import type { Database, TablesInsert, TablesUpdate } from '@scope/db'
import { requirePermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import {
  type TalentEmployeeCapabilityAdminCreateInput,
  type TalentEmployeeCapabilityAdminUpdateInput,
  type TalentEmployeeCapabilityListQuery,
  type TalentEmployeeCapabilitySelfCreateInput,
  type TalentEmployeeCapabilitySelfUpdateInput,
} from './schemas'
import { TalentServiceError } from './service'

type RecordRow = Database['public']['Tables']['talent_employee_capability_records']['Row']
type CapabilityRow = Database['public']['Tables']['talent_capabilities']['Row']
type LevelRow = Database['public']['Tables']['talent_levels']['Row']
type EmployeeRow = Database['public']['Tables']['employees']['Row']
type RecordReadRow = Pick<RecordRow, 'id' | 'employee_id' | 'capability_id' | 'talent_level_id' | 'language_level' | 'language_is_native' | 'certificate_status' | 'certificate_issuing_body' | 'certificate_code' | 'certificate_validity_months' | 'certificate_is_permanent' | 'certificate_renewal_required' | 'evidence_status' | 'qualification_responsible_user_id' | 'source_type' | 'status' | 'valid_from' | 'valid_until' | 'evidence_document_id' | 'version' | 'updated_at'>

export type TalentEmployeeCapabilityRecord = {
  id: string
  employeeId: string
  employeeLabel: string
  employeeNumber: string
  capabilityId: string
  capabilityCode: string
  capabilityName: string
  capabilityType: string
  talentLevelId: string | null
  talentLevelCode: string | null
  talentLevelName: string | null
  languageLevel: string | null
  languageIsNative: boolean
  certificateStatus: string | null
  certificateIssuingBody: string | null
  certificateCode: string | null
  certificateValidityMonths: number | null
  certificateIsPermanent: boolean
  certificateRenewalRequired: boolean
  evidenceStatus: string | null
  qualificationResponsibleAssigned: boolean
  sourceType: string
  status: string
  validFrom: string
  validUntil: string | null
  evidenceDocumentId: string | null
  version: number
  updatedAt: string
}

export type TalentEmployeeCapabilityOptions = {
  employees: Array<{ id: string; label: string; employeeNumber: string }>
  capabilities: Array<Pick<CapabilityRow, 'id' | 'code' | 'name' | 'capability_type'>>
  levels: Array<Pick<LevelRow, 'id' | 'code' | 'name'>>
}

function effectiveStatus(row: Pick<RecordRow, 'status' | 'valid_until'>, today: string): string {
  if (row.status !== 'ARCHIVED' && row.valid_until && row.valid_until <= today) return 'EXPIRED'
  return row.status
}

function employeeLabel(employee: Pick<EmployeeRow, 'first_name' | 'birth_name' | 'employee_number'>): string {
  return [employee.first_name, employee.birth_name].filter((value) => value.trim().length > 0).join(' ') || employee.employee_number
}

function valueFields(input: {
  capabilityId: string
  talentLevelId?: string | null
  languageLevel?: string | null
  languageIsNative?: boolean
  certificateStatus?: string | null
  validFrom: string
  validUntil?: string | null
  evidenceDocumentId?: string | null
}) {
  return {
    capability_id: input.capabilityId,
    talent_level_id: input.talentLevelId ?? null,
    language_level: input.languageLevel ?? null,
    language_is_native: input.languageIsNative ?? false,
    certificate_status: input.certificateStatus ?? null,
    valid_from: input.validFrom,
    valid_until: input.validUntil ?? null,
    evidence_document_id: input.evidenceDocumentId ?? null,
  }
}

function qualificationCreateFields(input: TalentEmployeeCapabilityAdminCreateInput) {
  return {
    certificate_issuing_body: input.certificateIssuingBody ?? null,
    certificate_code: input.certificateCode ?? null,
    certificate_validity_months: input.certificateValidityMonths ?? null,
    certificate_is_permanent: input.certificateIsPermanent ?? false,
    certificate_renewal_required: input.certificateRenewalRequired ?? false,
    evidence_status: input.evidenceStatus ?? null,
    qualification_responsible_user_id: input.qualificationResponsibleUserId ?? null,
  }
}

function qualificationUpdateFields(input: TalentEmployeeCapabilityAdminUpdateInput): TablesUpdate<'talent_employee_capability_records'> {
  const update: TablesUpdate<'talent_employee_capability_records'> = {}
  if (Object.prototype.hasOwnProperty.call(input, 'certificateIssuingBody')) update.certificate_issuing_body = input.certificateIssuingBody ?? null
  if (Object.prototype.hasOwnProperty.call(input, 'certificateCode')) update.certificate_code = input.certificateCode ?? null
  if (Object.prototype.hasOwnProperty.call(input, 'certificateValidityMonths')) update.certificate_validity_months = input.certificateValidityMonths ?? null
  if (Object.prototype.hasOwnProperty.call(input, 'certificateIsPermanent')) update.certificate_is_permanent = input.certificateIsPermanent ?? false
  if (Object.prototype.hasOwnProperty.call(input, 'certificateRenewalRequired')) update.certificate_renewal_required = input.certificateRenewalRequired ?? false
  if (Object.prototype.hasOwnProperty.call(input, 'evidenceStatus')) update.evidence_status = input.evidenceStatus ?? null
  if (Object.prototype.hasOwnProperty.call(input, 'qualificationResponsibleUserId')) update.qualification_responsible_user_id = input.qualificationResponsibleUserId ?? null
  return update
}

function recordWriteError(error: { code?: string; message?: string }, fallback: string) {
  const message = error.message ?? ''
  if (error.code === '23505') return { code: 'TALENT_QUALIFICATION_DUPLICATE', status: 409 }
  if (error.code === '23514') return { code: 'TALENT_VALUE_TYPE_INVALID', status: 400 }
  for (const code of ['TALENT_EVIDENCE_SCOPE_INVALID', 'TALENT_EVIDENCE_REFERENCE_REQUIRED', 'TALENT_PERMANENT_CERTIFICATE_INVALID', 'TALENT_QUALIFICATION_RESPONSIBLE_SCOPE_INVALID', 'TALENT_VALUE_TYPE_INVALID']) {
    if (message.includes(code)) return { code, status: 400 }
  }
  return { code: fallback, status: error.code === '42501' ? 403 : 400 }
}

function toRecord(
  row: RecordReadRow,
  capability: Pick<CapabilityRow, 'id' | 'code' | 'name' | 'capability_type'> | undefined,
  level: Pick<LevelRow, 'id' | 'code' | 'name'> | undefined,
  employee: Pick<EmployeeRow, 'first_name' | 'birth_name' | 'employee_number'> | undefined,
  today: string,
): TalentEmployeeCapabilityRecord {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeLabel: employee ? employeeLabel(employee) : row.employee_id,
    employeeNumber: employee?.employee_number ?? '',
    capabilityId: row.capability_id,
    capabilityCode: capability?.code ?? row.capability_id,
    capabilityName: capability?.name ?? row.capability_id,
    capabilityType: capability?.capability_type ?? '',
    talentLevelId: row.talent_level_id,
    talentLevelCode: level?.code ?? null,
    talentLevelName: level?.name ?? null,
    languageLevel: row.language_level,
    languageIsNative: row.language_is_native,
    certificateStatus: row.certificate_status,
    certificateIssuingBody: row.certificate_issuing_body,
    certificateCode: row.certificate_code,
    certificateValidityMonths: row.certificate_validity_months,
    certificateIsPermanent: row.certificate_is_permanent,
    certificateRenewalRequired: row.certificate_renewal_required,
    evidenceStatus: row.evidence_status,
    qualificationResponsibleAssigned: Boolean(row.qualification_responsible_user_id),
    sourceType: row.source_type,
    status: effectiveStatus(row, today),
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    evidenceDocumentId: row.evidence_document_id,
    version: row.version,
    updatedAt: row.updated_at,
  }
}

