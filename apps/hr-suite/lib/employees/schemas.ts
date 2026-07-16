import { z } from 'zod'
import { normalizeBsn } from '@/lib/security/bsn-fingerprint'

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const nullableText = (maximum: number) => z.string().trim().max(maximum).nullish()

const employeeMutableShape = {
  employeeNumber: z.string().trim().min(1).max(40).optional(),
  title: nullableText(40),
  initials: nullableText(20),
  firstName: z.string().trim().min(1).max(120),
  birthNamePrefix: nullableText(40),
  birthName: z.string().trim().min(1).max(120),
  partnerNamePrefix: nullableText(40),
  partnerName: nullableText(120),
  nameUsage: z.enum(['BIRTH_NAME', 'PARTNER_NAME', 'PARTNER_BEFORE_BIRTH_NAME', 'BIRTH_NAME_BEFORE_PARTNER_NAME']),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']),
  pronouns: nullableText(40),
  birthDate: dateOnly.nullish(),
  birthPlace: nullableText(120),
  birthCountry: z.string().regex(/^[A-Z]{2}$/).nullish(),
  nationality: z.string().regex(/^[A-Z]{2}$/).nullish(),
  maritalStatus: z.enum(['SINGLE', 'MARRIED', 'REGISTERED_PARTNERSHIP', 'DIVORCED', 'WIDOWED']).nullish(),
  maritalStatusDate: dateOnly.nullish(),
  educationLevel: z.enum(['MBO', 'HBO', 'WO', 'HIGHSCHOOL', 'OTHER', 'UNKNOWN']).nullish(),
  preferredLanguage: z.string().trim().min(2).max(12),
  privateEmail: z.email().max(254).nullish(),
  privatePhone: nullableText(40),
  privateMobile: nullableText(40),
  workEmail: z.email().max(254).nullish(),
  workPhone: nullableText(40),
  workPhoneExt: nullableText(20),
  workMobile: nullableText(40),
  avatarUrl: z.url().max(2_000).nullish(),
  originalHireDate: dateOnly.nullish(),
}

export const employeeCreateSchema = z.object({
  ...employeeMutableShape,
  preferredLanguage: employeeMutableShape.preferredLanguage.default('nl-NL'),
  bsn: z.string().max(20).optional().transform((value, context) => {
    if (!value) return undefined
    try {
      return normalizeBsn(value)
    } catch {
      context.addIssue({ code: 'custom', message: 'BSN_INVALID' })
      return z.NEVER
    }
  }),
}).strict()

export const employeeBsnSchema = z.object({
  bsn: z.string().max(20).transform((value, context) => {
    try {
      return normalizeBsn(value)
    } catch {
      context.addIssue({ code: 'custom', message: 'BSN_INVALID' })
      return z.NEVER
    }
  }),
}).strict()

const employeeUpdateFields = z.object(employeeMutableShape).partial().strict()

export const employeeUpdateSchema = employeeUpdateFields.extend({
  updatedAt: z.iso.datetime(),
}).superRefine((value, context) => {
  if (Object.keys(value).every((key) => key === 'updatedAt')) {
    context.addIssue({ code: 'custom', message: 'EMPLOYEE_UPDATE_EMPTY' })
  }
})

export const addressSchema = z.object({
  street: z.string().trim().min(1).max(160),
  houseNumber: z.string().trim().min(1).max(20),
  addition: nullableText(20),
  postalCode: z.string().trim().min(2).max(16),
  city: z.string().trim().min(1).max(120),
  province: nullableText(120),
  countryCode: z.string().regex(/^[A-Z]{2}$/).default('NL'),
  validFrom: dateOnly,
  validUntil: dateOnly.nullish(),
}).strict().superRefine((value, context) => {
  if (value.validUntil && value.validUntil < value.validFrom) {
    context.addIssue({ code: 'custom', path: ['validUntil'], message: 'ADDRESS_DATE_RANGE_INVALID' })
  }
})

function isValidIban(input: string): boolean {
  const iban = input.replace(/\s/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`
  const numeric = [...rearranged].map((character) => /\d/.test(character) ? character : String(character.charCodeAt(0) - 55)).join('')
  let remainder = 0
  for (const digit of numeric) remainder = (remainder * 10 + Number(digit)) % 97
  return remainder === 1
}

export const bankAccountSchema = z.object({
  iban: z.string().transform((value) => value.replace(/\s/g, '').toUpperCase()).refine(isValidIban, 'IBAN_INVALID'),
  bic: z.string().trim().max(11).nullish(),
  accountHolder: z.string().trim().min(1).max(160),
  description: nullableText(240),
  isPrimary: z.boolean().default(false),
}).strict()

export const relationSchema = z.object({
  relationType: z.enum(['PARTNER', 'CHILD', 'PARENT', 'SIBLING', 'DOCTOR', 'DENTIST', 'OTHER']),
  isEmergencyContact: z.boolean().default(false),
  firstName: nullableText(120),
  initials: nullableText(20),
  prefix: nullableText(40),
  lastName: z.string().trim().min(1).max(120),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).nullish(),
  birthDate: dateOnly.nullish(),
  phone: nullableText(40),
  mobile: nullableText(40),
  email: z.email().max(254).nullish(),
  notes: nullableText(2_000),
}).strict()

export type EmployeeCreateInput = Omit<z.infer<typeof employeeCreateSchema>, 'bsn'> & { bsn?: string }
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>
export type AddressInput = z.infer<typeof addressSchema>
export type BankAccountInput = z.infer<typeof bankAccountSchema>
export type RelationInput = z.infer<typeof relationSchema>
