import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { requireComponentLibraryAccess } from '@/lib/payroll/component-library-access'
import { renderPayrollProfessionalPayslipConceptPreviewForRun } from '@/lib/payroll/payroll-professional-service'
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

function unavailable(status: number, error = 'PAYROLL_CONCEPT_PAYSLIP_UNAVAILABLE'): NextResponse {
  return secure(NextResponse.json({ error }, { status }))
}

export async function GET(
  request: Request,
  context: { readonly params: Promise<{ readonly runId: string }> },
): Promise<NextResponse> {
  const { runId } = await context.params
  if (!UUID_PATTERN.test(runId)) return unavailable(400)

  try {
    const access = await requireComponentLibraryAccess(true)
    const preview = await renderPayrollProfessionalPayslipConceptPreviewForRun({
      scope: access.scope,
      payrollAdministrationId: access.administration.id,
      actorUserId: access.actorUserId,
      runId,
    })
    if (!preview) return unavailable(404)

    const fileName = preview.file_name.replace(/[\r\n"\\]/g, '_')
    const disposition = new URL(request.url).searchParams.get('download') === '1' ? 'attachment' : 'inline'
    const response = new NextResponse(Buffer.from(preview.artifact_bytes), {
      status: 200,
      headers: {
        'Content-Type': preview.content_type,
        'Content-Disposition': `${disposition}; filename="${fileName}"`,
        'X-Payroll-Source-SHA256': preview.source_hash,
        'X-Payroll-Input-SHA256': preview.input_hash,
        'X-Payroll-Result-SHA256': preview.result_hash,
        'X-Payroll-Document-SHA256': preview.document_hash,
      },
    })
    return secure(response)
  } catch (error) {
    const permissionResponse = permissionErrorResponse(error)
    if (permissionResponse) return secure(permissionResponse)
    if (error instanceof SyntheticPayrollServiceError) {
      if (error.reasonCode === 'PAYROLL_SOURCE_CHANGED_RECALCULATE_REQUIRED') {
        return unavailable(409, 'PAYROLL_SOURCE_CHANGED_RECALCULATE_REQUIRED')
      }
      if (error.code === 'PAYROLL_INPUT_INVALID' || error.code === 'PAYROLL_CALCULATION_BLOCKED') return unavailable(404)
    }
    return unavailable(503)
  }
}
