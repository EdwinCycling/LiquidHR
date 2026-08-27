import type { Database, Json } from '@scope/db'
import { z } from 'zod'
import {
  AuthorizationError,
  requireAnyPermission,
  requirePermission,
  requireHrGroupId,
  type AuthContext,
} from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import {
  compileProcessDefinition,
  DefinitionCompilerError,
  type CompiledProcessDefinition,
  type DefinitionCompileIssue,
} from './definition-compiler'
import { internalTransferFixture } from './fixtures/internal-transfer'
import {
  processDefinitionDraftSchema,
  type ProcessDefinitionDraft,
} from './definition-schemas'
import {
  AssignmentResolutionError,
  resolveAssignment,
  type AssignmentResolutionContext,
  type ResolverDepartment,
  type ResolverEmployee,
  type ResolverManagementAssignment,
  type ResolverPlacement,
  type ResolverQueueCandidate,
} from './assignment-resolver'

type ProcessDefinitionRow = Database['public']['Tables']['process_definitions']['Row']
type ProcessVersionRow = Database['public']['Tables']['process_versions']['Row']
type AccessScopeType = Database['public']['Enums']['access_scope_type']

export type StudioStatus = Database['public']['Enums']['process_definition_status']

export interface StudioIssue {
  readonly code: string
  readonly path: ReadonlyArray<string | number>
  readonly message: string
}

export interface StudioCatalogItem {
  readonly id: string
  readonly key: string
  readonly title: Json
  readonly description: Json | null
  readonly status: StudioStatus
  readonly scopeType: AccessScopeType
  readonly administrationId: string | null
  readonly updatedAt: string
  readonly draftRevision: number | null
  readonly publishedVersion: number | null
  readonly publishedAt: string | null
  readonly formCount: number
}

export interface StudioDiff {
  readonly fromVersion: number | null
  readonly changedPaths: readonly string[]
}

export interface StudioDefinition {
  readonly definition: ProcessDefinitionRow
  readonly draft: ProcessDefinitionDraft
  readonly draftRevision: number
  readonly validationReport: Json
  readonly versions: readonly ProcessVersionRow[]
  readonly diff: StudioDiff
}

export interface StudioTrialParticipant {
  readonly participantKey: string
  readonly selectorType: string
  readonly assignmentMode: string
  readonly permission: string
  readonly status: 'SUCCESS' | 'WARNING' | 'BLOCKING'
  readonly selectedEmployeeId: string | null
  readonly candidateEmployeeIds: readonly string[]
  readonly evidenceSource: string | null
  readonly errorCode: string | null
  readonly message: string | null
}

export interface StudioTrialStep {
  readonly stepKey: string
  readonly title: Json
  readonly participantKey: string | null
  readonly sla: ProcessDefinitionDraft['steps'][number]['sla'] | null
  readonly nextStepKey: string | null
  readonly transitionKey: string | null
}

export interface StudioTrialReport {
  readonly status: 'SUCCESS' | 'WARNING' | 'BLOCKING'
  readonly date: string
  readonly language: 'nl' | 'en'
  readonly subjectEmployeeId: string | null
  readonly path: readonly StudioTrialStep[]
  readonly participants: readonly StudioTrialParticipant[]
  readonly output: ProcessDefinitionDraft['output'] | null
  readonly blockers: readonly StudioIssue[]
  readonly warnings: readonly StudioIssue[]
  readonly writesPerformed: false
}

export class StudioServiceError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly issues: readonly StudioIssue[] = [],
  ) {
    super(code)
    this.name = 'StudioServiceError'
  }
}

export const studioDefinitionIdSchema = z.string().uuid()

export const studioCreateSchema = z.object({
  key: z.string().trim().regex(/^[a-z][a-z0-9_-]*$/).max(80).optional(),
}).strict()

export const studioSaveSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  definition: z.unknown(),
}).strict()

export const studioCloneSchema = z.object({
  key: z.string().trim().regex(/^[a-z][a-z0-9_-]*$/).max(80),
  title: z.record(z.string(), z.string()).optional(),
  description: z.record(z.string(), z.string()).optional(),
}).strict()

