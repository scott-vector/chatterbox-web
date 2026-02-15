// ---------------------------------------------------------------------------
// IMPORTANT: fetch override MUST be installed BEFORE importing transformers.js
// because transformers.js captures a reference to fetch during module init.
// That's why we use dynamic import() below instead of a static import.
// ---------------------------------------------------------------------------

const MODEL_ID = 'onnx-community/chatterbox-ONNX'

let ChatterboxModel, AutoProcessor, Tensor, env
let model = null
let processor = null
const speakerCache = new Map()

// ---------------------------------------------------------------------------
// Minimal fetch override: intercepts .onnx downloads to report byte-level
// progress back to the main thread. No stall detection here — that's handled
// by the main thread watchdog in tts-client.js.
// ---------------------------------------------------------------------------
const _realFetch = self.fetch.bind(self)

self.fetch = async function progressFetch(input, init = {}) {
  const url = typeof input === 'string' ? input : input?.url || ''
  if (!url.includes('.onnx')) return _realFetch(input, init)

  const filePathMatch = url.match(/\/(onnx\/[^?#]+)/)
  const filePath = filePathMatch ? filePathMatch[1] : url.split('/').pop()

  const resp = await _realFetch(input, init)
  if (!resp.ok || !resp.body) return resp

  const total = parseInt(resp.headers.get('content-length') || '0', 10)
  const reader = resp.body.getReader()
  const chunks = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value || value.length === 0) continue

    chunks.push(value)
    received += value.length

    const pct = total > 0 ? Math.round((received / total) * 100) : 0
    self.postMessage({
      type: 'load:progress',
      data: { status: 'progress', file: filePath, progress: pct, loaded: received, total },
    })
  }

  self.postMessage({
    type: 'load:progress',
    data: { status: 'done', file: filePath, loaded: received, total },
  })

  return new Response(new Blob(chunks), {
    headers: resp.headers,
    status: resp.status,
    statusText: resp.statusText,
  })
}

globalThis.fetch = self.fetch

// ---------------------------------------------------------------------------

async function initTransformers() {
  const mod = await import('@huggingface/transformers')
  ChatterboxModel = mod.ChatterboxModel
  AutoProcessor = mod.AutoProcessor
  Tensor = mod.Tensor
  env = mod.env
}
const _transformersReady = initTransformers()

async function checkWebGPU() {
  if (!navigator.gpu) return { available: false, reason: 'WebGPU not supported' }
  try {
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) return { available: false, reason: 'No GPU adapter found' }
    return { available: true }
  } catch (e) {
    return { available: false, reason: e.message }
  }
}

const DTYPE_CONFIGS = {
  wasm: {
    embed_tokens: 'fp32',
    speech_encoder: 'fp32',
    language_model: 'q4',
    conditional_decoder: 'fp32',
  },
  webgpu: {
    embed_tokens: 'fp32',
    speech_encoder: 'fp32',
    language_model: 'q4f16',
    conditional_decoder: 'fp32',
  },
}

async function load(data) {
  await _transformersReady

  const { device } = data
  const webgpu = await checkWebGPU()
  const useDevice = device || (webgpu.available ? 'webgpu' : 'wasm')
  const useDtype = DTYPE_CONFIGS[useDevice] || DTYPE_CONFIGS.wasm

  processor = await AutoProcessor.from_pretrained(MODEL_ID)

  model = await ChatterboxModel.from_pretrained(MODEL_ID, {
    device: useDevice,
    dtype: useDtype,
    progress_callback: (progress) => {
      self.postMessage({ type: 'load:progress', data: progress })
    },
  })

  self.postMessage({
    type: 'load:complete',
    data: { device: useDevice, dtype: useDevice, webgpu: webgpu.available },
  })
}

async function encodeSpeaker(data) {
  const { id, audioData } = data
  if (!model) throw new Error('Model not loaded')

  const audioFloat32 = new Float32Array(audioData)
  const audioTensor = new Tensor('float32', audioFloat32, [1, audioFloat32.length])
  const result = await model.encode_speech(audioTensor)
  speakerCache.set(id, result)

  self.postMessage({ type: 'encode_speaker:complete', data: { id } })
}

async function generate(data) {
  const { text, speakerId, exaggeration = 0.5 } = data
  if (!model || !processor) throw new Error('Model not loaded')

  const speakerEmbeddings = speakerCache.get(speakerId)
  if (!speakerEmbeddings) throw new Error(`Speaker "${speakerId}" not found in cache`)

  const inputs = await processor._call(text)

  let result
  try {
    result = await model.generate({
      ...inputs,
      ...speakerEmbeddings,
      exaggeration,
      max_new_tokens: 256,
      return_timestamps: 'word',
    })
  } catch {
    result = await model.generate({
      ...inputs,
      ...speakerEmbeddings,
      exaggeration,
      max_new_tokens: 256,
    })
  }

  const waveform = result?.waveform || result
  const wordTimestamps = Array.isArray(result?.word_timestamps)
    ? result.word_timestamps
    : null

  const waveformData = waveform.data
  const buffer = waveformData.buffer.slice(
    waveformData.byteOffset,
    waveformData.byteOffset + waveformData.byteLength,
  )

  self.postMessage(
    { type: 'generate:complete', data: { waveform: buffer, wordTimestamps } },
    [buffer],
  )
}

self.addEventListener('message', async (e) => {
  const { type, data } = e.data
  try {
    switch (type) {
      case 'check_webgpu': {
        await _transformersReady
        const result = await checkWebGPU()
        self.postMessage({ type: 'check_webgpu:complete', data: result })
        break
      }
      case 'load':
        await load(data)
        break
      case 'encode_speaker':
        await encodeSpeaker(data)
        break
      case 'generate':
        await generate(data)
        break
      default:
        self.postMessage({ type: 'error', data: { message: `Unknown type: ${type}` } })
    }
  } catch (err) {
    self.postMessage({ type: 'error', data: { message: err.message, stack: err.stack } })
  }
})
