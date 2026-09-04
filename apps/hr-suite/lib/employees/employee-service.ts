import type { Json } from '@scope/db'
import { requireHrGroupId, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { createBsnFingerprint } from '@/lib/security/bsn-fingerprint'
import { decryptPii, encryptPii } from '@/lib/security/pii-crypto'
import { EmployeeServiceError } from './errors'
import { compactEmployeeAvatar } from './avatar-image'
import { createEmployeeSystemActivity } from './employee-activity-service'
import { parseStorageReference, resolveStoredImageUrl } from '@/lib/storage/image-url'
import {
  isPostgresConflict,
  toEmployeeInsert,
  toEmployeeUpdate,
  toPublicEmployee,
  type PublicEmployee,
} from './employee-mappers'
import type {
  AddressInput,
  BankAccountInput,
  BankAccountUpdateInput,
  EmployeeCreateInput,
  EmployeeUpdateInput,
  RelationInput,
} from './schemas'

export { EmployeeServiceError } from './errors'


function toAddressLine1(input: AddressInput): string {
  const supplied = input.addressLine1?.trim()
  if (supplied) return supplied
  return [input.street, input.houseNumber, input.houseNumberAddition ?? input.addition]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
}

function toAddressRow(input: AddressInput): {
  address_type: AddressInput['addressType']
  description: string | null
  address_line_1: string
  address_line_2: string | null
  street: string | null
  house_number: string | null
  house_number_addition: string | null
  postal_code: string | null
  postal_code_normalized: string | null
  city: string
  region: string | null
  country_code: string
  source: AddressInput['source']
  source_reference: string | null
  valid_from: string
  valid_until: string | null
} {
  const postalCode = input.postalCode?.trim() ?? null
  return {
    address_type: input.addressType,
    description: input.addressType === 'SECONDARY' ? input.description?.trim() ?? null : null,
    address_line_1: toAddressLine1(input),
    address_line_2: input.addressLine2 ?? null,
    street: input.street ?? null,
    house_number: input.houseNumber ?? null,
    house_number_addition: input.houseNumberAddition ?? input.addition ?? null,
    postal_code: postalCode,
    postal_code_normalized: postalCode ? postalCode.replace(/\s/g, '').toUpperCase() : null,
    city: input.city,
    region: input.region ?? input.province ?? null,
    country_code: input.countryCode,
    source: input.source,
    source_reference: input.sourceReference ?? null,
    valid_from: input.validFrom,
    valid_until: input.addressType === 'SECONDARY' ? input.validUntil ?? null : null,
  }
}

function addressDatabaseError(error: { code?: string; message?: string }, fallback: string): EmployeeServiceError {
  if (isPostgresConflict(error)) {
    return new EmployeeServiceError('ADDRESS_PERIOD_CONFLICT', 409)
  }
  const message = error.message ?? ''
  if (message.includes('ADDRESS_LAST_CANNOT_ARCHIVE')) return new EmployeeServiceError('ADDRESS_LAST_CANNOT_ARCHIVE', 409)
  if (message.includes('ADDRESS_PRIMARY_REQUIRED')) return new EmployeeServiceError('ADDRESS_PRIMARY_REQUIRED', 409)
  if (message.includes('ADDRESS_PRIMARY_START_INVALID')) return new EmployeeServiceError('ADDRESS_PRIMARY_START_INVALID', 409)
  if (message.includes('ADDRESS_PRIMARY_END_NOT_ALLOWED')) return new EmployeeServiceError('ADDRESS_PRIMARY_END_NOT_ALLOWED', 400)
  if (message.includes('ADDRESS_SECONDARY_FIELDS_REQUIRED')) return new EmployeeServiceError('ADDRESS_SECONDARY_FIELDS_REQUIRED', 400)
  if (message.includes('ADDRESS_TYPE_INVALID')) return new EmployeeServiceError('ADDRESS_TYPE_INVALID', 400)
  if (message.includes('ADDRESS_TYPE_IMMUTABLE')) return new EmployeeServiceError('ADDRESS_TYPE_IMMUTABLE', 409)
  if (message.includes('ADDRESS_REMINDER_MODULE_DISABLED')) return new EmployeeServiceError('ADDRESS_REMINDER_MODULE_DISABLED', 409)
  if (message.includes('ADDRESS_REMINDER_ROLE_INVALID')) return new EmployeeServiceError('ADDRESS_REMINDER_ROLE_INVALID', 400)
  if (message.includes('ADDRESS_FORBIDDEN')) return new EmployeeServiceError('ADDRESS_FORBIDDEN', 403)
  return new EmployeeServiceError(fallback, 500)
}

async function createAddressChangeReminders(
  context: AuthContext,
  employeeId: string,
  action: string,
  before: Json,
  after: Json,
): Promise<void> {
  if (!context.administrationId) throw new EmployeeServiceError('ADDRESS_ADMINISTRATION_REQUIRED', 400)
  const supabase = await createClient()
  const { error } = await supabase.rpc('create_employee_address_change_reminders', {
    requested_tenant_id: context.tenantId,
    requested_administration_id: context.administrationId,
    requested_employee_id: employeeId,
    requested_action: action,
    requested_before: before,
    requested_after: after,
  })
  if (error) throw addressDatabaseError(error, 'ADDRESS_REMINDER_CREATE_FAILED')
}

function addressSnapshot(address: {
  address_line_1: string
  address_line_2: string | null
  street: string | null
  house_number: string | null
  house_number_addition: string | null
  postal_code: string | null
  city: string
  region: string | null
  country_code: string
  valid_from: string
  valid_until: string | null
  address_type: string
  description?: string | null
}): Json {
  return {
    type: address.address_type,
    description: address.description ?? null,
    addressLine1: address.address_line_1,
    addressLine2: address.address_line_2,
    street: address.street,
    houseNumber: address.house_number,
    addition: address.house_number_addition,
    postalCode: address.postal_code,
    city: address.city,
    region: address.region,
    countryCode: address.country_code,
    validFrom: address.valid_from,
    validUntil: address.valid_until,
  }
}

async function reserveEmployeeNumber(context: AuthContext): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('reserve_employee_number', { p_tenant_id: context.tenantId })
  if (error || !data) throw new EmployeeServiceError('EMPLOYEE_NUMBER_RESERVE_FAILED', 500)
  return data
}

