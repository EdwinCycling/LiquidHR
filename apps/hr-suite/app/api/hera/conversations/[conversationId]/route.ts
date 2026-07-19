import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { requireHeRaContext } from '@/lib/hera/request-context'
import { renameConversationSchema } from '@/lib/hera/schemas'
import { createClient } from '@/lib/supabase/server'

interface Params { params: Promise<{ conversationId: string }> }

export async function GET(_: Request, { params }: Params): Promise<NextResponse> {
  try {
    const context = await requireHeRaContext(); const { conversationId } = await params; const supabase = await createClient()
    const [{ data: conversation, error }, { data: messages, error: messagesError }] = await Promise.all([
      supabase.from('ai_conversations').select('id, title, summary, created_at, updated_at').eq('id', conversationId).eq('tenant_id', context.tenantId).eq('owner_user_id', context.userId).maybeSingle(),
      supabase.from('ai_messages').select('id, role, content, visible_tool_name, metadata, created_at').eq('conversation_id', conversationId).eq('tenant_id', context.tenantId).eq('owner_user_id', context.userId).order('created_at'),
    ])
    if (error) throw error; if (messagesError) throw messagesError
    if (!conversation) return NextResponse.json({ error: 'HERA_CONVERSATION_NOT_FOUND' }, { status: 404 })
    return NextResponse.json({ data: { conversation, messages } })
  } catch (error) { return permissionErrorResponse(error) ?? NextResponse.json({ error: 'HERA_OPERATION_FAILED' }, { status: 500 }) }
}

export async function PATCH(request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const body: unknown = await request.json(); const parsed = renameConversationSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'HERA_INPUT_INVALID' }, { status: 400 })
    const context = await requireHeRaContext(); const { conversationId } = await params; const supabase = await createClient()
    const { data, error } = await supabase.from('ai_conversations').update({ title: parsed.data.title }).eq('id', conversationId).eq('tenant_id', context.tenantId).eq('owner_user_id', context.userId).select('id, title, updated_at').maybeSingle()
    if (error) throw error; if (!data) return NextResponse.json({ error: 'HERA_CONVERSATION_NOT_FOUND' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (error) { return permissionErrorResponse(error) ?? NextResponse.json({ error: 'HERA_OPERATION_FAILED' }, { status: 500 }) }
}

export async function DELETE(_: Request, { params }: Params): Promise<NextResponse> {
  try {
    const context = await requireHeRaContext(); const { conversationId } = await params; const supabase = await createClient()
    const { data, error } = await supabase.from('ai_conversations').delete().eq('id', conversationId).eq('tenant_id', context.tenantId).eq('owner_user_id', context.userId).select('id').maybeSingle()
    if (error) throw error; if (!data) return NextResponse.json({ error: 'HERA_CONVERSATION_NOT_FOUND' }, { status: 404 })
    return NextResponse.json({ data: { id: data.id } })
  } catch (error) { return permissionErrorResponse(error) ?? NextResponse.json({ error: 'HERA_OPERATION_FAILED' }, { status: 500 }) }
}
