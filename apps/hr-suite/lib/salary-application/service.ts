import type { Database, Json } from '@scope/db'
import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

export type SalaryApplicationRoute = Database['public']['Enums']['salary_application_route']

export type SalaryApplicationSettings = {
  routes: SalaryApplicationRoute[]
  structureIds: string[]
}

export class SalaryApplicationError extends Error {
  constructor(readonly code: string, readonly status: 400 | 403 | 404 | 409 | 500) {
    super(code)
    this.name = 'SalaryApplicationError'
  }
}

function administrationId(value: string | null): string {
  if (!value) throw new SalaryApplicationError('ADMINISTRATION_REQUIRED', 400)
  return value
}

function mapDatabaseError(message: string | undefined): SalaryApplicationError {
  const code = message?.match(/[A-Z][A-Z_]+/)?.[0] ?? 'SALARY_APPLICATION_FAILED'
  const status = code === 'FORBIDDEN' ? 403
    : code.includes('NOT_FOUND') ? 404
      : code.includes('DUPLICATE') || code.includes('CONFLICT') ? 409
        : 400
  return new SalaryApplicationError(code, status)
}

export async function saveSalaryApplicationSettings(input: SalaryApplicationSettings): Promise<SalaryApplicationSettings> {
  const context = await requirePermission('salary:write')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('save_administration_salary_settings', {
    requested_administration_id: administrationId(context.administrationId),
    requested_routes: input.routes,
    requested_structure_ids: input.structureIds,
  })
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    throw mapDatabaseError(error?.message)
  }
  const result = data as { salaryRoutes?: unknown; salaryStructureIds?: unknown }
  if (!Array.isArray(result.salaryRoutes) || !Array.isArray(result.salaryStructureIds)) {
    throw new SalaryApplicationError('SALARY_APPLICATION_RESPONSE_INVALID', 500)
  }
  return {
    routes: result.salaryRoutes as SalaryApplicationRoute[],
    structureIds: result.salaryStructureIds.filter((value): value is string => typeof value === 'string'),
  }
}

export async function applySalaryApplicationChange(input: {
  employmentId: string
  effectiveOn: string
  reason: string
  warningCodes?: string[]
  acknowledgements?: Database['public']['Functions']['apply_salary_application_change']['Args']['requested_acknowledgements']
  payload: Record<string, unknown>
}): Promise<{ changeSetId: string; salaryId: string }> {
  await requirePermission('salary:write')
  const supabase = await createClient()
  const payload = JSON.parse(JSON.stringify(input.payload)) as Json
  const { data, error } = await supabase.rpc('apply_salary_application_change', {
    requested_employment_id: input.employmentId,
    requested_effective_on: input.effectiveOn,
    requested_payload: payload,
    requested_reason: input.reason,
    requested_warning_codes: input.warningCodes ?? [],
    requested_acknowledgements: input.acknowledgements ?? {},
  })
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    throw mapDatabaseError(error?.message)
  }
  const result = data as { changeSetId?: unknown; salaryId?: unknown }
  if (typeof result.changeSetId !== 'string' || typeof result.salaryId !== 'string') {
    throw new SalaryApplicationError('SALARY_APPLICATION_RESPONSE_INVALID', 500)
  }
  return { changeSetId: result.changeSetId, salaryId: result.salaryId }
}
