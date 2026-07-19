import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import { requireHeRaContext } from '@/lib/hera/request-context'
import { createClient } from '@/lib/supabase/server'

const preferenceSchema = z.object({
  tone: z.enum(['FRIENDLY', 'BUSINESS', 'DIRECT']),
  detailLevel: z.enum(['COMPACT', 'BALANCED', 'EXTENDED']),
  seniorityLevel: z.enum(['BASIC', 'EXPERIENCED', 'EXPERT']),
}).strict()

function operationFailed(error: unknown): NextResponse {
  return permissionErrorResponse(error)
    ?? NextResponse.json({ error: 'HERA_OPERATION_FAILED' }, { status: 500 })
}

export async function GET(): Promise<NextResponse> {
  try {
    const context = await requireHeRaContext()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('ai_user_preferences')
      .select('tone, detail_level, seniority_level, updated_at')
      .eq('tenant_id', context.tenantId)
      .eq('owner_user_id', context.userId)
      .maybeSingle()
    if (error) throw error
    return NextResponse.json({
      data: data ?? {
        tone: 'BUSINESS',
        detail_level: 'BALANCED',
        seniority_level: 'EXPERIENCED',
        updated_at: null,
      },
    })
  } catch (error) {
    return operationFailed(error)
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const body: unknown = await request.json()
    const parsed = preferenceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'HERA_INPUT_INVALID' }, { status: 400 })
    }
    const context = await requireHeRaContext()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('ai_user_preferences')
      .upsert({
        tenant_id: context.tenantId,
        owner_user_id: context.userId,
        tone: parsed.data.tone,
        detail_level: parsed.data.detailLevel,
        seniority_level: parsed.data.seniorityLevel,
      }, { onConflict: 'tenant_id,owner_user_id' })
      .select('tone, detail_level, seniority_level, updated_at')
      .single()
    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    return operationFailed(error)
  }
}