export async function getNextEmployeeNumber(): Promise<string> {
  await requirePermission('employee:write')
  const usage = await getEmployeeNumberUsage()
  const numericValues = usage.usedEmployeeNumbers
    .map((number) => Number(number))
    .filter((number) => Number.isSafeInteger(number) && number > 0)
  return String((numericValues.length > 0 ? Math.max(...numericValues) : 100001) + 1)
}

export interface EmployeeNumberUsage {
  highestNumericEmployeeNumber: string | null
  usedEmployeeNumbers: string[]
  truncated: boolean
}

export async function getEmployeeNumberUsage(): Promise<EmployeeNumberUsage> {
  const context = await requirePermission('employee:write')
  const supabase = await createClient()
  const limit = 5_000
  const { data, error } = await supabase
    .from('employees')
    .select('employee_number')
    .eq('tenant_id', context.tenantId)
    .order('employee_number')
    .limit(limit)
  if (error) throw new EmployeeServiceError('EMPLOYEE_NUMBER_USAGE_FAILED', 500)
  const usedEmployeeNumbers = (data ?? []).map((row) => row.employee_number)
  const numericValues = usedEmployeeNumbers
    .map((number) => Number(number))
    .filter((number) => Number.isSafeInteger(number) && number > 0)
  return {
    highestNumericEmployeeNumber: numericValues.length > 0 ? String(Math.max(...numericValues)) : null,
    usedEmployeeNumbers,
    truncated: usedEmployeeNumbers.length >= limit,
  }
}

export async function checkEmployeeNumberAvailability(employeeNumber: string): Promise<boolean> {
  const context = await requirePermission('employee:write')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('employees')
    .select('id')
    .eq('tenant_id', context.tenantId)
    .eq('employee_number', employeeNumber.trim())
    .maybeSingle()
  if (error) throw new EmployeeServiceError('EMPLOYEE_NUMBER_AVAILABILITY_FAILED', 500)
  return !data
}

