import 'server-only'

import { createHash } from 'node:crypto'
import type { Database, Tables } from '@scope/db'
import { z } from 'zod'
import { AuthorizationError, requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { getComponentLibrary } from '@/lib/payroll/component-library'
import { createClient } from '@/lib/supabase/server'
import { exactHoursToDatabase, isPositiveExactHours, parseExactHours } from './exact-hours'
import { ActualWorkServiceError } from './actual-work-service'

type Supabase = Awaited<ReturnType<typeof createClient>>
type Entry = Tables<'employment_work_hour_entries'>
type WorkType = Pick<Tables<'work_hour_types'>, 'id' | 'code' | 'name' | 'family' | 'entry_granularity' | 'is_active' | 'valid_from' | 'valid_until' | 'updated_at' | 'comment_required'>
type Mapping = Tables<'actual_work_payroll_mappings'>
type PayrollRelease = Tables<'actual_work_payroll_releases'>
type PayrollMappingComponent = { definition: { id: string; code: string; version: string; outputs: readonly { name: string; valueType: string }[] } }

const uuid = z.string().uuid()
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const importRequestSchema = z.object({ csv: z.string().min(1).max(2_000_000), confirm: z.boolean().default(false) })
const mappingSchema = z.object({
  workHourTypeId: uuid,
  processingTarget: z.enum(['PAYMENT', 'PREMIUM', 'TVT', 'INFORMATIONAL']),
  validFrom: isoDate,
  factor: z.string().optional(),
})
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve'), entryIds: z.array(uuid).min(1).max(250) }),
  z.object({ action: z.literal('release'), periodStart: isoDate, entryIds: z.array(uuid).min(1).max(250) }),
  z.object({ action: z.literal('map'), mapping: mappingSchema }),
])

type AdminScope = {
  tenantId: string
  hrGroupId: string
  administrationId: string
  userId: string
  supabase: Supabase
}

function requireAdminRole(roles: readonly string[]): void {
  if (!roles.some((role) => role === 'HR_ADMIN' || role === 'TENANT_ADMIN')) throw new AuthorizationError('Payroll uren beheren is alleen beschikbaar voor HR Admin.')
}

async function adminScope(write: boolean): Promise<AdminScope> {
  const context = await requirePermission(write ? 'salary:write' : 'salary:read')
  requireAdminRole(context.activeRoles)
  if (!context.administrationId || !context.permissions.includes('leave:read')
    || !context.permissions.includes('employee:read')
    || (write && !context.permissions.includes('leave:write'))) throw new AuthorizationError('Payroll uren beheren is niet beschikbaar voor deze administratie.')
  return {
    tenantId: context.tenantId,
    hrGroupId: requireHrGroupId(context),
    administrationId: context.administrationId,
    userId: context.userId,
    supabase: await createClient(),
  }
}

function databaseError(error: { message: string; code?: string } | null): never {
  const code = error?.message.match(/ACTUAL_WORK_[A-Z_]+/)?.[0]
    ?? error?.message.match(/PAYROLL_[A-Z_]+/)?.[0]
    ?? 'ACTUAL_WORK_PAYROLL_OPERATION_FAILED'
  throw new ActualWorkServiceError(code, error?.code === '42501' ? 403 : 400, 'actual-work-payroll', error?.code)
}

function validRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return date.toISOString().slice(0, 10) === value
}

function monthStart(value: string): boolean {
  return validRealDate(value) && value.endsWith('-01')
}

function addDays(value: string, count: number): string {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + count)
  return date.toISOString().slice(0, 10)
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1 }
      else if (char === '"') quoted = false
      else cell += char
      continue
    }
    if (char === '"' && cell.length === 0) quoted = true
    else if (char === ',') { row.push(cell.trim()); cell = '' }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(cell.trim()); cell = ''
      if (row.some((value) => value.length > 0)) rows.push(row)
      row = []
    } else cell += char
  }
  if (quoted) throw new ActualWorkServiceError('ACTUAL_WORK_CSV_QUOTE_INVALID')
  row.push(cell.trim())
  if (row.some((value) => value.length > 0)) rows.push(row)
  const headers = rows.shift()?.map((value) => value.trim()) ?? []
  if (headers.length === 0 || new Set(headers).size !== headers.length) throw new ActualWorkServiceError('ACTUAL_WORK_CSV_HEADER_INVALID')
  return { headers, rows }
}

