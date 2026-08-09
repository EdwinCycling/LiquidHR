import type { AssignmentSelector, ParticipantDefinition } from './definition-schemas'
import {
  AmbiguousManagerError,
  DepartmentCycleError,
  ManagerNotFoundError,
  resolveManagerForEmployee,
  type DepartmentReference,
  type ManagementAssignment,
  type OrganizationPlacement,
} from '@/lib/organization/manager-resolver'

export type AssignmentResolutionErrorCode =
  | 'NO_ASSIGNEE'
  | 'AMBIGUOUS_ASSIGNEE'
  | 'INELIGIBLE_ASSIGNEE'
  | 'CROSS_SCOPE_CANDIDATE'
  | 'SELF_ASSIGNMENT_FORBIDDEN'
  | 'INVALID_BUSINESS_DATE'
  | 'DEPARTMENT_CYCLE'

export interface AssignmentScope {
  readonly tenantId: string
  readonly hrGroupId: string
  readonly administrationId: string | null
}

export interface ResolverEmployee {
  readonly employeeId: string
  readonly userId: string | null
  readonly tenantId: string
  readonly hrGroupId: string
  readonly administrationIds: readonly string[]
  readonly isActive: boolean
}

export interface ResolverPlacement extends OrganizationPlacement {
  readonly tenantId: string
  readonly hrGroupId: string
  readonly administrationId: string | null
  readonly effectiveFrom: string
  readonly effectiveTo: string | null
}

export interface ResolverDepartment extends DepartmentReference {
  readonly tenantId: string
  readonly hrGroupId: string
  readonly isActive: boolean
}

export interface ResolverManagementAssignment extends ManagementAssignment {
  readonly tenantId: string
  readonly hrGroupId: string
  readonly managementRoleId: string | null
}

export interface ResolverQueueCandidate {
  readonly queueKey: string
  readonly permission: string | null
  readonly employeeId: string
  readonly source: 'queue' | 'process-owner-queue'
}

export interface AssignmentResolutionContext {
  readonly scope: AssignmentScope
  readonly subjectEmployeeId: string
  readonly initiatorEmployeeId: string | null
  readonly processStartedAt: string
  readonly stepActivatedAt: string
  readonly businessEffectiveDate: string | null
  readonly fields: Readonly<Record<string, unknown>>
  readonly employees: readonly ResolverEmployee[]
  readonly placements: readonly ResolverPlacement[]
  readonly departments: readonly ResolverDepartment[]
  readonly managementAssignments: readonly ResolverManagementAssignment[]
  readonly queueCandidates: readonly ResolverQueueCandidate[]
  readonly processOwnerCandidates: readonly ResolverQueueCandidate[]
  readonly processVersionId: string
  readonly instanceVersion: number
  readonly actorEmployeeId?: string | null
  readonly allowSelfAssignment?: boolean
  readonly deputyEnabled?: boolean
  readonly deputyRoleCodes?: Readonly<Record<string, string>>
}

export interface AssignmentRejectedCandidate {
  readonly employeeId: string
  readonly reason: 'OUT_OF_SCOPE' | 'INACTIVE' | 'NO_AUTH_USER' | 'SELF_ASSIGNMENT_FORBIDDEN'
  readonly tenantId: string | null
  readonly hrGroupId: string | null
  readonly administrationIds: readonly string[]
}

export interface AssignmentResolutionEvidence {
  readonly selector: AssignmentSelector
  readonly assignmentMode: ParticipantDefinition['assignmentMode']
  readonly resolutionDatePolicy: AssignmentSelector['resolutionDatePolicy']
  readonly asOfDate: string
  readonly source: string
  readonly sourceDepartmentId: string | null
  readonly ancestorPath: readonly string[]
  readonly candidateEmployeeIds: readonly string[]
  readonly rejectedCandidates: readonly AssignmentRejectedCandidate[]
  readonly scope: AssignmentScope
  readonly processVersionId: string
  readonly instanceVersion: number
}

