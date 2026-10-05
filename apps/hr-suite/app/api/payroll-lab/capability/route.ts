import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { resolveRequestOrigin } from '@/lib/auth/request-origin'
import {
  PayrollLabUnavailableError,
  updatePayrollLabAdministrationCapability,
} from '@/lib/payroll/access'

const requestSchema = z.object({ enabled: z.boolean() }).strict()

function jsonResponse(body: unknown, status: number): NextResponse {
  const response = NextResponse.json(body, { status })
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  return response
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const origin = resolveRequestOrigin({
    canonicalUrl: process.env.NEXT_PUBLIC_APP_URL,
    fallbackUrl: request.url,
    forwardedHost: request.headers.get('x-forwarded-host'),
    forwardedProtocol: request.headers.get('x-forwarded-proto'),
    host: request.headers.get('host') ?? request.nextUrl.host,
  })
  if (request.headers.get('origin') !== origin) {
    return jsonResponse({ error: 'PAYROLL_LAB_FORBIDDEN' }, 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'PAYROLL_LAB_INPUT_INVALID' }, 400)
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) return jsonResponse({ error: 'PAYROLL_LAB_INPUT_INVALID' }, 400)

  try {
    const administration = await updatePayrollLabAdministrationCapability(parsed.data.enabled)
    if (!administration) return jsonResponse({ error: 'PAYROLL_LAB_NOT_AVAILABLE' }, 404)
    return jsonResponse({ data: { capabilityEnabled: administration.capabilityEnabled } }, 200)
  } catch (error) {
    const permissionResponse = permissionErrorResponse(error)
    if (permissionResponse) {
      permissionResponse.headers.set('Cache-Control', 'no-store')
      permissionResponse.headers.set('Referrer-Policy', 'no-referrer')
      permissionResponse.headers.set('X-Content-Type-Options', 'nosniff')
      return permissionResponse
    }
    if (error instanceof PayrollLabUnavailableError) {
      return jsonResponse({ error: 'PAYROLL_LAB_UNAVAILABLE' }, 503)
    }
    return jsonResponse({ error: 'PAYROLL_LAB_UNAVAILABLE' }, 503)
  }
}
