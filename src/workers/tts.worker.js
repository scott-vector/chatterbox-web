import { ChatterboxModel, AutoProcessor, Tensor } from '@huggingface/transformers'

const MODEL_ID = 'onnx-community/chatterbox-ONNX'

let model = null
let processor = null
const speakerCache = new Map()

// ---------------------------------------------------------------------------
// Stall-resilient fetch: wraps the body stream with a per-chunk read timeout.
// If no data arrives for STALL_MS, the connection is aborted so the caller
// (transformers.js from_pretrained) surfaces an error we can retry on.
// ---------------------------------------------------------------------------
const STALL_MS = 15_000
const MAX_RETRIES = 3
const _origFetch = self.fetch.bind(self)

self.fetch = async function stallGuardFetch(input, init = {}) {
  const url = typeof input === 'string' ? input : input?.url || ''
  const isOnnx = url.includes('.onnx')

  if (!isOnnx) return _origFetch(input, init)

  const filename = url.split('/').pop()

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await _origFetch(input, init)
      if (!resp.ok || !resp.body) return resp

      // Wrap the body with stall detection
      const reader = resp.body.getReader()
      const stream = new ReadableStream({
        async pull(controller) {
          const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('STALL')), STALL_MS),
          )
          try {
            const { done, value } = await Promise.race([reader.read(), timeout])
            if (done) { controller.close(); return }
            controller.enqueue(value)
          } catch {
            reader.cancel().catch(() => {})
            controller.error(new Error('STALL'))
          }
        },
      })

      return new Response(stream, {
        headers: resp.headers,
        status: resp.status,
        statusText: resp.statusText,
      })
    } catch (err) {
      const isStall = err?.message === 'STALL' || err?.name === 'AbortError'
      if (attempt < MAX_RETRIES && isStall) {
        console.warn(`[tts.worker] Download stalled on ${filename}, clearing cache & retrying (${attempt}/${MAX_RETRIES})…`)
        await clearCacheFor(filename)
        continue
      }
      throw err
    }
  }

  // Fallback (shouldn't reach here)
  return _origFetch(input, init)
}

async function clearCacheFor(fileHint) {
  try {
    for (const name of await caches.keys()) {
      const cache = await caches.open(name)
      for (const req of await cache.keys()) {
        if (req.url.includes(fileHint)) {
          console.log(`[tts.worker] Cleared cache: ${req.url}`)
          await cache.delete(req)
        }
      }
    }
  } catch (e) {
    console.warn('[tts.worker] Cache clear failed:', e.message)
  }
}

// ---------------------------------------------------------------------------

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

// Only language_model has quantized variants in the repo.
// Other sessions (embed_tokens, speech_encoder, conditional_decoder) are fp32 only.
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
  // encode_speech expects a Tensor with shape [1, num_samples]
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

  // Processor returns { input_ids, attention_mask } for text-only call
  const inputs = await processor._call(text)

  // generate() takes input_ids, attention_mask, speaker embeddings, and exaggeration
  // It returns a waveform Tensor directly
  // max_new_tokens=256 matches the reference implementation (default is ~20 which produces <0.2s)
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
