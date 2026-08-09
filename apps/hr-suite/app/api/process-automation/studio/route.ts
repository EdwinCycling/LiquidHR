import { NextResponse } from 'next/server'
import {
  createStudioDefinition,
  listStudioCatalog,
  studioCreateSchema,
} from '@/lib/process-automation/studio-service'
import { studioHttpError } from '@/lib/process-automation/studio-http'

export async function GET() {
  try {
    return NextResponse.json({ data: await listStudioCatalog() })
  } catch (error) {
    return studioHttpError(error, 'PROCESS_DEFINITION_CATALOG_READ_FAILED')
  }
}

export async function POST(request: Request) {
  try {
    const parsed = studioCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ code: 'INVALID_PROCESS_DEFINITION_CREATE', issues: parsed.error.issues }, { status: 400 })
    return NextResponse.json({ data: await createStudioDefinition(parsed.data.key) }, { status: 201 })
  } catch (error) {
    return studioHttpError(error)
  }
}