export async function createEmployee(input: EmployeeCreateInput): Promise<PublicEmployee> {
  const context = await requirePermission('employee:write')
  const employeeNumber = input.employeeNumber?.trim() || await reserveEmployeeNumber(context)
  let encryptedBsn: string | null = null
  let bsnFingerprint: string | null = null

  if (input.bsn) {
    await requirePermission('employee-bsn:write')
    const hashKey = process.env.BSN_HASH_KEY
    if (!hashKey) throw new EmployeeServiceError('BSN_HASH_KEY_MISSING', 500)
    encryptedBsn = encryptPii(input.bsn, context.tenantId)
    bsnFingerprint = createBsnFingerprint(context.tenantId, input.bsn, hashKey)
  }

  const client = await createClient()
  const { data, error } = await client
    .from('employees')
    .insert(toEmployeeInsert(context.tenantId, requireHrGroupId(context), employeeNumber, input))
    .select('id, tenant_id, employee_number, first_name, birth_name, private_email, work_email, is_active, updated_at')
    .single()

  if (isPostgresConflict(error)) {
    throw new EmployeeServiceError('EMPLOYEE_NUMBER_CONFLICT', 409, {
      suggestedEmployeeNumber: await reserveEmployeeNumber(context),
    })
  }
  if (error || !data) throw new EmployeeServiceError('EMPLOYEE_CREATE_FAILED', 500)
  if (encryptedBsn && bsnFingerprint) {
    const { error: bsnError } = await client.from('employee_secure_identifiers').insert({
      tenant_id: context.tenantId,
      employee_id: data.id,
      bsn_ciphertext: encryptedBsn,
      bsn_fingerprint: bsnFingerprint,
    })
    if (bsnError) {
      await client.from('employees').update({
        is_active: false, deleted_at: new Date().toISOString(),
      }).eq('id', data.id)
      if (isPostgresConflict(bsnError)) throw new EmployeeServiceError('EMPLOYEE_IDENTITY_CONFLICT', 409)
      throw new EmployeeServiceError('EMPLOYEE_BSN_CREATE_FAILED', 500)
    }
  }
  return toPublicEmployee(data)
}

export async function updateEmployee(employeeId: string, input: EmployeeUpdateInput): Promise<PublicEmployee> {
  const context = await requirePermission('employee:write', employeeId)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('employees')
    .update(toEmployeeUpdate(input))
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', requireHrGroupId(context))
    .eq('id', employeeId)
    .eq('updated_at', input.updatedAt)
    .is('deleted_at', null)
    .select('id, tenant_id, employee_number, first_name, birth_name, private_email, work_email, is_active, updated_at')
    .maybeSingle()
  if (isPostgresConflict(error)) throw new EmployeeServiceError('EMPLOYEE_NUMBER_CONFLICT', 409)
  if (error) throw new EmployeeServiceError('EMPLOYEE_UPDATE_FAILED', 500)
  if (!data) throw new EmployeeServiceError('EMPLOYEE_CONCURRENCY_CONFLICT', 409)
  const result = toPublicEmployee(data)
  await createEmployeeSystemActivity(employeeId, 'employeeUpdated')
  return result
}

export async function archiveEmployee(employeeId: string, updatedAt: string): Promise<void> {
  const context = await requirePermission('employee:delete', employeeId)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('employees')
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', requireHrGroupId(context))
    .eq('id', employeeId)
    .eq('updated_at', updatedAt)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()
  if (error) throw new EmployeeServiceError('EMPLOYEE_ARCHIVE_FAILED', 500)
  if (!data) throw new EmployeeServiceError('EMPLOYEE_CONCURRENCY_CONFLICT', 409)
}

export async function setEmployeeArchived(employeeId: string, archived: boolean): Promise<void> {
  const context = await requirePermission('employee:write', employeeId)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('employees')
    .update({ is_archived: archived })
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', requireHrGroupId(context))
    .eq('id', employeeId)
    .is('deleted_at', null)
    .select('id, is_archived')
    .maybeSingle()
  if (error) throw new EmployeeServiceError('EMPLOYEE_ARCHIVE_FLAG_FAILED', 500)
  if (!data) throw new EmployeeServiceError('EMPLOYEE_NOT_FOUND', 404)
  const { error: auditError } = await supabase.from('audit_logs').insert({
    tenant_id: context.tenantId,
    actor_user_id: context.userId,
    entity_name: 'employee',
    entity_id: employeeId,
    subject_employee_id: employeeId,
    action: archived ? 'ARCHIVE' : 'UNARCHIVE',
    changes: { is_archived: { old: !archived, new: archived } } satisfies Json,
  })
  if (auditError) throw new EmployeeServiceError('EMPLOYEE_ARCHIVE_AUDIT_FAILED', 500)
}

