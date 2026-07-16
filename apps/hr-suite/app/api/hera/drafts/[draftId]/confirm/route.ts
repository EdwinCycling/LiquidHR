import { NextResponse } from 'next/server'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { heRaErrorResponse } from '@/lib/hera/http-errors'
import { requireHeRaContext } from '@/lib/hera/request-context'
import { createHeRaService } from '@/lib/hera/service'
import { createClient } from '@/lib/supabase/server'

interface Params { params: Promise<{ draftId: string }> }

export async function POST(_: Request, { params }: Params): Promise<NextResponse> {
  try {
    const context = await requireHeRaContext(); const { draftId } = await params; const supabase = await createClient()
    const service = createHeRaService({
      async claimDraft(authContext, id) {
        const { data, error } = await supabase.from('ai_action_drafts').update({ status: 'CONFIRMED', confirmed_at: new Date().toISOString() }).eq('id', id).eq('tenant_id', authContext.tenantId).eq('owner_user_id', authContext.userId).eq('status', 'PENDING').gt('expires_at', new Date().toISOString()).select('id, status, expires_at, payload').maybeSingle()
        if (error) throw error
        return data ? { id: data.id, status: data.status, expiresAt: data.expires_at, payload: data.payload } : null
      },
      async markDraftExecuted(authContext, id) {
        const { data, error } = await supabase.from('ai_action_drafts').update({ status: 'EXECUTED', confirmed_at: new Date().toISOString(), executed_at: new Date().toISOString() }).eq('id', id).eq('tenant_id', authContext.tenantId).eq('owner_user_id', authContext.userId).eq('status', 'PENDING').select('id').maybeSingle()
        if (error) throw error
        if (!data) throw new Error('DRAFT_NOT_CONFIRMABLE')
      },
    })
    return NextResponse.json({ data: await service.confirmDraft(context, draftId) })
  } catch (error) { return permissionErrorResponse(error) ?? heRaErrorResponse(error) ?? NextResponse.json({ error: 'HERA_OPERATION_FAILED' }, { status: 500 }) }
}