type CsvRow = {
  rowNumber: number
  employeeNumber: string
  employmentId: string | null
  workHourTypeCode: string
  granularity: 'DAY' | 'PERIOD'
  subjectPeriodStart: string
  subjectPeriodEnd: string
  payrollPeriodStart: string
  hours: string
  description: string
  sourceReference: string | null
  malformedColumns: boolean
}

type CheckedCsvRow = CsvRow & { valid: boolean; error: string | null; duplicate: boolean; employeeId?: string; resolvedEmploymentId?: string; workHourTypeId?: string; administrationId?: string; sourceKey?: string }

function csvPreviewRow(row: CheckedCsvRow) {
  return {
    rowNumber: row.rowNumber,
    employeeNumber: row.employeeNumber,
    workHourTypeCode: row.workHourTypeCode,
    subjectPeriodStart: row.subjectPeriodStart,
    subjectPeriodEnd: row.subjectPeriodEnd,
    payrollPeriodStart: row.payrollPeriodStart,
    hours: row.hours,
    description: row.description,
    sourceReference: row.sourceReference,
    valid: row.valid,
    error: row.error,
    duplicate: row.duplicate,
  }
}

function csvRows(text: string): CsvRow[] {
  const { headers, rows } = parseCsv(text.replace(/^\uFEFF/, ''))
  const allowed = new Set(['employeeNumber', 'employmentId', 'workHourTypeCode', 'entryType', 'date', 'periodStart', 'periodEnd', 'payrollPeriodStart', 'hours', 'description', 'sourceReference'])
  if (headers.some((header) => !allowed.has(header))) throw new ActualWorkServiceError('ACTUAL_WORK_CSV_HEADER_INVALID')
  for (const required of ['employeeNumber', 'workHourTypeCode', 'hours', 'payrollPeriodStart']) {
    if (!headers.includes(required)) throw new ActualWorkServiceError('ACTUAL_WORK_CSV_REQUIRED_COLUMN_MISSING')
  }
  return rows.map((cells, offset) => {
    const record = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']))
    const granularity = record.entryType === 'PERIOD' || record.periodStart ? 'PERIOD' : 'DAY'
    const start = granularity === 'DAY' ? record.date ?? '' : record.periodStart ?? ''
    const end = granularity === 'DAY' ? (validRealDate(start) ? addDays(start, 1) : '') : record.periodEnd ?? ''
    return {
      rowNumber: offset + 2,
      employeeNumber: (record.employeeNumber ?? '').trim(),
      employmentId: (record.employmentId ?? '').trim() || null,
      workHourTypeCode: (record.workHourTypeCode ?? '').trim().toUpperCase(),
      granularity,
      subjectPeriodStart: start,
      subjectPeriodEnd: end,
      payrollPeriodStart: (record.payrollPeriodStart ?? '').trim(),
      hours: (record.hours ?? '').trim().replace(',', '.'),
      description: (record.description ?? '').trim(),
      sourceReference: (record.sourceReference ?? '').trim() || null,
      malformedColumns: cells.length !== headers.length,
    }
  })
}

function sourceKey(scope: AdminScope, row: CsvRow): string {
  const identity = row.sourceReference
    ? `reference:${row.sourceReference}`
    : `row:${JSON.stringify([row.employeeNumber, row.employmentId, row.workHourTypeCode, row.granularity, row.subjectPeriodStart, row.subjectPeriodEnd, row.payrollPeriodStart, row.hours, row.description])}`
  return `CSV_SHA256:${sha256(`${scope.tenantId}:${scope.administrationId}:${identity}`)}`
}

