import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { PayrollImportError } from '@/lib/payroll-import/model'
import { finalizePayrollImport } from '@/lib/payroll-import/service'

const requestSchema = z.object({
  batchId: z.string().uuid(),
  administrationId: z.string().uuid(),
  selectedRowNumbers: z.array(z.number().int().positive()).max(5_000).default([]),
}).strict()

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json())
    const result = await finalizePayrollImport(input)
    return NextResponse.json({ data: result })
  } catch (error) {
    const permissionResponse = permissionErrorResponse(error)
    if (permissionResponse) return permissionResponse
    if (error instanceof PayrollImportError) return NextResponse.json({ error: error.code }, { status: error.status })
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'IMPORT_REQUEST_INVALID' }, { status: 400 })
    return NextResponse.json({ error: 'PAYROLL_IMPORT_FINALIZE_FAILED' }, { status: 500 })
  }
}
