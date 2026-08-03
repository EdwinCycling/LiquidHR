import { createHash } from 'node:crypto'
import type { Database, Json, TablesInsert } from '@scope/db'
import { requirePermission } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import { parseTalentImportCsv, talentImportSourceRowSchema, type TalentImportPreviewInput } from './import-schemas'

type BatchRow = Database['public']['Tables']['talent_import_batches']['Row']
type ImportRow = Database['public']['Tables']['talent_import_rows']['Row']
type Employee = Pick<Database['public']['Tables']['employees']['Row'], 'id' | 'employee_number'>
type Capability = Pick<Database['public']['Tables']['talent_capabilities']['Row'], 'id' | 'code' | 'capability_type'>
type Level = Pick<Database['public']['Tables']['talent_levels']['Row'], 'id' | 'code'>
type ExistingRecord = Pick<Database['public']['Tables']['talent_employee_capability_records']['Row'], 'id' | 'tenant_id' | 'employee_id' | 'capability_id' | 'source_type' | 'status' | 'valid_from'>

export class TalentImportError extends Error {
  constructor(public readonly code: string, public readonly status = 500) {
    super(code)
    this.name = 'TalentImportError'
  }
}

export type TalentImportRow = Omit<Pick<ImportRow, 'id' | 'row_number' | 'employee_number' | 'capability_code' | 'valid_from' | 'valid_until' | 'talent_level_code' | 'language_level' | 'certificate_code' | 'evidence_status' | 'row_status' | 'errors' | 'applied_record_id'>, 'errors'> & { errors: string[] }
export type TalentImportBatch = Pick<BatchRow, 'id' | 'source_filename' | 'source_hash' | 'row_count' | 'status' | 'created_at' | 'committed_at' | 'rolled_back_at'> & { rows: TalentImportRow[] }

function errorList(value: Json): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function toBatch(batch: BatchRow, rows: ImportRow[]): TalentImportBatch {
  return {
    id: batch.id, source_filename: batch.source_filename, source_hash: batch.source_hash, row_count: batch.row_count,
    status: batch.status, created_at: batch.created_at, committed_at: batch.committed_at, rolled_back_at: batch.rolled_back_at,
    rows: rows.map((row) => ({ id: row.id, row_number: row.row_number, employee_number: row.employee_number, capability_code: row.capability_code, valid_from: row.valid_from, valid_until: row.valid_until, talent_level_code: row.talent_level_code, language_level: row.language_level, certificate_code: row.certificate_code, evidence_status: row.evidence_status, row_status: row.row_status, errors: errorList(row.errors), applied_record_id: row.applied_record_id })),
  }
}

function normalized(value: string): string { return value.trim().toLocaleLowerCase('en-US') }

function validDate(value: string): boolean { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) }

export function validateTalentImportCapabilityType(values: Record<string, string>, capabilityType: string): string[] {
  const errors: string[] = []
  const hasCertificateMetadata = Boolean(values.certificate_code || values.evidence_status)
  if (['COMPETENCY', 'SKILL', 'KNOWLEDGE'].includes(capabilityType)) {
    if (!values.talent_level_code) errors.push('TALENT_IMPORT_LEVEL_REQUIRED')
    if (values.language_level) errors.push('TALENT_IMPORT_LANGUAGE_VALUE_NOT_ALLOWED')
    if (hasCertificateMetadata) errors.push('TALENT_IMPORT_CERTIFICATE_METADATA_NOT_ALLOWED')
  } else if (capabilityType === 'LANGUAGE') {
    if (values.talent_level_code) errors.push('TALENT_IMPORT_LEVEL_NOT_ALLOWED')
    if (!values.language_level) errors.push('TALENT_IMPORT_LANGUAGE_LEVEL_REQUIRED')
    if (hasCertificateMetadata) errors.push('TALENT_IMPORT_CERTIFICATE_METADATA_NOT_ALLOWED')
  } else if (capabilityType === 'CERTIFICATE') {
    errors.push('TALENT_IMPORT_CERTIFICATE_STATUS_REQUIRED')
  }
  return errors
}

async function resolveBatch(batchId: string, context: Awaited<ReturnType<typeof requirePermission>>) {
  const supabase = await createClient()
  const [batchResult, rowsResult] = await Promise.all([
    supabase.from('talent_import_batches').select('*').eq('tenant_id', context.tenantId).eq('id', batchId).maybeSingle(),
    supabase.from('talent_import_rows').select('*').eq('tenant_id', context.tenantId).eq('batch_id', batchId).order('row_number').limit(5000),
  ])
  if (batchResult.error || rowsResult.error) throw new TalentImportError('TALENT_IMPORT_READ_FAILED')
  if (!batchResult.data) throw new TalentImportError('TALENT_IMPORT_NOT_FOUND', 404)
  return toBatch(batchResult.data, rowsResult.data ?? [])
}