export const studioPublishSchema = z.object({
  expectedRevision: z.number().int().positive(),
  changelog: z.string().trim().min(1).max(2000),
}).strict()

export const studioRetireSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
}).strict()

export const studioTrialSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  language: z.enum(['nl', 'en']).default('nl'),
  subjectEmployeeId: z.string().uuid().nullable().optional(),
}).strict()

function jsonObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function localizedLabel(value: Json, language: 'nl' | 'en'): string {
  const object = jsonObject(value)
  const requested = object?.[language]
  if (typeof requested === 'string' && requested.trim() !== '') return requested
  const fallback = object?.nl
  return typeof fallback === 'string' ? fallback : ''
}

function issueFromZod(issue: z.core.$ZodIssue): StudioIssue {
  return { code: 'SCHEMA_INVALID', path: issue.path.map((part) => typeof part === 'symbol' ? String(part) : part), message: issue.message }
}

function issueFromCompiler(issue: DefinitionCompileIssue): StudioIssue {
  return { code: issue.code, path: issue.path, message: issue.message }
}

function parseDraft(value: Json): ProcessDefinitionDraft {
  const parsed = processDefinitionDraftSchema.safeParse(value)
  if (!parsed.success) {
    throw new StudioServiceError('PROCESS_DEFINITION_INVALID_DRAFT', 422, parsed.error.issues.map(issueFromZod))
  }
  return parsed.data
}

function compileDraft(value: unknown): { draft: ProcessDefinitionDraft; compiled: CompiledProcessDefinition | null; issues: readonly StudioIssue[] } {
  const parsed = processDefinitionDraftSchema.safeParse(value)
  if (!parsed.success) return { draft: internalTransferFixture, compiled: null, issues: parsed.error.issues.map(issueFromZod) }
  try {
    return {
      draft: parsed.data,
      compiled: compileProcessDefinition(parsed.data, { requiredLanguages: ['nl', 'en'] }),
      issues: [],
    }
  } catch (error) {
    if (error instanceof DefinitionCompilerError) {
      return { draft: parsed.data, compiled: null, issues: error.issues.map(issueFromCompiler) }
    }
    throw error
  }
}

function rpcCode(message: string): string {
  return message.match(/\b[A-Z][A-Z0-9_]{2,80}\b/)?.[0] ?? 'PROCESS_DEFINITION_STUDIO_FAILED'
}

export function studioRpcErrorCode(error: { message: string; code?: string | null }): string {
  return error.code === '40001' ? 'PROCESS_DEFINITION_DRAFT_CONFLICT' : rpcCode(error.message)
}

function throwRpcError(error: { message: string; code?: string | null }, fallbackStatus = 409): never {
  const code = studioRpcErrorCode(error)
  const status = code.includes('FORBIDDEN') ? 403 : code.includes('NOT_FOUND') ? 404 : fallbackStatus
  throw new StudioServiceError(code, status)
}

async function studioReadContext(): Promise<{ context: AuthContext; supabase: Awaited<ReturnType<typeof createClient>> }> {
  const context = await requireAnyPermission(['process-definition:read', 'form-definition:read'])
  return { context, supabase: await createClient() }
}

async function studioWriteContext(): Promise<{ context: AuthContext; supabase: Awaited<ReturnType<typeof createClient>> }> {
  const context = await requirePermission('process-definition:write')
  return { context, supabase: await createClient() }
}

function latestByDefinition<T extends { process_definition_id: string; revision?: number; version_number?: number }>(rows: readonly T[]): Map<string, T> {
  const result = new Map<string, T>()
  for (const row of rows) {
    const current = result.get(row.process_definition_id)
    const rowNumber = row.revision ?? row.version_number ?? 0
    const currentNumber = current ? current.revision ?? current.version_number ?? 0 : -1
    if (!current || rowNumber > currentNumber) result.set(row.process_definition_id, row)
  }
  return result
}

