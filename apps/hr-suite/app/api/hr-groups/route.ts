import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

const administrationInputSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]+$/).max(80),
  name: z.string().trim().min(1).max(160),
  administrationNumber: z.string().trim().min(1).max(80),
  cocNumber: z.string().trim().max(40).optional().nullable(),
  vatNumber: z.string().trim().max(40).optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
}).strict()

const groupPatchSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000),
}).strict()

export async function POST(request: Request) {
  try {
    const context = await requirePermission('hr-group:manage')
    if (!context.hrGroupId) return NextResponse.json({ error: 'HR_GROUP_REQUIRED' }, { status: 403 })
    const body: unknown = await request.json().catch(() => null)
    const parsed = administrationInputSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_ADMINISTRATION_INPUT' }, { status: 400 })

    const supabase = await createClient()
    const id = crypto.randomUUID()
    const { error } = await supabase.from('administrations').insert({
      id,
      tenant_id: context.tenantId,
      hr_group_id: context.hrGroupId,
      code: parsed.data.code,
      name: parsed.data.name,
      administration_number: parsed.data.administrationNumber,
      coc_number: parsed.data.cocNumber || null,
      vat_number: parsed.data.vatNumber || null,
      parent_id: parsed.data.parentId ?? null,
      is_active: parsed.data.isActive ?? true,
    })
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'ADMINISTRATION_ALREADY_EXISTS' }, { status: 409 })
      throw error
    }

    return NextResponse.json({ data: { id } }, { status: 201 })
  } catch (error) {
    const response = permissionErrorResponse(error)
    if (response) return response
    throw error
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await requirePermission('hr-group:manage')
    if (!context.hrGroupId) return NextResponse.json({ error: 'HR_GROUP_REQUIRED' }, { status: 403 })
    const body: unknown = await request.json().catch(() => null)
    const parsed = groupPatchSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_HR_GROUP_INPUT' }, { status: 400 })

    const supabase = await createClient()
    const { error } = await supabase
      .from('hr_groups')
      .update({
        name: parsed.data.name,
        description: parsed.data.description || null,
        updated_by_user_id: context.userId,
      })
      .eq('tenant_id', context.tenantId)
      .eq('id', context.hrGroupId)
    if (error) throw error

    return NextResponse.json({ data: { id: context.hrGroupId } })
  } catch (error) {
    const response = permissionErrorResponse(error)
    if (response) return response
    throw error
  }
}
