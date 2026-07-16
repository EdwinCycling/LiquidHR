import type { Database } from '@scope/db'
import type { EmployeeCreateInput, EmployeeUpdateInput } from './schemas'

type EmployeeInsert = Database['public']['Tables']['employees']['Insert']
type EmployeeUpdate = Database['public']['Tables']['employees']['Update']
type EmployeeRow = Database['public']['Tables']['employees']['Row']

export interface PublicEmployee {
  id: string
  tenantId: string
  employeeNumber: string
  firstName: string
  birthName: string
  privateEmail: string | null
  workEmail: string | null
  isActive: boolean
  updatedAt: string
}

type PublicEmployeeSource = Pick<EmployeeRow, 'id' | 'tenant_id' | 'employee_number' | 'first_name' | 'birth_name' | 'private_email' | 'work_email' | 'is_active' | 'updated_at'>

function optionalText(value: string | null | undefined): string | null {
  return value?.trim() || null
}

export function toEmployeeInsert(tenantId: string, employeeNumber: string, input: EmployeeCreateInput): EmployeeInsert {
  return {
    tenant_id: tenantId, employee_number: employeeNumber.trim(), title: optionalText(input.title),
    initials: optionalText(input.initials), first_name: input.firstName.trim(),
    birth_name_prefix: optionalText(input.birthNamePrefix), birth_name: input.birthName.trim(),
    partner_name_prefix: optionalText(input.partnerNamePrefix), partner_name: optionalText(input.partnerName),
    name_usage: input.nameUsage, gender: input.gender, pronouns: optionalText(input.pronouns),
    birth_date: input.birthDate ?? null, birth_place: optionalText(input.birthPlace),
    birth_country: input.birthCountry ?? null, nationality: input.nationality ?? null,
    marital_status: input.maritalStatus ?? null, marital_status_date: input.maritalStatusDate ?? null,
    education_level: input.educationLevel ?? null, preferred_language: input.preferredLanguage,
    private_email: input.privateEmail?.toLowerCase() ?? null, private_phone: optionalText(input.privatePhone),
    private_mobile: optionalText(input.privateMobile), work_email: input.workEmail?.toLowerCase() ?? null,
    work_phone: optionalText(input.workPhone), work_phone_ext: optionalText(input.workPhoneExt),
    work_mobile: optionalText(input.workMobile), avatar_url: input.avatarUrl ?? null,
    original_hire_date: input.originalHireDate ?? null,
  }
}

export function toEmployeeUpdate(input: EmployeeUpdateInput): EmployeeUpdate {
  const row: EmployeeUpdate = {}
  const assign = <K extends keyof EmployeeUpdate>(key: K, value: EmployeeUpdate[K] | undefined) => {
    if (value !== undefined) row[key] = value
  }
  assign('employee_number', input.employeeNumber?.trim())
  assign('title', input.title === undefined ? undefined : optionalText(input.title))
  assign('initials', input.initials === undefined ? undefined : optionalText(input.initials))
  assign('first_name', input.firstName?.trim())
  assign('birth_name_prefix', input.birthNamePrefix === undefined ? undefined : optionalText(input.birthNamePrefix))
  assign('birth_name', input.birthName?.trim())
  assign('partner_name_prefix', input.partnerNamePrefix === undefined ? undefined : optionalText(input.partnerNamePrefix))
  assign('partner_name', input.partnerName === undefined ? undefined : optionalText(input.partnerName))
  assign('name_usage', input.nameUsage); assign('gender', input.gender)
  assign('pronouns', input.pronouns === undefined ? undefined : optionalText(input.pronouns))
  assign('birth_date', input.birthDate)
  assign('birth_place', input.birthPlace === undefined ? undefined : optionalText(input.birthPlace))
  assign('birth_country', input.birthCountry); assign('nationality', input.nationality)
  assign('marital_status', input.maritalStatus); assign('marital_status_date', input.maritalStatusDate)
  assign('education_level', input.educationLevel); assign('preferred_language', input.preferredLanguage)
  assign('private_email', input.privateEmail === undefined ? undefined : input.privateEmail?.toLowerCase() ?? null)
  assign('private_phone', input.privatePhone === undefined ? undefined : optionalText(input.privatePhone))
  assign('private_mobile', input.privateMobile === undefined ? undefined : optionalText(input.privateMobile))
  assign('work_email', input.workEmail === undefined ? undefined : input.workEmail?.toLowerCase() ?? null)
  assign('work_phone', input.workPhone === undefined ? undefined : optionalText(input.workPhone))
  assign('work_phone_ext', input.workPhoneExt === undefined ? undefined : optionalText(input.workPhoneExt))
  assign('work_mobile', input.workMobile === undefined ? undefined : optionalText(input.workMobile))
  assign('avatar_url', input.avatarUrl); assign('original_hire_date', input.originalHireDate)
  return row
}

export function toPublicEmployee(employee: PublicEmployeeSource): PublicEmployee {
  return {
    id: employee.id, tenantId: employee.tenant_id, employeeNumber: employee.employee_number,
    firstName: employee.first_name, birthName: employee.birth_name, privateEmail: employee.private_email,
    workEmail: employee.work_email, isActive: employee.is_active, updatedAt: employee.updated_at,
  }
}

export function isPostgresConflict(error: { code?: string } | null | undefined): boolean {
  return error?.code === '23505' || error?.code === '23P01'
}