export interface ResolvedAssignmentCandidate {
  readonly employeeId: string
  readonly userId: string
  readonly managementRoleId: string | null
  readonly managementRoleCode: string | null
  readonly source: string
  readonly sourceDepartmentId: string | null
  readonly ancestorPath: readonly string[]
}

export interface ResolvedAssignment {
  readonly assignmentMode: ParticipantDefinition['assignmentMode']
  readonly candidates: readonly ResolvedAssignmentCandidate[]
  readonly selectedEmployeeId: string | null
  readonly evidence: AssignmentResolutionEvidence
}

export class AssignmentResolutionError extends Error {
  constructor(
    readonly code: AssignmentResolutionErrorCode,
    message: string,
    readonly evidence: AssignmentResolutionEvidence,
  ) {
    super(message)
    this.name = 'AssignmentResolutionError'
  }
}

interface RawCandidate {
  readonly employeeId: string
  readonly managementRoleId: string | null
  readonly managementRoleCode: string | null
  readonly source: string
  readonly sourceDepartmentId: string | null
  readonly ancestorPath: readonly string[]
}

interface RawResolution {
  readonly candidates: readonly RawCandidate[]
  readonly source: string
  readonly sourceDepartmentId: string | null
  readonly ancestorPath: readonly string[]
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/

function asDate(value: string | null | undefined, name: string): string {
  const date = value?.slice(0, 10) ?? ''
  if (!datePattern.test(date)) throw new Error(`${name} must be an ISO date`)
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) throw new Error(`${name} must be a valid ISO date`)
  return date
}

function resolveDateOrThrow(
  value: string | null | undefined,
  name: string,
  selector: AssignmentSelector,
  context: AssignmentResolutionContext,
): string {
  try {
    return asDate(value, name)
  } catch (error) {
    const message = error instanceof Error ? error.message : `${name} must be a valid ISO date`
    throw new AssignmentResolutionError('INVALID_BUSINESS_DATE', message, emptyEvidence(selector, context, ''))
  }
}

function resolveAsOfDate(selector: AssignmentSelector, context: AssignmentResolutionContext): string {
  switch (selector.resolutionDatePolicy) {
    case 'STEP_ACTIVATED_AT':
      return resolveDateOrThrow(context.stepActivatedAt, 'stepActivatedAt', selector, context)
    case 'PROCESS_STARTED_AT':
      return resolveDateOrThrow(context.processStartedAt, 'processStartedAt', selector, context)
    case 'BUSINESS_EFFECTIVE_DATE':
      if (!context.businessEffectiveDate) throw new AssignmentResolutionError('INVALID_BUSINESS_DATE', 'Business effective date is required for assignment resolution.', emptyEvidence(selector, context, ''))
      return resolveDateOrThrow(context.businessEffectiveDate, 'businessEffectiveDate', selector, context)
    case 'FIXED_DATE_FIELD': {
      const fieldKey = selector.fixedDateFieldKey
      const value = fieldKey ? context.fields[fieldKey] : undefined
      if (typeof value !== 'string') throw new AssignmentResolutionError('INVALID_BUSINESS_DATE', 'The fixed date field is missing or is not a date.', emptyEvidence(selector, context, ''))
      return resolveDateOrThrow(value, fieldKey ?? 'fixedDateFieldKey', selector, context)
    }
    case 'SNAPSHOT_AT_START':
      return resolveDateOrThrow(context.processStartedAt, 'processStartedAt', selector, context)
  }
}

function scopeMatches(employee: ResolverEmployee, scope: AssignmentScope): boolean {
  return employee.tenantId === scope.tenantId
    && employee.hrGroupId === scope.hrGroupId
    && (scope.administrationId === null || employee.administrationIds.includes(scope.administrationId))
}

function activeOn(from: string, to: string | null, date: string): boolean {
  return from <= date && (to === null || to >= date)
}

