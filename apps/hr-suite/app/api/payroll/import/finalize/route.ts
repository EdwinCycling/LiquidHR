import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { PayrollImportError } from '@/lib/payroll-import/model'
import { finalizePayrollImportXml, PayrollImportDecisionApiError } from '@/lib/payroll-import/finalization/decision-api'
import { finalizePayrollImport } from '@/lib/payroll-import/service'

const xmlFinalizationRequestSchema = z.object({
  sourceType: z.literal('LOONAANGIFTE_XML'),
  batchId: z.guid(),
  confirmation: z.literal(true),
}).strict()

const representativeFinalizationRequestSchema = z.object({
  batchId: z.guid(),
  administrationId: z.guid(),
  selectedRowNumbers: z.array(z.number().int().positive()).max(5_000).default([]),
}).strict()

const requestSchema = z.union([xmlFinalizationRequestSchema, representativeFinalizationRequestSchema])

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json())
    const xmlInput = xmlFinalizationRequestSchema.safeParse(input)
    const result = xmlInput.success
      ? await finalizePayrollImportXml(xmlInput.data.batchId)
      : await finalizePayrollImport(representativeFinalizationRequestSchema.parse(input))
    return NextResponse.json({ data: result })
  } catch (error) {
    const permissionResponse = permissionErrorResponse(error)
    if (permissionResponse) return permissionResponse
    if (error instanceof PayrollImportDecisionApiError) {
      return NextResponse.json({ error: error.code, details: error.details }, { status: error.status })
    }
    if (error instanceof PayrollImportError) return NextResponse.json({ error: error.code }, { status: error.status })
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'IMPORT_REQUEST_INVALID' }, { status: 400 })
    return NextResponse.json({ error: 'PAYROLL_IMPORT_FINALIZE_FAILED' }, { status: 500 })
  }
}
