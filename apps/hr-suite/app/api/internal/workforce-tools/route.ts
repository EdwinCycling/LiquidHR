import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse, requireAuthContext } from '@/lib/auth/permissions'
import { dispatchWorkforceTool, WorkforceToolDispatchError } from '@/lib/workforce-tools/registry'

const MAX_BODY_BYTES = 16_384

class WorkforceRequestError extends Error {
  constructor(readonly code: 'INVALID' | 'TOO_LARGE') {
    super(code)
  }
}
const requestSchema = z.object({
  toolId: z.string().min(1).max(160),
  input: z.unknown(),
}).strict()

async function readBoundedJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader()
  if (!reader) throw new WorkforceRequestError('INVALID')

  const chunks: Uint8Array[] = []
  let byteLength = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    byteLength += value.byteLength
    if (byteLength > MAX_BODY_BYTES) {
      await reader.cancel()
      throw new WorkforceRequestError('TOO_LARGE')
    }
    chunks.push(value)
  }

  const bytes = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    throw new WorkforceRequestError('INVALID')
  }
}

function failedResponse(error: unknown): NextResponse {
  const permissionResponse = permissionErrorResponse(error)
  if (permissionResponse) {
    const code = permissionResponse.status === 401 ? 'AUTHENTICATION_REQUIRED'
      : permissionResponse.status === 403 ? 'ACCESS_DENIED'
        : permissionResponse.status === 409 ? 'CONTEXT_SELECTION_REQUIRED'
          : null
    if (code) {
      const status = permissionResponse.status
      return NextResponse.json({ error: code }, { status, headers: { 'Cache-Control': 'no-store' } })
    }
  }
  if (error instanceof WorkforceToolDispatchError) {
    const status = error.code === 'TOOL_NOT_FOUND' ? 404
      : error.code === 'MODULE_INACTIVE' ? 404
      : error.code === 'RESOURCE_NOT_FOUND' ? 404
      : error.code === 'INPUT_INVALID' ? 400
        : error.code === 'AUTHENTICATION_REQUIRED' ? 401
          : error.code === 'ACCESS_DENIED' ? 403
            : 500
    return NextResponse.json({ error: error.code }, { status, headers: { 'Cache-Control': 'no-store' } })
  }
  if (error instanceof WorkforceRequestError) {
    const status = error.code === 'TOO_LARGE' ? 413 : 400
    const code = error.code === 'TOO_LARGE' ? 'WORKFORCE_REQUEST_TOO_LARGE' : 'WORKFORCE_REQUEST_INVALID'
    return NextResponse.json({ error: code }, { status, headers: { 'Cache-Control': 'no-store' } })
  }
  return NextResponse.json({ error: 'WORKFORCE_TOOL_EXECUTION_FAILED' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
}

/** Cookie-authenticated internal BFF. Each tool rechecks its own permission and module. */
export async function POST(request: Request): Promise<NextResponse> {
  let sameOrigin = false
  try {
    sameOrigin = request.headers.get('origin') === new URL(request.url).origin
  } catch {
    sameOrigin = false
  }
  if (!sameOrigin) {
    return NextResponse.json({ error: 'WORKFORCE_REQUEST_FORBIDDEN' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const body = requestSchema.safeParse(await readBoundedJson(request))
    if (!body.success) {
      return NextResponse.json({ error: 'WORKFORCE_REQUEST_INVALID' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    }
    await requireAuthContext()
    const data = await dispatchWorkforceTool(body.data.toolId, body.data.input)
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return failedResponse(error)
  }
}
