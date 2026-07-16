import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { toHeRaExport } from '@/lib/hera/export'
import { requireHeRaContext } from '@/lib/hera/request-context'
import { createClient } from '@/lib/supabase/server'

interface Params { params: Promise<{ conversationId: string }> }

export async function GET(request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const context = await requireHeRaContext(); const { conversationId } = await params; const supabase = await createClient()
    const { data: conversation, error } = await supabase.from('ai_conversations').select('id, title, created_at').eq('id', conversationId).eq('tenant_id', context.tenantId).eq('owner_user_id', context.userId).maybeSingle()
    if (error) throw error; if (!conversation) return NextResponse.json({ error: 'HERA_CONVERSATION_NOT_FOUND' }, { status: 404 })
    const { data: messages, error: messagesError } = await supabase.from('ai_messages').select('role, content, created_at, model_id').eq('conversation_id', conversationId).eq('tenant_id', context.tenantId).eq('owner_user_id', context.userId).order('created_at')
    if (messagesError) throw messagesError
    const exported = toHeRaExport({ conversation: { id: conversation.id, title: conversation.title, createdAt: conversation.created_at }, messages: messages.map((message) => ({ role: message.role, content: message.content, createdAt: message.created_at, modelId: message.model_id })) })
    const format = new URL(request.url).searchParams.get('format') === 'markdown' ? 'markdown' : 'json'
    const body = format === 'markdown' ? exported.markdown : JSON.stringify(exported.json, null, 2)
    const extension = format === 'markdown' ? 'md' : 'json'
    return new NextResponse(body, { headers: { 'content-type': format === 'markdown' ? 'text/markdown; charset=utf-8' : 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="hera-${conversation.id}.${extension}"` } })
  } catch (error) { return permissionErrorResponse(error) ?? NextResponse.json({ error: 'HERA_OPERATION_FAILED' }, { status: 500 }) }
}