export function employeeAvatarHref(employeeId: string, storedValue: string | null): string | null {
  return resolveStoredImageUrl(storedValue, { kind: 'employee-avatar', employeeId })
}

export async function uploadEmployeeAvatar(employeeId: string, file: File): Promise<void> {
  const context = await requirePermission('employee:write', employeeId)
  const compacted = await compactEmployeeAvatar(file)
  const supabase = await createClient()
  const { data: current, error: currentError } = await supabase.from('employees').select('avatar_url').eq('tenant_id', context.tenantId).eq('hr_group_id', requireHrGroupId(context)).eq('id', employeeId).is('deleted_at', null).maybeSingle()
  if (currentError || !current) throw new EmployeeServiceError('EMPLOYEE_NOT_FOUND', 404)
  const path = `${context.tenantId}/${employeeId}/${crypto.randomUUID()}.webp`
  const upload = await supabase.storage.from('employee-avatars').upload(path, compacted, { contentType: 'image/webp', upsert: false })
  if (upload.error) throw new EmployeeServiceError('EMPLOYEE_AVATAR_UPLOAD_FAILED', 500)
  const { error } = await supabase.from('employees').update({ avatar_url: `storage://${path}` }).eq('tenant_id', context.tenantId).eq('hr_group_id', requireHrGroupId(context)).eq('id', employeeId).is('deleted_at', null)
  if (error) {
    await supabase.storage.from('employee-avatars').remove([path])
    throw new EmployeeServiceError('EMPLOYEE_AVATAR_SAVE_FAILED', 500)
  }
  const currentPath = parseStorageReference(current.avatar_url)
  if (currentPath) await supabase.storage.from('employee-avatars').remove([currentPath])
}

export async function deleteEmployeeAvatar(employeeId: string): Promise<void> {
  const context = await requirePermission('employee:write', employeeId)
  const supabase = await createClient()
  const { data, error } = await supabase.from('employees').select('avatar_url').eq('tenant_id', context.tenantId).eq('hr_group_id', requireHrGroupId(context)).eq('id', employeeId).is('deleted_at', null).maybeSingle()
  if (error || !data) throw new EmployeeServiceError('EMPLOYEE_NOT_FOUND', 404)
  const { error: updateError } = await supabase.from('employees').update({ avatar_url: null }).eq('tenant_id', context.tenantId).eq('hr_group_id', requireHrGroupId(context)).eq('id', employeeId)
  if (updateError) throw new EmployeeServiceError('EMPLOYEE_AVATAR_SAVE_FAILED', 500)
  const currentPath = parseStorageReference(data.avatar_url)
  if (currentPath) await supabase.storage.from('employee-avatars').remove([currentPath])
}

export async function getEmployeeAvatar(employeeId: string): Promise<{ body: ArrayBuffer; contentType: string } | { url: string } | null> {
  const context = await requirePermission('employee:read', employeeId)
  const supabase = await createClient()
  const { data, error } = await supabase.from('employees').select('avatar_url').eq('tenant_id', context.tenantId).eq('hr_group_id', requireHrGroupId(context)).eq('id', employeeId).is('deleted_at', null).maybeSingle()
  if (error || !data?.avatar_url) return null
  const path = parseStorageReference(data.avatar_url)
  if (!path) {
    const url = resolveStoredImageUrl(data.avatar_url, { kind: 'employee-avatar', employeeId })
    return url ? { url } : null
  }
  const signed = await supabase.storage.from('employee-avatars').createSignedUrl(path, 300)
  if (signed.error || !signed.data?.signedUrl) return null
  const response = await fetch(signed.data.signedUrl)
  if (!response.ok) return null
  return { body: await response.arrayBuffer(), contentType: response.headers.get('content-type') ?? 'image/jpeg' }
}

