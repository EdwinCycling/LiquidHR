import 'server-only'

import { createHash } from 'node:crypto'
import { z } from 'zod'
import { createBsnFingerprint } from '@/lib/security/bsn-fingerprint'
import { PayrollImportError, type CanonicalPayrollPerson, type PayrollImportSourceContext, type PayrollImportSourceType } from './model'
import { parseLoonaangifteXml } from './xml/parser'

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
  sourceContext?: PayrollImportSourceContext
  sourceIssuesByRow?: readonly { sourceRowNumber: number; code: string; field?: string }[]
}

export function hashPayrollSource(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function adaptPayrollSource(input: {
  sourceType: PayrollImportSourceType
  bytes: Uint8Array
  tenantId?: string
}): AdaptedPayrollSource {
  const sourceHash = hashPayrollSource(input.bytes)
  if (input.sourceType === 'LOONAANGIFTE_XML') {
    if (!input.tenantId?.trim()) throw new PayrollImportError('IMPORT_TENANT_CONTEXT_REQUIRED', 409)
    const tenantId = input.tenantId
    const key = process.env.BSN_HASH_KEY
    if (!key) throw new PayrollImportError('BSN_HASH_KEY_MISSING', 500)
    if (key.length < 32) throw new PayrollImportError('BSN_HASH_KEY_INVALID', 500)

    const parsed = parseLoonaangifteXml({
      bytes: input.bytes,
      context: {
        identity: {
          protectBsn: (bsn) => createBsnFingerprint(tenantId, bsn, key),
        },
      },
    })
    if (parsed.status !== 'SUPPORTED_READ_ONLY') {
      const context: PayrollImportSourceContext = {
        status: parsed.status,
        ...parsed.sourceMetadata,
        reportingPeriods: [],
        diagnostics: parsed.diagnostics.map(({ code }) => ({ code })),
      }
      return { sourceType: input.sourceType, sourceHash, persons: [], sourceContext: context }
    }

    const document = parsed.document
    const persons: CanonicalPayrollPerson[] = document.persons.map((person) => ({
      sourceRowNumber: person.sourceRowNumber,
      externalEmployeeNumber: person.externalEmployeeNumber,
      bsnFingerprint: person.bsnFingerprint,
      initials: person.initials,
      significantSurnamePart: person.significantSurnamePart,
      birthDate: person.birthDate,
      nationalityCode: person.nationalityCode,
      genderCode: person.genderCode,
      incomeRelationships: person.incomeRelationships.map((relationship) => {
        const sourcePeriods = relationship.periods.map(({ startsOn, incomeCode, employmentRelationCode, caoCode }) => ({
          startsOn,
          incomeCode,
          ...(employmentRelationCode === undefined ? {} : { employmentRelationCode }),
          ...(caoCode === undefined ? {} : { caoCode }),
        }))
        const uniqueIncomeCodes = new Set(sourcePeriods.map((period) => period.incomeCode))
        const uniqueEmploymentCodes = new Set(sourcePeriods.flatMap((period) => period.employmentRelationCode === undefined ? [] : [period.employmentRelationCode]))
        const uniqueCaoCodes = new Set(sourcePeriods.flatMap((period) => period.caoCode === undefined ? [] : [period.caoCode]))
        const hasOneEmploymentCode = sourcePeriods.every((period) => period.employmentRelationCode !== undefined) && uniqueEmploymentCodes.size === 1
        const hasOneCaoCode = sourcePeriods.every((period) => period.caoCode !== undefined) && uniqueCaoCodes.size === 1
        return {
          payrollTaxNumber: relationship.payrollTaxNumber,
          ikvNumber: relationship.ikvNumber,
          ...(uniqueIncomeCodes.size === 1 ? { incomeCode: sourcePeriods[0]?.incomeCode } : {}),
          ...(hasOneEmploymentCode ? { employmentRelationCode: String([...uniqueEmploymentCodes][0]) } : {}),
          ...(hasOneCaoCode ? { caoCode: String([...uniqueCaoCodes][0]) } : {}),
          flags: {},
          startsOn: relationship.startsOn,
          endsOn: relationship.endsOn,
          sourcePeriods,
        }
      }),
      sourceMetadata: { sourceSystem: 'Belastingdienst Loonaangifte XML', sourceRow: person.sourceRowNumber },
    }))
    const sourceContext: PayrollImportSourceContext = {
      status: parsed.status,
      taxYear: document.taxYear,
      schemaVersion: document.schemaVersion,
      namespaceUri: document.namespaceUri,
      payrollTaxNumber: document.payrollTaxNumber,
      reportingPeriods: document.reportingPeriods.map(({ startsOn, endsOn }) => ({ startsOn, endsOn })),
      xsdValidation: parsed.xsdValidation,
      sourceArchiveSha256: parsed.profile.sourceArchiveSha256,
      xsdSha256: parsed.profile.xsdSha256,
      diagnostics: parsed.diagnostics.map(({ code }) => ({ code })),
    }
    const sourceIssuesByRow = document.persons.flatMap((person) => person.conflicts.map((conflict) => ({
      sourceRowNumber: person.sourceRowNumber,
      code: 'XML_PERSON_FIELD_CONFLICT',
      field: conflict.field,
    })))
    return { sourceType: input.sourceType, sourceHash: document.sourceHash, persons, sourceContext, sourceIssuesByRow }
  }

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
