import {
  getEmployeeJourneyProjections,
} from '@/lib/journeys/projection-service'
import {
  localizedValue,
  type JourneyProjection,
} from '@/lib/journeys/projection-domain'
import { AuthorizationError, getRequestAuthorizationContext, getSelfPermissions } from '@/lib/auth/permissions'
import { readEmployeeEssAccess } from '@/lib/auth/employee-ess-access'
import { createClient } from '@/lib/supabase/server'
import { resolveFocusActAsSession, type FocusActAsSession } from './act-as-token'
import { loadFocusManagerHomeForContext, type FocusManagerHomeData } from './manager-home-service'
import { readFocusPreviewCookie } from './preview-token'
import {
  resolveEmploymentAccessState,
  resolveFocusExperience,
  isFullPortalAllowed,
  resolvePresentation,
  type FocusDevice,
  type FocusPresentation,
} from './access-state'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type FocusActionKey =
  | 'journey'
  | 'profile'
  | 'documents'
  | 'leave'
  | 'hours'
  | 'requests'
  | 'work'
  | 'team'
  | 'absence'

export interface FocusAction {
  key: FocusActionKey
  href: string
}

export interface FocusEmployeeSummary {
  id: string
  name: string
  avatarUrl: string | null
  effectiveEmploymentStartDate: string | null
}

export interface FocusHomeData {
  experience: ReturnType<typeof resolveFocusExperience>
  presentation: FocusPresentation
  employee: FocusEmployeeSummary | null
  journey: JourneyProjection | null
  actions: FocusAction[]
  isPreboarding: boolean
  canOpenFull: boolean
  isEssBlocked: boolean
  readOnly: boolean
  isPreview: boolean
  canRequestLeave: boolean
  canReportAbsence: boolean
  canReportEmployeeAbsence: boolean
  managerHome: FocusManagerHomeData | null
  actAs: FocusActAsSession | null
}

function employeeName(employee: { first_name: string; birth_name: string }): string {
  return `${employee.first_name} ${employee.birth_name}`.trim()
}

function safeJourneyActionUrl(actionUrl: string | null): string | null {
  if (!actionUrl) return null
  try {
    const parsed = new URL(actionUrl, 'https://liquidhr.local')
    if (parsed.origin !== 'https://liquidhr.local' || !parsed.pathname.startsWith('/')) return null
    const allowedPrefixes = ['/journeys/', '/my-signatures', '/company-documents', '/employees/']
    if (!allowedPrefixes.some((prefix) => parsed.pathname.startsWith(prefix))) return null
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return null
  }
}

function featuredJourney(journeys: readonly JourneyProjection[]): JourneyProjection | null {
  return [...journeys]
    .filter((journey) => journey.status === 'ACTIVE' || journey.status === 'PLANNED')
    .sort((left, right) => {
      const leftAction = left.nextAction?.availableOn ?? left.anchorDate
      const rightAction = right.nextAction?.availableOn ?? right.anchorDate
      return leftAction.localeCompare(rightAction)
    })[0] ?? null
}

export function focusActions(input: {
  employeeId: string
  experience: FocusHomeData['experience']
  permissions: readonly string[]
  journey: JourneyProjection | null
  blocked?: boolean
  employeeSelfReportEnabled?: boolean
}): FocusAction[] {
  const actions: FocusAction[] = []
  if (input.experience === 'NO_EMPLOYMENT') return actions
  const add = (key: FocusActionKey, href: string) => actions.push({ key, href })
  const permissions = new Set(input.permissions)
  const canUseEmployeeSelfservice = !input.blocked

  if (canUseEmployeeSelfservice && permissions.has('self:journey:read') && input.journey) add('journey', '/focus/onboarding')
  if (canUseEmployeeSelfservice && permissions.has('self:employee:read')) add('profile', '/focus/profiel')
  if (canUseEmployeeSelfservice && (permissions.has('self:document:read') || permissions.has('self:document-signing:read'))) add('documents', '/focus/documenten')

  if (input.experience !== 'PREBOARDING') {
    if (canUseEmployeeSelfservice && permissions.has('self:leave:read')) add('leave', '/focus/verlof')
    if (canUseEmployeeSelfservice && permissions.has('self:leave:read')) add('hours', '/focus/uren')
    if (canUseEmployeeSelfservice && permissions.has('self:absence:write') && input.employeeSelfReportEnabled === true) add('absence', '/focus/ziek')
    if ((canUseEmployeeSelfservice && permissions.has('self:process-task:read')) || (input.experience === 'MANAGER' && (permissions.has('process-task:read') || permissions.has('process-instance:read')))) add('requests', '/focus/aanvragen')
    if ((input.experience === 'MANAGER' && (permissions.has('process-task:read') || permissions.has('process-instance:read') || permissions.has('absence:read') || permissions.has('absence:write')) || (canUseEmployeeSelfservice && (permissions.has('process-task:read') || permissions.has('process-instance:read') || permissions.has('self:process-task:read') || permissions.has('self:process-instance:read'))))) add('work', '/focus/werk')
    if ((input.experience === 'MANAGER' || canUseEmployeeSelfservice) && (permissions.has('organization-chart:read') || permissions.has('self:organization-chart:read') || permissions.has('self:employee:read') || (input.experience === 'MANAGER' && (permissions.has('absence:read') || permissions.has('absence:write'))))) add('team', '/focus/team')
  }

  return actions
}

