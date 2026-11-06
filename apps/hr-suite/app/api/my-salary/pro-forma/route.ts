import { AuthenticationError, AuthorizationError } from '@/lib/auth/permissions'
import { resolveRequestOrigin } from '@/lib/auth/request-origin'
import { PayrollProFormaError, calculateMySalaryProForma, payrollProFormaScenarioSchema } from '@/lib/payroll/payroll-pro-forma-service'

export const dynamic = 'force-dynamic'

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: {
    'Cache-Control': 'no-store, max-age=0',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  } })
}

export async function POST(request: Request): Promise<Response> {
  const origin = resolveRequestOrigin({
    canonicalUrl: process.env.NEXT_PUBLIC_APP_URL,
    fallbackUrl: request.url,
    forwardedHost: request.headers.get('x-forwarded-host'),
    forwardedProtocol: request.headers.get('x-forwarded-proto'),
    host: request.headers.get('host'),
  })
  if (request.headers.get('origin') !== origin) return json({ error: 'SAME_ORIGIN_REQUIRED' }, 403)

  const text = await request.text()
  if (text.length > 2048) return json({ error: 'REQUEST_TOO_LARGE' }, 413)

  let body: unknown
  try { body = JSON.parse(text) as unknown } catch { return json({ error: 'INVALID_REQUEST' }, 400) }
  const parsed = payrollProFormaScenarioSchema.safeParse(body)
  if (!parsed.success) return json({ error: 'INVALID_SCENARIO' }, 400)

  try {
    return json(await calculateMySalaryProForma(parsed.data))
  } catch (error) {
    if (error instanceof AuthenticationError) return json({ error: 'AUTHENTICATION_REQUIRED' }, 401)
    if (error instanceof AuthorizationError) return json({ error: 'SALARY_ACCESS_DENIED' }, 403)
    if (error instanceof PayrollProFormaError) return json({ error: error.code }, error.status)
    const status = typeof error === 'object' && error !== null && 'status' in error
      && (error.status === 403 || error.status === 404 || error.status === 409 || error.status === 503)
      ? error.status
      : 503
    return json({ error: status === 403 ? 'SALARY_ACCESS_DENIED' : 'SOURCE_UNAVAILABLE' }, status)
  }
}