function formCount(value: Json | null): number {
  const object = jsonObject(value)
  const forms = object?.forms
  return Array.isArray(forms) ? forms.length : 0
}

function flatten(value: unknown, prefix = ''): Map<string, string> {
  const result = new Map<string, string>()
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, `${prefix}[${index}]`).forEach((entry, key) => result.set(key, entry)))
    return result
  }
  if (value !== null && typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
      flatten(child, prefix ? `${prefix}.${key}` : key).forEach((entry, childKey) => result.set(childKey, entry))
    })
    return result
  }
  result.set(prefix, JSON.stringify(value) ?? 'undefined')
  return result
}

function changedPaths(previous: unknown, current: unknown): string[] {
  const previousFlat = flatten(previous)
  const currentFlat = flatten(current)
  const keys = new Set([...previousFlat.keys(), ...currentFlat.keys()])
  return [...keys].filter((key) => previousFlat.get(key) !== currentFlat.get(key)).sort()
}

export async function listStudioCatalog(): Promise<readonly StudioCatalogItem[]> {
  const { supabase } = await studioReadContext()
  const { data: definitions, error: definitionError } = await supabase
    .from('process_definitions')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(250)
  if (definitionError) throw new StudioServiceError('PROCESS_DEFINITION_CATALOG_READ_FAILED', 500)
  const ids = definitions.map((definition) => definition.id)
  if (ids.length === 0) return []

  const [{ data: drafts, error: draftError }, { data: versions, error: versionError }] = await Promise.all([
    supabase.from('process_definition_drafts').select('*').in('process_definition_id', ids).order('revision', { ascending: false }).limit(1000),
    supabase.from('process_versions').select('*').in('process_definition_id', ids).order('version_number', { ascending: false }).limit(1000),
  ])
  if (draftError || versionError) throw new StudioServiceError('PROCESS_DEFINITION_CATALOG_READ_FAILED', 500)
  const latestDrafts = latestByDefinition(drafts)
  const latestVersions = latestByDefinition(versions)
  return definitions.map((definition) => {
    const draft = latestDrafts.get(definition.id)
    const version = latestVersions.get(definition.id)
    return {
      id: definition.id,
      key: definition.key,
      title: definition.title,
      description: definition.description,
      status: definition.status,
      scopeType: definition.scope_type,
      administrationId: definition.administration_id,
      updatedAt: definition.updated_at,
      draftRevision: draft?.revision ?? null,
      publishedVersion: version?.version_number ?? null,
      publishedAt: version?.published_at ?? null,
      formCount: formCount(draft?.definition_json ?? version?.definition_json ?? null),
    }
  })
}

export async function getStudioDefinition(definitionId: string): Promise<StudioDefinition> {
  const { supabase } = await studioReadContext()
  const { data: definition, error: definitionError } = await supabase
    .from('process_definitions')
    .select('*')
    .eq('id', definitionId)
    .maybeSingle()
  if (definitionError) throw new StudioServiceError('PROCESS_DEFINITION_READ_FAILED', 500)
  if (!definition) throw new StudioServiceError('PROCESS_DEFINITION_NOT_FOUND', 404)

  const [{ data: drafts, error: draftError }, { data: versions, error: versionError }] = await Promise.all([
    supabase.from('process_definition_drafts').select('*').eq('process_definition_id', definitionId).order('revision', { ascending: false }).limit(50),
    supabase.from('process_versions').select('*').eq('process_definition_id', definitionId).order('version_number', { ascending: false }).limit(50),
  ])
  if (draftError || versionError) throw new StudioServiceError('PROCESS_DEFINITION_READ_FAILED', 500)
  const draft = drafts[0]
  if (!draft) throw new StudioServiceError('PROCESS_DEFINITION_DRAFT_NOT_FOUND', 404)
  const parsedDraft = parseDraft(draft.definition_json)
  const latestVersion = versions[0]
  const previousContent = latestVersion ? jsonObject(latestVersion.definition_json)?.content ?? latestVersion.definition_json : null
  return {
    definition,
    draft: parsedDraft,
    draftRevision: draft.revision,
    validationReport: draft.validation_report,
    versions,
    diff: {
      fromVersion: latestVersion?.version_number ?? null,
      changedPaths: latestVersion ? changedPaths(previousContent, parsedDraft) : [],
    },
  }
}