async function validateCsv(scope: AdminScope, rawRows: readonly CsvRow[]): Promise<CheckedCsvRow[]> {
  const employeesResult = await scope.supabase.from('employees')
    .select('id,employee_number')
    .eq('tenant_id', scope.tenantId).eq('hr_group_id', scope.hrGroupId)
    .in('employee_number', [...new Set(rawRows.map((row) => row.employeeNumber))])
  if (employeesResult.error) databaseError(employeesResult.error)
  const employeeByNumber = new Map((employeesResult.data ?? []).map((employee) => [employee.employee_number, employee]))
  const typesResult = await scope.supabase.from('work_hour_types')
    .select('id,code,name,family,entry_granularity,is_active,valid_from,valid_until,updated_at,comment_required')
    .eq('tenant_id', scope.tenantId).eq('hr_group_id', scope.hrGroupId)
    .eq('is_active', true).or(`administration_id.is.null,administration_id.eq.${scope.administrationId}`)
  if (typesResult.error) databaseError(typesResult.error)
  const types = (typesResult.data ?? []) as WorkType[]
  const checked: CheckedCsvRow[] = []
  const seenSourceKeys = new Map<string, string>()
  for (const row of rawRows) {
    const employee = employeeByNumber.get(row.employeeNumber)
    const workType = types.find((item) => item.code === row.workHourTypeCode)
    let error: string | null = null
    let resolvedEmploymentId: string | undefined
    if (row.malformedColumns) error = 'ACTUAL_WORK_CSV_COLUMN_COUNT_INVALID'
    else if (!employee) error = 'ACTUAL_WORK_CSV_EMPLOYEE_NOT_FOUND'
    else if (!workType) error = 'ACTUAL_WORK_CSV_TYPE_NOT_FOUND'
    else if (!validRealDate(row.subjectPeriodStart) || !validRealDate(row.subjectPeriodEnd) || row.subjectPeriodEnd <= row.subjectPeriodStart) error = 'ACTUAL_WORK_CSV_PERIOD_INVALID'
    else if (row.granularity === 'DAY' && row.subjectPeriodEnd !== addDays(row.subjectPeriodStart, 1)) error = 'ACTUAL_WORK_CSV_DAY_INVALID'
    else if (!monthStart(row.payrollPeriodStart)) error = 'ACTUAL_WORK_CSV_PAYROLL_PERIOD_INVALID'
    else if (!workType.is_active || workType.valid_from > row.subjectPeriodStart || (workType.valid_until && workType.valid_until < addDays(row.subjectPeriodEnd, -1))) error = 'ACTUAL_WORK_CSV_TYPE_NOT_EFFECTIVE'
    else if (workType.entry_granularity !== 'BOTH' && workType.entry_granularity !== row.granularity) error = 'ACTUAL_WORK_CSV_GRANULARITY_INVALID'
    else if (workType.comment_required && !row.description) error = 'ACTUAL_WORK_CSV_COMMENT_REQUIRED'
    else {
      try {
        if (!isPositiveExactHours(parseExactHours(row.hours))) error = 'ACTUAL_WORK_CSV_HOURS_INVALID'
      } catch { error = 'ACTUAL_WORK_CSV_HOURS_INVALID' }
    }
    if (!error && employee) {
      let query = scope.supabase.from('employments')
        .select('id,administration_id')
        .eq('tenant_id', scope.tenantId).eq('hr_group_id', scope.hrGroupId)
        .eq('employee_id', employee.id).eq('administration_id', scope.administrationId)
        .eq('record_status', 'CONFIRMED').is('deleted_at', null)
        .lt('starts_on', row.subjectPeriodEnd).or(`ends_on.is.null,ends_on.gte.${row.subjectPeriodStart}`)
      if (row.employmentId) query = query.eq('id', row.employmentId)
      const employmentResult = await query.limit(2)
      if (employmentResult.error) databaseError(employmentResult.error)
      if (employmentResult.data?.length !== 1) error = row.employmentId ? 'ACTUAL_WORK_CSV_EMPLOYMENT_INVALID' : 'ACTUAL_WORK_CSV_EMPLOYMENT_AMBIGUOUS'
      else resolvedEmploymentId = employmentResult.data[0]!.id
    }
    const key = sourceKey(scope, row)
    const rowSignature = JSON.stringify(row)
    const priorSignature = seenSourceKeys.get(key)
    let duplicate = priorSignature !== undefined
    if (priorSignature !== undefined && priorSignature !== rowSignature) {
      error = 'ACTUAL_WORK_CSV_SOURCE_REFERENCE_CONFLICT'
    } else if (priorSignature === undefined) {
      seenSourceKeys.set(key, rowSignature)
    }
    if (!error) {
      const existing = await scope.supabase.from('employment_work_hour_entries')
        .select('id,source_type').eq('tenant_id', scope.tenantId).eq('administration_id', scope.administrationId)
        .eq('source_type', 'ACTUAL_WORK_CSV').eq('source_key', key).maybeSingle()
      if (existing.error) databaseError(existing.error)
      duplicate ||= Boolean(existing.data)
    }
    checked.push({ ...row, valid: error === null, error, duplicate, ...(employee ? { employeeId: employee.id } : {}), ...(resolvedEmploymentId ? { resolvedEmploymentId } : {}), ...(workType ? { workHourTypeId: workType.id } : {}), ...(error === null ? { administrationId: scope.administrationId, sourceKey: key } : {}) })
  }
  return checked
}

