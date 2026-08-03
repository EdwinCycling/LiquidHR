import type { Database } from '@scope/db'
import { AuthorizationError, requireAuthContext, type AuthContext } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'

type NotificationRow = Database['public']['Tables']['talent_notifications']['Row']
type NotificationStatus = 'OPEN' | 'READ' | 'DONE' | 'DISMISSED'

export type TalentNotification = Pick<NotificationRow, 'id' | 'event_type' | 'title' | 'summary' | 'status' | 'created_at' | 'read_at' | 'handled_at' | 'source_entity_id'>

export class TalentNotificationError extends Error {
  constructor(public readonly code: string, public readonly status = 500) {
    super(code)
    this.name = 'TalentNotificationError'
  }
}

function canReadNotifications(context: AuthContext): boolean {
  return context.permissions.includes('talent:manage')
    || context.permissions.includes('talent:read')
    || context.permissions.includes('talent-goal:manage')
    || context.permissions.includes('talent-goal:read')
    || context.permissions.includes('self:talent-goal:read')
}

export async function listTalentNotifications(): Promise<TalentNotification[]> {
  const context = await requireAuthContext()
  if (!canReadNotifications(context)) throw new AuthorizationError('Je hebt geen toegang tot Talentmeldingen.')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  let query = supabase
    .from('talent_notifications')
    .select('id, event_type, title, summary, status, created_at, read_at, handled_at, source_entity_id')
    .eq('tenant_id', context.tenantId)
    .order('created_at', { ascending: false })
    .limit(100)
  const canReadTenantNotifications = context.permissions.includes('talent:manage')
    || context.permissions.includes('talent:read')
    || context.permissions.includes('talent-goal:manage')
  if (!canReadTenantNotifications) query = query.eq('recipient_user_id', context.userId)
  const { data, error } = await query
  if (error) throw new TalentNotificationError('TALENT_NOTIFICATION_READ_FAILED')
  return (data ?? []) as TalentNotification[]
}

export async function updateTalentNotification(notificationId: string, status: Exclude<NotificationStatus, 'OPEN'>): Promise<void> {
  const context = await requireAuthContext()
  if (!canReadNotifications(context)) throw new AuthorizationError('Je hebt geen toegang tot Talentmeldingen.')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const now = new Date().toISOString()
  const update: Database['public']['Tables']['talent_notifications']['Update'] = {
    status,
    read_at: status === 'READ' ? now : undefined,
    handled_at: status === 'DONE' || status === 'DISMISSED' ? now : null,
  }
  const { data, error } = await supabase
    .from('talent_notifications')
    .update(update)
    .eq('tenant_id', context.tenantId)
    .eq('id', notificationId)
    .select('id')
    .maybeSingle()
  if (error) throw new TalentNotificationError('TALENT_NOTIFICATION_UPDATE_FAILED')
  if (!data) throw new TalentNotificationError('TALENT_NOTIFICATION_NOT_FOUND', 404)
}

export async function createTalentGoalNotification(tenantId: string, employeeId: string, goalId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('create_talent_notification', {
    requested_tenant_id: tenantId,
    requested_recipient_employee_id: employeeId,
    requested_event_type: 'GOAL_OPEN',
    requested_title: 'Open ontwikkeldoel',
    requested_summary: 'Er staat een ontwikkeldoel klaar om te bekijken of bij te werken.',
    requested_source_entity_id: goalId,
  })
  if (error) throw new TalentNotificationError('TALENT_NOTIFICATION_CREATE_FAILED')
}
