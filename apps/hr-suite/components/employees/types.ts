import type { Database } from '@scope/db'
import type { CurrentEmployeeSummary } from '@/lib/employment/employee-summary'

type Employment = Database['public']['Tables']['employments']['Row']

export interface EmployeeCapabilities {
  canEditEmployee: boolean
  canReadBsn: boolean
  canWriteBsn: boolean
  canManageAddresses: boolean
  canManageRelations: boolean
  canManageBankAccounts: boolean
  canReadSalary: boolean
}

export interface EmployeeProfile {
  id: string
  employeeNumber: string
  firstName: string
  birthName: string
  privateEmail: string | null
  workEmail: string | null
  updatedAt?: string
  title?: string | null
  initials?: string | null
  birthNamePrefix?: string | null
  partnerNamePrefix?: string | null
  partnerName?: string | null
  nameUsage?: 'BIRTH_NAME' | 'PARTNER_NAME' | 'PARTNER_BEFORE_BIRTH_NAME' | 'BIRTH_NAME_BEFORE_PARTNER_NAME'
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY'
  pronouns?: string | null
  birthDate?: string | null
  birthPlace?: string | null
  birthCountry?: string | null
  nationality?: string | null
  maritalStatus?: 'SINGLE' | 'MARRIED' | 'REGISTERED_PARTNERSHIP' | 'DIVORCED' | 'WIDOWED' | null
  maritalStatusDate?: string | null
  educationLevel?: 'MBO' | 'HBO' | 'WO' | 'HIGHSCHOOL' | 'OTHER' | 'UNKNOWN' | null
  preferredLanguage?: string
  privatePhone?: string | null
  privateMobile?: string | null
  workPhone?: string | null
  workPhoneExt?: string | null
  workMobile?: string | null
  avatarUrl?: string | null
  originalHireDate?: string | null
  isActive?: boolean
  isArchived?: boolean
}

export interface EmployeeAddress {
  id: string
  addressLine1: string
  addressLine2: string | null
  street: string | null
  houseNumber: string | null
  houseNumberAddition: string | null
  postalCode: string | null
  city: string
  region: string | null
  countryCode: string
  source: string
  sourceReference: string | null
  validFrom: string
  validUntil: string | null
}

export interface EmployeeBankAccount {
  id: string
  maskedIban: string
  bic: string | null
  accountHolder: string
  description: string | null
  isPrimary: boolean
}

export interface EmployeeRelation {
  id: string
  relationType: string
  isEmergencyContact: boolean
  firstName: string | null
  initials: string | null
  prefix: string | null
  lastName: string
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY' | null
  birthDate: string | null
  phone: string | null
  mobile: string | null
  email: string | null
  notes: string | null
}

export interface EmployeeRelationTypeOption {
  code: string
  nameNl: string
  nameEn: string
}

export interface EmployeeRoleAssignment {
  id: string
  roleName: string
  roleCode: string
  departmentName: string | null
  effectiveFrom: string
  effectiveTo: string | null
}

export interface EmployeeDetailViewModel {
  employee: EmployeeProfile
  employments: Employment[]
  status: 'ACTIVE_EMPLOYEE' | 'FUTURE_EMPLOYEE' | 'FORMER_EMPLOYEE' | 'NEVER_EMPLOYED'
  addresses?: EmployeeAddress[]
  bankAccounts?: EmployeeBankAccount[]
  relations?: EmployeeRelation[]
  relationTypes?: EmployeeRelationTypeOption[]
  currentEmploymentSummary: CurrentEmployeeSummary
  capabilities?: EmployeeCapabilities
  roleAssignments?: EmployeeRoleAssignment[]
}

export const NO_EMPLOYEE_CAPABILITIES: EmployeeCapabilities = {
  canEditEmployee: false,
  canReadBsn: false,
  canWriteBsn: false,
  canManageAddresses: false,
  canManageRelations: false,
  canManageBankAccounts: false,
  canReadSalary: false,
}
