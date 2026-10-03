import { z, type ZodRawShape, type ZodType } from 'zod'
import { ApiRequestTooLargeError, ApiValidationError } from './errors'

export const API_DEFAULT_JSON_BODY_MAX_BYTES = 1_048_576

type ApiQueryValue = string | string[]
type ApiQueryInput = Record<string, ApiQueryValue>

function parseDeclaredLength(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}

function isJsonContentType(value: string | null): boolean {
  if (value === null) return false
  const mediaType = value.split(';', 1)[0]?.trim().toLowerCase()
  return mediaType === 'application/json' || mediaType.endsWith('+json')
}

function queryInput(request: Request): ApiQueryInput {
  const input: ApiQueryInput = Object.create(null) as ApiQueryInput
  for (const [key, value] of new URL(request.url).searchParams.entries()) {
    const current = input[key]
    if (current === undefined) input[key] = value
    else if (Array.isArray(current)) input[key] = [...current, value]
    else input[key] = [current, value]
  }
  return input
}

async function readBoundedBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  const declaredLength = parseDeclaredLength(request.headers.get('content-length'))
  if (declaredLength !== null && declaredLength > maxBytes) throw new ApiRequestTooLargeError()

  if (!request.body) return new Uint8Array()

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
        await reader.cancel().catch(() => undefined)
        throw new ApiRequestTooLargeError()
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
  return bytes
}

function decodeJson(bytes: Uint8Array): unknown {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new ApiValidationError()
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new ApiValidationError()
  }
}

/** Maakt een Zod-object dat onbekende requestvelden afwijst. */
export function strictApiObject<Shape extends ZodRawShape>(shape: Shape) {
  return z.object(shape).strict()
}

export function parseApiInput<T>(input: unknown, schema: ZodType<T>): T {
  const result = schema.safeParse(input)
  if (!result.success) throw new ApiValidationError(result.error.issues.length)
  return result.data
}

export function parseApiQuery<T>(request: Request, schema: ZodType<T>): T {
  return parseApiInput(queryInput(request), schema)
}

export async function parseApiJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
  maxBytes = API_DEFAULT_JSON_BODY_MAX_BYTES,
): Promise<T> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new RangeError('maxBytes must be a positive safe integer.')
  if (!isJsonContentType(request.headers.get('content-type'))) throw new ApiValidationError()
  const bytes = await readBoundedBody(request, maxBytes)
  return parseApiInput(decodeJson(bytes), schema)
}
