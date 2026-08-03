import type { Database } from '@scope/db'
import { AuthorizationError, requireAuthContext, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import type { ProductUpdateInput, ProductUpdateSurfaceSeenInput } from './schemas'

type ProductUpdateRow = Database['public']['Tables']['product_updates']['Row']
type ProductUpdateWrite = Database['public']['Tables']['product_updates']['Insert']
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type ProductUpdateKind = 'NEW_FEATURE' | 'IMPROVEMENT'
export type ProductUpdateChannel = 'GIFT_WINDOW' | 'LOGIN_POPUP' | 'TOP_BANNER'
export type ProductUpdateAudience = 'TENANT_ADMIN' | 'DIRECT_MANAGER' | 'EMPLOYEE'
export type ProductUpdateScope = 'GLOBAL' | 'TENANT'
export type ProductUpdateSurfaceChannel = 'LOGIN_POPUP' | 'TOP_BANNER'

export interface ProductUpdate {
  id: string
  tenantId: string | null
  scope: ProductUpdateScope
  kind: ProductUpdateKind
  title: string
  summary: string
  content: string
  startsAt: string | null
  endsAt: string | null
  displayChannels: ProductUpdateChannel[]
  audienceRoles: ProductUpdateAudience[]
  isActive: boolean
  createdAt: string
}

export interface ProductUpdateDashboardData {
  updates: ProductUpdate[]
  bannerUpdates: ProductUpdate[]
  loginPopupUpdates: ProductUpdate[]
  unreadGiftCount: number
}

export class ProductUpdateServiceError extends Error {
  constructor(readonly code: string, readonly status: 400 | 403 | 404 | 500) {
    super(code)
  }
}

function toProductUpdate(row: ProductUpdateRow): ProductUpdate {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    scope: row.tenant_id === null ? 'GLOBAL' : 'TENANT',
    kind: row.kind as ProductUpdateKind,
    title: row.title,
    summary: row.summary,
    content: row.content,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    displayChannels: row.display_channels as ProductUpdateChannel[],
    audienceRoles: row.audience_roles as ProductUpdateAudience[],
    isActive: row.is_active,
    createdAt: row.created_at,
  }
}

type ReadDependencies = {
  context: Pick<AuthContext, 'tenantId' | 'userId'>
  supabase: SupabaseServerClient
}

async function listVisibleProductUpdates(dependencies?: ReadDependencies): Promise<{ updates: ProductUpdate[]; bannerUpdates: ProductUpdate[]; loginPopupUpdates: ProductUpdate[]; stateLastSeenAt: string | null }> {
  const context = dependencies?.context ?? await requireAuthContext()
  const supabase = dependencies?.supabase ?? await createClient()
  const now = new Date().toISOString()
  const [{ data, error }, { data: state, error: stateError }, { data: dismissals, error: dismissalsError }] = await Promise.all([
    supabase.from('product_updates').select('*').or(`tenant_id.is.null,tenant_id.eq.${context.tenantId}`).eq('is_active', true).or(`starts_at.is.null,starts_at.lte.${now}`).or(`ends_at.is.null,ends_at.gte.${now}`).order('starts_at', { ascending: false, nullsFirst: false }).limit(100),
    supabase.from('product_update_user_state').select('last_seen_at').eq('tenant_id', context.tenantId).eq('user_id', context.userId).maybeSingle(),
    supabase.from('product_update_surface_dismissals').select('product_update_id,channel').eq('tenant_id', context.tenantId).eq('user_id', context.userId),
  ])
  if (error || stateError || dismissalsError) throw new ProductUpdateServiceError('PRODUCT_UPDATES_READ_FAILED', 500)
  const updates = (data ?? []).map(toProductUpdate)
  const dismissalKeys = new Set((dismissals ?? []).map((dismissal) => `${dismissal.product_update_id}:${dismissal.channel}`))
  const notDismissed = (update: ProductUpdate, channel: ProductUpdateSurfaceChannel): boolean => !dismissalKeys.has(`${update.id}:${channel}`)
  return {
    updates,
    bannerUpdates: updates.filter((update) => update.displayChannels.includes('TOP_BANNER') && notDismissed(update, 'TOP_BANNER')),
    loginPopupUpdates: updates.filter((update) => update.displayChannels.includes('LOGIN_POPUP') && notDismissed(update, 'LOGIN_POPUP')),
    stateLastSeenAt: state?.last_seen_at ?? null,
  }
}