function employeeById(context: AssignmentResolutionContext, employeeId: string): ResolverEmployee | undefined {
  return context.employees.find((employee) => employee.employeeId === employeeId)
}

function readId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = value.id
    return typeof id === 'string' && id.trim() !== '' ? id : null
  }
  return null
}

function departmentPath(context: AssignmentResolutionContext, startDepartmentId: string, asOfDate: string): string[] {
  const departments = new Map(context.departments.map((department) => [department.id, department]))
  const path: string[] = []
  const visited = new Set<string>()
  let departmentId: string | null = startDepartmentId
  while (departmentId) {
    if (visited.has(departmentId)) throw new AssignmentResolutionError('DEPARTMENT_CYCLE', `Department cycle detected at ${departmentId}.`, emptyEvidenceForDate(context, asOfDate, 'department'))
    visited.add(departmentId)
    const department = departments.get(departmentId)
    if (!department || !department.isActive) break
    path.push(departmentId)
    departmentId = department.parentId
  }
  return path
}

function emptyEvidence(selector: AssignmentSelector, context: AssignmentResolutionContext, asOfDate: string): AssignmentResolutionEvidence {
  return {
    selector,
    assignmentMode: 'EXACTLY_ONE',
    resolutionDatePolicy: selector.resolutionDatePolicy,
    asOfDate,
    source: 'none',
    sourceDepartmentId: null,
    ancestorPath: [],
    candidateEmployeeIds: [],
    rejectedCandidates: [],
    scope: context.scope,
    processVersionId: context.processVersionId,
    instanceVersion: context.instanceVersion,
  }
}

function emptyEvidenceForDate(context: AssignmentResolutionContext, asOfDate: string, source: string): AssignmentResolutionEvidence {
  return {
    selector: { type: 'SUBJECT_EMPLOYEE', resolutionDatePolicy: 'STEP_ACTIVATED_AT' },
    assignmentMode: 'EXACTLY_ONE',
    resolutionDatePolicy: 'STEP_ACTIVATED_AT',
    asOfDate,
    source,
    sourceDepartmentId: null,
    ancestorPath: [],
    candidateEmployeeIds: [],
    rejectedCandidates: [],
    scope: context.scope,
    processVersionId: context.processVersionId,
    instanceVersion: context.instanceVersion,
  }
}

function subjectPlacement(context: AssignmentResolutionContext, asOfDate: string): ResolverPlacement | null {
  const placements = context.placements.filter((placement) =>
    placement.employeeId === context.subjectEmployeeId
    && placement.tenantId === context.scope.tenantId
    && placement.hrGroupId === context.scope.hrGroupId
    && activeOn(placement.effectiveFrom, placement.effectiveTo, asOfDate),
  )
  if (placements.length > 1) throw new AssignmentResolutionError('AMBIGUOUS_ASSIGNEE', 'Multiple active subject placements were found.', emptyEvidenceForDate(context, asOfDate, 'subject-placement'))
  return placements[0] ?? null
}

