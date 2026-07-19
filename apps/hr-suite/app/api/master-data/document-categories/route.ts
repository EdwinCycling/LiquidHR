import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const context = await requirePermission('document:write')
    if (!context.administrationId) return NextResponse.json({ error: 'ADMINISTRATION_REQUIRED' }, { status: 400 })
    const body = await request.json() as { code?: unknown; name?: unknown; description?: unknown }
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const description = typeof body.description === 'string' ? body.description.trim() || null : null
    if (!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(code) || !name || name.length > 160) return NextResponse.json({ error: 'MASTER_DATA_INPUT_INVALID' }, { status: 400 })
    const supabase = await createClient()
    const { error } = await supabase.from('document_categories').insert({ tenant_id: context.tenantId, administration_id: context.administrationId, code, name, description, is_active: true })
    if (error) return NextResponse.json({ error: error.code === '23505' ? 'MASTER_DATA_DUPLICATE' : 'DOCUMENT_CATEGORY_CREATE_FAILED' }, { status: error.code === '23505' ? 409 : 500 })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch { return NextResponse.json({ error: 'DOCUMENT_CATEGORY_CREATE_FAILED' }, { status: 500 }) }
}
