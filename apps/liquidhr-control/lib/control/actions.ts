'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { lifecycleCommandSchema, onboardingSchema, supportSessionSchema } from './schemas'
import { createClient } from '@/lib/supabase/server'

export interface ControlActionState {
  code: 'idle' | 'invalid' | 'failed'
  message?: string
}

function administrationsFromFormData(formData: FormData) {
  const names = formData.getAll('administrationName').map(String)
  const codes = formData.getAll('administrationCode').map(String)
  return names.map((name, index) => ({ name, code: codes[index] ?? '' }))
}

export async function onboardTenant(
  _previous: ControlActionState,
  formData: FormData,
): Promise<ControlActionState> {
  const parsed = onboardingSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    primaryContactEmail: formData.get('primaryContactEmail'),
    administrationMode: formData.get('administrationMode'),
    administrations: administrationsFromFormData(formData),
  })
  if (!parsed.success) return { code: 'invalid' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('onboard_platform_tenant', {
    requested_name: parsed.data.name,
    requested_slug: parsed.data.slug,
    requested_administration_mode: parsed.data.administrationMode,
    requested_primary_contact_email: parsed.data.primaryContactEmail,
    requested_administrations: parsed.data.administrations,
  })
  if (error || !data) return { code: 'failed', message: error?.message }
  redirect(`/dashboard/tenants/${data}`)
}

export async function changeTenantLifecycle(formData: FormData): Promise<void> {
  const parsed = lifecycleCommandSchema.safeParse({
    tenantId: formData.get('tenantId'),
    status: formData.get('status'),
    reason: formData.get('reason'),
  })
  if (!parsed.success) redirect(`/dashboard/tenants/${String(formData.get('tenantId'))}?error=invalid`)

  const supabase = await createClient()
  const { error } = await supabase.rpc('change_tenant_lifecycle', {
    requested_tenant_id: parsed.data.tenantId,
    requested_status: parsed.data.status,
    requested_reason: parsed.data.reason,
  })
  if (error) redirect(`/dashboard/tenants/${parsed.data.tenantId}?error=failed`)
  revalidatePath('/dashboard')
  revalidatePath(`/dashboard/tenants/${parsed.data.tenantId}`)
}

export async function captureUsage(formData: FormData): Promise<void> {
  const tenantId = String(formData.get('tenantId') ?? '')
  const parsed = lifecycleCommandSchema.shape.tenantId.safeParse(tenantId)
  if (!parsed.success) return
  const supabase = await createClient()
  await supabase.rpc('capture_tenant_usage_snapshot', { requested_tenant_id: parsed.data })
  revalidatePath(`/dashboard/tenants/${parsed.data}`)
}

export async function startSupportSession(
  _previous: ControlActionState,
  formData: FormData,
): Promise<ControlActionState> {
  const parsed = supportSessionSchema.safeParse({
    tenantId: formData.get('tenantId'),
    reason: formData.get('reason'),
    durationMinutes: formData.get('durationMinutes'),
  })
  if (!parsed.success) return { code: 'invalid' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('start_platform_support_session', {
    requested_tenant_id: parsed.data.tenantId,
    requested_reason: parsed.data.reason,
    requested_duration_minutes: parsed.data.durationMinutes,
  })
  if (error || !data) return { code: 'failed' }

  const cookieStore = await cookies()
  cookieStore.set('liquidhr-support-session', data, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: parsed.data.durationMinutes * 60,
  })

  const hrAppOrigin = (process.env.NEXT_PUBLIC_HR_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  redirect(`${hrAppOrigin}/support`)
}
