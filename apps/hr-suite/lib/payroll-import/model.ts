import { z } from 'zod'

export const payrollImportSourceTypeSchema = z.enum(['LOONAANGIFTE_XML', 'INTERNAL_REPRESENTATIVE'])
export type PayrollImportSourceType = z.infer<typeof payrollImportSourceTypeSchema>

export type PayrollImportRowStatus = 'GREEN' | 'WARNING' | 'BLOCKING'
export type PayrollImportMatchStatus = 'UNMATCHED' | 'EXACT' | 'PROPOSED' | 'MANUAL_REVIEW' | 'NEW'
export type PayrollImportIssueSeverity = 'WARNING' | 'BLOCKING'

export interface PayrollImportIssue {
  code: string
  severity: PayrollImportIssueSeverity
  field?: string
}

export interface CanonicalPayrollAddress {
  street?: string
  houseNumber?: string
  houseNumberAddition?: string
  postalCode?: string
  city?: string
  countryCode?: string
}

export interface CanonicalPayrollIncomeRelationship {
  payrollTaxNumber: string
  ikvNumber: number
  incomeCode?: string
  employmentRelationCode?: string
  caoCode?: string
  flags: Record<string, boolean>
  hoursPerWeek?: number
  salaryAmount?: number
  startsOn?: string
  endsOn?: string
}

export interface CanonicalPayrollPerson {
  sourceRowNumber: number
  externalEmployeeNumber?: string
  bsnFingerprint?: string
  initials?: string
  prefix?: string
  firstName?: string
  birthName?: string
  birthDate?: string
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY'
  nationality?: string
  address?: CanonicalPayrollAddress
  incomeRelationships: CanonicalPayrollIncomeRelationship[]
  sourceMetadata: Record<string, string | number | boolean | null>
}

export interface PayrollImportMatch {
  status: PayrollImportMatchStatus
  employeeId?: string
  reason?: 'BSN_EXACT' | 'EXTERNAL_EMPLOYEE_NUMBER' | 'NAME_BIRTH_DATE' | 'NO_CANDIDATE' | 'AMBIGUOUS'
}

export interface ExistingPayrollEmployeeCandidate {
  id: string
  externalEmployeeNumber?: string | null
  bsnFingerprint?: string | null
  firstName: string
  birthName: string
  birthDate?: string | null
}

export interface ValidatedPayrollPerson extends CanonicalPayrollPerson {
  status: PayrollImportRowStatus
  match: PayrollImportMatch
  issues: PayrollImportIssue[]
}

export interface PayrollImportAnalysis {
  sourceType: PayrollImportSourceType
  sourceFilename: string
  sourceHash: string
  rows: ValidatedPayrollPerson[]
  summary: {
    total: number
    green: number
    warnings: number
    blocking: number
    incomeRelationships: number
    ambiguousMatches: number
  }
}

export class PayrollImportError extends Error {
  constructor(
    readonly code: string,
    readonly status: 400 | 403 | 404 | 409 | 422 | 500 = 400,
    readonly databaseCode?: string,
  ) {
    super(code)
    this.name = 'PayrollImportError'
  }
}

export function payrollImportEmploymentLinkId(input: { employmentId: string; recordStatus: string }): string | null {
  return input.recordStatus === 'DRAFT' ? null : input.employmentId
}

export function normalizeIdentityPart(value: string | null | undefined): string {
  return (value ?? '').trim().toLocaleLowerCase('nl-NL').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (month < 1 || month > 12 || day < 1) return false
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0
  return day <= daysInMonth && year >= 1
}

export function toSafeDatabaseDate(value: string | undefined): string | null {
  return value && isValidIsoDate(value) ? value : null
}

export function isValidLoonaangifteLhNr(value: string): boolean {
  return /^[0-9]{9}L(0[1-9]|[1-9][0-9])$/.test(value.trim())
}

export function isValidPayrollIkvNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 99
}
