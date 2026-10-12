import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { requireComponentLibraryAccess } from '@/lib/payroll/component-library-access'
import { renderPayrun01PayslipPdfPreviewForRun } from '@/lib/payroll/payrun01-service'
import { SyntheticPayrollServiceError } from '@/lib/payroll/synthetic-calculation-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Download-Options': 'noopen',
}

function secure(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(RESPONSE_HEADERS)) response.headers.set(key, value)
  return response
}

function unavailable(status: number): NextResponse {
  return secure(NextResponse.json({ error: 'PAYROLL_PAYSLIP_PREVIEW_UNAVAILABLE' }, { status }))
}

export async function GET(
  request: Request,
  context: { readonly params: Promise<{ readonly runId: string }> },
): Promise<NextResponse> {
  const { runId } = await context.params
  if (!UUID_PATTERN.test(runId)) return unavailable(400)

  try {
    const access = await requireComponentLibraryAccess(false)
    const preview = await renderPayrun01PayslipPdfPreviewForRun({
      scope: access.scope,
      payrollAdministrationId: access.administration.id,
      actorUserId: access.actorUserId,
      runId,
    })
    const fileName = preview.file_name.replace(/[\r\n"\\]/g, '_')
    const disposition = new URL(request.url).searchParams.get('download') === '1' ? 'attachment' : 'inline'
    return secure(new NextResponse(Buffer.from(preview.artifact_bytes), {
      status: 200,
      headers: {
        'Content-Type': preview.content_type,
        'Content-Disposition': `${disposition}; filename="${fileName}"`,
      },
    }))
  } catch (error) {
    const permissionResponse = permissionErrorResponse(error)
    if (permissionResponse) return secure(permissionResponse)
    if (error instanceof SyntheticPayrollServiceError
      && (error.code === 'PAYROLL_INPUT_INVALID' || error.code === 'PAYROLL_CALCULATION_BLOCKED')) return unavailable(404)
    return unavailable(503)
  }
}
