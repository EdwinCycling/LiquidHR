import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { requireComponentLibraryAccess } from '@/lib/payroll/component-library-access'
import {
  getPayrun01TechnicalJsonArtifactForRun,
} from '@/lib/payroll/payrun01-service'
import {
  createPayrollProfessionalPayslipPdfArtifactForRun,
  getPayrollProfessionalPayslipPdfArtifactForRun,
} from '@/lib/payroll/payroll-professional-service'
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
  return secure(NextResponse.json({ error: 'PAYROLL_ARTIFACT_UNAVAILABLE' }, { status }))
}

export async function GET(
  _request: Request,
  context: { readonly params: Promise<{ readonly runId: string; readonly artifactType: string }> },
): Promise<NextResponse> {
  const { runId, artifactType } = await context.params
  if (!UUID_PATTERN.test(runId) || !['TECHNICAL_JSON', 'PAYSLIP_PDF'].includes(artifactType)) return unavailable(400)
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
      : await getPayrollProfessionalPayslipPdfArtifactForRun(input)
    if (!artifact) return unavailable(404)
    const fileName = artifact.file_name.replace(/[\r\n"\\]/g, '_')
    return secure(new NextResponse(Buffer.from(artifact.artifact_bytes), {
      status: 200,
      headers: {
        'Content-Type': artifact.content_type,
        'Content-Length': String(artifact.artifact_bytes.byteLength),
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'X-Artifact-SHA256': artifact.artifact_hash,
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

export async function POST(
  _request: Request,
  context: { readonly params: Promise<{ readonly runId: string; readonly artifactType: string }> },
): Promise<NextResponse> {
  const { runId, artifactType } = await context.params
  if (!UUID_PATTERN.test(runId) || artifactType !== 'PAYSLIP_PDF') return unavailable(400)
  try {
    const access = await requireComponentLibraryAccess(true)
    const artifact = await createPayrollProfessionalPayslipPdfArtifactForRun({
      scope: access.scope,
      payrollAdministrationId: access.administration.id,
      actorUserId: access.actorUserId,
      runId,
    })
    if (!artifact) return unavailable(404)
    return secure(NextResponse.json({
      id: artifact.id,
      runId: artifact.calculation_run_id,
      artifactType: artifact.artifact_type,
      fileName: artifact.file_name,
      contentType: artifact.content_type,
      sizeBytes: artifact.artifact_bytes.byteLength,
      sha256: artifact.artifact_hash,
      provenance: artifact.provenance_json,
      createdAt: artifact.created_at,
    }, { status: 200 }))
  } catch (error) {
    const permissionResponse = permissionErrorResponse(error)
    if (permissionResponse) return secure(permissionResponse)
    if (error instanceof SyntheticPayrollServiceError
      && (error.code === 'PAYROLL_INPUT_INVALID' || error.code === 'PAYROLL_CALCULATION_BLOCKED')) return unavailable(404)
    return unavailable(503)
  }
}