function roleCandidate(
  context: AssignmentResolutionContext,
  roleCode: string,
  departmentId: string,
  asOfDate: string,
): RawResolution {
  const path = departmentPath(context, departmentId, asOfDate)
  const departments: readonly DepartmentReference[] = context.departments.map((department) => ({ id: department.id, parentId: department.parentId }))
  const assignments: readonly ManagementAssignment[] = context.managementAssignments
    .filter((assignment) => assignment.tenantId === context.scope.tenantId && assignment.hrGroupId === context.scope.hrGroupId)
    .map((assignment) => ({
      departmentId: assignment.departmentId,
      roleCode: assignment.roleCode,
      employeeId: assignment.employeeId,
      effectiveFrom: assignment.effectiveFrom,
      effectiveTo: assignment.effectiveTo,
    }))
  const unavailableEmployeeIds = context.employees.filter((employee) => !employee.isActive).map((employee) => employee.employeeId)
  let resolved: ReturnType<typeof resolveManagerForEmployee>
  try {
    resolved = resolveManagerForEmployee({
      roleCode,
      placement: { employeeId: context.subjectEmployeeId, departmentId, directManagerId: null, directManagerDeputyId: null },
      departments,
      assignments,
      unavailableEmployeeIds,
      deputyRoleCodes: context.deputyEnabled ? context.deputyRoleCodes : undefined,
      asOfDate,
    })
  } catch (error) {
    if (error instanceof AmbiguousManagerError) throw new AssignmentResolutionError('AMBIGUOUS_ASSIGNEE', error.message, emptyEvidenceForDate(context, asOfDate, 'department'))
    if (error instanceof DepartmentCycleError) throw new AssignmentResolutionError('DEPARTMENT_CYCLE', error.message, emptyEvidenceForDate(context, asOfDate, 'department'))
    if (error instanceof ManagerNotFoundError) return { candidates: [], source: 'department', sourceDepartmentId: null, ancestorPath: path }
    throw error
  }
  const assignment = context.managementAssignments.find((candidate) =>
    candidate.employeeId === resolved.employeeId
    && candidate.departmentId === resolved.departmentId
    && candidate.roleCode === (resolved.source.endsWith('deputy') && context.deputyRoleCodes ? context.deputyRoleCodes[roleCode] ?? roleCode : roleCode)
    && activeOn(candidate.effectiveFrom, candidate.effectiveTo, asOfDate),
  )
  return {
    candidates: [{
      employeeId: resolved.employeeId,
      managementRoleId: assignment?.managementRoleId ?? null,
      managementRoleCode: assignment?.roleCode ?? roleCode,
      source: resolved.source,
      sourceDepartmentId: resolved.departmentId,
      ancestorPath: path.slice(0, Math.max(1, path.indexOf(resolved.departmentId) + 1)),
    }],
    source: resolved.source,
    sourceDepartmentId: resolved.departmentId,
    ancestorPath: path.slice(0, Math.max(1, path.indexOf(resolved.departmentId) + 1)),
  }
}

