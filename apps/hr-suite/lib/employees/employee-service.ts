import type { Json } from '@scope/db'
import { requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { createBsnFingerprint } from '@/lib/security/bsn-fingerprint'
import { decryptPii, encryptPii } from '@/lib/security/pii-crypto'
import { EmployeeServiceError } from './errors'
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
  EmployeeCreateInput,
  EmployeeUpdateInput,
  RelationInput,
} from './schemas'

export { EmployeeServiceError } from './errors'

async function reserveEmployeeNumber(context: AuthContext): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('reserve_employee_number', { p_tenant_id: context.tenantId })
  if (error || !data) throw new EmployeeServiceError('EMPLOYEE_NUMBER_RESERVE_FAILED', 500)
  return data
}

export async function getNextEmployeeNumber(): Promise<string> {
  const context = await requirePermission('employee:write')
  return reserveEmployeeNumber(context)
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
    .insert(toEmployeeInsert(context.tenantId, employeeNumber, input))
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
    .eq('id', employeeId)
    .eq('updated_at', input.updatedAt)
    .is('deleted_at', null)
    .select('id, tenant_id, employee_number, first_name, birth_name, private_email, work_email, is_active, updated_at')
    .maybeSingle()
  if (isPostgresConflict(error)) throw new EmployeeServiceError('EMPLOYEE_NUMBER_CONFLICT', 409)
  if (error) throw new EmployeeServiceError('EMPLOYEE_UPDATE_FAILED', 500)
  if (!data) throw new EmployeeServiceError('EMPLOYEE_CONCURRENCY_CONFLICT', 409)
  return toPublicEmployee(data)
}

export async function archiveEmployee(employeeId: string, updatedAt: string): Promise<void> {
  const context = await requirePermission('employee:delete', employeeId)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('employees')
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq('tenant_id', context.tenantId)
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
  if (!storedValue) return null
  return storedValue.startsWith('storage://') ? `/api/employees/${employeeId}/avatar` : storedValue
}

export async function uploadEmployeeAvatar(employeeId: string, file: File): Promise<void> {
  const context = await requirePermission('employee:write', employeeId)
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    throw new EmployeeServiceError('EMPLOYEE_AVATAR_INPUT_INVALID', 400)
  }
  const supabase = await createClient()
  const { data: current, error: currentError } = await supabase.from('employees').select('avatar_url').eq('tenant_id', context.tenantId).eq('id', employeeId).is('deleted_at', null).maybeSingle()
  if (currentError || !current) throw new EmployeeServiceError('EMPLOYEE_NOT_FOUND', 404)
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${context.tenantId}/${employeeId}/${crypto.randomUUID()}.${extension}`
  const upload = await supabase.storage.from('employee-avatars').upload(path, file, { contentType: file.type, upsert: false })
  if (upload.error) throw new EmployeeServiceError('EMPLOYEE_AVATAR_UPLOAD_FAILED', 500)
  const { error } = await supabase.from('employees').update({ avatar_url: `storage://${path}` }).eq('tenant_id', context.tenantId).eq('id', employeeId).is('deleted_at', null)
  if (error) {
    await supabase.storage.from('employee-avatars').remove([path])
    throw new EmployeeServiceError('EMPLOYEE_AVATAR_SAVE_FAILED', 500)
  }
  if (current.avatar_url?.startsWith('storage://')) await supabase.storage.from('employee-avatars').remove([current.avatar_url.slice('storage://'.length)])
}

export async function deleteEmployeeAvatar(employeeId: string): Promise<void> {
  const context = await requirePermission('employee:write', employeeId)
  const supabase = await createClient()
  const { data, error } = await supabase.from('employees').select('avatar_url').eq('tenant_id', context.tenantId).eq('id', employeeId).is('deleted_at', null).maybeSingle()
  if (error || !data) throw new EmployeeServiceError('EMPLOYEE_NOT_FOUND', 404)
  const { error: updateError } = await supabase.from('employees').update({ avatar_url: null }).eq('tenant_id', context.tenantId).eq('id', employeeId)
  if (updateError) throw new EmployeeServiceError('EMPLOYEE_AVATAR_SAVE_FAILED', 500)
  if (data.avatar_url?.startsWith('storage://')) await supabase.storage.from('employee-avatars').remove([data.avatar_url.slice('storage://'.length)])
}

export async function getEmployeeAvatar(employeeId: string): Promise<{ body: ArrayBuffer; contentType: string } | { url: string } | null> {
  const context = await requirePermission('employee:read', employeeId)
  const supabase = await createClient()
  const { data, error } = await supabase.from('employees').select('avatar_url').eq('tenant_id', context.tenantId).eq('id', employeeId).is('deleted_at', null).maybeSingle()
  if (error || !data?.avatar_url) return null
  if (!data.avatar_url.startsWith('storage://')) return { url: data.avatar_url }
  const path = data.avatar_url.slice('storage://'.length)
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
  if (readContext.employeeId === employeeId) await requirePermission('address:write', employeeId)
  else await requirePermission('employee:write', employeeId)
  const supabase = await createClient()
  const { data, error } = await supabase.from('employee_addresses').insert({
    tenant_id: readContext.tenantId,
    employee_id: employeeId,
    street: input.street,
    house_number: input.houseNumber,
    addition: input.addition ?? null,
    postal_code: input.postalCode.replace(/\s/g, '').toUpperCase(),
    city: input.city,
    province: input.province ?? null,
    country_code: input.countryCode,
    valid_from: input.validFrom,
    valid_until: input.validUntil ?? null,
  }).select('id').single()
  if (isPostgresConflict(error)) throw new EmployeeServiceError('ADDRESS_PERIOD_CONFLICT', 409)
  if (error || !data) throw new EmployeeServiceError('ADDRESS_CREATE_FAILED', 500)
  return data.id
}

