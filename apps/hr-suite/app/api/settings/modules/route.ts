import { NextResponse } from 'next/server'
import { moduleErrorResponse, listTenantModules, saveTenantModules } from '@/lib/modules/module-service'
import { moduleSelectionSchema } from '@/lib/modules/schemas'

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json({ data: await listTenantModules() })
  } catch (error) {
    return moduleErrorResponse(error)
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const parsed = moduleSelectionSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'MODULE_INPUT_INVALID' }, { status: 400 })
    await saveTenantModules(parsed.data)
    return NextResponse.json({ data: { saved: true } })
  } catch (error) {
    return moduleErrorResponse(error)
  }
}
