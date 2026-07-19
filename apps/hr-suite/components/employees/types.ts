import type { Database } from '@scope/db'

type Employment = Database['public']['Tables']['employments']['Row']

export interface EmployeeCapabilities {
  canEditEmployee: boolean
  canReadBsn: boolean
  canWriteBsn: boolean
  canManageAddresses: boolean
  canManageRelations: boolean
  canManageBankAccounts: boolean
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
  street: string
  houseNumber: string
  addition: string | null
  postalCode: string
  city: string
  province: string | null
  countryCode: string
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

export interface EmployeeDetailViewModel {
  employee: EmployeeProfile
  employments: Employment[]
  status: 'ACTIVE_EMPLOYEE' | 'FUTURE_EMPLOYEE' | 'FORMER_EMPLOYEE' | 'NEVER_EMPLOYED'
  addresses?: EmployeeAddress[]
  bankAccounts?: EmployeeBankAccount[]
  relations?: EmployeeRelation[]
  relationTypes?: EmployeeRelationTypeOption[]
  capabilities?: EmployeeCapabilities
}

export const NO_EMPLOYEE_CAPABILITIES: EmployeeCapabilities = {
  canEditEmployee: false,
  canReadBsn: false,
  canWriteBsn: false,
  canManageAddresses: false,
  canManageRelations: false,
  canManageBankAccounts: false,
}
