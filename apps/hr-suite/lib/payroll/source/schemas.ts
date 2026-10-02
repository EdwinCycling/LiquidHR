import { z } from 'zod'
import type {
  PayrollJsonValue,
  PayrollSourceSnapshot,
  PayrollSourceProviderInput,
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

export const payrollSourceProviderInputSchema = z.object({
  tenantId: opaqueUuidSchema,
  hrGroupId: opaqueUuidSchema,
  administrationId: opaqueUuidSchema,
  employeeId: opaqueUuidSchema,
  payrollPeriod: payrollPeriodReferenceSchema,
}).strict() satisfies z.ZodType<PayrollSourceProviderInput>

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
  canonicalSource: payrollJsonValueSchema,
  sourceVersionVector: z.record(z.string(), z.string()),
  sourceGaps: z.array(payrollSourceGapSchema),
  sourceHash: z.string().regex(/^[0-9a-f]{64}$/),
  createdAt: z.string().datetime(),
}).strict() satisfies z.ZodType<PayrollSourceSnapshot>