export async function updateEmployeeAddress(
  employeeId: string,
  addressId: string,
  input: AddressInput,
  expectedUpdatedAt?: string,
): Promise<void> {
  const context = await requirePermission('employee:read', employeeId)
  if (context.employeeId === employeeId) await requirePermission('address:write', employeeId)
  else await requirePermission('employee:write', employeeId)
  const supabase = await createClient()
  let query = supabase.from('employee_addresses').update({
    street: input.street, house_number: input.houseNumber, addition: input.addition ?? null,
    postal_code: input.postalCode.replace(/\s/g, '').toUpperCase(), city: input.city,
    province: input.province ?? null, country_code: input.countryCode,
    valid_from: input.validFrom, valid_until: input.validUntil ?? null,
  }).eq('tenant_id', context.tenantId).eq('employee_id', employeeId).eq('id', addressId)
    .is('deleted_at', null)
  if (expectedUpdatedAt) query = query.eq('updated_at', expectedUpdatedAt)
  const { data, error } = await query.select('id').maybeSingle()
  if (isPostgresConflict(error)) throw new EmployeeServiceError('ADDRESS_PERIOD_CONFLICT', 409)
  if (error) throw new EmployeeServiceError('ADDRESS_UPDATE_FAILED', 500)
  if (!data) throw new EmployeeServiceError(expectedUpdatedAt ? 'ADDRESS_STALE_WRITE' : 'ADDRESS_NOT_FOUND', 409)
}

export async function archiveEmployeeAddress(employeeId: string, addressId: string): Promise<void> {
  const context = await requirePermission('employee:read', employeeId)
  if (context.employeeId === employeeId) await requirePermission('address:write', employeeId)
  else await requirePermission('employee:write', employeeId)
  const supabase = await createClient()
  const { error } = await supabase.from('employee_addresses').update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', context.tenantId).eq('employee_id', employeeId).eq('id', addressId)
  if (error) throw new EmployeeServiceError('ADDRESS_ARCHIVE_FAILED', 500)
}

export async function createEmployeeRelation(employeeId: string, input: RelationInput): Promise<string> {
  const readContext = await requirePermission('employee:read', employeeId)
  if (readContext.employeeId === employeeId) await requirePermission('relation:write', employeeId)
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
  return data.id
}

export async function updateEmployeeRelation(employeeId: string, relationId: string, input: RelationInput): Promise<void> {
  const context = await requirePermission('employee:read', employeeId)
  if (context.employeeId === employeeId) await requirePermission('relation:write', employeeId)
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
}

export async function archiveEmployeeRelation(employeeId: string, relationId: string): Promise<void> {
  const context = await requirePermission('employee:read', employeeId)
  if (context.employeeId === employeeId) await requirePermission('relation:write', employeeId)
  else await requirePermission('employee:write', employeeId)
  const supabase = await createClient()
  const { error } = await supabase.from('employee_relations').update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', context.tenantId).eq('employee_id', employeeId).eq('id', relationId)
  if (error) throw new EmployeeServiceError('RELATION_ARCHIVE_FAILED', 500)
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
  return data.id
}

export async function updateEmployeeBankAccount(
  employeeId: string,
  bankAccountId: string,
  input: BankAccountInput,
): Promise<void> {
  const context = await requirePermission('bank-account:write', employeeId)
  const supabase = await createClient()
  const { error } = await supabase.from('employee_bank_accounts').update({
    iban_ciphertext: encryptPii(input.iban, context.tenantId), iban_last_four: input.iban.slice(-4),
    bic: input.bic ?? null, account_holder: input.accountHolder,
    description: input.description ?? null, is_primary: input.isPrimary,
  }).eq('tenant_id', context.tenantId).eq('employee_id', employeeId).eq('id', bankAccountId)
    .is('deleted_at', null)
  if (isPostgresConflict(error)) throw new EmployeeServiceError('PRIMARY_BANK_ACCOUNT_CONFLICT', 409)
  if (error) throw new EmployeeServiceError('BANK_ACCOUNT_UPDATE_FAILED', 500)
}

export async function archiveEmployeeBankAccount(employeeId: string, bankAccountId: string): Promise<void> {
  const context = await requirePermission('bank-account:write', employeeId)
  const supabase = await createClient()
  const { error } = await supabase.from('employee_bank_accounts').update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', context.tenantId).eq('employee_id', employeeId).eq('id', bankAccountId)
  if (error) throw new EmployeeServiceError('BANK_ACCOUNT_ARCHIVE_FAILED', 500)
}
