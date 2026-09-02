export const PUBLIC_RECRUITMENT_REQUEST_MAX_BYTES = 4_250_000

export const PUBLIC_RECRUITMENT_REQUEST_TOO_LARGE = 'RECRUITMENT_PUBLIC_REQUEST_TOO_LARGE'

export class BoundedRequestBodyError extends Error {
  readonly code = PUBLIC_RECRUITMENT_REQUEST_TOO_LARGE
  readonly status = 413 as const

  constructor() {
    super(PUBLIC_RECRUITMENT_REQUEST_TOO_LARGE)
    this.name = 'BoundedRequestBodyError'
  }
}

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

function parseDeclaredLength(value: string | null): bigint | null {
  if (value === null || !/^\d+$/.test(value)) return null
  try {
    return BigInt(value)
  } catch {
    return null
  }
}

function copySafeHeaders(headers: Headers): Headers {
  const safe = new Headers()
  for (const [name, value] of headers) {
    if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase())) safe.set(name, value)
  }
  return safe
}

function reconstructRequest(request: Request, bytes: Uint8Array): Request {
  return new Request(request.url, {
    method: request.method,
    headers: copySafeHeaders(request.headers),
    body: bytes as BodyInit,
    credentials: request.credentials,
    cache: request.cache,
    redirect: request.redirect,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    integrity: request.integrity,
  })
}

export async function readBoundedRequest(
  request: Request,
  maxBytes = PUBLIC_RECRUITMENT_REQUEST_MAX_BYTES,
): Promise<Request> {
  const declaredLength = parseDeclaredLength(request.headers.get('content-length'))
  if (declaredLength !== null && declaredLength > BigInt(maxBytes)) throw new BoundedRequestBodyError()

  if (!request.body) return reconstructRequest(request, new Uint8Array())

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value || value.byteLength === 0) continue

      const nextTotal = total + value.byteLength
      if (nextTotal > maxBytes) {
        const remaining = maxBytes + 1 - total
        if (remaining > 0) chunks.push(value.slice(0, remaining))
        await reader.cancel().catch(() => undefined)
        throw new BoundedRequestBodyError()
      }
      chunks.push(value)
      total = nextTotal
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return reconstructRequest(request, bytes)
}