export async function createStudioDefinition(requestedKey?: string): Promise<{ id: string; revision: number }> {
  const { context, supabase } = await studioWriteContext()
  const key = requestedKey ?? `internal-transfer-${context.userId.slice(0, 8)}`
  const definition = { ...internalTransferFixture, key }
  const result = compileDraft(definition)
  const { data, error } = await supabase.rpc('create_process_definition_draft', {
    requested_tenant_id: context.tenantId,
    requested_hr_group_id: requireHrGroupId(context),
    requested_scope_type: 'TENANT',
    requested_administration_id: null as unknown as string,
    requested_key: key,
    requested_title: definition.title as Json,
    requested_description: definition.description as Json,
    requested_definition: definition as unknown as Json,
    requested_validation_report: { issues: result.issues } as unknown as Json,
  })
  if (error) throwRpcError(error)
  const parsed = z.object({ id: z.string().uuid(), revision: z.number().int().positive() }).safeParse(data)
  if (!parsed.success) throw new StudioServiceError('PROCESS_DEFINITION_STUDIO_FAILED', 500)
  return parsed.data
}

export async function saveStudioDefinition(definitionId: string, expectedRevision: number, input: unknown): Promise<{ revision: number; issues: readonly StudioIssue[] }> {
  const { supabase } = await studioWriteContext()
  const result = compileDraft(input)
  if (result.issues.some((issue) => issue.code === 'SCHEMA_INVALID')) {
    throw new StudioServiceError('PROCESS_DEFINITION_INVALID_DRAFT', 422, result.issues)
  }
  const { data, error } = await supabase.rpc('save_process_definition_draft', {
    requested_definition_id: definitionId,
    requested_expected_revision: expectedRevision,
    requested_definition: result.draft as unknown as Json,
    requested_validation_report: { issues: result.issues } as unknown as Json,
  })
  if (error) throwRpcError(error)
  const parsed = z.object({ revision: z.number().int().positive() }).safeParse(data)
  if (!parsed.success) throw new StudioServiceError('PROCESS_DEFINITION_STUDIO_FAILED', 500)
  return { revision: parsed.data.revision, issues: result.issues }
}

export async function cloneStudioDefinition(definitionId: string, input: z.infer<typeof studioCloneSchema>): Promise<{ id: string; revision: number }> {
  const { supabase } = await studioWriteContext()
  const { data, error } = await supabase.rpc('clone_process_definition_draft', {
    requested_source_definition_id: definitionId,
    requested_key: input.key,
    requested_title: input.title as Json | undefined,
    requested_description: input.description as Json | undefined,
  })
  if (error) throwRpcError(error)
  const parsed = z.object({ id: z.string().uuid(), revision: z.number().int().positive() }).safeParse(data)
  if (!parsed.success) throw new StudioServiceError('PROCESS_DEFINITION_STUDIO_FAILED', 500)
  return parsed.data
}

function compiledVersion(value: Json): CompiledProcessDefinition | undefined {
  const object = jsonObject(value)
  if (!object || object.kind !== 'COMPILED_PROCESS_DEFINITION') return undefined
  const content = object.content
  if (!jsonObject(content) || jsonObject(content)?.status !== 'PUBLISHED') return undefined
  return value as unknown as CompiledProcessDefinition
}

