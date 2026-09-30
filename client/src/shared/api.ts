let refreshInFlight: Promise<boolean> | null = null

function refreshSession() {
  return fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'same-origin',
  }).then((refreshResponse) => refreshResponse.ok).catch(() => false)
}

async function refreshAfterUnauthorized(path: string, response: Response, retry: () => Promise<Response>) {
  if (
    response.status !== 401
    || path === '/api/auth/refresh'
    || path === '/api/auth/sign-in'
    || path === '/api/auth/sign-up'
  ) return response

  refreshInFlight ??= (async () => {
    if ('locks' in navigator) {
      return navigator.locks.request('syncup-session-refresh', refreshSession)
    }
    return refreshSession()
  })().finally(() => { refreshInFlight = null })
  return await refreshInFlight ? retry() : response
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const makeRequest = () => fetch(path, {
      ...options,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...options.headers },
    })
  const response = await refreshAfterUnauthorized(path, await makeRequest(), makeRequest)
  if (!response.ok) {
    const result = await response.json().catch(() => null) as {
      error?: { message?: string }
    } | null
    throw new Error(result?.error?.message ?? 'Something went wrong. Please try again.')
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export async function apiUpload(path: string, body: BodyInit): Promise<void> {
  const makeRequest = () => fetch(path, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/octet-stream' },
    body,
  })
  const response = await refreshAfterUnauthorized(path, await makeRequest(), makeRequest)
  if (!response.ok) {
    const result = await response.json().catch(() => null) as {
      error?: { message?: string }
    } | null
    throw new Error(result?.error?.message ?? 'Encrypted upload failed. Please try again.')
  }
}
