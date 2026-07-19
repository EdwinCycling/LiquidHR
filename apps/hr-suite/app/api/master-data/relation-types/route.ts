import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const context = await requirePermission('employee:write')
    const body = await request.json() as { code?: unknown; nameNl?: unknown; nameEn?: unknown }
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
    const nameNl = typeof body.nameNl === 'string' ? body.nameNl.trim() : ''
    const nameEn = typeof body.nameEn === 'string' ? body.nameEn.trim() : ''
    if (!/^[A-Z][A-Z0-9_ -]{1,39}$/.test(code) || !nameNl || !nameEn || nameNl.length > 120 || nameEn.length > 120) return NextResponse.json({ error: 'MASTER_DATA_INPUT_INVALID' }, { status: 400 })
    const supabase = await createClient()
    const { error } = await supabase.from('relation_types').insert({ tenant_id: context.tenantId, code, name_nl: nameNl, name_en: nameEn, is_active: true })
    if (error) return NextResponse.json({ error: error.code === '23505' ? 'MASTER_DATA_DUPLICATE' : 'RELATION_TYPE_CREATE_FAILED' }, { status: error.code === '23505' ? 409 : 500 })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch { return NextResponse.json({ error: 'RELATION_TYPE_CREATE_FAILED' }, { status: 500 }) }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const context = await requirePermission('employee:write')
    const body = await request.json() as { id?: unknown; nameNl?: unknown; nameEn?: unknown; isActive?: unknown }
    if (typeof body.id !== 'string') return NextResponse.json({ error: 'MASTER_DATA_INPUT_INVALID' }, { status: 400 })
    const patch: { name_nl?: string; name_en?: string; is_active?: boolean } = {}
    if (typeof body.nameNl === 'string' && body.nameNl.trim()) patch.name_nl = body.nameNl.trim()
    if (typeof body.nameEn === 'string' && body.nameEn.trim()) patch.name_en = body.nameEn.trim()
    if (typeof body.isActive === 'boolean') patch.is_active = body.isActive
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'MASTER_DATA_INPUT_INVALID' }, { status: 400 })
    const supabase = await createClient()
    const { error } = await supabase.from('relation_types').update(patch).eq('id', body.id).eq('tenant_id', context.tenantId)
    if (error) return NextResponse.json({ error: 'RELATION_TYPE_UPDATE_FAILED' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ error: 'RELATION_TYPE_UPDATE_FAILED' }, { status: 500 }) }
}
