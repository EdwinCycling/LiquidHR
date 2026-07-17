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