function rawCandidates(selector: AssignmentSelector, context: AssignmentResolutionContext, asOfDate: string): RawResolution {
  switch (selector.type) {
    case 'EXPLICIT_PERSON':
    case 'FORM_FIELD_PERSON': {
      const employeeId = readId(context.fields[selector.personFieldKey])
      return { candidates: employeeId ? [{ employeeId, managementRoleId: null, managementRoleCode: null, source: 'explicit', sourceDepartmentId: null, ancestorPath: [] }] : [], source: 'explicit', sourceDepartmentId: null, ancestorPath: [] }
    }
    case 'INITIATOR':
      return { candidates: context.initiatorEmployeeId ? [{ employeeId: context.initiatorEmployeeId, managementRoleId: null, managementRoleCode: null, source: 'initiator', sourceDepartmentId: null, ancestorPath: [] }] : [], source: 'initiator', sourceDepartmentId: null, ancestorPath: [] }
    case 'SUBJECT_EMPLOYEE':
      return { candidates: [{ employeeId: context.subjectEmployeeId, managementRoleId: null, managementRoleCode: null, source: 'subject', sourceDepartmentId: null, ancestorPath: [] }], source: 'subject', sourceDepartmentId: null, ancestorPath: [] }
    case 'DIRECT_MANAGER_OF_SUBJECT': {
      const placement = subjectPlacement(context, asOfDate)
      if (!placement) return { candidates: [], source: 'direct', sourceDepartmentId: null, ancestorPath: [] }
      const unavailable = context.employees.filter((employee) => !employee.isActive).map((employee) => employee.employeeId)
      let result: ReturnType<typeof resolveManagerForEmployee>
      try {
        result = resolveManagerForEmployee({
          roleCode: 'DIRECT_MANAGER',
          placement: context.deputyEnabled ? placement : { ...placement, directManagerDeputyId: null },
          departments: context.departments,
          assignments: context.managementAssignments,
          unavailableEmployeeIds: unavailable,
          deputyRoleCodes: context.deputyEnabled ? context.deputyRoleCodes : undefined,
          asOfDate,
        })
      } catch (error) {
        if (error instanceof ManagerNotFoundError) return { candidates: [], source: 'direct', sourceDepartmentId: placement.departmentId, ancestorPath: [placement.departmentId] }
        if (error instanceof AmbiguousManagerError) throw new AssignmentResolutionError('AMBIGUOUS_ASSIGNEE', error.message, emptyEvidenceForDate(context, asOfDate, 'direct'))
        if (error instanceof DepartmentCycleError) throw new AssignmentResolutionError('DEPARTMENT_CYCLE', error.message, emptyEvidenceForDate(context, asOfDate, 'direct'))
        throw error
      }
      const path = departmentPath(context, placement.departmentId, asOfDate)
      return { candidates: [{ employeeId: result.employeeId, managementRoleId: null, managementRoleCode: 'DIRECT_MANAGER', source: result.source, sourceDepartmentId: result.departmentId, ancestorPath: path.slice(0, Math.max(1, path.indexOf(result.departmentId) + 1)) }], source: result.source, sourceDepartmentId: result.departmentId, ancestorPath: path }
    }
    case 'MANAGEMENT_ROLE_ON_SUBJECT_DEPARTMENT': {
      const placement = subjectPlacement(context, asOfDate)
      return placement ? roleCandidate(context, selector.roleCode, placement.departmentId, asOfDate) : { candidates: [], source: 'department', sourceDepartmentId: null, ancestorPath: [] }
    }
    case 'MANAGEMENT_ROLE_ON_SELECTED_DEPARTMENT': {
      const departmentId = readId(context.fields[selector.departmentFieldKey])
      return departmentId ? roleCandidate(context, selector.roleCode, departmentId, asOfDate) : { candidates: [], source: 'department', sourceDepartmentId: null, ancestorPath: [] }
    }
    case 'MANAGEMENT_ROLE_ON_PROCESS_DEPARTMENT': {
      const departmentId = readId(context.fields.processDepartmentId)
      return departmentId ? roleCandidate(context, selector.roleCode, departmentId, asOfDate) : { candidates: [], source: 'department', sourceDepartmentId: null, ancestorPath: [] }
    }
    case 'PERMISSION_WORK_QUEUE':
      return {
        candidates: context.queueCandidates.filter((candidate) => candidate.queueKey === selector.queueKey && candidate.permission === selector.permission).map((candidate) => ({ employeeId: candidate.employeeId, managementRoleId: null, managementRoleCode: null, source: candidate.source, sourceDepartmentId: null, ancestorPath: [] })),
        source: 'queue',
        sourceDepartmentId: null,
        ancestorPath: [],
      }
    case 'PROCESS_OWNER_QUEUE':
      return {
        candidates: context.processOwnerCandidates.filter((candidate) => candidate.queueKey === selector.queueKey).map((candidate) => ({ employeeId: candidate.employeeId, managementRoleId: null, managementRoleCode: null, source: candidate.source, sourceDepartmentId: null, ancestorPath: [] })),
        source: 'process-owner-queue',
        sourceDepartmentId: null,
        ancestorPath: [],
      }
  }
}

function rejectedCandidate(employee: ResolverEmployee | undefined, employeeId: string, reason: AssignmentRejectedCandidate['reason']): AssignmentRejectedCandidate {
  return {
    employeeId,
    reason,
    tenantId: employee?.tenantId ?? null,
    hrGroupId: employee?.hrGroupId ?? null,
    administrationIds: employee?.administrationIds ?? [],
  }
}

