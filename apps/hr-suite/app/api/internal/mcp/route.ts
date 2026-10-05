import { apiJsonResponse, apiResponseHeaders } from '@/lib/api-v1/core/responses'
import { createApiRequestContext } from '@/lib/api-v1/core/request-context'
import {
  createWorkforceMcpHandler,
  isLoopbackMcpRequest,
  isWorkforceMcpEnabled,
} from '@/lib/workforce-tools/mcp-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const mcpHandler = createWorkforceMcpHandler()

function sameOriginIfProvided(request: Request): boolean {
  const origin = request.headers.get('origin')?.trim()
  if (!origin) return true

  try {
    return origin === new URL(request.url).origin
  } catch {
    return false
  }
}

function unavailableResponse(request: Request): Response {
  return apiJsonResponse(
    { error: 'MCP_UNAVAILABLE' },
    {
      status: 404,
      context: createApiRequestContext(request),
    },
  )
}

async function handle(request: Request): Promise<Response> {
  if (!isWorkforceMcpEnabled() || !isLoopbackMcpRequest(request) || !sameOriginIfProvided(request)) {
    return unavailableResponse(request)
  }

  const context = createApiRequestContext(request)
  try {
    const response = await mcpHandler.fetch(request)
    const headers = apiResponseHeaders(response.headers, context)
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  } catch {
    return apiJsonResponse(
      { error: 'MCP_REQUEST_FAILED' },
      {
        status: 500,
        context,
      },
    )
  }
}

export function GET(request: Request): Promise<Response> {
  return handle(request)
}

export function POST(request: Request): Promise<Response> {
  return handle(request)
}

export function DELETE(request: Request): Promise<Response> {
  return handle(request)
}
