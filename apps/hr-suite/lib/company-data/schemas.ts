import { z } from 'zod'

const nullableText = (maximum: number) => z.string().trim().max(maximum).nullable().optional()
const countryCode = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).default('NL')

const addressShape = {
  addressLine1: nullableText(240),
  addressLine2: nullableText(240),
  street: nullableText(160),
  houseNumber: nullableText(20),
  houseNumberAddition: nullableText(20),
  postalCode: nullableText(16),
  city: nullableText(120),
  region: nullableText(120),
  countryCode,
}

function validateAddress(value: { countryCode: string; addressLine1?: string | null; street?: string | null; houseNumber?: string | null; postalCode?: string | null; city?: string | null }, context: z.RefinementCtx) {
  if (value.countryCode === 'NL') {
    if (!value.street) context.addIssue({ code: 'custom', path: ['street'], message: 'COMPANY_DATA_STREET_REQUIRED' })
    if (!value.houseNumber) context.addIssue({ code: 'custom', path: ['houseNumber'], message: 'COMPANY_DATA_HOUSE_NUMBER_REQUIRED' })
    if (!value.postalCode) context.addIssue({ code: 'custom', path: ['postalCode'], message: 'COMPANY_DATA_POSTAL_CODE_REQUIRED' })
  } else if (!value.addressLine1) {
    context.addIssue({ code: 'custom', path: ['addressLine1'], message: 'COMPANY_DATA_ADDRESS_REQUIRED' })
  }
  if (!value.city) context.addIssue({ code: 'custom', path: ['city'], message: 'COMPANY_DATA_CITY_REQUIRED' })
}

export const companyDataUpdateSchema = z.object({
  singleLocation: z.boolean(),
  ...addressShape,
}).strict().superRefine(validateAddress)

export const locationCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  ...addressShape,
  isActive: z.boolean().default(true),
}).strict().superRefine(validateAddress)

export const locationUpdateSchema = locationCreateSchema

export type CompanyDataUpdateInput = z.infer<typeof companyDataUpdateSchema>
export type LocationCreateInput = z.infer<typeof locationCreateSchema>
export type LocationUpdateInput = z.infer<typeof locationUpdateSchema>