export async function publishStudioDefinition(definitionId: string, expectedRevision: number, changelog: string): Promise<{ versionNumber: number; revision: number }> {
  const { supabase } = await studioWriteContext()
  await requirePermission('process-definition:publish')
  const studio = await getStudioDefinition(definitionId)
  const previous = studio.versions[0] ? compiledVersion(studio.versions[0].definition_json) : undefined
  const result = compileDraft(studio.draft)
  let compiled: CompiledProcessDefinition | null = result.compiled
  let issues = result.issues
  if (compiled && previous) {
    try {
      compiled = compileProcessDefinition(studio.draft, { requiredLanguages: ['nl', 'en'], previousCompiledDefinition: previous })
    } catch (error) {
      if (error instanceof DefinitionCompilerError) {
        compiled = null
        issues = error.issues.map(issueFromCompiler)
      } else throw error
    }
  }
  if (!compiled) throw new StudioServiceError('PROCESS_DEFINITION_COMPILER_BLOCKED', 422, issues)
  if (expectedRevision !== studio.draftRevision) throw new StudioServiceError('PROCESS_DEFINITION_DRAFT_CONFLICT', 409)
  const { data, error } = await supabase.rpc('publish_process_definition_draft', {
    requested_definition_id: definitionId,
    requested_expected_revision: expectedRevision,
    requested_compiled_definition: compiled as unknown as Json,
    requested_definition_hash: compiled.hash,
    requested_schema_version: compiled.schemaVersion,
    requested_compiler_version: compiled.compilerVersion,
    requested_changelog: changelog,
  })
  if (error) throwRpcError(error)
  const parsed = z.object({ versionNumber: z.number().int().positive(), revision: z.number().int().positive() }).safeParse(data)
  if (!parsed.success) throw new StudioServiceError('PROCESS_DEFINITION_STUDIO_FAILED', 500)
  return parsed.data
}

export async function retireStudioDefinition(definitionId: string, reason: string): Promise<{ activeInstanceCount: number }> {
  const { supabase } = await studioWriteContext()
  await requirePermission('process-definition:publish')
  const { data, error } = await supabase.rpc('retire_process_definition', { requested_definition_id: definitionId, requested_reason: reason })
  if (error) throwRpcError(error)
  const parsed = z.object({ activeInstanceCount: z.number().int().nonnegative() }).safeParse(data)
  if (!parsed.success) throw new StudioServiceError('PROCESS_DEFINITION_STUDIO_FAILED', 500)
  return parsed.data
}

function trialIssue(code: string, path: ReadonlyArray<string | number>, message: string): StudioIssue {
  return { code, path, message }
}

interface TrialData {
  readonly employees: readonly ResolverEmployee[]
  readonly placements: readonly ResolverPlacement[]
  readonly departments: readonly ResolverDepartment[]
  readonly managementAssignments: readonly ResolverManagementAssignment[]
  readonly queueCandidates: readonly ResolverQueueCandidate[]
}

