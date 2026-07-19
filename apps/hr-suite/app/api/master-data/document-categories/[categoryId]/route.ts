import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

interface Context { params: Promise<{ categoryId: string }> }

export async function PATCH(request: Request, route: Context): Promise<NextResponse> {
  try {
    const context = await requirePermission('document:write')
    const { categoryId } = await route.params
    const body = await request.json() as { name?: unknown; description?: unknown; isActive?: unknown }
    const patch: { name?: string; description?: string | null; is_active?: boolean } = {}
    if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim()
    if (typeof body.description === 'string') patch.description = body.description.trim() || null
    if (typeof body.isActive === 'boolean') patch.is_active = body.isActive
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'MASTER_DATA_INPUT_INVALID' }, { status: 400 })
    const supabase = await createClient()
    const { error } = await supabase.from('document_categories').update(patch).eq('id', categoryId).eq('tenant_id', context.tenantId).eq('administration_id', context.administrationId ?? '')
    if (error) return NextResponse.json({ error: 'DOCUMENT_CATEGORY_UPDATE_FAILED' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ error: 'DOCUMENT_CATEGORY_UPDATE_FAILED' }, { status: 500 }) }
}

export async function DELETE(_request: Request, route: Context): Promise<NextResponse> {
  try {
    const context = await requirePermission('document:write')
    const { categoryId } = await route.params
    const supabase = await createClient()
    const { error } = await supabase.from('document_categories').delete().eq('id', categoryId).eq('tenant_id', context.tenantId).eq('administration_id', context.administrationId ?? '')
    if (error) return NextResponse.json({ error: error.code === '23503' ? 'MASTER_DATA_IN_USE' : 'DOCUMENT_CATEGORY_DELETE_FAILED' }, { status: error.code === '23503' ? 409 : 500 })
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ error: 'DOCUMENT_CATEGORY_DELETE_FAILED' }, { status: 500 }) }
}
