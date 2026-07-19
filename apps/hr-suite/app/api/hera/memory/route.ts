import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { requireHeRaContext } from '@/lib/hera/request-context'
import { memoryItemSchema } from '@/lib/hera/schemas'
import { createClient } from '@/lib/supabase/server'

const createBodySchema = memoryItemSchema.extend({ explicitConsent: z.literal(true) }).strict()
const updateBodySchema = z.object({
  id: z.string().uuid(),
  content: z.string().trim().min(1).max(1_000).optional(),
  category: z.enum(['PREFERENCE', 'WORKING_CONTEXT']).optional(),
  explicitConsent: z.literal(true),
}).strict().refine(
  (value) => value.content !== undefined || value.category !== undefined,
  { message: 'HERA_MEMORY_UPDATE_EMPTY' },
)

function operationFailed(error: unknown): NextResponse {
  return permissionErrorResponse(error)
    ?? NextResponse.json({ error: 'HERA_OPERATION_FAILED' }, { status: 500 })
}

export async function GET(): Promise<NextResponse> {
  try {
    const context = await requireHeRaContext()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('ai_memory_items')
      .select('id, content, category, consented_at, created_at, updated_at')
      .eq('tenant_id', context.tenantId)
      .eq('owner_user_id', context.userId)
      .order('updated_at', { ascending: false })
      .limit(100)
    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    return operationFailed(error)
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: unknown = await request.json()
    const parsed = createBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'HERA_MEMORY_CONSENT_REQUIRED' }, { status: 400 })
    }
    const context = await requireHeRaContext()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('ai_memory_items')
      .insert({
        tenant_id: context.tenantId,
        owner_user_id: context.userId,
        content: parsed.data.content,
        category: parsed.data.category,
        source_conversation_id: parsed.data.sourceConversationId ?? null,
      })
      .select('id, content, category, consented_at, created_at, updated_at')
      .single()
    if (error) throw error
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    return operationFailed(error)
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const body: unknown = await request.json()
    const parsed = updateBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'HERA_MEMORY_CONSENT_REQUIRED' }, { status: 400 })
    }
    const context = await requireHeRaContext()
    const supabase = await createClient()
    const update = {
      ...(parsed.data.content === undefined ? {} : { content: parsed.data.content }),
      ...(parsed.data.category === undefined ? {} : { category: parsed.data.category }),
    }
    const { data, error } = await supabase
      .from('ai_memory_items')
      .update(update)
      .eq('id', parsed.data.id)
      .eq('tenant_id', context.tenantId)
      .eq('owner_user_id', context.userId)
      .select('id, content, category, consented_at, created_at, updated_at')
      .maybeSingle()
    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: 'HERA_MEMORY_NOT_FOUND' }, { status: 404 })
    }
    return NextResponse.json({ data })
  } catch (error) {
    return operationFailed(error)
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id || !z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: 'HERA_INPUT_INVALID' }, { status: 400 })
    }
    const context = await requireHeRaContext()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('ai_memory_items')
      .delete()
      .eq('id', id)
      .eq('tenant_id', context.tenantId)
      .eq('owner_user_id', context.userId)
      .select('id')
      .maybeSingle()
    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: 'HERA_MEMORY_NOT_FOUND' }, { status: 404 })
    }
    return NextResponse.json({ data })
  } catch (error) {
    return operationFailed(error)
  }
}