async function loadTrialData(supabase: Awaited<ReturnType<typeof createClient>>, context: AuthContext, date: string): Promise<TrialData> {
  const groupId = requireHrGroupId(context)
  const [employeesResult, employmentsResult, placementsResult, departmentsResult, assignmentsResult, rolesResult] = await Promise.all([
    supabase.from('employees').select('id,auth_user_id,tenant_id,hr_group_id,is_active,is_archived,deleted_at').eq('tenant_id', context.tenantId).eq('hr_group_id', groupId).limit(1000),
    supabase.from('employments').select('employee_id,administration_id,starts_on,ends_on,record_status,deleted_at').eq('tenant_id', context.tenantId).eq('hr_group_id', groupId).limit(2000),
    supabase.from('employee_organizations').select('employee_id,department_id,direct_manager_id,direct_manager_deputy_id,tenant_id,hr_group_id,administration_id,effective_from,effective_to').eq('tenant_id', context.tenantId).eq('hr_group_id', groupId).limit(2000),
    supabase.from('departments').select('id,parent_id,tenant_id,hr_group_id,is_active').eq('tenant_id', context.tenantId).eq('hr_group_id', groupId).limit(500),
    supabase.from('department_management').select('employee_id,department_id,management_role_id,tenant_id,hr_group_id,effective_from,effective_to').eq('tenant_id', context.tenantId).eq('hr_group_id', groupId).limit(2000),
    supabase.from('management_roles').select('id,code').eq('is_active', true).limit(500),
  ])
  const errors = [employeesResult.error, employmentsResult.error, placementsResult.error, departmentsResult.error, assignmentsResult.error, rolesResult.error].filter(Boolean)
  if (errors.length > 0) throw new StudioServiceError('PROCESS_TRIAL_RESOLVER_DATA_UNAVAILABLE', 409)

  const employeesData = employeesResult.data ?? []
  const employmentsData = employmentsResult.data ?? []
  const placementsData = placementsResult.data ?? []
  const departmentsData = departmentsResult.data ?? []
  const assignmentsData = assignmentsResult.data ?? []
  const rolesData = rolesResult.data ?? []
  const activeEmployment = employmentsData.filter((employment) => employment.record_status === 'CONFIRMED' && employment.deleted_at === null && employment.starts_on <= date && (employment.ends_on === null || employment.ends_on >= date))
  const administrationIdsByEmployee = new Map<string, string[]>()
  activeEmployment.forEach((employment) => {
    const ids = administrationIdsByEmployee.get(employment.employee_id) ?? []
    ids.push(employment.administration_id)
    administrationIdsByEmployee.set(employment.employee_id, ids)
  })
  const employees: ResolverEmployee[] = employeesData.map((employee) => ({
    employeeId: employee.id,
    userId: employee.auth_user_id,
    tenantId: employee.tenant_id,
    hrGroupId: employee.hr_group_id,
    administrationIds: administrationIdsByEmployee.get(employee.id) ?? (context.administrationId ? [context.administrationId] : []),
    isActive: employee.is_active && !employee.is_archived && employee.deleted_at === null,
  }))
  const placements: ResolverPlacement[] = placementsData.filter((placement) => placement.effective_from <= date && (placement.effective_to === null || placement.effective_to >= date)).map((placement) => ({
    employeeId: placement.employee_id,
    departmentId: placement.department_id,
    directManagerId: placement.direct_manager_id,
    directManagerDeputyId: placement.direct_manager_deputy_id,
    tenantId: placement.tenant_id,
    hrGroupId: placement.hr_group_id,
    administrationId: placement.administration_id,
    effectiveFrom: placement.effective_from,
    effectiveTo: placement.effective_to,
  }))
  const departments: ResolverDepartment[] = departmentsData.map((department) => ({
    id: department.id,
    parentId: department.parent_id,
    tenantId: department.tenant_id,
    hrGroupId: department.hr_group_id,
    isActive: department.is_active,
  }))
  const roleCodeById = new Map(rolesData.map((role) => [role.id, role.code]))
  const managementAssignments: ResolverManagementAssignment[] = assignmentsData.flatMap((assignment) => {
    if (assignment.department_id === null || assignment.effective_from > date || (assignment.effective_to !== null && assignment.effective_to < date)) return []
    return [{
      departmentId: assignment.department_id,
      roleCode: roleCodeById.get(assignment.management_role_id) ?? assignment.management_role_id,
      employeeId: assignment.employee_id,
      effectiveFrom: assignment.effective_from,
      effectiveTo: assignment.effective_to,
      tenantId: assignment.tenant_id,
      hrGroupId: assignment.hr_group_id,
      managementRoleId: assignment.management_role_id,
    }]
  })
  const queueCandidates: ResolverQueueCandidate[] = employees.filter((employee) => employee.userId !== null && employee.isActive).map((employee) => ({
    queueKey: 'hr-processes',
    permission: 'process-task:act',
    employeeId: employee.employeeId,
    source: 'queue',
  }))
  return { employees, placements, departments, managementAssignments, queueCandidates }
}

