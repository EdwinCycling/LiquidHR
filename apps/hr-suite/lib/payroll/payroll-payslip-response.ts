import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { SyntheticPayrollServiceError } from './synthetic-calculation-service'

type PayslipPdf = {
  readonly artifact_bytes: Uint8Array
  readonly content_type: 'application/pdf'
}

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, private',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'self'",
}

function withNoStore(response: NextResponse): NextResponse {
  for (const [name, value] of Object.entries(NO_STORE_HEADERS)) response.headers.set(name, value)
  return response
}

export function parsePayrollPeriodKey(value: string): { readonly year: number; readonly month: number } | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (year < 1900 || year > 9999) return null
  return { year, month }
}

export async function servePayrollPayslip(
  request: Request,
  periodKey: string,
  loadPdf: (year: number, month: number) => Promise<PayslipPdf | null>,
): Promise<NextResponse> {
  const period = parsePayrollPeriodKey(periodKey)
  if (!period) return withNoStore(NextResponse.json({ error: 'INVALID_PERIOD' }, { status: 400 }))

  try {
    const pdf = await loadPdf(period.year, period.month)
    if (!pdf) return withNoStore(new NextResponse(null, { status: 404 }))

    const disposition = new URL(request.url).searchParams.get('download') === '1' ? 'attachment' : 'inline'
    const filename = `liquidhr-loonstrook-${period.year}-${String(period.month).padStart(2, '0')}.pdf`
    const buffer = new ArrayBuffer(pdf.artifact_bytes.byteLength)
    new Uint8Array(buffer).set(pdf.artifact_bytes)
    return withNoStore(new NextResponse(buffer, {
      headers: {
        ...NO_STORE_HEADERS,
        'Content-Type': pdf.content_type,
        'Content-Disposition': `${disposition}; filename="${filename}"`,
      },
    }))
  } catch (error) {
    const permission = permissionErrorResponse(error)
    if (permission) return withNoStore(permission)
    if (error instanceof SyntheticPayrollServiceError) {
      const status = error.code === 'PAYROLL_INPUT_INVALID'
        || error.code === 'PAYROLL_CALCULATION_BLOCKED'
        || error.code === 'PAYROLL_SYNTHETIC_MODE_DISABLED'
        ? 404
        : 503
      return withNoStore(new NextResponse(null, { status }))
    }
    return withNoStore(new NextResponse(null, { status: 503 }))
  }
}
