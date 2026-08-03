import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { talentImportCommandSchema } from '@/lib/talent/import-schemas'
import { commitTalentImportBatch, getTalentImportBatch, rollbackTalentImportBatch, TalentImportError } from '@/lib/talent/import-service'

export async function GET(_request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  try { const { batchId } = await params; return NextResponse.json({ data: await getTalentImportBatch(batchId) }) } catch (error) { const permission = permissionErrorResponse(error); if (permission) return permission; if (error instanceof TalentImportError) return NextResponse.json({ error: error.code }, { status: error.status }); return NextResponse.json({ error: 'TALENT_IMPORT_READ_FAILED' }, { status: 500 }) }
}

export async function POST(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  try {
    const parsed = talentImportCommandSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    const { batchId } = await params
    const data = parsed.data.command === 'COMMIT' ? await commitTalentImportBatch(batchId, parsed.data.idempotencyKey) : await rollbackTalentImportBatch(batchId, parsed.data.idempotencyKey)
    return NextResponse.json({ data })
  } catch (error) { const permission = permissionErrorResponse(error); if (permission) return permission; if (error instanceof TalentImportError) return NextResponse.json({ error: error.code }, { status: error.status }); return NextResponse.json({ error: 'TALENT_IMPORT_COMMAND_FAILED' }, { status: 500 }) }
}
