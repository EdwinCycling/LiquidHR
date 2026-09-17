import {
  getEmployeeJourneyProjections,
} from '@/lib/journeys/projection-service'
import {
  localizedValue,
  type JourneyProjection,
} from '@/lib/journeys/projection-domain'
import { getRequestAuthorizationContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import {
  resolveEmploymentAccessState,
  resolveFocusExperience,
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
  | 'requests'
  | 'work'
  | 'team'

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

function focusActions(input: {
  employeeId: string
  experience: FocusHomeData['experience']
  permissions: readonly string[]
  journey: JourneyProjection | null
}): FocusAction[] {
  const actions: FocusAction[] = []
  const add = (key: FocusActionKey, href: string) => actions.push({ key, href })
  const permissions = new Set(input.permissions)

  if (permissions.has('self:journey:read') && input.journey) add('journey', '/focus/onboarding')
  if (permissions.has('self:employee:read')) add('profile', '/focus/profiel')
  if (permissions.has('self:document:read') || permissions.has('self:document-signing:read')) add('documents', '/focus/documenten')

  if (input.experience !== 'PREBOARDING') {
    if (permissions.has('self:leave:read')) add('leave', `/employees/${input.employeeId}/leave`)
    if (permissions.has('self:process-task:read')) add('requests', '/focus/aanvragen')
    if (permissions.has('process-task:read') || permissions.has('process-instance:read')) add('work', '/focus/werk')
    if (permissions.has('organization-chart:read') || permissions.has('self:organization-chart:read')) add('team', '/focus/team')
  }

  return actions
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

  return {
    employee: employeeResult.data,
    employments: (employmentResult.data ?? []).map((employment) => ({
      startsOn: employment.starts_on,
      endsOn: employment.ends_on,
      recordStatus: employment.record_status,
      deletedAt: employment.deleted_at,
    })),
  }
}

export async function getFocusHomeData(options: {
  today?: string
  device?: FocusDevice
  explicitPresentation?: FocusPresentation | null
} = {}): Promise<FocusHomeData> {
  const requestContext = await getRequestAuthorizationContext()
  const { context, supabase } = requestContext
  const today = options.today ?? new Date().toISOString().slice(0, 10)
  const device = options.device ?? 'DESKTOP'
  const employeeId = context.employeeId

  if (!employeeId || !context.hrGroupId) {
    return {
      experience: 'NO_EMPLOYMENT',
      presentation: 'FULL',
      employee: null,
      journey: null,
      actions: [],
      isPreboarding: false,
      canOpenFull: true,
    }
  }

  const focusData = await readEmployeeFocusData(supabase, context.tenantId, context.hrGroupId, employeeId)
  if (!focusData.employee) {
    return {
      experience: 'NO_EMPLOYMENT',
      presentation: 'FULL',
      employee: null,
      journey: null,
      actions: [],
      isPreboarding: false,
      canOpenFull: true,
    }
  }

  const accessState = resolveEmploymentAccessState(today, focusData.employments)
  const experience = resolveFocusExperience(accessState, context.activeRoles)
  const journeys = context.permissions.includes('self:journey:read')
    ? await getEmployeeJourneyProjections(employeeId).catch(() => [])
    : []
  const journey = featuredJourney(journeys)
  const permissions = experience === 'PREBOARDING'
    ? context.permissions.filter((permission) => permission.startsWith('self:'))
    : context.permissions

  return {
    experience,
    presentation: resolvePresentation({
      experience,
      activeRoles: context.activeRoles,
      device,
      explicitPreference: options.explicitPresentation,
    }),
    employee: {
      id: focusData.employee.id,
      name: employeeName(focusData.employee),
      avatarUrl: focusData.employee.avatar_url,
      effectiveEmploymentStartDate: accessState.effectiveStartDate,
    },
    journey,
    actions: focusActions({ employeeId, experience, permissions, journey }),
    isPreboarding: experience === 'PREBOARDING',
    canOpenFull: experience !== 'PREBOARDING',
  }
}

export function focusJourneyActionHref(journey: JourneyProjection | null): string | null {
  return safeJourneyActionUrl(journey?.nextAction?.actionUrl ?? null)
}

export function focusJourneyTitle(journey: JourneyProjection | null, locale: string): string | null {
  return journey ? localizedValue(journey.templateName, locale) : null
}
