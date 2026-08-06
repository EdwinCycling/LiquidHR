import 'server-only'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { controlSnapshotSchema, hrGroupSchema, type ControlSnapshot, type HrGroup } from './schemas'
import { createClient } from '@/lib/supabase/server'

function isAccessDenied(message: string): boolean {
  return message.includes('PLATFORM_ACCESS_DENIED') || message.includes('42501')
}

export async function getControlSnapshot(tenantId?: string): Promise<ControlSnapshot> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_platform_control_snapshot', {
    requested_tenant_id: tenantId ?? null,
  })

  if (error) {
    if (isAccessDenied(error.message)) redirect('/geen-toegang')
    if (error.message.includes('get_platform_control_snapshot')) redirect('/installatie-nodig')
    throw error
  }

  return controlSnapshotSchema.parse(data)
}

export async function getPlatformHrGroups(tenantId: string): Promise<HrGroup[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_platform_hr_groups', {
    requested_tenant_id: tenantId,
  })

  if (error) {
    if (isAccessDenied(error.message)) redirect('/geen-toegang')
    if (error.message.includes('get_platform_hr_groups')) redirect('/installatie-nodig')
    throw error
  }

  return z.array(hrGroupSchema).parse(data)
}
