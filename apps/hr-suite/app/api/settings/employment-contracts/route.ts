import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissionErrorResponse } from '@/lib/auth/permissions'
import {
  createEmploymentCatalogItem,
  createEmploymentRegulation,
  createEmploymentRegulationSuccessor,
  EmploymentSettingsError,
  setEmploymentCatalogItemActive,
  updateEmploymentRegulation,
  updateEmploymentCatalogItem,
  updateDefaultEmploymentCountry,
  setEmploymentPaymentFrequencies,
} from '@/lib/employment/employment-settings'
import { saveSalaryApplicationSettings } from '@/lib/salary-application/service'
import { databaseUuid } from '@/lib/validation/database-uuid'

const catalog = z.enum(['LABOR_CONDITION_SET', 'FLEX_PHASE', 'SALARY_FREQUENCY', 'COST_CARRIER', 'COST_CENTER'])
const catalogInput = z.object({ catalog, code: z.string().trim().min(1).max(40), name: z.string().trim().min(1).max(160), numericValue: z.number().min(0).max(999).nullish() }).strict()
const regulationInput = z.object({ name: z.string().trim().min(1).max(160), validFrom: z.string().date(), standardHoursPerWeek: z.number().positive().max(60), probationMaximumMonths: z.union([z.literal(1), z.literal(2)]).default(1) }).strict()
const paymentFrequencies = z.array(z.enum(['MONTHLY', 'FOUR_WEEKLY'])).min(1).max(2)
const salaryApplicationRoute = z.enum(['MANUAL', 'MINIMUM_WAGE', 'SCALE_WITH_STEPS', 'SALARY_BAND'])
const salaryApplicationSettings = z.object({
  routes: z.array(salaryApplicationRoute).min(1).max(4),
  structureIds: z.array(databaseUuid).max(250),
}).strict()
const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('COUNTRY'), countryCode: z.string().regex(/^[A-Z]{2}$/) }).strict(),
  z.object({ action: z.literal('PAYMENT_FREQUENCIES'), codes: paymentFrequencies }).strict(),
  z.object({ action: z.literal('SALARY_SETTINGS'), ...salaryApplicationSettings.shape }).strict(),
  z.object({ action: z.literal('CREATE'), ...catalogInput.shape }).strict(),
  z.object({ action: z.literal('UPDATE'), id: databaseUuid, ...catalogInput.shape }).strict(),
  z.object({ action: z.literal('ACTIVE'), catalog, id: databaseUuid, isActive: z.boolean() }).strict(),
  z.object({ action: z.literal('REGULATION_CREATE'), ...regulationInput.shape }).strict(),
  z.object({ action: z.literal('REGULATION_UPDATE'), id: databaseUuid, ...regulationInput.shape }).strict(),
  z.object({ action: z.literal('REGULATION_SUCCESSOR'), predecessorId: databaseUuid, ...regulationInput.shape }).strict(),
])

function fail(error: unknown): NextResponse | null {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof EmploymentSettingsError) {
    return NextResponse.json({ code: error.code }, { status: error.status })
  }
  return null
}

export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const parsed = requestSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ code: 'SETTINGS_INPUT_INVALID' }, { status: 400 })
    if (parsed.data.action === 'COUNTRY') {
      await updateDefaultEmploymentCountry(parsed.data.countryCode)
    } else if (parsed.data.action === 'PAYMENT_FREQUENCIES') {
      await setEmploymentPaymentFrequencies(parsed.data.codes)
    } else if (parsed.data.action === 'SALARY_SETTINGS') {
      await saveSalaryApplicationSettings({ routes: parsed.data.routes, structureIds: parsed.data.structureIds })
    } else if (parsed.data.action === 'CREATE') {
      await createEmploymentCatalogItem(parsed.data.catalog, {
        ...parsed.data,
        numericValue: parsed.data.numericValue ?? null,
      })
    } else if (parsed.data.action === 'UPDATE') {
      await updateEmploymentCatalogItem(parsed.data.catalog, parsed.data.id, { ...parsed.data, numericValue: parsed.data.numericValue ?? null })
    } else if (parsed.data.action === 'REGULATION_CREATE') {
      await createEmploymentRegulation(parsed.data)
    } else if (parsed.data.action === 'REGULATION_UPDATE') {
      await updateEmploymentRegulation(parsed.data.id, parsed.data)
    } else if (parsed.data.action === 'REGULATION_SUCCESSOR') {
      await createEmploymentRegulationSuccessor(parsed.data)
    } else {
      await setEmploymentCatalogItemActive(parsed.data.catalog, parsed.data.id, parsed.data.isActive)
    }
    return NextResponse.json({ data: { updated: true } })
  } catch (error) {
    const response = fail(error)
    if (response) return response
    throw error
  }
}
