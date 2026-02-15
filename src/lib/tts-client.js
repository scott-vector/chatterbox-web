let worker = null
let listeners = new Map()
let progressListeners = new Set()
let resetListeners = new Set()
let modelLoaded = false

// --- Stall watchdog ---
// Runs on the MAIN THREAD where setInterval always works (unlike the worker
// where reader.read() can block the event loop). If no progress message
// arrives for STALL_TIMEOUT_MS, we kill the worker and retry.
const STALL_TIMEOUT_MS = 20_000  // 20s with no progress = stalled
const MAX_LOAD_RETRIES = 3
let stallTimer = null
let lastProgressTime = 0
let loadRetryCount = 0
let currentLoadOptions = null
let currentLoadCallbacks = null

function startStallWatchdog() {
  stopStallWatchdog()
  lastProgressTime = Date.now()
  stallTimer = setInterval(() => {
    if (!currentLoadCallbacks) {
      stopStallWatchdog()
      return
    }
    const elapsed = Date.now() - lastProgressTime
    if (elapsed > STALL_TIMEOUT_MS) {
      console.warn(`[tts-client] Download stalled (${(elapsed / 1000).toFixed(0)}s no progress), retrying…`)
      handleStall()
    }
  }, 3_000)
}

function stopStallWatchdog() {
  if (stallTimer) {
    clearInterval(stallTimer)
    stallTimer = null
  }
}

async function purgeTransformersCache() {
  try {
    const names = await caches.keys()
    for (const name of names) {
      if (name.includes('transformers')) {
        console.log(`[tts-client] Purging stale cache: ${name}`)
        await caches.delete(name)
      }
    }
  } catch (e) {
    console.warn('[tts-client] Cache purge failed:', e.message)
  }
}

async function handleStall() {
  stopStallWatchdog()
  loadRetryCount++

  // Kill the stuck worker
  if (worker) {
    worker.terminate()
    worker = null
    listeners.clear()
  }

  if (loadRetryCount > MAX_LOAD_RETRIES) {
    const cbs = currentLoadCallbacks
    currentLoadCallbacks = null
    currentLoadOptions = null
    if (cbs) cbs.reject(new Error(`Model download stalled ${MAX_LOAD_RETRIES} times. Check your network connection.`))
    return
  }

  console.log(`[tts-client] Retry ${loadRetryCount}/${MAX_LOAD_RETRIES} — purging cache and restarting worker…`)

  // Purge cache so the stalled partial download isn't served from cache
  await purgeTransformersCache()

  // Notify UI to reset progress bars
  resetListeners.forEach((fn) => fn())

  // Restart the load in a new worker
  try {
    const result = await sendLoad(currentLoadOptions)
    modelLoaded = true
    const cbs = currentLoadCallbacks
    currentLoadCallbacks = null
    currentLoadOptions = null
    if (cbs) cbs.resolve(result)
  } catch (err) {
    const cbs = currentLoadCallbacks
    currentLoadCallbacks = null
    currentLoadOptions = null
    if (cbs) cbs.reject(err)
  }
}

// --- Worker management ---

function getWorker() {
  if (!worker) {
    if (modelLoaded) {
      modelLoaded = false
      resetListeners.forEach((fn) => fn())
    }

    worker = new Worker(new URL('../workers/tts.worker.js', import.meta.url), { type: 'module' })
    worker.addEventListener('message', (e) => {
      const { type, data } = e.data

      if (type === 'load:progress') {
        // Reset the stall watchdog on every progress message
        lastProgressTime = Date.now()

        // Once a file download finishes, stop the watchdog — ONNX compilation
        // can take minutes with no progress events and that's normal.
        if (data.status === 'done' && data.file) {
          console.log(`[tts-client] ${data.file} download complete, pausing watchdog for compilation`)
          stopStallWatchdog()
        }

        progressListeners.forEach((fn) => fn(data))
        return
      }

      if (type === 'error') {
        listeners.forEach((cbs) => {
          cbs.reject(new Error(data.message))
        })
        listeners.clear()
        return
      }

      const cbs = listeners.get(type)
      if (cbs) {
        cbs.resolve(data)
        listeners.delete(type)
      }
    })

    worker.addEventListener('error', (e) => {
      const msg = e.message || 'Worker crashed'
      listeners.forEach((cbs) => {
        cbs.reject(new Error(msg))
      })
      listeners.clear()
    })
  }
  return worker
}

function send(type, data, transferable = []) {
  const responseType = `${type}:complete`
  return new Promise((resolve, reject) => {
    listeners.set(responseType, { resolve, reject })
    getWorker().postMessage({ type, data }, transferable)
  })
}

// Internal send for load — used by both the public API and the retry logic
function sendLoad(options = {}) {
  return send('load', options)
}

export const ttsClient = {
  get isModelLoaded() {
    return modelLoaded
  },

  checkWebGPU() {
    return send('check_webgpu')
  },

  async load(options = {}) {
    loadRetryCount = 0
    currentLoadOptions = options

    return new Promise((resolve, reject) => {
      currentLoadCallbacks = { resolve, reject }

      // Start the stall watchdog BEFORE sending
      startStallWatchdog()

      sendLoad(options)
        .then((result) => {
          stopStallWatchdog()
          modelLoaded = true
          // Only resolve if the watchdog hasn't already taken over
          if (currentLoadCallbacks) {
            currentLoadCallbacks = null
            currentLoadOptions = null
            resolve(result)
          }
        })
        .catch((err) => {
          stopStallWatchdog()
          if (currentLoadCallbacks) {
            currentLoadCallbacks = null
            currentLoadOptions = null
            reject(err)
          }
        })
    })
  },

  encodeSpeaker(id, audioData) {
    const buffer = audioData instanceof Float32Array ? audioData.buffer : audioData
    return send('encode_speaker', {
      id,
      audioData: buffer,
    })
  },

  generate(text, speakerId, exaggeration = 0.5) {
    return send('generate', { text, speakerId, exaggeration })
  },

  onProgress(fn) {
    progressListeners.add(fn)
    return () => progressListeners.delete(fn)
  },

  onReset(fn) {
    resetListeners.add(fn)
    return () => resetListeners.delete(fn)
  },

  terminate() {
    stopStallWatchdog()
    if (worker) {
      worker.terminate()
      worker = null
      modelLoaded = false
      listeners.clear()
      progressListeners.clear()
    }
  },
}