export async function getProductUpdateDashboardData(dependencies?: ReadDependencies): Promise<ProductUpdateDashboardData> {
  const { updates, bannerUpdates, loginPopupUpdates, stateLastSeenAt } = await listVisibleProductUpdates(dependencies)
  const unreadGiftCount = updates.filter((update) => update.displayChannels.includes('GIFT_WINDOW') && (!stateLastSeenAt || (update.startsAt ?? update.createdAt) > stateLastSeenAt)).length
  return { updates, bannerUpdates, loginPopupUpdates, unreadGiftCount }
}

export async function markProductUpdatesSeen(): Promise<void> {
  const context = await requireAuthContext()
  const supabase = await createClient()
  const { updates } = await listVisibleProductUpdates({ context, supabase })
  const giftUpdates = updates.filter((update) => update.displayChannels.includes('GIFT_WINDOW'))
  if (giftUpdates.length === 0) return
  const { error } = await supabase.from('product_update_user_state').upsert({
    tenant_id: context.tenantId,
    user_id: context.userId,
    last_seen_at: new Date().toISOString(),
    last_seen_update_id: giftUpdates[0]?.id ?? null,
  }, { onConflict: 'tenant_id,user_id' })
  if (error) throw new ProductUpdateServiceError('PRODUCT_UPDATES_SEEN_FAILED', 500)
}

export async function markProductUpdateSurfaceSeen(input: ProductUpdateSurfaceSeenInput): Promise<void> {
  const context = await requireAuthContext()
  const supabase = await createClient()
  const { updates } = await listVisibleProductUpdates({ context, supabase })
  const update = updates.find((candidate) => candidate.id === input.updateId)
  if (!update || !update.displayChannels.includes(input.channel)) {
    throw new ProductUpdateServiceError('PRODUCT_UPDATE_NOT_FOUND', 404)
  }
  const { error } = await supabase.from('product_update_surface_dismissals').upsert({
    tenant_id: context.tenantId,
    user_id: context.userId,
    product_update_id: input.updateId,
    channel: input.channel,
    seen_at: new Date().toISOString(),
  }, { onConflict: 'tenant_id,user_id,product_update_id,channel' })
  if (error) throw new ProductUpdateServiceError('PRODUCT_UPDATE_SURFACE_SEEN_FAILED', 500)
}

export interface ProductUpdateManagementData {
  updates: ProductUpdate[]
  canManageGlobal: boolean
  canManageTenant: boolean
}

export async function listManagedProductUpdates(): Promise<ProductUpdateManagementData> {
  const context = await requireAuthContext()
  const canManageGlobal = context.permissions.includes('product-updates:global-write')
  const canManageTenant = context.permissions.includes('product-updates:write')
  if (!canManageGlobal && !canManageTenant) {
    throw new AuthorizationError('Je hebt onvoldoende rechten voor deze actie.')
  }
  const supabase = await createClient()
  const { data, error } = await supabase.from('product_updates').select('*').or(`tenant_id.is.null,tenant_id.eq.${context.tenantId}`).order('starts_at', { ascending: false, nullsFirst: false }).limit(250)
  if (error) throw new ProductUpdateServiceError('PRODUCT_UPDATES_READ_FAILED', 500)
  return { updates: (data ?? []).map(toProductUpdate), canManageGlobal, canManageTenant }
}

