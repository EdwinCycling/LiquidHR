import 'server-only'

import { redirect } from 'next/navigation'
import { controlSnapshotSchema, type ControlSnapshot } from './schemas'
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