export async function previewActualWorkCsv(input: unknown) {
  const parsed = importRequestSchema.safeParse(input)
  if (!parsed.success) throw new ActualWorkServiceError(parsed.error.issues[0]?.message ?? 'ACTUAL_WORK_CSV_INVALID')
  const scope = await adminScope(parsed.data.confirm)
  const rows = await validateCsv(scope, csvRows(parsed.data.csv))
  if (!parsed.data.confirm) return { rows: rows.map(csvPreviewRow) }
  const saved: Array<{ rowNumber: number; entryId: string; duplicate: boolean; status: Entry['status'] }> = []
  for (const row of rows.filter((item) => item.valid)) {
    const result = await scope.supabase.rpc('save_actual_work_import_entry', {
      requested_entry_id: null,
      requested_tenant_id: scope.tenantId,
      requested_hr_group_id: scope.hrGroupId,
      requested_administration_id: row.administrationId!,
      requested_employee_id: row.employeeId!,
      requested_employment_id: row.resolvedEmploymentId!,
      requested_work_hour_type_id: row.workHourTypeId!,
      requested_entry_granularity: row.granularity as Database['public']['Enums']['actual_work_entry_granularity'],
      requested_subject_period_start: row.subjectPeriodStart,
      requested_subject_period_end: row.subjectPeriodEnd,
      requested_posting_period_start: row.payrollPeriodStart,
      requested_hours: exactHoursToDatabase(parseExactHours(row.hours)) as unknown as number,
      requested_status: 'PENDING',
      requested_note: row.description,
      requested_operation: 'CREATE',
      requested_reason: '',
      requested_source_key: row.sourceKey!,
    })
    if (result.error || !result.data) databaseError(result.error)
    const savedEntry = result.data as Entry
    saved.push({ rowNumber: row.rowNumber, entryId: savedEntry.id, duplicate: row.duplicate, status: savedEntry.status })
  }
  return { rows: rows.map(csvPreviewRow), saved }
}