export async function revealEmployeeBsn(employeeId: string): Promise<string | null> {
  const context = await requirePermission('employee-bsn:read', employeeId)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('employee_secure_identifiers')
    .select('bsn_ciphertext')
    .eq('tenant_id', context.tenantId)
    .eq('id', employeeId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error || !data) throw new EmployeeServiceError('EMPLOYEE_NOT_FOUND', 404)
  await supabase.from('audit_logs').insert({
    tenant_id: context.tenantId,
    entity_name: 'employee',
    entity_id: employeeId,
    actor_user_id: context.userId,
    action: 'REVEAL',
    changes: { field: 'bsn' } satisfies Json,
  })
  return data.bsn_ciphertext ? decryptPii(data.bsn_ciphertext, context.tenantId) : null
}

export async function setEmployeeBsn(employeeId: string, bsn: string): Promise<void> {
  const context = await requirePermission('employee-bsn:write', employeeId)
  const hashKey = process.env.BSN_HASH_KEY
  if (!hashKey) throw new EmployeeServiceError('BSN_HASH_KEY_MISSING', 500)
  const supabase = await createClient()
  const { error } = await supabase.from('employee_secure_identifiers').upsert({
    tenant_id: context.tenantId,
    employee_id: employeeId,
    bsn_ciphertext: encryptPii(bsn, context.tenantId),
    bsn_fingerprint: createBsnFingerprint(context.tenantId, bsn, hashKey),
  }, { onConflict: 'employee_id' })
  if (isPostgresConflict(error)) throw new EmployeeServiceError('EMPLOYEE_IDENTITY_CONFLICT', 409)
  if (error) throw new EmployeeServiceError('EMPLOYEE_BSN_UPDATE_FAILED', 500)
}

export async function createEmployeeAddress(employeeId: string, input: AddressInput): Promise<string> {
  const readContext = await requirePermission('employee:read', employeeId)
  if (readContext.employeeId === employeeId) await requirePermission('self:address:write', employeeId)
  else await requirePermission('employee:write', employeeId)
  const supabase = await createClient()
  if (!readContext.administrationId) throw new EmployeeServiceError('ADMINISTRATION_REQUIRED', 400)
  const address = toAddressRow(input)
  const validFrom = address.valid_from
  if (!validFrom) throw new EmployeeServiceError('ADDRESS_VALID_FROM_REQUIRED', 400)
  const { data, error } = await supabase.rpc('create_employee_address_with_reminders', {
    requested_tenant_id: readContext.tenantId,
    requested_administration_id: readContext.administrationId,
    requested_employee_id: employeeId,
    requested_address_line_1: address.address_line_1,
    requested_address_line_2: address.address_line_2 ?? '',
    requested_street: address.street ?? '',
    requested_house_number: address.house_number ?? '',
    requested_house_number_addition: address.house_number_addition ?? '',
    requested_postal_code: address.postal_code ?? '',
    requested_city: address.city ?? '',
    requested_region: address.region ?? '',
    requested_country_code: address.country_code,
    requested_source: address.source,
    requested_source_reference: address.source_reference ?? '',
    requested_valid_from: validFrom,
    requested_valid_until: address.valid_until as string,
    requested_address_type: address.address_type,
    requested_description: address.description ?? '',
    requested_reminder_roles: readContext.employeeId === employeeId ? ['HR_ADMIN', 'MANAGER'] : input.directReminderRecipients,
  })
  if (error) throw addressDatabaseError(error, 'ADDRESS_CREATE_FAILED')
  if (!data) throw new EmployeeServiceError('ADDRESS_CREATE_FAILED', 500)
  await createEmployeeSystemActivity(employeeId, 'addressCreated')
  return data
}