function writePayload(input: ProductUpdateInput, context: AuthContext, scope: ProductUpdateScope): ProductUpdateWrite {
  return {
    tenant_id: scope === 'GLOBAL' ? null : context.tenantId,
    kind: input.kind,
    title: input.title,
    summary: input.summary,
    content: input.content,
    starts_at: input.startsAt ?? null,
    ends_at: input.endsAt ?? null,
    display_channels: input.displayChannels,
    audience_roles: input.audienceRoles,
    is_active: input.isActive,
    created_by_user_id: context.userId,
    updated_by_user_id: context.userId,
  }
}

export async function createProductUpdate(input: ProductUpdateInput, scope: ProductUpdateScope): Promise<ProductUpdate> {
  const context = await requirePermission(scope === 'GLOBAL' ? 'product-updates:global-write' : 'product-updates:write')
  const supabase = await createClient()
  const { data, error } = await supabase.from('product_updates').insert(writePayload(input, context, scope)).select('*').single()
  if (error || !data) throw new ProductUpdateServiceError('PRODUCT_UPDATE_CREATE_FAILED', 500)
  return toProductUpdate(data)
}

export async function updateProductUpdate(id: string, input: ProductUpdateInput): Promise<ProductUpdate> {
  const context = await requireAuthContext()
  const supabase = await createClient()
  const { data: existing, error: existingError } = await supabase.from('product_updates').select('id,tenant_id').eq('id', id).maybeSingle()
  if (existingError) throw new ProductUpdateServiceError('PRODUCT_UPDATE_UPDATE_FAILED', 500)
  if (!existing) throw new ProductUpdateServiceError('PRODUCT_UPDATE_NOT_FOUND', 404)
  const canEdit = existing.tenant_id === null
    ? context.permissions.includes('product-updates:global-write')
    : existing.tenant_id === context.tenantId && context.permissions.includes('product-updates:write')
  if (!canEdit) throw new ProductUpdateServiceError('PRODUCT_UPDATE_FORBIDDEN', 403)
  const updatePayload = {
    kind: input.kind,
    title: input.title,
    summary: input.summary,
    content: input.content,
    starts_at: input.startsAt ?? null,
    ends_at: input.endsAt ?? null,
    display_channels: input.displayChannels,
    audience_roles: input.audienceRoles,
    is_active: input.isActive,
    updated_by_user_id: context.userId,
  }
  const query = supabase.from('product_updates').update(updatePayload).eq('id', id)
  const scopedQuery = existing.tenant_id === null ? query.is('tenant_id', null) : query.eq('tenant_id', context.tenantId)
  const { data, error } = await scopedQuery.select('*').maybeSingle()
  if (error) throw new ProductUpdateServiceError('PRODUCT_UPDATE_UPDATE_FAILED', 500)
  if (!data) throw new ProductUpdateServiceError('PRODUCT_UPDATE_NOT_FOUND', 404)
  return toProductUpdate(data)
}

export async function deleteProductUpdate(id: string): Promise<void> {
  const context = await requireAuthContext()
  const supabase = await createClient()
  const { data: existing, error: existingError } = await supabase.from('product_updates').select('id,tenant_id').eq('id', id).maybeSingle()
  if (existingError) throw new ProductUpdateServiceError('PRODUCT_UPDATE_DELETE_FAILED', 500)
  if (!existing) throw new ProductUpdateServiceError('PRODUCT_UPDATE_NOT_FOUND', 404)
  const canDelete = existing.tenant_id === null
    ? context.permissions.includes('product-updates:global-write')
    : existing.tenant_id === context.tenantId && context.permissions.includes('product-updates:write')
  if (!canDelete) throw new ProductUpdateServiceError('PRODUCT_UPDATE_FORBIDDEN', 403)
  const query = supabase.from('product_updates').delete().eq('id', id)
  const scopedQuery = existing.tenant_id === null ? query.is('tenant_id', null) : query.eq('tenant_id', context.tenantId)
  const { data, error } = await scopedQuery.select('id').maybeSingle()
  if (error) throw new ProductUpdateServiceError('PRODUCT_UPDATE_DELETE_FAILED', 500)
  if (!data) throw new ProductUpdateServiceError('PRODUCT_UPDATE_NOT_FOUND', 404)
}
