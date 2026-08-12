import { z } from 'zod'

export const localizedJourneyTextSchema = z.object({
  nl: z.string().trim().min(1).max(5000),
  en: z.string().trim().min(1).max(5000),
}).strict()

const keySchema = z.string().trim().regex(/^[a-z][a-z0-9_-]*$/).max(80)

export const journeyTemplateDraftSchema = z.object({
  name: localizedJourneyTextSchema,
  description: localizedJourneyTextSchema,
  journeyType: z.enum(['PREBOARDING', 'ONBOARDING', 'REBOARDING', 'INTERNAL_TRANSFER', 'PROMOTION', 'RETURN', 'OFFBOARDING', 'CUSTOM']),
  anchorRule: z.enum(['EMPLOYMENT_START_DATE', 'MANUAL_DATE']),
  phases: z.array(z.object({ key: keySchema, name: localizedJourneyTextSchema, sortOrder: z.number().int().nonnegative() }).strict()).min(1).max(50),
  roles: z.array(z.object({
    key: keySchema,
    name: localizedJourneyTextSchema,
    required: z.boolean(),
    cardinality: z.enum(['ONE', 'MANY']),
    resolverType: z.enum(['TARGET_EMPLOYEE', 'DIRECT_MANAGER', 'DEPARTMENT_MANAGER', 'SPECIFIC_EMPLOYEE', 'MANUAL']),
    resolverRoleCode: z.string().trim().min(1).max(80).nullable(),
    resolverEmployeeId: z.string().uuid().nullable(),
    sortOrder: z.number().int().nonnegative(),
  }).strict()).min(1).max(50),
  moments: z.array(z.object({
    key: keySchema,
    phaseKey: keySchema,
    name: localizedJourneyTextSchema,
    dateOffsetDays: z.number().int().min(-730).max(730),
    availabilityOffsetDays: z.number().int().min(-730).max(730),
    sortOrder: z.number().int().nonnegative(),
  }).strict()).min(1).max(250),
  topics: z.array(z.object({
    key: keySchema,
    momentKey: keySchema,
    ownerRoleKey: keySchema,
    topicType: z.enum(['INFORMATION', 'ACTION', 'CHECK_IN', 'DOCUMENT']),
    title: localizedJourneyTextSchema,
    body: localizedJourneyTextSchema,
    actionUrl: z.string().url().max(2000).nullable(),
    required: z.boolean(),
    sortOrder: z.number().int().nonnegative(),
    audienceRoleKeys: z.array(keySchema).max(50),
  }).strict()).max(1000),
}).strict()

export type JourneyTemplateDraft = z.infer<typeof journeyTemplateDraftSchema>

export interface JourneyTemplateIssue {
  readonly code: string
  readonly path: ReadonlyArray<string | number>
}

function duplicateKeys(values: readonly { key: string }[]): Set<string> {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    if (seen.has(value.key)) duplicates.add(value.key)
    seen.add(value.key)
  }
  return duplicates
}

