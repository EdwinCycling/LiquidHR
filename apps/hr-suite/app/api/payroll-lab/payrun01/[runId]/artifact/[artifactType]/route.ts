import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { requireComponentLibraryAccess } from '@/lib/payroll/component-library-access'
import {
  getPayrun01PayslipPdfArtifactForRun,
  getPayrun01TechnicalJsonArtifactForRun,
} from '@/lib/payroll/payrun01-service'
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

function secureResponse(response: NextResponse): NextResponse {
  for (const [name, value] of Object.entries(RESPONSE_HEADERS)) response.headers.set(name, value)
  return response
}

function errorResponse(status: number): NextResponse {
  return secureResponse(NextResponse.json({ error: 'PAYRUN01_ARTIFACT_UNAVAILABLE' }, { status }))
}

export async function GET(
  _request: Request,
  context: { readonly params: Promise<{ readonly runId: string; readonly artifactType: string }> },
): Promise<NextResponse> {
  const { runId, artifactType } = await context.params
  if (!UUID_PATTERN.test(runId) || !['TECHNICAL_JSON', 'PAYSLIP_PDF'].includes(artifactType)) return errorResponse(400)

  try {
    const access = await requireComponentLibraryAccess(false)
    const input = {
      scope: access.scope,
      payrollAdministrationId: access.administration.id,
      actorUserId: access.actorUserId,
      runId,
    }
    const artifact = artifactType === 'TECHNICAL_JSON'
      ? await getPayrun01TechnicalJsonArtifactForRun(input)
      : await getPayrun01PayslipPdfArtifactForRun(input)
    if (!artifact) return errorResponse(404)
    return secureResponse(new NextResponse(Buffer.from(artifact.artifact_bytes), {
      status: 200,
      headers: {
        'Content-Type': artifact.content_type,
        'Content-Disposition': `attachment; filename="${artifact.file_name}"`,
      },
    }))
  } catch (error) {
    const permissionResponse = permissionErrorResponse(error)
    if (permissionResponse) return secureResponse(permissionResponse)
    if (error instanceof SyntheticPayrollServiceError
      && (error.code === 'PAYROLL_INPUT_INVALID' || error.code === 'PAYROLL_CALCULATION_BLOCKED')) {
      return errorResponse(404)
    }
    return errorResponse(503)
  }
}
