import { NextResponse } from 'next/server'
import { permissionErrorResponse, requirePermission } from '@/lib/auth/permissions'
import { createDocumentCategorySchema } from '@/lib/master-data/document-category-schema'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const context = await requirePermission('settings:write')
    if (!context.administrationId) return NextResponse.json({ error: 'ADMINISTRATION_REQUIRED' }, { status: 400 })
    const parsed = createDocumentCategorySchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'MASTER_DATA_INPUT_INVALID' }, { status: 400 })
    const supabase = await createClient()
    const { error } = await supabase.from('document_categories').insert({ tenant_id: context.tenantId, administration_id: context.administrationId, code: parsed.data.code, name: parsed.data.name, description: parsed.data.description || null, requires_salary_permission: parsed.data.requiresSalaryPermission, is_active: true })
    if (error) return NextResponse.json({ error: error.code === '23505' ? 'MASTER_DATA_DUPLICATE' : 'DOCUMENT_CATEGORY_CREATE_FAILED' }, { status: error.code === '23505' ? 409 : 500 })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) { const response = permissionErrorResponse(error); if (response) return response; return NextResponse.json({ error: 'DOCUMENT_CATEGORY_CREATE_FAILED' }, { status: 500 }) }
}
