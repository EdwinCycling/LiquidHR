import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

const administrationPatchSchema = z.object({
  name: z.string().trim().min(1).max(160),
  administrationNumber: z.string().trim().min(1).max(80),
  cocNumber: z.string().trim().max(40).optional().nullable(),
  vatNumber: z.string().trim().max(40).optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  isActive: z.boolean(),
}).strict()

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ administrationId: string }> },
): Promise<NextResponse> {
  try {
    const context = await requirePermission('hr-group:manage')
    if (!context.hrGroupId) return NextResponse.json({ error: 'HR_GROUP_REQUIRED' }, { status: 403 })

    const parsed = administrationPatchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_ADMINISTRATION_INPUT' }, { status: 400 })

    const { administrationId } = await params
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('administrations')
      .update({
        name: parsed.data.name,
        administration_number: parsed.data.administrationNumber,
        coc_number: parsed.data.cocNumber || null,
        vat_number: parsed.data.vatNumber || null,
        parent_id: parsed.data.parentId ?? null,
        is_active: parsed.data.isActive,
      })
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', context.hrGroupId)
      .eq('id', administrationId)
      .select('id, name, administration_number, coc_number, vat_number, parent_id, is_active')
      .maybeSingle()

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'ADMINISTRATION_ALREADY_EXISTS' }, { status: 409 })
      throw error
    }
    if (!data) return NextResponse.json({ error: 'ADMINISTRATION_NOT_FOUND' }, { status: 404 })

    return NextResponse.json({ data: { id: data.id, name: data.name, administrationNumber: data.administration_number, cocNumber: data.coc_number, vatNumber: data.vat_number, parentId: data.parent_id, isActive: data.is_active } })
  } catch (error) {
    const response = permissionErrorResponse(error)
    if (response) return response
    return NextResponse.json({ error: 'ADMINISTRATION_UPDATE_FAILED' }, { status: 500 })
  }
}
