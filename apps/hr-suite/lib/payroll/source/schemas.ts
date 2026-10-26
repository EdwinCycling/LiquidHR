import { z } from 'zod'
import type {
  PayrollJsonValue,
  PayrollSourceSnapshot,
  PayrollSourceProviderInput,
  PayrollPeriodIdentity,
} from '@liquid-hr/payroll-engine'

function isPayrollJsonValue(value: unknown): value is PayrollJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isPayrollJsonValue)
  if (typeof value !== 'object') return false

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return false

  return Object.values(value).every(isPayrollJsonValue)
}

const payrollJsonValueSchema = z.custom<PayrollJsonValue>(isPayrollJsonValue)
// Core IDs are opaque PostgreSQL UUIDs; legacy records may not use RFC version/variant bits.
const opaqueUuidSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

export const payrollPeriodReferenceSchema = z.object({
  year: z.number().int().min(1900).max(2200),
  month: z.number().int().min(1).max(12),
}).strict()

function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export const payrollPeriodIdentitySchema = z.object({
  id: opaqueUuidSchema,
  periodYear: z.number().int().min(1900).max(2200),
  periodNumber: z.number().int().min(1).max(14),
  periodicity: z.enum(['MONTHLY', 'FOUR_WEEKLY']),
  periodKind: z.literal('REGULAR'),
  startsOn: z.string().refine(validCalendarDate),
  endsOn: z.string().refine(validCalendarDate),
}).strict().superRefine((identity, context) => {
  const start = Date.parse(`${identity.startsOn}T00:00:00Z`)
  const end = Date.parse(`${identity.endsOn}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['endsOn'], message: 'PAYROLL_PERIOD_BOUNDARIES_INVALID' })
    return
  }
  const days = Math.round((end - start) / 86_400_000) + 1
  const monthlyBoundsInvalid = identity.periodicity === 'MONTHLY'
    && (identity.startsOn.slice(0, 7) !== identity.endsOn.slice(0, 7)
      || Number(identity.startsOn.slice(8, 10)) !== 1
      || Number(identity.endsOn.slice(8, 10)) !== new Date(Date.UTC(
        Number(identity.startsOn.slice(0, 4)), Number(identity.startsOn.slice(5, 7)), 0,
      )).getUTCDate())
  if ((identity.periodicity === 'FOUR_WEEKLY' && days !== 28) || monthlyBoundsInvalid) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['periodicity'], message: 'PAYROLL_PERIOD_BOUNDARIES_INVALID' })
  }
}) satisfies z.ZodType<PayrollPeriodIdentity>

export const payrollSourceProviderInputSchema = z.object({
  tenantId: opaqueUuidSchema,
  hrGroupId: opaqueUuidSchema,
  administrationId: opaqueUuidSchema,
  employeeId: opaqueUuidSchema,
  employmentId: opaqueUuidSchema.optional(),
  payrollPeriod: payrollPeriodReferenceSchema,
  payrollPeriodIdentity: payrollPeriodIdentitySchema.optional(),
}).strict().superRefine((input, context) => {
  if (input.payrollPeriodIdentity
    && `${input.payrollPeriod.year}-${String(input.payrollPeriod.month).padStart(2, '0')}` !== input.payrollPeriodIdentity.startsOn.slice(0, 7)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['payrollPeriodIdentity'], message: 'PAYROLL_PERIOD_REFERENCE_MISMATCH' })
  }
}) satisfies z.ZodType<PayrollSourceProviderInput>

export const payrollSourceGapSchema = z.object({
  field: z.string().min(1),
  status: z.enum(['SOURCE_GAP', 'UNSUPPORTED']),
  reasonCode: z.string().min(1),
}).strict()

export const payrollSourceSnapshotSchema = z.object({
  id: opaqueUuidSchema,
  sourceTenantId: opaqueUuidSchema,
  sourceHrGroupId: opaqueUuidSchema,
  sourceAdministrationId: opaqueUuidSchema,
  sourceEmployeeId: opaqueUuidSchema,
  sourceEmploymentId: opaqueUuidSchema,
  sourceIncomeRelationshipId: opaqueUuidSchema.nullable(),
  periodReference: payrollPeriodReferenceSchema,
  payrollPeriodIdentity: payrollPeriodIdentitySchema.optional(),
  canonicalSource: payrollJsonValueSchema,
  sourceVersionVector: z.record(z.string(), z.string()),
  sourceGaps: z.array(payrollSourceGapSchema),
  sourceHash: z.string().regex(/^[0-9a-f]{64}$/),
  createdAt: z.string().datetime(),
}).strict().superRefine((snapshot, context) => {
  if (snapshot.payrollPeriodIdentity
    && `${snapshot.periodReference.year}-${String(snapshot.periodReference.month).padStart(2, '0')}` !== snapshot.payrollPeriodIdentity.startsOn.slice(0, 7)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['payrollPeriodIdentity'], message: 'PAYROLL_PERIOD_REFERENCE_MISMATCH' })
  }
}) satisfies z.ZodType<PayrollSourceSnapshot>

