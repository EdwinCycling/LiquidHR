import { createHash } from 'node:crypto'
import { z } from 'zod'
import { PayrollImportError, type CanonicalPayrollPerson, type PayrollImportSourceType } from './model'

const addressSchema = z.object({
  street: z.string().trim().max(160).optional(),
  houseNumber: z.string().trim().max(20).optional(),
  houseNumberAddition: z.string().trim().max(20).optional(),
  postalCode: z.string().trim().max(16).optional(),
  city: z.string().trim().max(120).optional(),
  countryCode: z.string().trim().toUpperCase().length(2).optional(),
}).strict()

const incomeRelationshipSchema = z.object({
  payrollTaxNumber: z.string().trim(),
  ikvNumber: z.number().int(),
  incomeCode: z.string().trim().optional(),
  employmentRelationCode: z.string().trim().optional(),
  caoCode: z.string().trim().optional(),
  flags: z.record(z.string(), z.boolean()).default({}),
  hoursPerWeek: z.number().nonnegative().optional(),
  salaryAmount: z.number().nonnegative().optional(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict()

const representativePersonSchema = z.object({
  sourceRowNumber: z.number().int().positive(),
  externalEmployeeNumber: z.string().trim().optional(),
  bsnFingerprint: z.string().trim().regex(/^[0-9a-f]{64}$/).optional(),
  initials: z.string().trim().max(20).optional(),
  prefix: z.string().trim().max(40).optional(),
  firstName: z.string().trim().max(120).optional(),
  birthName: z.string().trim().max(120).optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
  nationality: z.string().regex(/^[A-Z]{2}$/).optional(),
  address: addressSchema.optional(),
  incomeRelationships: z.array(incomeRelationshipSchema).min(1),
  sourceMetadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
}).strict()

const representativeFixtureSchema = z.object({
  sourceType: z.literal('INTERNAL_REPRESENTATIVE'),
  persons: z.array(representativePersonSchema).min(1),
}).strict()

export interface AdaptedPayrollSource {
  sourceType: PayrollImportSourceType
  sourceHash: string
  persons: CanonicalPayrollPerson[]
}

export function hashPayrollSource(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function adaptPayrollSource(input: {
  sourceType: PayrollImportSourceType
  bytes: Uint8Array
}): AdaptedPayrollSource {
  const sourceHash = hashPayrollSource(input.bytes)

  let decoded: unknown
  try {
    decoded = JSON.parse(new TextDecoder().decode(input.bytes)) as unknown
  } catch {
    throw new PayrollImportError('INTERNAL_FIXTURE_INVALID', 422)
  }
  const fixture = representativeFixtureSchema.safeParse(decoded)
  if (!fixture.success) throw new PayrollImportError('INTERNAL_FIXTURE_INVALID', 422)
  return {
    sourceType: input.sourceType,
    sourceHash,
    persons: fixture.data.persons,
  }
}
