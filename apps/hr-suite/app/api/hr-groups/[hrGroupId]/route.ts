import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({ name: z.string().trim().min(1).max(160), description: z.string().trim().max(1000) }).strict()
export async function PATCH(request: Request, { params }: { params: Promise<{ hrGroupId: string }> }) {
  try { const context = await requirePermission('hr-group:manage'); const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'INVALID_HR_GROUP_INPUT' }, { status: 400 }); const { hrGroupId } = await params; const supabase = await createClient(); const { data, error } = await supabase.from('hr_groups').update({ name: parsed.data.name, description: parsed.data.description || null, updated_by_user_id: context.userId }).eq('tenant_id', context.tenantId).eq('id', hrGroupId).select('id, name, description').maybeSingle(); if (error) throw error; if (!data) return NextResponse.json({ error: 'HR_GROUP_NOT_FOUND' }, { status: 404 }); return NextResponse.json({ data }) } catch (error) { const response = permissionErrorResponse(error); return response ?? NextResponse.json({ error: 'HR_GROUP_UPDATE_FAILED' }, { status: 500 }) }
}