export async function getActualWorkPayrollReview(periodStart: string) {
  if (!monthStart(periodStart)) throw new ActualWorkServiceError('ACTUAL_WORK_PAYROLL_PERIOD_INVALID')
  const scope = await adminScope(false)
  const entryResult = await scope.supabase.from('employment_work_hour_entries').select('*')
    .eq('tenant_id', scope.tenantId).eq('hr_group_id', scope.hrGroupId).eq('administration_id', scope.administrationId)
    .eq('posting_period_start', periodStart).neq('status', 'REVOKED')
    .order('employee_id').order('work_hour_type_id').order('subject_period_start').limit(2001)
  if (entryResult.error) databaseError(entryResult.error)
  const entries = (entryResult.data ?? []) as Entry[]
  if (entries.length > 2000) throw new ActualWorkServiceError('ACTUAL_WORK_PAYROLL_PERIOD_LIMIT_REACHED')
  const employeeIds = [...new Set(entries.map((entry) => entry.employee_id))]
  const typeIds = [...new Set(entries.map((entry) => entry.work_hour_type_id))]
  const entryIds = entries.map((entry) => entry.id)
  const [employeeResult, typeResult, revisionResult, mappingResult, releaseResult, leaveLinkResult] = await Promise.all([
    employeeIds.length ? scope.supabase.from('employees').select('id,employee_number,first_name,birth_name_prefix,birth_name').eq('tenant_id', scope.tenantId).eq('hr_group_id', scope.hrGroupId).in('id', employeeIds) : Promise.resolve({ data: [], error: null }),
    typeIds.length ? scope.supabase.from('work_hour_types').select('id,code,name,family,entry_granularity,is_active,valid_from,valid_until,updated_at,comment_required').eq('tenant_id', scope.tenantId).eq('hr_group_id', scope.hrGroupId).in('id', typeIds) : Promise.resolve({ data: [], error: null }),
    entryIds.length ? scope.supabase.from('actual_work_revisions').select('entry_id,revision_number').eq('tenant_id', scope.tenantId).eq('hr_group_id', scope.hrGroupId).in('entry_id', entryIds).order('revision_number', { ascending: false }) : Promise.resolve({ data: [], error: null }),
    typeIds.length ? scope.supabase.from('actual_work_payroll_mappings').select('*').eq('tenant_id', scope.tenantId).eq('hr_group_id', scope.hrGroupId).eq('administration_id', scope.administrationId).in('work_hour_type_id', typeIds) : Promise.resolve({ data: [], error: null }),
    entryIds.length ? scope.supabase.from('actual_work_payroll_releases').select('*').eq('tenant_id', scope.tenantId).eq('hr_group_id', scope.hrGroupId).eq('administration_id', scope.administrationId).eq('payroll_period_start', periodStart).in('entry_id', entryIds) : Promise.resolve({ data: [], error: null }),
    typeIds.length ? scope.supabase.from('leave_type_overtime_work_hours').select('work_hour_type_id,leave_type_id').eq('tenant_id', scope.tenantId).eq('hr_group_id', scope.hrGroupId).in('work_hour_type_id', typeIds) : Promise.resolve({ data: [], error: null }),
  ])
  for (const result of [employeeResult, typeResult, revisionResult, mappingResult, releaseResult, leaveLinkResult]) if (result.error) databaseError(result.error)
  const employees = new Map((employeeResult.data ?? []).map((employee) => [employee.id, employee]))
  const types = new Map((typeResult.data ?? []).map((type) => [type.id, type as WorkType]))
  const latestRevision = new Map<string, number>()
  for (const row of revisionResult.data ?? []) if (!latestRevision.has(row.entry_id)) latestRevision.set(row.entry_id, row.revision_number)
  const mappings = (mappingResult.data ?? []) as Mapping[]
  const releases = (releaseResult.data ?? []) as PayrollRelease[]
  const leaveTypeIds = [...new Set((leaveLinkResult.data ?? []).map((link) => link.leave_type_id))]
  const leaveTypesResult = leaveTypeIds.length
    ? await scope.supabase.from('leave_types').select('id,entitlement_mode,is_active').eq('tenant_id', scope.tenantId).eq('hr_group_id', scope.hrGroupId).in('id', leaveTypeIds)
    : { data: [], error: null }
  if (leaveTypesResult.error) databaseError(leaveTypesResult.error)
  const overtimeLeaveTypeIds = new Set((leaveTypesResult.data ?? []).filter((type) => type.is_active && type.entitlement_mode === 'OVERTIME_HOURS').map((type) => type.id))
  const tvtTypeIds = new Set((leaveLinkResult.data ?? []).filter((link) => overtimeLeaveTypeIds.has(link.leave_type_id)).map((link) => link.work_hour_type_id))
  const mappingById = new Map(mappings.map((mapping) => [mapping.id, mapping]))
  const releaseByEntry = new Map<string, PayrollRelease[]>()
  for (const release of releases) releaseByEntry.set(release.entry_id, [...(releaseByEntry.get(release.entry_id) ?? []), release])
  const availableTypesResult = await scope.supabase.from('work_hour_types')
    .select('id,code,name,family,entry_granularity,is_active,valid_from,valid_until,updated_at,comment_required')
    .eq('tenant_id', scope.tenantId).eq('hr_group_id', scope.hrGroupId).eq('is_active', true)
    .or(`administration_id.is.null,administration_id.eq.${scope.administrationId}`)
  if (availableTypesResult.error) databaseError(availableTypesResult.error)
  return {
    periodStart,
    administrationId: scope.administrationId,
    availableTypes: availableTypesResult.data ?? [],
    employees: entries.map((entry) => {
      const latest = latestRevision.get(entry.id) ?? null
      const entryReleases = releaseByEntry.get(entry.id) ?? []
      const currentRelease = entryReleases.find((release) => release.entry_revision_number === latest)
      const workType = types.get(entry.work_hour_type_id) ?? null
      const mapping = currentRelease ? mappingById.get(currentRelease.mapping_id) ?? null : null
      const periodEnd = entry.subject_period_end > entry.subject_period_start ? addDays(entry.subject_period_end, -1) : entry.subject_period_start
      const releaseMappingCurrent = Boolean(currentRelease && mapping && workType
        && currentRelease.work_hour_type_updated_at === workType.updated_at
        && mapping.valid_from <= entry.subject_period_start
        && (mapping.valid_until === null || mapping.valid_until >= periodEnd))
      return {
        ...entry,
        employee: employees.get(entry.employee_id) ?? null,
        workType,
        currentRevision: latest,
        release: currentRelease ? { ...currentRelease, mapping } : null,
        needsPayrollReview: currentRelease ? !releaseMappingCurrent || currentRelease.release_class === 'TWK_REQUIRED'
          : entryReleases.some((release) => release.entry_revision_number !== latest),
        tvtConfigured: tvtTypeIds.has(entry.work_hour_type_id),
        informational: workType?.family === 'TRANSPARENT' || mappings.some((mappingRow) => mappingRow.work_hour_type_id === entry.work_hour_type_id && mappingRow.processing_target === 'INFORMATIONAL'),
        effectiveMappings: mappings.filter((mapping) => mapping.work_hour_type_id === entry.work_hour_type_id
          && mapping.valid_from <= entry.subject_period_start
          && (mapping.valid_until === null || mapping.valid_until >= addDays(entry.subject_period_end, -1))),
      }
    }),
    mappings,
  }
}

