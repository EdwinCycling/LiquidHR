import { NextResponse } from 'next/server'
import { permissionErrorResponse, requirePermission } from '@/lib/auth/permissions'
import { updateDocumentCategorySchema } from '@/lib/master-data/document-category-schema'
import { createClient } from '@/lib/supabase/server'

interface Context { params: Promise<{ categoryId: string }> }

export async function PATCH(request: Request, route: Context): Promise<NextResponse> {
  try {
    const context = await requirePermission('settings:write')
    if (!context.administrationId) return NextResponse.json({ error: 'ADMINISTRATION_REQUIRED' }, { status: 400 })
    const { categoryId } = await route.params
    const parsed = updateDocumentCategorySchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'MASTER_DATA_INPUT_INVALID' }, { status: 400 })
    const patch: { name?: string; description?: string | null; is_active?: boolean; requires_salary_permission?: boolean } = {}
    if (parsed.data.name !== undefined) patch.name = parsed.data.name
    if (parsed.data.description !== undefined) patch.description = parsed.data.description || null
    if (parsed.data.isActive !== undefined) patch.is_active = parsed.data.isActive
    if (parsed.data.requiresSalaryPermission !== undefined) patch.requires_salary_permission = parsed.data.requiresSalaryPermission
    const supabase = await createClient()
    const { data, error } = await supabase.from('document_categories').update(patch).eq('id', categoryId).eq('tenant_id', context.tenantId).eq('administration_id', context.administrationId).select('id').maybeSingle()
    if (error) return NextResponse.json({ error: 'DOCUMENT_CATEGORY_UPDATE_FAILED' }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'DOCUMENT_CATEGORY_NOT_FOUND' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) { const response = permissionErrorResponse(error); if (response) return response; return NextResponse.json({ error: 'DOCUMENT_CATEGORY_UPDATE_FAILED' }, { status: 500 }) }
}

export async function DELETE(_request: Request, route: Context): Promise<NextResponse> {
  try {
    const context = await requirePermission('settings:write')
    if (!context.administrationId) return NextResponse.json({ error: 'ADMINISTRATION_REQUIRED' }, { status: 400 })
    const { categoryId } = await route.params
    const supabase = await createClient()
    const { count, error: countError } = await supabase.from('employee_documents').select('id', { count: 'exact', head: true }).eq('tenant_id', context.tenantId).eq('administration_id', context.administrationId).eq('category_id', categoryId)
    if (countError) return NextResponse.json({ error: 'DOCUMENT_CATEGORY_DELETE_FAILED' }, { status: 500 })
    if ((count ?? 0) > 0) return NextResponse.json({ error: 'DOCUMENT_CATEGORY_IN_USE' }, { status: 409 })
    const { error } = await supabase.from('document_categories').delete().eq('id', categoryId).eq('tenant_id', context.tenantId).eq('administration_id', context.administrationId)
    if (error) return NextResponse.json({ error: error.code === '23503' ? 'DOCUMENT_CATEGORY_IN_USE' : 'DOCUMENT_CATEGORY_DELETE_FAILED' }, { status: error.code === '23503' ? 409 : 500 })
    return NextResponse.json({ ok: true })
  } catch (error) { const response = permissionErrorResponse(error); if (response) return response; return NextResponse.json({ error: 'DOCUMENT_CATEGORY_DELETE_FAILED' }, { status: 500 }) }
}