async function readRecordRows(query: TalentEmployeeCapabilityListQuery, selfBound: boolean) {
  const context = selfBound
    ? await requirePermission('self:talent-record:read')
    : await requirePermission('talent-record:read')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const targetEmployeeId = selfBound ? context.employeeId : query.employeeId
  if (selfBound && !targetEmployeeId) throw new TalentServiceError('EMPLOYEE_CONTEXT_REQUIRED', 403)

  let recordsQuery = supabase
    .from('talent_employee_capability_records')
    .select('id,employee_id,capability_id,talent_level_id,language_level,language_is_native,certificate_status,certificate_issuing_body,certificate_code,certificate_validity_months,certificate_is_permanent,certificate_renewal_required,evidence_status,qualification_responsible_user_id,source_type,status,valid_from,valid_until,evidence_document_id,version,updated_at')
    .eq('tenant_id', context.tenantId)
    .order('valid_from', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(1000)
  if (targetEmployeeId) recordsQuery = recordsQuery.eq('employee_id', targetEmployeeId)
  if (query.sourceType) recordsQuery = recordsQuery.eq('source_type', query.sourceType)
  const { data: records, error: recordsError } = await recordsQuery
  if (recordsError) throw new TalentServiceError('TALENT_EMPLOYEE_CAPABILITY_READ_FAILED')

  const rows = records ?? []
  const capabilityIds = [...new Set(rows.map((row) => row.capability_id))]
  const levelIds = [...new Set(rows.map((row) => row.talent_level_id).filter((id): id is string => Boolean(id)))]
  const employeeIds = [...new Set(rows.map((row) => row.employee_id))]
  const [capabilitiesResult, levelsResult, employeesResult] = await Promise.all([
    capabilityIds.length > 0
      ? supabase.from('talent_capabilities').select('id,code,name,capability_type').eq('tenant_id', context.tenantId).in('id', capabilityIds)
      : Promise.resolve({ data: [], error: null }),
    levelIds.length > 0
      ? supabase.from('talent_levels').select('id,code,name').eq('tenant_id', context.tenantId).in('id', levelIds)
      : Promise.resolve({ data: [], error: null }),
    employeeIds.length > 0
      ? supabase.from('employees').select('id,first_name,birth_name,employee_number').eq('tenant_id', context.tenantId).in('id', employeeIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (capabilitiesResult.error || levelsResult.error || employeesResult.error) throw new TalentServiceError('TALENT_EMPLOYEE_CAPABILITY_READ_FAILED')

  const capabilitiesById = new Map((capabilitiesResult.data ?? []).map((item) => [item.id, item]))
  const levelsById = new Map((levelsResult.data ?? []).map((item) => [item.id, item]))
  const employeesById = new Map((employeesResult.data ?? []).map((item) => [item.id, item]))
  const today = new Date().toISOString().slice(0, 10)
  return rows
    .map((row) => toRecord(row, capabilitiesById.get(row.capability_id), row.talent_level_id ? levelsById.get(row.talent_level_id) : undefined, employeesById.get(row.employee_id), today))
    .filter((row) => (!query.status || row.status === query.status) && (!query.capabilityType || row.capabilityType === query.capabilityType))
}

export function listMyTalentEmployeeCapabilityRecords() {
  return readRecordRows({}, true)
}

export function listTalentEmployeeCapabilityRecords(query: TalentEmployeeCapabilityListQuery) {
  return readRecordRows(query, false)
}

async function recordOptions(includeEmployees: boolean): Promise<TalentEmployeeCapabilityOptions> {
  const context = includeEmployees
    ? await requirePermission('talent-record:write')
    : await requirePermission('self:talent-record:read')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const employeesQuery = includeEmployees
    ? supabase.from('employees').select('id,first_name,birth_name,employee_number').eq('tenant_id', context.tenantId).is('deleted_at', null).eq('is_active', true).order('birth_name').limit(1000)
    : null
  const [employeesResult, capabilitiesResult, levelsResult] = await Promise.all([
    employeesQuery ?? Promise.resolve({ data: [], error: null }),
    supabase.from('talent_capabilities').select('id,code,name,capability_type').eq('tenant_id', context.tenantId).eq('status', 'ACTIVE').order('capability_type').order('name').limit(1000),
    supabase.from('talent_levels').select('id,code,name').eq('tenant_id', context.tenantId).order('sort_order').order('code').limit(100),
  ])
  if (employeesResult.error || capabilitiesResult.error || levelsResult.error) throw new TalentServiceError('TALENT_EMPLOYEE_CAPABILITY_OPTIONS_FAILED')
  return {
    employees: (employeesResult.data ?? []).map((employee) => ({ id: employee.id, label: employeeLabel(employee), employeeNumber: employee.employee_number })),
    capabilities: capabilitiesResult.data ?? [],
    levels: levelsResult.data ?? [],
  }
}

export function getTalentEmployeeCapabilityOptions() {
  return recordOptions(true)
}

export function getMyTalentEmployeeCapabilityOptions() {
  return recordOptions(false)
}

export async function createMyTalentEmployeeCapabilityRecord(input: TalentEmployeeCapabilitySelfCreateInput) {
  const context = await requirePermission('self:talent-record:write')
  await requireTenantModule('TALENT')
  if (!context.employeeId) throw new TalentServiceError('EMPLOYEE_CONTEXT_REQUIRED', 403)
  const supabase = await createClient()
  const insert: TablesInsert<'talent_employee_capability_records'> = {
    tenant_id: context.tenantId,
    employee_id: context.employeeId,
    ...valueFields(input),
    source_type: 'SELF_ENTERED',
    status: 'DRAFT',
    created_by_user_id: context.userId,
    updated_by_user_id: context.userId,
  }
  const { data, error } = await supabase.from('talent_employee_capability_records').insert(insert).select('id').single()
  if (error) {
    const mapped = recordWriteError(error, 'TALENT_EMPLOYEE_CAPABILITY_CREATE_FAILED')
    throw new TalentServiceError(mapped.code, mapped.status)
  }
  return data.id
}

export async function createTalentEmployeeCapabilityRecord(input: TalentEmployeeCapabilityAdminCreateInput) {
  const context = await requirePermission('talent-record:write')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const insert: TablesInsert<'talent_employee_capability_records'> = {
    tenant_id: context.tenantId,
    employee_id: input.employeeId,
    ...valueFields(input),
    ...qualificationCreateFields(input),
    source_type: input.sourceType,
    status: input.status,
    created_by_user_id: context.userId,
    updated_by_user_id: context.userId,
  }
  const { data, error } = await supabase.from('talent_employee_capability_records').insert(insert).select('id').single()
  if (error) {
    const mapped = recordWriteError(error, 'TALENT_EMPLOYEE_CAPABILITY_CREATE_FAILED')
    throw new TalentServiceError(mapped.code, mapped.status)
  }
  return data.id
}

async function updateRecord(
  recordId: string,
  input: TalentEmployeeCapabilitySelfUpdateInput | TalentEmployeeCapabilityAdminUpdateInput,
  selfBound: boolean,
) {
  const context = selfBound
    ? await requirePermission('self:talent-record:write')
    : await requirePermission('talent-record:write')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const update: TablesUpdate<'talent_employee_capability_records'> = {
    ...valueFields(input),
    updated_by_user_id: context.userId,
    version: input.version + 1,
  }
  if (!selfBound) {
    Object.assign(update, qualificationUpdateFields(input as TalentEmployeeCapabilityAdminUpdateInput))
    if ('status' in input && input.status) {
      update.status = input.status
      if (input.status === 'ARCHIVED') update.archived_by_user_id = context.userId
    }
  }
  let query = supabase
    .from('talent_employee_capability_records')
    .update(update)
    .eq('id', recordId)
    .eq('tenant_id', context.tenantId)
    .eq('version', input.version)
    .select('id')
  if (selfBound) {
    if (!context.employeeId) throw new TalentServiceError('EMPLOYEE_CONTEXT_REQUIRED', 403)
    query = query.eq('employee_id', context.employeeId).eq('source_type', 'SELF_ENTERED').eq('status', 'DRAFT')
  }
  const { data, error } = await query.maybeSingle()
  if (error) {
    const mapped = recordWriteError(error, 'TALENT_EMPLOYEE_CAPABILITY_UPDATE_FAILED')
    throw new TalentServiceError(mapped.code, mapped.status)
  }
  if (!data) throw new TalentServiceError('TALENT_EMPLOYEE_CAPABILITY_CONFLICT', 409)
  return data.id
}

export function updateMyTalentEmployeeCapabilityRecord(recordId: string, input: TalentEmployeeCapabilitySelfUpdateInput) {
  return updateRecord(recordId, input, true)
}

export function updateTalentEmployeeCapabilityRecord(recordId: string, input: TalentEmployeeCapabilityAdminUpdateInput) {
  return updateRecord(recordId, input, false)
}