export async function runStudioTrial(definitionId: string, input: z.infer<typeof studioTrialSchema>): Promise<StudioTrialReport> {
  const { context, supabase } = await studioReadContext()
  const studio = await getStudioDefinition(definitionId)
  const result = compileDraft(studio.draft)
  if (!result.compiled) {
    return {
      status: 'BLOCKING', date: input.date, language: input.language, subjectEmployeeId: input.subjectEmployeeId ?? null,
      path: [], participants: [], output: result.draft.output ?? null, blockers: result.issues, warnings: [], writesPerformed: false,
    }
  }

  let trialData: TrialData
  try {
    trialData = await loadTrialData(supabase, context, input.date)
  } catch (error) {
    if (error instanceof StudioServiceError) {
      return {
        status: 'WARNING', date: input.date, language: input.language, subjectEmployeeId: input.subjectEmployeeId ?? context.employeeId,
        path: result.draft.steps.map((step) => ({ stepKey: step.key, title: step.title as Json, participantKey: step.participantKey ?? null, sla: step.sla ?? null, nextStepKey: null, transitionKey: null })),
        participants: [], output: result.draft.output ?? null, blockers: [], warnings: [trialIssue(error.code, [], 'Resolverdata kon niet worden geladen; er is geen runtime gestart.')], writesPerformed: false,
      }
    }
    throw error
  }

  const scopedActiveEmployeeIds = new Set(trialData.employees
    .filter((employee) => employee.isActive && (context.administrationId === null || employee.administrationIds.includes(context.administrationId)))
    .map((employee) => employee.employeeId))
  const fallbackSubject = trialData.employees.find((employee) => employee.employeeId === context.employeeId && employee.isActive)?.employeeId
    ?? trialData.employees.find((employee) => employee.isActive
      && employee.userId !== null
      && scopedActiveEmployeeIds.has(employee.employeeId)
      && trialData.placements.some((placement) => placement.employeeId === employee.employeeId
        && placement.directManagerId !== null
        && (context.administrationId === null || placement.administrationId === context.administrationId)))?.employeeId
    ?? trialData.employees.find((employee) => employee.isActive)?.employeeId
    ?? null
  const subjectEmployeeId = input.subjectEmployeeId ?? fallbackSubject
  const warnings: StudioIssue[] = []
  const blockers: StudioIssue[] = []
  if (!subjectEmployeeId) blockers.push(trialIssue('SUBJECT_EMPLOYEE_REQUIRED', ['subjectEmployeeId'], 'Kies een actieve synthetische medewerker voor de procesproef.'))
  const subjectPlacement = trialData.placements.find((placement) => placement.employeeId === subjectEmployeeId)
  const targetDepartment = trialData.departments.find((department) => department.id !== subjectPlacement?.departmentId
    && department.isActive
    && trialData.managementAssignments.some((assignment) => assignment.departmentId === department.id
      && assignment.roleCode === 'DIRECT_MANAGER'
      && scopedActiveEmployeeIds.has(assignment.employeeId)))?.id
    ?? subjectPlacement?.departmentId
    ?? null
  const resolverContext: AssignmentResolutionContext = {
    scope: { tenantId: context.tenantId, hrGroupId: requireHrGroupId(context), administrationId: context.administrationId },
    subjectEmployeeId: subjectEmployeeId ?? '',
    initiatorEmployeeId: context.employeeId ?? subjectEmployeeId,
    processStartedAt: `${input.date}T09:00:00Z`,
    stepActivatedAt: `${input.date}T09:00:00Z`,
    businessEffectiveDate: input.date,
    fields: { 'target-department': targetDepartment, 'effective-on': input.date },
    employees: trialData.employees,
    placements: trialData.placements,
    departments: trialData.departments,
    managementAssignments: trialData.managementAssignments,
    queueCandidates: trialData.queueCandidates,
    processOwnerCandidates: trialData.queueCandidates.map((candidate) => ({ ...candidate, source: 'process-owner-queue' as const })),
    processVersionId: studio.versions[0]?.id ?? '00000000-0000-0000-0000-000000000000',
    instanceVersion: 1,
    actorEmployeeId: context.employeeId,
  }
  const participants: StudioTrialParticipant[] = result.draft.participants.map((participant, index) => {
    try {
      const resolved = subjectEmployeeId ? resolveAssignment(participant, resolverContext) : null
      if (!resolved) return { participantKey: participant.key, selectorType: participant.selector.type, assignmentMode: participant.assignmentMode, permission: participant.permission, status: 'BLOCKING', selectedEmployeeId: null, candidateEmployeeIds: [], evidenceSource: null, errorCode: 'SUBJECT_EMPLOYEE_REQUIRED', message: 'Subject ontbreekt.' }
      if (resolved.candidates.length === 0) {
        const issue = trialIssue('NO_ASSIGNEE', ['participants', index], `Geen kandidaat gevonden voor ${participant.key}.`)
        blockers.push(issue)
        return { participantKey: participant.key, selectorType: participant.selector.type, assignmentMode: participant.assignmentMode, permission: participant.permission, status: 'BLOCKING', selectedEmployeeId: null, candidateEmployeeIds: [], evidenceSource: resolved.evidence.source, errorCode: 'NO_ASSIGNEE', message: issue.message }
      }
      return { participantKey: participant.key, selectorType: participant.selector.type, assignmentMode: participant.assignmentMode, permission: participant.permission, status: 'SUCCESS', selectedEmployeeId: resolved.selectedEmployeeId, candidateEmployeeIds: resolved.candidates.map((candidate) => candidate.employeeId), evidenceSource: resolved.evidence.source, errorCode: null, message: null }
    } catch (error) {
      if (!(error instanceof AssignmentResolutionError)) throw error
      const severity = error.code === 'INVALID_BUSINESS_DATE' ? 'WARNING' : 'BLOCKING'
      const issue = trialIssue(error.code, ['participants', index], error.message)
      if (severity === 'WARNING') warnings.push(issue)
      else blockers.push(issue)
      return { participantKey: participant.key, selectorType: participant.selector.type, assignmentMode: participant.assignmentMode, permission: participant.permission, status: severity, selectedEmployeeId: null, candidateEmployeeIds: error.evidence.candidateEmployeeIds, evidenceSource: error.evidence.source, errorCode: error.code, message: error.message }
    }
  })

  const path: StudioTrialStep[] = []
  const visited = new Set<string>()
  let currentStepKey: string | null = result.draft.startStepKey
  while (currentStepKey && path.length <= result.draft.steps.length) {
    if (visited.has(currentStepKey)) {
      blockers.push(trialIssue('ILLEGAL_CYCLE', ['steps', currentStepKey], 'De procesproef detecteerde een cyclus.'))
      break
    }
    visited.add(currentStepKey)
    const step = result.draft.steps.find((candidate) => candidate.key === currentStepKey)
    if (!step) break
    const transition = result.draft.transitions.find((candidate) => candidate.fromStepKey === step.key && candidate.kind === 'FORWARD') ?? null
    path.push({ stepKey: step.key, title: step.title, participantKey: step.participantKey ?? null, sla: step.sla ?? null, nextStepKey: transition?.toStepKey ?? null, transitionKey: transition?.key ?? null })
    if (transition?.condition) warnings.push(trialIssue('CONDITION_REVIEW_REQUIRED', ['transitions', transition.key, 'condition'], 'Deze route bevat een voorwaarde; de procesproef gebruikt de eerste toegestane route.'))
    currentStepKey = transition?.toStepKey ?? null
  }
  if (path.length === 0) blockers.push(trialIssue('START_STEP_UNKNOWN', ['startStepKey'], 'De startstap kon niet worden gevonden.'))
  return {
    status: blockers.length > 0 ? 'BLOCKING' : warnings.length > 0 ? 'WARNING' : 'SUCCESS',
    date: input.date,
    language: input.language,
    subjectEmployeeId,
    path,
    participants,
    output: result.draft.output ?? null,
    blockers,
    warnings,
    writesPerformed: false,
  }
}

export function studioErrorResponse(error: unknown) {
  if (error instanceof StudioServiceError) return { body: { code: error.code, issues: error.issues }, status: error.status }
  if (error instanceof AuthorizationError) return { body: { code: 'FORBIDDEN' }, status: error.status }
  return null
}

export function studioCatalogLabel(item: StudioCatalogItem, language: 'nl' | 'en' = 'nl'): string {
  return localizedLabel(item.title, language) || item.key
}