async function saveMapping(scope: AdminScope, input: z.infer<typeof mappingSchema>) {
  const mapping = mappingSchema.parse(input)
  if (!validRealDate(mapping.validFrom)) throw new ActualWorkServiceError('ACTUAL_WORK_PAYROLL_MAPPING_DATE_INVALID')
  if (mapping.processingTarget === 'PREMIUM') throw new ActualWorkServiceError('ACTUAL_WORK_PAYROLL_COMPONENT_SOURCE_GAP', 409, 'SOURCE_GAP')
  const componentTarget = mapping.processingTarget === 'PAYMENT'
  let component: PayrollMappingComponent | null = null
  if (componentTarget) {
    let factor: ReturnType<typeof parseExactHours>
    try { factor = parseExactHours(mapping.factor ?? '') } catch { throw new ActualWorkServiceError('ACTUAL_WORK_PAYROLL_FACTOR_INVALID') }
    if (!isPositiveExactHours(factor)) throw new ActualWorkServiceError('ACTUAL_WORK_PAYROLL_FACTOR_INVALID')
    const library = await getComponentLibrary()
    const candidate = library.components.find((item) => item.definition.id === 'system:payfull02:payfull02_variable_regular_wage'
      && item.definition.version === '2026.1-payfull02'
      && item.definition.code === 'PAYFULL02_VARIABLE_REGULAR_WAGE'
      && item.definition.outputs.some((output) => output.name === 'amount' && output.valueType === 'MONEY'))
    if (!candidate) throw new ActualWorkServiceError('ACTUAL_WORK_PAYROLL_COMPONENT_SOURCE_GAP', 409)
    component = { definition: candidate.definition }
  }
  const result = await scope.supabase.rpc('save_actual_work_payroll_mapping', {
    requested_tenant_id: scope.tenantId,
    requested_hr_group_id: scope.hrGroupId,
    requested_administration_id: scope.administrationId,
    requested_work_hour_type_id: mapping.workHourTypeId,
    requested_processing_target: mapping.processingTarget,
    requested_salary_component_id: component?.definition.id ?? null,
    requested_salary_component_code: component?.definition.code ?? null,
    requested_salary_component_version: component?.definition.version ?? null,
    requested_salary_component_output: component ? 'amount' : null,
    requested_calculation_rule: component ? 'HOURLY_RATE_X_HOURS' : 'NONE',
    requested_factor: component ? exactHoursToDatabase(parseExactHours(mapping.factor!)) as unknown as number : null,
    requested_valid_from: mapping.validFrom,
  })
  if (result.error || !result.data) databaseError(result.error)
  return result.data
}

