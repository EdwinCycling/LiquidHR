import { NextRequest, NextResponse } from 'next/server'
import { permissionErrorResponse, requirePermission } from '@/lib/auth/permissions'
import {
  PayrollLabUnavailableError,
  resolvePayrollLabAdministration,
} from '@/lib/payroll/access'
import {
  getLatestCaoBench02Payroll,
} from '@/lib/payroll/cao-bench02-calculation-service'
import {
  buildCaoBench02ValidationPack,
  isValidationPackCaseKey,
  isValidationPackCompatibleRun,
  isValidationPackRunId,
  ValidationPackError,
} from '@/lib/payroll/validation-pack'
import { renderCaoBench02ValidationPackPdf } from '@/lib/payroll/validation-pack-pdf'
import { payrollScopeFromAuthContext } from '@/lib/payroll/scope'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

function jsonResponse(body: unknown, status: number, extraHeaders: Record<string, string> = {}): NextResponse {
  return secureResponse(NextResponse.json(body, { status, headers: extraHeaders }))
}

function requestValues(request: NextRequest): { caseKey: string; runId: string; format: 'json' | 'pdf' } | null {
  const params = request.nextUrl.searchParams
  const keys = [...params.keys()]
  if (keys.length !== 3 || keys.some((key) => !['caseKey', 'runId', 'format'].includes(key))) return null

  const caseKeys = params.getAll('caseKey')
  const runIds = params.getAll('runId')
  const formats = params.getAll('format')
  if (caseKeys.length !== 1 || runIds.length !== 1 || formats.length !== 1) return null

  const [caseKey] = caseKeys
  const [runId] = runIds
  const [format] = formats
  if (!caseKey || !isValidationPackCaseKey(caseKey) || !runId || !isValidationPackRunId(runId)) return null
  if (format !== 'json' && format !== 'pdf') return null
  return { caseKey, runId, format }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const values = requestValues(request)
  if (!values) return jsonResponse({ error: 'PAYROLL_VALIDATION_PACK_INPUT_INVALID' }, 400)

  try {
    const context = await requirePermission('salary:read')
    const scope = payrollScopeFromAuthContext(context)
    if (!scope) return jsonResponse({ error: 'PAYROLL_VALIDATION_PACK_UNAVAILABLE' }, 404)

    const administration = await resolvePayrollLabAdministration(context)
    if (!administration || !administration.capabilityEnabled || administration.status !== 'ACTIVE') {
      return jsonResponse({ error: 'PAYROLL_VALIDATION_PACK_UNAVAILABLE' }, 404)
    }

    const view = await getLatestCaoBench02Payroll(scope, administration.id, values.caseKey, values.runId)
    if (!isValidationPackCompatibleRun(values.caseKey, values.runId, administration.id, view)) {
      return jsonResponse({ error: 'PAYROLL_VALIDATION_PACK_UNAVAILABLE' }, 404)
    }

    const pack = buildCaoBench02ValidationPack(values.caseKey, administration.id, view)
    const filename = `${values.caseKey.toLowerCase()}-${values.runId}-validation-pack`
    if (values.format === 'json') {
      return jsonResponse(pack, 200, {
        'Content-Disposition': `attachment; filename="${filename}.json"`,
      })
    }

    const pdf = await renderCaoBench02ValidationPackPdf(pack)
    return secureResponse(new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}.pdf"`,
      },
    }))
  } catch (error) {
    const permissionResponse = permissionErrorResponse(error)
    if (permissionResponse) return secureResponse(permissionResponse)
    if (error instanceof PayrollLabUnavailableError) {
      return jsonResponse({ error: 'PAYROLL_VALIDATION_PACK_UNAVAILABLE' }, 503)
    }
    if (error instanceof ValidationPackError) {
      return jsonResponse({ error: 'PAYROLL_VALIDATION_PACK_UNAVAILABLE' }, 404)
    }
    return jsonResponse({ error: 'PAYROLL_VALIDATION_PACK_UNAVAILABLE' }, 503)
  }
}
