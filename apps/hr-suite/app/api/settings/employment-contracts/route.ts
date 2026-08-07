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
} from '@/lib/employment/employment-settings'

const catalog = z.enum(['LABOR_CONDITION_SET', 'FLEX_PHASE', 'SALARY_FREQUENCY', 'COST_CARRIER', 'COST_CENTER'])
const catalogInput = z.object({ catalog, code: z.string().trim().min(1).max(40), name: z.string().trim().min(1).max(160), numericValue: z.number().min(0).max(999).nullish() }).strict()
const regulationInput = z.object({ name: z.string().trim().min(1).max(160), validFrom: z.string().date(), standardHoursPerWeek: z.number().positive().max(60) }).strict()
const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('COUNTRY'), countryCode: z.string().regex(/^[A-Z]{2}$/) }).strict(),
  z.object({ action: z.literal('CREATE'), ...catalogInput.shape }).strict(),
  z.object({ action: z.literal('UPDATE'), id: z.string().uuid(), ...catalogInput.shape }).strict(),
  z.object({ action: z.literal('ACTIVE'), catalog, id: z.string().uuid(), isActive: z.boolean() }).strict(),
  z.object({ action: z.literal('REGULATION_CREATE'), ...regulationInput.shape }).strict(),
  z.object({ action: z.literal('REGULATION_UPDATE'), id: z.string().uuid(), ...regulationInput.shape }).strict(),
  z.object({ action: z.literal('REGULATION_SUCCESSOR'), predecessorId: z.string().uuid(), ...regulationInput.shape }).strict(),
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
