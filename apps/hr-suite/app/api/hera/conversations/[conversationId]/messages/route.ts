import { NextResponse } from 'next/server'
import type { Json } from '@scope/db'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { buildModelContext, resolveMemoryProposal } from '@/lib/hera/context'
import { heRaErrorResponse } from '@/lib/hera/http-errors'
import { runHeRaTurn } from '@/lib/hera/orchestrator'
import { resolvePersona } from '@/lib/hera/persona'
import { loadHeRaUserContext } from '@/lib/hera/preferences'
import { requireHeRaContext } from '@/lib/hera/request-context'
import { userMessageSchema } from '@/lib/hera/schemas'
import { createClient } from '@/lib/supabase/server'
import { getTranslator } from '@/lib/i18n/server'

interface Params {
  params: Promise<{ conversationId: string }>
}

function toJson(value: unknown): Json {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('HERA_METADATA_INVALID')
    return value
  }
  if (Array.isArray(value)) return value.map(toJson)
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toJson(item)]))
  }
  throw new Error('HERA_METADATA_INVALID')
}

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const body: unknown = await request.json()
    const parsed = userMessageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'HERA_INPUT_INVALID' }, { status: 400 })
    }

    const context = await requireHeRaContext()
    const { conversationId } = await params
    const supabase = await createClient()
    const { data: conversation, error: conversationError } = await supabase
      .from('ai_conversations')
      .select('summary')
      .eq('id', conversationId)
      .eq('tenant_id', context.tenantId)
      .eq('owner_user_id', context.userId)
      .maybeSingle()
    if (conversationError) throw conversationError
    if (!conversation) {
      return NextResponse.json({ error: 'HERA_CONVERSATION_NOT_FOUND' }, { status: 404 })
    }

    const { error: userMessageError } = await supabase.from('ai_messages').insert({
      tenant_id: context.tenantId,
      conversation_id: conversationId,
      owner_user_id: context.userId,
      role: 'USER',
      content: parsed.data.content,
    })
    if (userMessageError) throw userMessageError

    const [{ data: messages, error: messagesError }, userContext] = await Promise.all([
      supabase
        .from('ai_messages')
        .select('role, content')
        .eq('tenant_id', context.tenantId)
        .eq('conversation_id', conversationId)
        .eq('owner_user_id', context.userId)
        .order('created_at', { ascending: false })
        .limit(16),
      loadHeRaUserContext(context),
    ])
    if (messagesError) throw messagesError

    const persona = resolvePersona(context, userContext.locale)
    const translate = await getTranslator('hera', userContext.locale)
    const memoryProposal = resolveMemoryProposal(parsed.data.content, userContext.memory)
    const turn = memoryProposal
      ? {
          content: translate('memoryProposalPending'),
          model: 'hera-rules-v1',
          evidence: null,
          draft: null,
        }
      : await runHeRaTurn({
          context,
          userContext,
          latestUserMessage: parsed.data.content,
          modelContext: buildModelContext({
            summary: conversation.summary,
            messages: [...messages].reverse(),
            maxCharacters: 14_000,
          }),
          personaInstruction: persona.instructions,
          groundingRequiredMessage: translate('groundingRequired'),
          now: new Date(),
        })

    let draft: { id: string; version: number; expiresAt: string; summary: string; controlPayload: Json } | null = null
    if (turn.draft) {
      const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString()
      const { data, error } = await supabase
        .from('ai_action_drafts')
        .insert({
          tenant_id: context.tenantId,
          conversation_id: conversationId,
          owner_user_id: context.userId,
          action_type: turn.draft.actionType,
          tool_name: turn.draft.toolName,
          payload: toJson(turn.draft.payload),
          summary: turn.draft.summary,
          control_payload: toJson(turn.draft.controlPayload),
          status: 'AWAITING_CONFIRMATION',
          version: 1,
          expires_at: expiresAt,
        })
        .select('id, version, expires_at, summary, control_payload')
        .single()
      if (error) throw error
      draft = {
        id: data.id,
        version: data.version,
        expiresAt: data.expires_at,
        summary: data.summary,
        controlPayload: data.control_payload,
      }
    }

    const metadata: Json = turn.evidence
      ? { evidence: toJson(turn.evidence) }
      : {}
    const { data: assistantMessage, error: assistantMessageError } = await supabase
      .from('ai_messages')
      .insert({
        tenant_id: context.tenantId,
        conversation_id: conversationId,
        owner_user_id: context.userId,
        role: 'ASSISTANT',
        content: turn.content,
        model_id: turn.model,
        metadata,
      })
      .select('id, role, content, metadata, created_at')
      .single()
    if (assistantMessageError) throw assistantMessageError

    return NextResponse.json({
      data: {
        message: assistantMessage,
        draftId: draft?.id ?? null,
        draft,
        evidence: turn.evidence,
        memoryProposal,
      },
    })
  } catch (error) {
    return permissionErrorResponse(error)
      ?? heRaErrorResponse(error)
      ?? NextResponse.json({ error: 'HERA_OPERATION_FAILED' }, { status: 500 })
  }
}
