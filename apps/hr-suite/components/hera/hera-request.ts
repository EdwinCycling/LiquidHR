export async function requestJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 15_000,
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error('HERA_REQUEST_TIMEOUT'))
    }, timeoutMs)
  })

  try {
    const response = await Promise.race([
      fetcher(url, { ...init, signal: controller.signal }),
      timeout,
    ])
    if (!response.ok) throw new Error('HERA_REQUEST_FAILED')
    return response.json() as Promise<T>
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}