async function readEmployeeSelfReportEnabled(
  supabase: SupabaseServerClient,
  tenantId: string,
  hrGroupId: string,
): Promise<boolean> {
  const result = await supabase.rpc('get_employee_self_report_enabled', {
    requested_tenant_id: tenantId,
    requested_hr_group_id: hrGroupId,
  })
  return !result.error && result.data === true
}

async function readEmployeeFocusData(
  supabase: SupabaseServerClient,
  tenantId: string,
  hrGroupId: string,
  employeeId: string,
) {
  const [employeeResult, employmentResult] = await Promise.all([
    supabase
      .from('employees')
      .select('id,first_name,birth_name,avatar_url')
      .eq('tenant_id', tenantId)
      .eq('hr_group_id', hrGroupId)
      .eq('id', employeeId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('employments')
      .select('starts_on,ends_on,record_status,deleted_at')
      .eq('tenant_id', tenantId)
      .eq('hr_group_id', hrGroupId)
      .eq('employee_id', employeeId)
      .is('deleted_at', null)
      .order('starts_on', { ascending: true })
      .limit(100),
  ])

  if (employeeResult.error) throw employeeResult.error
  if (employmentResult.error) throw employmentResult.error

  const essAccess = employeeResult.data
    ? await readEmployeeEssAccess(supabase, employeeResult.data.id)
    : null

  return {
    employee: employeeResult.data,
    employments: (employmentResult.data ?? []).map((employment) => ({
      startsOn: employment.starts_on,
      endsOn: employment.ends_on,
      recordStatus: employment.record_status,
      deletedAt: employment.deleted_at,
    })),
    isEssBlocked: essAccess?.status === 'BLOCKED',
  }
}

export async function getFocusHomeData(options: {
  today?: string
  device?: FocusDevice
  explicitPresentation?: FocusPresentation | null
  actAsToken?: string | null
} = {}): Promise<FocusHomeData> {
  const requestContext = await getRequestAuthorizationContext()
  const { context, supabase } = requestContext
  const today = options.today ?? new Date().toISOString().slice(0, 10)
  const device = options.device ?? 'DESKTOP'
  const actAs = await resolveFocusActAsSession(options.actAsToken, context, supabase)
  const employeeId = actAs?.subjectEmployeeId ?? context.employeeId

  if (!employeeId || !context.hrGroupId) {
    return {
      experience: 'NO_EMPLOYMENT',
      presentation: 'FOCUS',
      employee: null,
      journey: null,
      actions: [],
      isPreboarding: false,
      canOpenFull: false,
      isEssBlocked: false,
      readOnly: false,
      isPreview: false,
      canRequestLeave: false,
      canReportAbsence: false,
      canReportEmployeeAbsence: false,
      managerHome: null,
      actAs: null,
    }
  }

  const focusData = await readEmployeeFocusData(supabase, context.tenantId, context.hrGroupId, employeeId)
  if (!focusData.employee) {
    return {
      experience: 'NO_EMPLOYMENT',
      presentation: 'FOCUS',
      employee: null,
      journey: null,
      actions: [],
      isPreboarding: false,
      canOpenFull: false,
      isEssBlocked: false,
      readOnly: false,
      isPreview: false,
      canRequestLeave: false,
      canReportAbsence: false,
      canReportEmployeeAbsence: false,
      managerHome: null,
      actAs,
    }
  }

  const accessState = resolveEmploymentAccessState(today, focusData.employments)
  const effectiveRoles = actAs ? ['EMPLOYEE'] : context.activeRoles
  const effectivePermissions = actAs ? await getSelfPermissions(supabase, context.tenantId) : context.permissions
  const experience = resolveFocusExperience(accessState, effectiveRoles)
  const journeys = experience !== 'NO_EMPLOYMENT' && effectivePermissions.includes('self:journey:read')
    ? await getEmployeeJourneyProjections(employeeId).catch(() => [])
    : []
  const journey = featuredJourney(journeys)
  const permissions = experience === 'PREBOARDING'
    ? effectivePermissions.filter((permission) => permission.startsWith('self:'))
    : effectivePermissions
  const isEssBlocked = focusData.isEssBlocked
  const employeeSelfReportEnabled = !isEssBlocked
    && experience === 'EMPLOYEE'
    && permissions.includes('self:absence:write')
    ? await readEmployeeSelfReportEnabled(supabase, context.tenantId, context.hrGroupId)
    : false
  const managerHome = experience === 'MANAGER' && !actAs
    ? await loadFocusManagerHomeForContext(context, today, supabase)
    : null

  return {
    experience,
    presentation: actAs ? 'FOCUS' : resolvePresentation({
      experience,
      activeRoles: effectiveRoles,
      device,
      explicitPreference: options.explicitPresentation,
      employeePortalMode: context.employeePortalMode,
      managerPortalMode: context.managerPortalMode,
      blocked: isEssBlocked,
    }),
    employee: {
      id: focusData.employee.id,
      name: employeeName(focusData.employee),
      avatarUrl: focusData.employee.avatar_url,
      effectiveEmploymentStartDate: accessState.effectiveStartDate,
    },
    journey,
    actions: focusActions({ employeeId, experience, permissions, journey, blocked: isEssBlocked, employeeSelfReportEnabled }),
    isPreboarding: experience === 'PREBOARDING',
    canOpenFull: actAs ? false : isFullPortalAllowed({
      experience,
      activeRoles: effectiveRoles,
      employeePortalMode: context.employeePortalMode,
      managerPortalMode: context.managerPortalMode,
      blocked: isEssBlocked,
    }),
    isEssBlocked,
    readOnly: false,
    isPreview: false,
    canRequestLeave: !isEssBlocked && experience === 'EMPLOYEE' && permissions.includes('self:leave:request'),
    canReportAbsence: !isEssBlocked && experience === 'EMPLOYEE' && permissions.includes('self:absence:write') && employeeSelfReportEnabled,
    canReportEmployeeAbsence: !isEssBlocked && experience === 'MANAGER' && !actAs && permissions.includes('absence:write'),
    managerHome,
    actAs,
  }
}

export async function getFocusPreviewData(employeeId: string, options: { today?: string } = {}): Promise<FocusHomeData> {
  const requestContext = await getRequestAuthorizationContext()
  const preview = await readFocusPreviewCookie()
  if (
    !preview
    || preview.actorUserId !== requestContext.context.userId
    || preview.tenantId !== requestContext.context.tenantId
    || preview.hrGroupId !== requestContext.context.hrGroupId
    || preview.employeeId !== employeeId
  ) throw new AuthorizationError('Deze Focus-preview is ongeldig of verlopen.')
  if (!requestContext.context.permissions.includes('user:invite')) throw new AuthorizationError('Je hebt geen recht om een Focus-preview te openen.')

  const today = options.today ?? new Date().toISOString().slice(0, 10)
  const focusData = await readEmployeeFocusData(
    requestContext.supabase,
    requestContext.context.tenantId,
    requestContext.context.hrGroupId ?? '',
    employeeId,
  )
  if (!focusData.employee) throw new AuthorizationError('Deze medewerker valt niet binnen je actieve HR-groep.')

  const accessState = resolveEmploymentAccessState(today, focusData.employments)
  const experience = resolveFocusExperience(accessState, ['EMPLOYEE'])
  const permissions = await getSelfPermissions(requestContext.supabase, requestContext.context.tenantId)
  const journeys = experience !== 'NO_EMPLOYMENT' && permissions.includes('self:journey:read')
    ? await getEmployeeJourneyProjections(employeeId).catch(() => [])
    : []
  const journey = featuredJourney(journeys)
  const employeeSelfReportEnabled = !focusData.isEssBlocked
    && experience === 'EMPLOYEE'
    && permissions.includes('self:absence:write')
    ? await readEmployeeSelfReportEnabled(requestContext.supabase, requestContext.context.tenantId, requestContext.context.hrGroupId ?? '')
    : false

  return {
    experience,
    presentation: 'FOCUS',
    employee: {
      id: focusData.employee.id,
      name: employeeName(focusData.employee),
      avatarUrl: focusData.employee.avatar_url,
      effectiveEmploymentStartDate: accessState.effectiveStartDate,
    },
    journey,
    actions: focusActions({ employeeId, experience, permissions, journey, blocked: focusData.isEssBlocked, employeeSelfReportEnabled }),
    isPreboarding: experience === 'PREBOARDING',
    canOpenFull: false,
    isEssBlocked: focusData.isEssBlocked,
    readOnly: true,
    isPreview: true,
    canRequestLeave: false,
    canReportAbsence: false,
    canReportEmployeeAbsence: false,
    managerHome: null,
    actAs: null,
  }
}

export function focusJourneyActionHref(journey: JourneyProjection | null): string | null {
  return safeJourneyActionUrl(journey?.nextAction?.actionUrl ?? null)
}

export function focusJourneyTitle(journey: JourneyProjection | null, locale: string): string | null {
  return journey ? localizedValue(journey.templateName, locale) : null
}
