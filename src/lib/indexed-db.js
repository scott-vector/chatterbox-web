const DB_NAME = 'chatterbox-browser-data'
const DB_VERSION = 1
const VOICE_STORE = 'referenceVoices'

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(VOICE_STORE)) {
        const store = db.createObjectStore(VOICE_STORE, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
  })
}

async function runTransaction(storeName, mode, handler) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const store = tx.objectStore(storeName)

    const result = handler(store)
    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  }).finally(() => db.close())
}

export async function saveReferenceVoice({ id, name, audioData, transcriptSyncDelaySec }) {
  const createdAt = Date.now()
  const voice = {
    id,
    name,
    audioData,
    createdAt,
    ...(Number.isFinite(transcriptSyncDelaySec) ? { transcriptSyncDelaySec } : {}),
  }

  await runTransaction(VOICE_STORE, 'readwrite', (store) => {
    store.put(voice)
  })
  return { ...voice }
}

export async function listReferenceVoices() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VOICE_STORE, 'readonly')
    const store = tx.objectStore(VOICE_STORE)
    const request = store.getAll()

    request.onsuccess = () => {
      const items = request.result
        .sort((a, b) => b.createdAt - a.createdAt)
      resolve(items)
    }
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => { db.close() }
  })
}

export async function getReferenceVoice(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VOICE_STORE, 'readonly')
    const store = tx.objectStore(VOICE_STORE)
    const request = store.get(id)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => { db.close() }
  })
}

export async function deleteReferenceVoice(id) {
  await runTransaction(VOICE_STORE, 'readwrite', (store) => {
    store.delete(id)
  })
}

export async function updateReferenceVoice(id, updates) {
  const existing = await getReferenceVoice(id)
  if (!existing) return null

  const nextVoice = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
  }

  await runTransaction(VOICE_STORE, 'readwrite', (store) => {
    store.put(nextVoice)
  })

  return nextVoice
}
