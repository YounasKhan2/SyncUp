export type PendingMessage = {
  chatId: string
  localId: string
  idempotencyKey: string
  bodyCiphertext: string
  bodyNonce: string
  keyEnvelopes: Record<string, string>
  attachmentIds?: string[]
  attachments?: {
    id: string
    filename: string
    content_type: string
    size_bytes: number
    nonce: string | null
    key_envelope: string
    transport_version?: number
  }[]
  replyToId?: string
  createdAt: string
  attempts: number
  nextAttemptAt: number
}

const databaseName = 'syncup-local'
const databaseVersion = 1
let databasePromise: Promise<IDBDatabase> | null = null

function database() {
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'idempotencyKey' })
      }
      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'chatId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open the local message store.'))
    request.onblocked = () => reject(new Error('Close other SyncUp tabs to update local message storage.'))
  })
  return databasePromise
}

export async function listPendingMessages(): Promise<PendingMessage[]> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('outbox', 'readonly')
    const request = transaction.objectStore('outbox').getAll() as IDBRequest<PendingMessage[]>
    request.onsuccess = () => resolve(request.result.sort((left, right) => left.createdAt.localeCompare(right.createdAt)))
    request.onerror = () => reject(request.error ?? new Error('Unable to load queued messages.'))
  })
}

export async function savePendingMessage(message: PendingMessage) {
  const db = await database()
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('outbox', 'readwrite')
    transaction.objectStore('outbox').put(message)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save the message to your outbox.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Saving the message to your outbox was cancelled.'))
  })
}

export async function removePendingMessage(idempotencyKey: string) {
  const db = await database()
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('outbox', 'readwrite')
    transaction.objectStore('outbox').delete(idempotencyKey)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to remove the sent message from your outbox.'))
  })
}

export async function loadDraft(chatId: string): Promise<string> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const request = db.transaction('drafts', 'readonly').objectStore('drafts').get(chatId)
    request.onsuccess = () => resolve((request.result as { text?: string } | undefined)?.text ?? '')
    request.onerror = () => reject(request.error ?? new Error('Unable to restore this draft.'))
  })
}

export async function listAllDrafts(): Promise<Record<string, string>> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const request = db.transaction('drafts', 'readonly').objectStore('drafts').getAll()
    request.onsuccess = () => {
      const map: Record<string, string> = {}
      for (const row of request.result as { chatId: string; text: string }[]) {
        if (row.text) map[row.chatId] = row.text
      }
      resolve(map)
    }
    request.onerror = () => reject(request.error ?? new Error('Unable to load drafts.'))
  })
}

export async function saveDraft(chatId: string, text: string) {
  const db = await database()
  return new Promise<void>((resolve, reject) => {
    const store = db.transaction('drafts', 'readwrite').objectStore('drafts')
    if (text) store.put({ chatId, text })
    else store.delete(chatId)
    store.transaction.oncomplete = () => resolve()
    store.transaction.onerror = () => reject(store.transaction.error ?? new Error('Unable to save this draft.'))
  })
}
