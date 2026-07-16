import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { requireHeRaContext } from '@/lib/hera/request-context'
import { createConversationSchema } from '@/lib/hera/schemas'
import { createClient } from '@/lib/supabase/server'

export async function GET(): Promise<NextResponse> {
  try {
    const context = await requireHeRaContext()
    const supabase = await createClient()
    const { data, error } = await supabase.from('ai_conversations')
      .select('id, title, summary, created_at, updated_at')
      .eq('tenant_id', context.tenantId).eq('owner_user_id', context.userId)
      .order('updated_at', { ascending: false }).limit(100)
    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    return permissionErrorResponse(error) ?? NextResponse.json({ error: 'HERA_OPERATION_FAILED' }, { status: 500 })
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: unknown = await request.json()
    const parsed = createConversationSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'HERA_INPUT_INVALID' }, { status: 400 })
    const context = await requireHeRaContext()
    const supabase = await createClient()
    const { data, error } = await supabase.from('ai_conversations').insert({
      tenant_id: context.tenantId, administration_id: context.administrationId, owner_user_id: context.userId,
      title: parsed.data.title ?? 'Nieuw gesprek',
    }).select('id, title, summary, created_at, updated_at').single()
    if (error) throw error
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    return permissionErrorResponse(error) ?? NextResponse.json({ error: 'HERA_OPERATION_FAILED' }, { status: 500 })
  }
}
