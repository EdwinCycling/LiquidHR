import type { Database } from '@scope/db'
import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import type { CompanyDataUpdateInput, LocationCreateInput, LocationUpdateInput } from './schemas'

type CompanyDataRow = Database['public']['Tables']['administration_company_data']['Row']
type LocationRow = Database['public']['Tables']['administration_locations']['Row']
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface CompanyAddress {
  addressLine1: string | null
  addressLine2: string | null
  street: string | null
  houseNumber: string | null
  houseNumberAddition: string | null
  postalCode: string | null
  city: string | null
  region: string | null
  countryCode: string
}

export interface CompanyData extends CompanyAddress {
  id: string
  singleLocation: boolean
}

export interface CompanyLocation extends CompanyAddress {
  id: string
  name: string
  isActive: boolean
  used: boolean
}

export interface CompanyDataSettings {
  company: CompanyData
  locations: CompanyLocation[]
}

export class CompanyDataServiceError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code)
    this.name = 'CompanyDataServiceError'
  }
}

function requireAdministration(administrationId: string | null): string {
  if (!administrationId) throw new CompanyDataServiceError('ADMINISTRATION_REQUIRED', 400)
  return administrationId
}

function addressFromRow(row: CompanyDataRow | LocationRow): CompanyAddress {
  return {
    addressLine1: row.address_line_1,
    addressLine2: row.address_line_2,
    street: row.street,
    houseNumber: row.house_number,
    houseNumberAddition: row.house_number_addition,
    postalCode: row.postal_code,
    city: row.city,
    region: row.region,
    countryCode: row.country_code,
  }
}

function toCompany(row: CompanyDataRow): CompanyData {
  return { id: row.id, singleLocation: row.single_location, ...addressFromRow(row) }
}

function toLocation(row: LocationRow, used: boolean): CompanyLocation {
  return { id: row.id, name: row.name, isActive: row.is_active, used, ...addressFromRow(row) }
}

function addressPayload(input: Pick<CompanyAddress, 'countryCode'> & Partial<Omit<CompanyAddress, 'countryCode'>>): {
  address_line_1: string | null
  address_line_2: string | null
  street: string | null
  house_number: string | null
  house_number_addition: string | null
  postal_code: string | null
  city: string | null
  region: string | null
  country_code: string
} {
  const addressLine1 = input.countryCode === 'NL'
    ? [input.street, input.houseNumber, input.houseNumberAddition].filter(Boolean).join(' ') || null
    : input.addressLine1 ?? null
  return {
    address_line_1: addressLine1,
    address_line_2: input.addressLine2 ?? null,
    street: input.street ?? null,
    house_number: input.houseNumber ?? null,
    house_number_addition: input.houseNumberAddition ?? null,
    postal_code: input.postalCode ?? null,
    city: input.city ?? null,
    region: input.region ?? null,
    country_code: input.countryCode,
  }
}

async function getScope(): Promise<{ tenantId: string; administrationId: string }> {
  const context = await requirePermission('company-data:read')
  return { tenantId: context.tenantId, administrationId: requireAdministration(context.administrationId) }
}

async function getWriteScope(): Promise<{ tenantId: string; administrationId: string; userId: string }> {
  const context = await requirePermission('company-data:write')
  return { tenantId: context.tenantId, administrationId: requireAdministration(context.administrationId), userId: context.userId }
}

export async function getCompanyDataSettings(existingClient?: SupabaseServerClient): Promise<CompanyDataSettings> {
  const { tenantId, administrationId } = await getScope()
  const supabase = existingClient ?? await createClient()
  const [{ data: company, error: companyError }, { data: locations, error: locationsError }, { data: usedRows, error: usedError }] = await Promise.all([
    supabase.from('administration_company_data').select('*').eq('tenant_id', tenantId).eq('administration_id', administrationId).maybeSingle(),
    supabase.from('administration_locations').select('*').eq('tenant_id', tenantId).eq('administration_id', administrationId).order('is_active', { ascending: false }).order('name').limit(250),
    supabase.from('employee_organizations').select('location_id').eq('tenant_id', tenantId).eq('administration_id', administrationId).not('location_id', 'is', null).limit(5_000),
  ])
  if (companyError || locationsError || usedError) throw new CompanyDataServiceError('COMPANY_DATA_READ_FAILED', 500)
  if (!company) throw new CompanyDataServiceError('COMPANY_DATA_NOT_FOUND', 404)
  const usedLocationIds = new Set((usedRows ?? []).map((row) => row.location_id).filter((id): id is string => id !== null))
  return { company: toCompany(company), locations: (locations ?? []).map((location) => toLocation(location, usedLocationIds.has(location.id))) }
}