export function validateJourneyTemplate(input: JourneyTemplateDraft): readonly JourneyTemplateIssue[] {
  const parsed = journeyTemplateDraftSchema.safeParse(input)
  if (!parsed.success) return parsed.error.issues.map((issue) => ({ code: 'JOURNEY_TEMPLATE_SCHEMA_INVALID', path: issue.path.map(String) }))

  const value = parsed.data
  const issues: JourneyTemplateIssue[] = []
  const phaseKeys = new Set(value.phases.map((phase) => phase.key))
  const roleKeys = new Set(value.roles.map((role) => role.key))
  const momentKeys = new Set(value.moments.map((moment) => moment.key))

  for (const [collection, values] of [['phases', value.phases], ['roles', value.roles], ['moments', value.moments], ['topics', value.topics]] as const) {
    duplicateKeys(values).forEach((key) => issues.push({ code: 'JOURNEY_TEMPLATE_KEY_DUPLICATE', path: [collection, key] }))
  }
  value.roles.forEach((role, index) => {
    if (role.resolverType === 'SPECIFIC_EMPLOYEE' && role.resolverEmployeeId === null) issues.push({ code: 'JOURNEY_TEMPLATE_RESOLVER_EMPLOYEE_REQUIRED', path: ['roles', index, 'resolverEmployeeId'] })
    if (role.resolverType === 'DEPARTMENT_MANAGER' && role.resolverRoleCode === null) issues.push({ code: 'JOURNEY_TEMPLATE_RESOLVER_ROLE_REQUIRED', path: ['roles', index, 'resolverRoleCode'] })
  })
  value.moments.forEach((moment, index) => {
    if (!phaseKeys.has(moment.phaseKey)) issues.push({ code: 'JOURNEY_TEMPLATE_PHASE_NOT_FOUND', path: ['moments', index, 'phaseKey'] })
    if (moment.availabilityOffsetDays > moment.dateOffsetDays) issues.push({ code: 'JOURNEY_TEMPLATE_AVAILABILITY_AFTER_MOMENT', path: ['moments', index, 'availabilityOffsetDays'] })
  })
  value.topics.forEach((topic, index) => {
    if (!momentKeys.has(topic.momentKey)) issues.push({ code: 'JOURNEY_TEMPLATE_MOMENT_NOT_FOUND', path: ['topics', index, 'momentKey'] })
    if (!roleKeys.has(topic.ownerRoleKey)) issues.push({ code: 'JOURNEY_TEMPLATE_OWNER_ROLE_NOT_FOUND', path: ['topics', index, 'ownerRoleKey'] })
    if (topic.audienceRoleKeys.length === 0) issues.push({ code: 'JOURNEY_TEMPLATE_AUDIENCE_REQUIRED', path: ['topics', index, 'audienceRoleKeys'] })
    topic.audienceRoleKeys.forEach((roleKey) => {
      if (!roleKeys.has(roleKey)) issues.push({ code: 'JOURNEY_TEMPLATE_AUDIENCE_ROLE_NOT_FOUND', path: ['topics', index, 'audienceRoleKeys'] })
    })
    if (topic.topicType === 'ACTION' && topic.actionUrl === null) issues.push({ code: 'JOURNEY_TEMPLATE_ACTION_URL_REQUIRED', path: ['topics', index, 'actionUrl'] })
  })
  return issues
}

export function calculateJourneyDate(anchorDate: string, offsetDays: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate) || !Number.isInteger(offsetDays)) throw new Error('JOURNEY_DATE_INPUT_INVALID')
  const date = new Date(`${anchorDate}T00:00:00.000Z`)
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== anchorDate) throw new Error('JOURNEY_DATE_INPUT_INVALID')
  date.setUTCDate(date.getUTCDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

export interface JourneyRoleCandidate {
  readonly employeeId: string
  readonly source: 'TARGET_EMPLOYEE' | 'DIRECT_MANAGER' | 'DEPARTMENT_MANAGER' | 'SPECIFIC_EMPLOYEE' | 'MANUAL'
}

export type JourneyRoleResolution =
  | { readonly status: 'RESOLVED'; readonly roleKey: string; readonly employeeIds: readonly string[] }
  | { readonly status: 'MISSING'; readonly roleKey: string; readonly blocking: boolean }
  | { readonly status: 'AMBIGUOUS'; readonly roleKey: string; readonly candidateEmployeeIds: readonly string[] }

export function resolveJourneyRole(
  role: { readonly roleKey: string; readonly required: boolean; readonly cardinality: 'ONE' | 'MANY' },
  candidates: readonly JourneyRoleCandidate[],
): JourneyRoleResolution {
  const employeeIds = [...new Set(candidates.map((candidate) => candidate.employeeId))].sort()
  if (employeeIds.length === 0) return { status: 'MISSING', roleKey: role.roleKey, blocking: role.required }
  if (role.cardinality === 'ONE' && employeeIds.length > 1) return { status: 'AMBIGUOUS', roleKey: role.roleKey, candidateEmployeeIds: employeeIds }
  return { status: 'RESOLVED', roleKey: role.roleKey, employeeIds }
}