export async function updateEmployeeAddress(
  employeeId: string,
  addressId: string,
  input: AddressInput,
  expectedUpdatedAt?: string,
): Promise<void> {
  const context = await requirePermission('employee:read', employeeId)
  if (context.employeeId === employeeId) await requirePermission('self:address:write', employeeId)
  else await requirePermission('employee:write', employeeId)
  const supabase = await createClient()
  const { data: existing, error: existingError } = await supabase.from('employee_addresses').select('address_type,description,address_line_1,address_line_2,street,house_number,house_number_addition,postal_code,city,region,country_code,valid_from,valid_until').eq('tenant_id', context.tenantId).eq('employee_id', employeeId).eq('id', addressId).is('deleted_at', null).maybeSingle()
  if (existingError) throw new EmployeeServiceError('ADDRESS_UPDATE_FAILED', 500)
  if (!existing) throw new EmployeeServiceError('ADDRESS_NOT_FOUND', 404)
  const address = toAddressRow({ ...input, addressType: existing.address_type as AddressInput['addressType'] })
  const updateRow = { ...address, address_type: existing.address_type, valid_until: existing.address_type === 'PRIMARY' ? existing.valid_until : address.valid_until }
  let query = supabase.from('employee_addresses').update(updateRow).eq('tenant_id', context.tenantId).eq('employee_id', employeeId).eq('id', addressId)
    .is('deleted_at', null)
  if (expectedUpdatedAt) query = query.eq('updated_at', expectedUpdatedAt)
  const { data, error } = await query.select('id').maybeSingle()
  if (error) throw addressDatabaseError(error, 'ADDRESS_UPDATE_FAILED')
  if (!data) throw new EmployeeServiceError(expectedUpdatedAt ? 'ADDRESS_STALE_WRITE' : 'ADDRESS_NOT_FOUND', 409)
  if (context.employeeId === employeeId) {
    await createAddressChangeReminders(context, employeeId, 'UPDATE', addressSnapshot(existing), addressSnapshot({ ...address, address_type: existing.address_type }))
  }
  await createEmployeeSystemActivity(employeeId, 'addressUpdated')
}

export async function archiveEmployeeAddress(employeeId: string, addressId: string): Promise<void> {
  const context = await requirePermission('employee:read', employeeId)
  if (context.employeeId === employeeId) await requirePermission('self:address:write', employeeId)
  else await requirePermission('employee:write', employeeId)
  const supabase = await createClient()
  const { data: existing, error: existingError } = await supabase.from('employee_addresses').select('address_type,description,address_line_1,address_line_2,street,house_number,house_number_addition,postal_code,city,region,country_code,valid_from,valid_until').eq('tenant_id', context.tenantId).eq('employee_id', employeeId).eq('id', addressId).is('deleted_at', null).maybeSingle()
  if (existingError) throw addressDatabaseError(existingError, 'ADDRESS_ARCHIVE_FAILED')
  if (!existing) throw new EmployeeServiceError('ADDRESS_NOT_FOUND', 404)
  const { data, error } = await supabase.from('employee_addresses').update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', context.tenantId).eq('employee_id', employeeId).eq('id', addressId)
    .is('deleted_at', null).select('id').maybeSingle()
  if (error) throw addressDatabaseError(error, 'ADDRESS_ARCHIVE_FAILED')
  if (!data) throw new EmployeeServiceError('ADDRESS_NOT_FOUND', 404)
  if (context.employeeId === employeeId) {
    await createAddressChangeReminders(context, employeeId, 'ARCHIVE', addressSnapshot(existing), { status: 'ARCHIVED', type: existing.address_type } satisfies Json)
  }
  await createEmployeeSystemActivity(employeeId, 'addressArchived')
}

export async function createEmployeeRelation(employeeId: string, input: RelationInput): Promise<string> {
  const readContext = await requirePermission('employee:read', employeeId)
  if (readContext.employeeId === employeeId) await requirePermission('self:relation:write', employeeId)
  else await requirePermission('employee:write', employeeId)
  const supabase = await createClient()
  const { data, error } = await supabase.from('employee_relations').insert({
    tenant_id: readContext.tenantId,
    employee_id: employeeId,
    relation_type: input.relationType,
    is_emergency_contact: input.isEmergencyContact,
    first_name: input.firstName ?? null,
    initials: input.initials ?? null,
    prefix: input.prefix ?? null,
    last_name: input.lastName,
    gender: input.gender ?? null,
    birth_date: input.birthDate ?? null,
    phone: input.phone ?? null,
    mobile: input.mobile ?? null,
    email: input.email?.toLowerCase() ?? null,
    notes: input.notes ?? null,
  }).select('id').single()
  if (error || !data) throw new EmployeeServiceError('RELATION_CREATE_FAILED', 500)
  await createEmployeeSystemActivity(employeeId, 'relationCreated')
  return data.id
}

