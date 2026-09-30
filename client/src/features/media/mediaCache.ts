const DB_NAME = 'syncup-media-cache'
const STORE_NAME = 'encrypted-media'
const DB_VERSION = 1
const MAX_CACHE_BYTES = 128 * 1024 * 1024

type CachedMedia = {
  id: string
  ciphertext: ArrayBuffer
  size: number
  lastAccessedAt: number
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('lastAccessedAt', 'lastAccessedAt')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open media cache.'))
  })
}

async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, mode)
    const request = run(tx.objectStore(STORE_NAME))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Media cache operation failed.'))
    tx.oncomplete = () => database.close()
    tx.onerror = () => reject(tx.error ?? new Error('Media cache transaction failed.'))
  })
}

export async function getCachedCiphertext(id: string): Promise<ArrayBuffer | null> {
  if (!('indexedDB' in window)) return null
  const entry = await transaction<CachedMedia | undefined>('readonly', (store) => store.get(id))
  if (!entry) return null
  void transaction('readwrite', (store) => store.put({ ...entry, lastAccessedAt: Date.now() })).catch(() => undefined)
  return entry.ciphertext
}

export async function cacheCiphertext(id: string, ciphertext: ArrayBuffer) {
  if (!('indexedDB' in window)) return
  await transaction('readwrite', (store) => store.put({
    id,
    ciphertext,
    size: ciphertext.byteLength,
    lastAccessedAt: Date.now(),
  }))
  void pruneMediaCache().catch(() => undefined)
}

async function pruneMediaCache() {
  const database = await openDatabase()
  const entries = await new Promise<CachedMedia[]>((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => database.close()
  })
  let total = entries.reduce((sum, entry) => sum + entry.size, 0)
  if (total <= MAX_CACHE_BYTES) return
  const oldestFirst = entries.sort((left, right) => left.lastAccessedAt - right.lastAccessedAt)
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    for (const entry of oldestFirst) {
      if (total <= MAX_CACHE_BYTES) break
      store.delete(entry.id)
      total -= entry.size
    }
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => reject(tx.error)
  })
}
