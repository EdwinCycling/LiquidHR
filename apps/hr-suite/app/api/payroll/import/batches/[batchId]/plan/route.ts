import { NextResponse } from 'next/server'
import { z } from 'zod'

import { permissionErrorResponse } from '@/lib/auth/permissions'
import {
  payrollImportPlanPostSchema,
  PayrollImportDecisionApiError,
  previewPayrollImportPlan,
  getPayrollImportFinalizationRecovery,
} from '@/lib/payroll-import/finalization/decision-api'
import { FinalizationLedgerError } from '@/lib/payroll-import/finalization/ledger-repository'

export const runtime = 'nodejs'

const paramsSchema = z.object({ batchId: z.guid() }).strict()

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> },
): Promise<NextResponse> {
  try {
    const parsedParams = paramsSchema.parse(await params)
    return NextResponse.json({ data: await getPayrollImportFinalizationRecovery(parsedParams.batchId) })
  } catch (error) {
    const permissionResponse = permissionErrorResponse(error)
    if (permissionResponse) return permissionResponse
    if (error instanceof PayrollImportDecisionApiError) {
      return NextResponse.json({ error: error.code, ...(error.details ? { details: error.details } : {}) }, { status: error.status })
    }
    if (error instanceof FinalizationLedgerError) return NextResponse.json({ error: error.code }, { status: error.status })
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'PAYROLL_IMPORT_REQUEST_INVALID' }, { status: 400 })
    return NextResponse.json({ error: 'PAYROLL_IMPORT_RECOVERY_READ_FAILED' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> },
): Promise<NextResponse> {
  try {
    const parsedParams = paramsSchema.parse(await params)
    payrollImportPlanPostSchema.parse(await request.json())
    return NextResponse.json({ data: await previewPayrollImportPlan(parsedParams.batchId) })
  } catch (error) {
    const permissionResponse = permissionErrorResponse(error)
    if (permissionResponse) return permissionResponse
    if (error instanceof PayrollImportDecisionApiError) {
      return NextResponse.json({ error: error.code, ...(error.details ? { details: error.details } : {}) }, { status: error.status })
    }
    if (error instanceof FinalizationLedgerError) return NextResponse.json({ error: error.code }, { status: error.status })
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'PAYROLL_IMPORT_REQUEST_INVALID' }, { status: 400 })
    return NextResponse.json({ error: 'PAYROLL_IMPORT_PLAN_READ_FAILED' }, { status: 500 })
  }
}