export async function listTalentImportBatches(): Promise<TalentImportBatch[]> {
  const context = await requirePermission('talent-import:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data, error } = await supabase.from('talent_import_batches').select('*').eq('tenant_id', context.tenantId).order('created_at', { ascending: false }).limit(50)
  if (error) throw new TalentImportError('TALENT_IMPORT_READ_FAILED')
  return (data ?? []).map((batch) => toBatch(batch, []))
}

export async function getTalentImportBatch(batchId: string): Promise<TalentImportBatch> {
  const context = await requirePermission('talent-import:manage')
  await requireTenantModule('TALENT')
  return resolveBatch(batchId, context)
}

export async function previewTalentImport(input: TalentImportPreviewInput): Promise<TalentImportBatch> {
  const context = await requirePermission('talent-import:manage')
  await requireTenantModule('TALENT')
  const parsed = parseTalentImportCsv(input.content)
  if (parsed.rows.length === 0 && parsed.errors.length > 0) throw new TalentImportError(parsed.errors[0], 400)
  const supabase = await createClient()
  const employeeNumbers = [...new Set(parsed.rows.map((row) => row.values.employee_number).filter(Boolean))]
  const capabilityCodes = [...new Set(parsed.rows.map((row) => row.values.capability_code).filter(Boolean))]
  const [employeesResult, capabilitiesResult, levelsResult] = await Promise.all([
    employeeNumbers.length > 0 ? supabase.from('employees').select('id,employee_number').eq('tenant_id', context.tenantId).in('employee_number', employeeNumbers).is('deleted_at', null) : Promise.resolve({ data: [], error: null }),
    capabilityCodes.length > 0 ? supabase.from('talent_capabilities').select('id,code,capability_type').eq('tenant_id', context.tenantId).in('code', capabilityCodes) : Promise.resolve({ data: [], error: null }),
    supabase.from('talent_levels').select('id,code').eq('tenant_id', context.tenantId).limit(500),
  ])
  if (employeesResult.error || capabilitiesResult.error || levelsResult.error) throw new TalentImportError('TALENT_IMPORT_LOOKUP_FAILED')
  const employeeByNumber = new Map((employeesResult.data ?? []).map((employee) => [normalized(employee.employee_number), employee as Employee]))
  const capabilityByCode = new Map((capabilitiesResult.data ?? []).map((capability) => [normalized(capability.code), capability as Capability]))
  const levelByCode = new Map((levelsResult.data ?? []).map((level) => [normalized(level.code), level as Level]))
  const employeeIds = [...employeeByNumber.values()].map((employee) => employee.id)
  const capabilityIds = [...capabilityByCode.values()].map((capability) => capability.id)
  const existingResult = employeeIds.length > 0 && capabilityIds.length > 0
    ? await supabase.from('talent_employee_capability_records').select('id,tenant_id,employee_id,capability_id,source_type,status,valid_from').eq('tenant_id', context.tenantId).in('employee_id', employeeIds).in('capability_id', capabilityIds).neq('status', 'ARCHIVED').limit(10000)
    : { data: [], error: null }
  if (existingResult.error) throw new TalentImportError('TALENT_IMPORT_EXISTING_READ_FAILED')
  const existingByKey = new Map((existingResult.data ?? []).map((record) => [`${record.employee_id}:${record.capability_id}:${record.valid_from}`, record as ExistingRecord]))
  const seenKeys = new Set<string>()
  const rows: TablesInsert<'talent_import_rows'>[] = []
  for (const source of parsed.rows) {
    const values = source.values
    const employee = employeeByNumber.get(normalized(values.employee_number))
    const capability = capabilityByCode.get(normalized(values.capability_code))
    const level = values.talent_level_code ? levelByCode.get(normalized(values.talent_level_code)) : undefined
    const errors = [...parsed.errors.filter((error) => error.endsWith(`:${source.rowNumber}`))]
    if (!employee) errors.push('TALENT_IMPORT_EMPLOYEE_NOT_FOUND')
    if (!capability) errors.push('TALENT_IMPORT_CAPABILITY_NOT_FOUND')
    if (!validDate(values.valid_from)) errors.push('TALENT_IMPORT_VALID_FROM_INVALID')
    if (values.valid_until && (!validDate(values.valid_until) || values.valid_until <= values.valid_from)) errors.push('TALENT_IMPORT_VALID_UNTIL_INVALID')
    if (values.talent_level_code && !level) errors.push('TALENT_IMPORT_LEVEL_NOT_FOUND')
    const parsedEvidence = values.evidence_status ? talentImportSourceRowSchema.shape.evidenceStatus.safeParse(values.evidence_status).success : true
    if (!parsedEvidence) errors.push('TALENT_IMPORT_EVIDENCE_STATUS_INVALID')
    if (capability) errors.push(...validateTalentImportCapabilityType(values, capability.capability_type))
    const key = employee && capability ? `${employee.id}:${capability.id}:${values.valid_from}` : null
    if (key && seenKeys.has(key)) errors.push('TALENT_IMPORT_DUPLICATE_ROW')
    if (key) seenKeys.add(key)
    const existing = key ? existingByKey.get(key) : undefined
    if (existing && existing.source_type !== 'IMPORTED') errors.push('TALENT_IMPORT_EXISTING_SOURCE_CONFLICT')
    const action = existing?.source_type === 'IMPORTED' ? 'UPDATE' : 'NEW'
    const parsedData: Json = {
      employeeId: employee?.id ?? null, capabilityId: capability?.id ?? null, talentLevelId: level?.id ?? null,
      languageLevel: values.language_level || null, certificateCode: values.certificate_code || null, evidenceStatus: values.evidence_status || null,
      validFrom: values.valid_from || null, validUntil: values.valid_until || null, action, targetRecordId: existing?.id ?? null,
    }
    rows.push({ tenant_id: context.tenantId, batch_id: '', row_number: source.rowNumber, employee_number: values.employee_number, capability_code: values.capability_code, valid_from: validDate(values.valid_from) ? values.valid_from : null, valid_until: validDate(values.valid_until) ? values.valid_until : null, talent_level_code: values.talent_level_code || null, language_level: values.language_level || null, certificate_code: values.certificate_code || null, evidence_status: values.evidence_status || null, parsed_data: parsedData, row_status: errors.length === 0 ? 'VALID' : 'INVALID', errors, })
  }
  const sourceHash = createHash('sha256').update(input.content, 'utf8').digest('hex')
  const { data: batch, error: batchError } = await supabase.from('talent_import_batches').insert({ tenant_id: context.tenantId, source_filename: input.filename, source_hash: sourceHash, row_count: rows.length, status: 'PREVIEW', created_by_user_id: context.userId }).select('*').single()
  if (batchError || !batch) throw new TalentImportError('TALENT_IMPORT_CREATE_FAILED')
  const rowsWithBatch = rows.map((row) => ({ ...row, batch_id: batch.id }))
  const { data: insertedRows, error: rowsError } = rowsWithBatch.length > 0 ? await supabase.from('talent_import_rows').insert(rowsWithBatch).select('*') : { data: [], error: null }
  if (rowsError) throw new TalentImportError('TALENT_IMPORT_ROWS_CREATE_FAILED')
  return toBatch(batch, insertedRows ?? [])
}

async function runCommand(batchId: string, idempotencyKey: string, command: 'commit_talent_import_batch' | 'rollback_talent_import_batch'): Promise<TalentImportBatch> {
  const context = await requirePermission('talent-import:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { error } = await supabase.rpc(command, { requested_tenant_id: context.tenantId, requested_batch_id: batchId, requested_idempotency_key: idempotencyKey })
  if (error) {
    const code = error.message.match(/[A-Z][A-Z0-9_]+/)?.[0] ?? 'TALENT_IMPORT_COMMAND_FAILED'
    const status = code.includes('FORBIDDEN') ? 403 : code.includes('NOT_FOUND') ? 404 : code.includes('INVALID') || code.includes('REQUIRED') || code.includes('PREVIEW') || code.includes('COMMITTED') || code.includes('INVALID_ROWS') ? 409 : 400
    throw new TalentImportError(code, status)
  }
  return resolveBatch(batchId, context)
}

export function commitTalentImportBatch(batchId: string, idempotencyKey: string) { return runCommand(batchId, idempotencyKey, 'commit_talent_import_batch') }
export function rollbackTalentImportBatch(batchId: string, idempotencyKey: string) { return runCommand(batchId, idempotencyKey, 'rollback_talent_import_batch') }