async function approveEntries(scope: AdminScope, entryIds: readonly string[]) {
  const entries = await scope.supabase.from('employment_work_hour_entries').select('*')
    .eq('tenant_id', scope.tenantId).eq('hr_group_id', scope.hrGroupId).eq('administration_id', scope.administrationId).in('id', [...entryIds])
  if (entries.error) databaseError(entries.error)
  if ((entries.data ?? []).length !== entryIds.length) throw new ActualWorkServiceError('ACTUAL_WORK_PAYROLL_ENTRY_SCOPE_INVALID', 403)
  const approved: Entry[] = []
  for (const entry of entries.data ?? []) {
    if (entry.status === 'APPROVED') { approved.push(entry); continue }
    if (entry.status !== 'PENDING') throw new ActualWorkServiceError('ACTUAL_WORK_PAYROLL_ENTRY_NOT_APPROVABLE')
    const result = await scope.supabase.rpc('save_actual_work_entry', {
      requested_entry_id: entry.id,
      requested_tenant_id: scope.tenantId,
      requested_hr_group_id: scope.hrGroupId,
      requested_administration_id: entry.administration_id,
      requested_employee_id: entry.employee_id,
      requested_employment_id: entry.employment_id,
      requested_work_hour_type_id: entry.work_hour_type_id,
      requested_entry_granularity: entry.entry_granularity,
      requested_subject_period_start: entry.subject_period_start,
      requested_subject_period_end: entry.subject_period_end,
      requested_posting_period_start: entry.posting_period_start,
      requested_hours: exactHoursToDatabase(parseExactHours(String(entry.hours))) as unknown as number,
      requested_status: 'APPROVED',
      requested_note: entry.note ?? '',
      requested_operation: 'EDIT',
    })
    if (result.error || !result.data) databaseError(result.error)
    approved.push(result.data)
  }
  return approved
}

async function releaseEntries(scope: AdminScope, periodStart: string, entryIds: readonly string[]) {
  if (!monthStart(periodStart)) throw new ActualWorkServiceError('ACTUAL_WORK_PAYROLL_PERIOD_INVALID')
  const review = await getActualWorkPayrollReview(periodStart)
  const entriesById = new Map(review.employees.map((entry) => [entry.id, entry]))
  const requestEntries = entryIds.map((entryId) => {
    const entry = entriesById.get(entryId)
    if (!entry || !entry.currentRevision) throw new ActualWorkServiceError('ACTUAL_WORK_PAYROLL_ENTRY_SCOPE_INVALID', 403)
    if (entry.status !== 'APPROVED') throw new ActualWorkServiceError('ACTUAL_WORK_PAYROLL_ENTRY_NOT_APPROVED')
    if (entry.effectiveMappings.some((mapping) => mapping.processing_target === 'PREMIUM')
      || (entry.workType?.family === 'OVERTIME' && entry.effectiveMappings.some((mapping) => mapping.processing_target === 'PAYMENT'))) {
      throw new ActualWorkServiceError('ACTUAL_WORK_PAYROLL_COMPONENT_SOURCE_GAP', 409, 'SOURCE_GAP')
    }
    const mappings = entry.effectiveMappings.filter((mapping) => mapping.processing_target === 'PAYMENT')
    if (mappings.length !== 1) throw new ActualWorkServiceError('ACTUAL_WORK_PAYROLL_MAPPING_REQUIRED', 409, 'SOURCE_GAP')
    return { entryId, revisionNumber: entry.currentRevision, mappingId: mappings[0]!.id }
  })
  const result = await scope.supabase.rpc('release_actual_work_entries_for_payroll', {
    requested_tenant_id: scope.tenantId,
    requested_hr_group_id: scope.hrGroupId,
    requested_administration_id: scope.administrationId,
    requested_payroll_period_start: periodStart,
    requested_entries: requestEntries,
  })
  if (result.error || !result.data) databaseError(result.error)
  return result.data
}

export async function mutateActualWorkPayroll(input: unknown) {
  const parsed = actionSchema.safeParse(input)
  if (!parsed.success) throw new ActualWorkServiceError('ACTUAL_WORK_PAYROLL_INPUT_INVALID')
  const scope = await adminScope(true)
  if (parsed.data.action === 'map') return saveMapping(scope, parsed.data.mapping)
  if (parsed.data.action === 'approve') return approveEntries(scope, parsed.data.entryIds)
  return releaseEntries(scope, parsed.data.periodStart, parsed.data.entryIds)
}
