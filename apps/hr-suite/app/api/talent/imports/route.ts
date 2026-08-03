import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { talentImportPreviewSchema } from '@/lib/talent/import-schemas'
import { listTalentImportBatches, previewTalentImport, TalentImportError } from '@/lib/talent/import-service'

export async function GET() {
  try { return NextResponse.json({ data: await listTalentImportBatches() }) } catch (error) { const permission = permissionErrorResponse(error); if (permission) return permission; if (error instanceof TalentImportError) return NextResponse.json({ error: error.code }, { status: error.status }); return NextResponse.json({ error: 'TALENT_IMPORT_READ_FAILED' }, { status: 500 }) }
}

export async function POST(request: Request) {
  try {
    const parsed = talentImportPreviewSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'TALENT_INPUT_INVALID' }, { status: 400 })
    return NextResponse.json({ data: await previewTalentImport(parsed.data) }, { status: 201 })
  } catch (error) { const permission = permissionErrorResponse(error); if (permission) return permission; if (error instanceof TalentImportError) return NextResponse.json({ error: error.code }, { status: error.status }); return NextResponse.json({ error: 'TALENT_IMPORT_PREVIEW_FAILED' }, { status: 500 }) }
}
