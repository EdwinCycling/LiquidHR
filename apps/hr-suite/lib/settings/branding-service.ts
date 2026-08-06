import type { Database } from '@scope/db'
import { z } from 'zod'
import { loadActiveContext } from '@/lib/context/server-context'
import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import type { CompanyBranding } from '@/lib/preferences/user-preferences'

const brandingColorsSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  sidebarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
}).strict()

type BrandingRow = Database['public']['Tables']['administration_branding']['Row']
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

function brandingFromRow(row: Pick<BrandingRow, 'primary_color' | 'accent_color' | 'sidebar_color' | 'logo_storage_path'>): CompanyBranding {
  return {
    primaryColor: row.primary_color,
    accentColor: row.accent_color,
    sidebarColor: row.sidebar_color,
    logoUrl: row.logo_storage_path ? '/api/settings/company-branding/logo' : null,
  }
}

export async function getBrandingForAdministration(tenantId: string, administrationId: string, existingClient?: SupabaseServerClient): Promise<CompanyBranding | null> {
  const supabase = existingClient ?? await createClient()
  const { data, error } = await supabase
    .from('administration_branding')
    .select('primary_color, accent_color, sidebar_color, logo_storage_path')
    .eq('tenant_id', tenantId)
    .eq('administration_id', administrationId)
    .maybeSingle()
  if (error || !data) return null
  return brandingFromRow(data)
}

export async function getAdministrationBrandingForSettings(): Promise<CompanyBranding | null> {
  const context = await requirePermission('settings:read')
  if (!context.administrationId) return null
  return getBrandingForAdministration(context.tenantId, context.administrationId)
}

export async function saveAdministrationBranding(input: {
  primaryColor: string
  accentColor: string
  sidebarColor: string
  logo: File | null
  removeLogo: boolean
}): Promise<CompanyBranding> {
  const parsedColors = brandingColorsSchema.safeParse({
    primaryColor: input.primaryColor,
    accentColor: input.accentColor,
    sidebarColor: input.sidebarColor,
  })
  if (!parsedColors.success) throw new Error('BRANDING_COLORS_INVALID')
  const values = parsedColors.data
  const context = await requirePermission('settings:write')
  if (!context.administrationId) throw new Error('BRANDING_ADMINISTRATION_REQUIRED')
  if (input.logo && (!['image/png', 'image/jpeg', 'image/webp'].includes(input.logo.type) || input.logo.size > 2 * 1024 * 1024)) {
    throw new Error('BRANDING_LOGO_INVALID')
  }

  const supabase = await createClient()
  const { data: current, error: currentError } = await supabase
    .from('administration_branding')
    .select('primary_color, accent_color, sidebar_color, logo_storage_path')
    .eq('tenant_id', context.tenantId)
    .eq('administration_id', context.administrationId)
    .maybeSingle()
  if (currentError) throw new Error('BRANDING_READ_FAILED')

  let logoStoragePath = current?.logo_storage_path ?? null
  if (input.removeLogo) logoStoragePath = null
  if (input.logo) {
    const extension = input.logo.type === 'image/png' ? 'png' : input.logo.type === 'image/webp' ? 'webp' : 'jpg'
    logoStoragePath = `${context.tenantId}/${context.administrationId}/${crypto.randomUUID()}.${extension}`
    const upload = await supabase.storage.from('administration-branding').upload(logoStoragePath, input.logo, { contentType: input.logo.type, upsert: false })
    if (upload.error) throw new Error('BRANDING_LOGO_UPLOAD_FAILED')
  }

  const { error: saveError } = await supabase.from('administration_branding').upsert({
    tenant_id: context.tenantId,
    administration_id: context.administrationId,
    primary_color: values.primaryColor,
    accent_color: values.accentColor,
    sidebar_color: values.sidebarColor,
    logo_storage_path: logoStoragePath,
    updated_by: context.userId,
  }, { onConflict: 'tenant_id,administration_id' })
  if (saveError) {
    if (input.logo && logoStoragePath) await supabase.storage.from('administration-branding').remove([logoStoragePath])
    throw new Error('BRANDING_SAVE_FAILED')
  }
  if (current?.logo_storage_path && current.logo_storage_path !== logoStoragePath) {
    await supabase.storage.from('administration-branding').remove([current.logo_storage_path])
  }
  return {
    primaryColor: values.primaryColor,
    accentColor: values.accentColor,
    sidebarColor: values.sidebarColor,
    logoUrl: logoStoragePath ? '/api/settings/company-branding/logo' : null,
  }
}

export async function getActiveAdministrationBrandingLogo(): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (!userId) return null
  const context = await loadActiveContext(userId, supabase)
  const administrationId = context.activeAdministration?.id
  if (!administrationId) return null
  const { data, error } = await supabase
    .from('administration_branding')
    .select('logo_storage_path')
    .eq('tenant_id', context.tenant.id)
    .eq('administration_id', administrationId)
    .maybeSingle()
  if (error || !data?.logo_storage_path) return null
  const signed = await supabase.storage.from('administration-branding').createSignedUrl(data.logo_storage_path, 300)
  if (signed.error || !signed.data?.signedUrl) return null
  const response = await fetch(signed.data.signedUrl)
  if (!response.ok) return null
  return { body: await response.arrayBuffer(), contentType: response.headers.get('content-type') ?? 'image/png' }
}