export async function updateCompanyData(input: CompanyDataUpdateInput): Promise<CompanyData> {
  const { tenantId, administrationId, userId } = await getWriteScope()
  const supabase = await createClient()
  if (input.singleLocation) {
    const { count, error } = await supabase.from('administration_locations').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('administration_id', administrationId)
    if (error) throw new CompanyDataServiceError('COMPANY_DATA_READ_FAILED', 500)
    if ((count ?? 0) > 0) throw new CompanyDataServiceError('COMPANY_HAS_LOCATIONS', 409)
  }
  const payload = { single_location: input.singleLocation, ...addressPayload(input), updated_by_user_id: userId }
  const { data: existing, error: existingError } = await supabase.from('administration_company_data').select('id').eq('tenant_id', tenantId).eq('administration_id', administrationId).maybeSingle()
  if (existingError) throw new CompanyDataServiceError('COMPANY_DATA_READ_FAILED', 500)
  const query = existing
    ? supabase.from('administration_company_data').update(payload).eq('id', existing.id).eq('tenant_id', tenantId).eq('administration_id', administrationId).select('*').single()
    : supabase.from('administration_company_data').insert({ tenant_id: tenantId, administration_id: administrationId, created_by_user_id: userId, ...payload }).select('*').single()
  const { data, error } = await query
  if (error || !data) throw new CompanyDataServiceError(error?.code === 'P0001' ? error.message : 'COMPANY_DATA_SAVE_FAILED', error?.code === 'P0001' ? 409 : 500)
  return toCompany(data)
}

export async function createLocation(input: LocationCreateInput): Promise<CompanyLocation> {
  const { tenantId, administrationId, userId } = await getWriteScope()
  const supabase = await createClient()
  const { data: company, error: companyError } = await supabase.from('administration_company_data').select('single_location').eq('tenant_id', tenantId).eq('administration_id', administrationId).single()
  if (companyError || !company) throw new CompanyDataServiceError('COMPANY_DATA_NOT_FOUND', 404)
  if (company.single_location) throw new CompanyDataServiceError('SINGLE_LOCATION_MODE', 409)
  const { data, error } = await supabase.from('administration_locations').insert({ tenant_id: tenantId, administration_id: administrationId, name: input.name, is_active: input.isActive, created_by_user_id: userId, updated_by_user_id: userId, ...addressPayload(input) }).select('*').single()
  if (error || !data) throw new CompanyDataServiceError(error?.code === 'P0001' ? error.message : 'LOCATION_CREATE_FAILED', error?.code === 'P0001' ? 409 : 500)
  return toLocation(data, false)
}

export async function updateLocation(locationId: string, input: LocationUpdateInput): Promise<CompanyLocation> {
  const { tenantId, administrationId, userId } = await getWriteScope()
  const supabase = await createClient()
  const { data, error } = await supabase.from('administration_locations').update({ name: input.name, is_active: input.isActive, updated_by_user_id: userId, ...addressPayload(input) }).eq('id', locationId).eq('tenant_id', tenantId).eq('administration_id', administrationId).select('*').maybeSingle()
  if (error) throw new CompanyDataServiceError('LOCATION_UPDATE_FAILED', 500)
  if (!data) throw new CompanyDataServiceError('LOCATION_NOT_FOUND', 404)
  const { count, error: usageError } = await supabase.from('employee_organizations').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('administration_id', administrationId).eq('location_id', locationId)
  if (usageError) throw new CompanyDataServiceError('LOCATION_USAGE_CHECK_FAILED', 500)
  return toLocation(data, (count ?? 0) > 0)
}

export async function deleteLocation(locationId: string): Promise<void> {
  const { tenantId, administrationId } = await getWriteScope()
  const supabase = await createClient()
  const { data, error } = await supabase.from('administration_locations').delete().eq('id', locationId).eq('tenant_id', tenantId).eq('administration_id', administrationId).select('id').maybeSingle()
  if (error?.code === '23503') throw new CompanyDataServiceError('LOCATION_IN_USE', 409)
  if (error) throw new CompanyDataServiceError('LOCATION_DELETE_FAILED', 500)
  if (!data) throw new CompanyDataServiceError('LOCATION_NOT_FOUND', 404)
}
