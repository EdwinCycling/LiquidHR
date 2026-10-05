import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { PayrollImportError, payrollImportSourceTypeSchema } from '@/lib/payroll-import/model'
import { analyzePayrollImport, stagePayrollImport } from '@/lib/payroll-import/service'

export const runtime = 'nodejs'

const requestSchema = z.object({
  sourceType: payrollImportSourceTypeSchema,
  taxYear: z.coerce.number().int().min(2000).max(2200),
  administrationId: z.guid(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict()

function publicAnalysis(analysis: Awaited<ReturnType<typeof analyzePayrollImport>>) {
  const { sourceFilename, sourceHash, ...publicPayload } = analysis
  void sourceFilename
  void sourceHash
  return {
    ...publicPayload,
    rows: analysis.rows.map(({ bsnFingerprint, sourceMetadata, externalEmployeeNumber, match, ...row }) => {
      void bsnFingerprint
      void sourceMetadata
      void externalEmployeeNumber
      const { employeeId, ...publicMatch } = match
      void employeeId
      return { ...row, match: publicMatch }
    }),
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const parsed = requestSchema.parse({
      sourceType: form.get('sourceType'),
      taxYear: form.get('taxYear'),
      administrationId: form.get('administrationId'),
      periodStart: form.get('periodStart') || undefined,
      periodEnd: form.get('periodEnd') || undefined,
    })
    if (parsed.sourceType === 'LOONAANGIFTE_XML') {
      throw new PayrollImportError('REAL_XML_STAGING_PENDING', 409)
    }
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0 || file.size > 10_000_000) throw new PayrollImportError('IMPORT_FILE_INVALID', 422)
    const analysis = await analyzePayrollImport({
      sourceType: parsed.sourceType,
      filename: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
      taxYear: parsed.taxYear,
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
      administrationId: parsed.administrationId,
    })
    const staged = await stagePayrollImport({ analysis, taxYear: parsed.taxYear, periodStart: parsed.periodStart, periodEnd: parsed.periodEnd, administrationId: parsed.administrationId })
    return NextResponse.json({ data: { ...staged, analysis: publicAnalysis(analysis) } })
  } catch (error) {
    const permissionResponse = permissionErrorResponse(error)
    if (permissionResponse) return permissionResponse
    if (error instanceof PayrollImportError) return NextResponse.json({ error: error.code }, { status: error.status })
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'IMPORT_REQUEST_INVALID' }, { status: 400 })
    return NextResponse.json({ error: 'PAYROLL_IMPORT_STAGE_FAILED' }, { status: 500 })
  }
}