export async function updateEmployeeRelation(employeeId: string, relationId: string, input: RelationInput): Promise<void> {
  const context = await requirePermission('employee:read', employeeId)
  if (context.employeeId === employeeId) await requirePermission('self:relation:write', employeeId)
  else await requirePermission('employee:write', employeeId)
  const supabase = await createClient()
  const { error } = await supabase.from('employee_relations').update({
    relation_type: input.relationType, is_emergency_contact: input.isEmergencyContact,
    first_name: input.firstName ?? null, initials: input.initials ?? null,
    prefix: input.prefix ?? null, last_name: input.lastName, gender: input.gender ?? null,
    birth_date: input.birthDate ?? null, phone: input.phone ?? null, mobile: input.mobile ?? null,
    email: input.email?.toLowerCase() ?? null, notes: input.notes ?? null,
  }).eq('tenant_id', context.tenantId).eq('employee_id', employeeId).eq('id', relationId)
    .is('deleted_at', null)
  if (error) throw new EmployeeServiceError('RELATION_UPDATE_FAILED', 500)
  await createEmployeeSystemActivity(employeeId, 'relationUpdated')
}

export async function archiveEmployeeRelation(employeeId: string, relationId: string): Promise<void> {
  const context = await requirePermission('employee:read', employeeId)
  if (context.employeeId === employeeId) await requirePermission('self:relation:write', employeeId)
  else await requirePermission('employee:write', employeeId)
  const supabase = await createClient()
  const { error } = await supabase.from('employee_relations').update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', context.tenantId).eq('employee_id', employeeId).eq('id', relationId)
  if (error) throw new EmployeeServiceError('RELATION_ARCHIVE_FAILED', 500)
  await createEmployeeSystemActivity(employeeId, 'relationArchived')
}

export async function createEmployeeBankAccount(employeeId: string, input: BankAccountInput): Promise<string> {
  const context = await requirePermission('bank-account:write', employeeId)
  const supabase = await createClient()
  const { data, error } = await supabase.from('employee_bank_accounts').insert({
    tenant_id: context.tenantId,
    employee_id: employeeId,
    iban_ciphertext: encryptPii(input.iban, context.tenantId),
    iban_last_four: input.iban.slice(-4),
    bic: input.bic ?? null,
    account_holder: input.accountHolder,
    description: input.description ?? null,
    is_primary: input.isPrimary,
  }).select('id').single()
  if (isPostgresConflict(error)) throw new EmployeeServiceError('PRIMARY_BANK_ACCOUNT_CONFLICT', 409)
  if (error || !data) throw new EmployeeServiceError('BANK_ACCOUNT_CREATE_FAILED', 500)
  await createEmployeeSystemActivity(employeeId, 'bankAccountCreated')
  return data.id
}

export async function updateEmployeeBankAccount(
  employeeId: string,
  bankAccountId: string,
  input: BankAccountUpdateInput,
): Promise<void> {
  const context = await requirePermission('bank-account:write', employeeId)
  const supabase = await createClient()
  const updateRow: {
    iban_ciphertext?: string
    iban_last_four?: string
    bic: string | null
    account_holder: string
    description: string | null
    is_primary: boolean
  } = {
    bic: input.bic ?? null, account_holder: input.accountHolder,
    description: input.description ?? null, is_primary: input.isPrimary,
  }
  if (input.iban) {
    updateRow.iban_ciphertext = encryptPii(input.iban, context.tenantId)
    updateRow.iban_last_four = input.iban.slice(-4)
  }
  const { error } = await supabase.from('employee_bank_accounts').update(updateRow).eq('tenant_id', context.tenantId).eq('employee_id', employeeId).eq('id', bankAccountId)
    .is('deleted_at', null)
  if (isPostgresConflict(error)) throw new EmployeeServiceError('PRIMARY_BANK_ACCOUNT_CONFLICT', 409)
  if (error) throw new EmployeeServiceError('BANK_ACCOUNT_UPDATE_FAILED', 500)
  await createEmployeeSystemActivity(employeeId, 'bankAccountUpdated')
}

export async function archiveEmployeeBankAccount(employeeId: string, bankAccountId: string): Promise<void> {
  const context = await requirePermission('bank-account:write', employeeId)
  const supabase = await createClient()
  const { error } = await supabase.from('employee_bank_accounts').update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', context.tenantId).eq('employee_id', employeeId).eq('id', bankAccountId)
  if (error) throw new EmployeeServiceError('BANK_ACCOUNT_ARCHIVE_FAILED', 500)
  await createEmployeeSystemActivity(employeeId, 'bankAccountArchived')
}