export function resolveAssignment(
  participant: ParticipantDefinition,
  context: AssignmentResolutionContext,
): ResolvedAssignment {
  const asOfDate = resolveAsOfDate(participant.selector, context)
  const raw = rawCandidates(participant.selector, context, asOfDate)
  const uniqueRaw = [...new Map(raw.candidates.map((candidate) => [candidate.employeeId, candidate])).values()]
  const rejected: AssignmentRejectedCandidate[] = []
  const eligible: ResolvedAssignmentCandidate[] = []
  for (const candidate of uniqueRaw) {
    const employee = employeeById(context, candidate.employeeId)
    if (!employee || !scopeMatches(employee, context.scope)) {
      rejected.push(rejectedCandidate(employee, candidate.employeeId, 'OUT_OF_SCOPE'))
      continue
    }
    if (!employee.isActive) {
      rejected.push(rejectedCandidate(employee, candidate.employeeId, 'INACTIVE'))
      continue
    }
    if (!employee.userId) {
      rejected.push(rejectedCandidate(employee, candidate.employeeId, 'NO_AUTH_USER'))
      continue
    }
    if (context.actorEmployeeId === candidate.employeeId && !context.allowSelfAssignment) {
      rejected.push(rejectedCandidate(employee, candidate.employeeId, 'SELF_ASSIGNMENT_FORBIDDEN'))
      continue
    }
    eligible.push({
      employeeId: employee.employeeId,
      userId: employee.userId,
      managementRoleId: candidate.managementRoleId,
      managementRoleCode: candidate.managementRoleCode,
      source: candidate.source,
      sourceDepartmentId: candidate.sourceDepartmentId,
      ancestorPath: candidate.ancestorPath,
    })
  }
  eligible.sort((left, right) => left.employeeId.localeCompare(right.employeeId))
  rejected.sort((left, right) => left.employeeId.localeCompare(right.employeeId))
  const evidence: AssignmentResolutionEvidence = {
    selector: participant.selector,
    assignmentMode: participant.assignmentMode,
    resolutionDatePolicy: participant.selector.resolutionDatePolicy,
    asOfDate,
    source: raw.source,
    sourceDepartmentId: raw.sourceDepartmentId,
    ancestorPath: raw.ancestorPath,
    candidateEmployeeIds: eligible.map((candidate) => candidate.employeeId),
    rejectedCandidates: rejected,
    scope: context.scope,
    processVersionId: context.processVersionId,
    instanceVersion: context.instanceVersion,
  }
  if (eligible.length === 0) {
    const errorCode = rejected.some((candidate) => candidate.reason === 'SELF_ASSIGNMENT_FORBIDDEN')
      ? 'SELF_ASSIGNMENT_FORBIDDEN'
      : rejected.length > 0 && rejected.every((candidate) => candidate.reason === 'OUT_OF_SCOPE')
        ? 'CROSS_SCOPE_CANDIDATE'
        : rejected.length > 0 ? 'INELIGIBLE_ASSIGNEE' : 'NO_ASSIGNEE'
    throw new AssignmentResolutionError(errorCode, `${errorCode}: no eligible assignee found.`, evidence)
  }
  if (participant.assignmentMode === 'EXACTLY_ONE' && eligible.length !== 1) {
    throw new AssignmentResolutionError('AMBIGUOUS_ASSIGNEE', `AMBIGUOUS_ASSIGNEE: ${eligible.length} eligible assignees found.`, evidence)
  }
  if (participant.assignmentMode === 'ALL' && rejected.length > 0) {
    throw new AssignmentResolutionError('INELIGIBLE_ASSIGNEE', 'ALL requires every resolved candidate to be eligible.', evidence)
  }
  return {
    assignmentMode: participant.assignmentMode,
    candidates: eligible,
    selectedEmployeeId: participant.assignmentMode === 'EXACTLY_ONE' ? eligible[0]?.employeeId ?? null : null,
    evidence,
  }
}
