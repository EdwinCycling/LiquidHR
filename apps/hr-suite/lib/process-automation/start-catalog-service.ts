import { z } from 'zod'
import { requireAuthContext, requireHrGroupId, type AuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

const localizedTextSchema = z.record(z.string(), z.string())

const catalogStepSchema = z.object({
  title: localizedTextSchema,
  responsibleRole: localizedTextSchema.nullable(),
  isStart: z.boolean(),
}).strict()

const catalogRouteSchema = z.object({
  fromTitle: localizedTextSchema,
  label: localizedTextSchema,
  toTitle: localizedTextSchema,
}).strict()

const startableProcessSchema = z.object({
  processDefinitionId: z.string().uuid(),
  title: localizedTextSchema,
  description: localizedTextSchema.nullable(),
  steps: z.array(catalogStepSchema),
  routes: z.array(catalogRouteSchema),
}).strict()

export type StartableProcess = z.infer<typeof startableProcessSchema>

export class ProcessStartCatalogError extends Error {
  constructor(readonly code: string, readonly status: number, message = code) {
    super(message)
    this.name = 'ProcessStartCatalogError'
  }
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface ProcessStartCatalogDependencies {
  readonly supabase: SupabaseServerClient
  readonly context: AuthContext
}

function catalogErrorCode(message: string): string {
  const code = message.split(':', 1)[0]?.trim() ?? ''
  if (code === 'AUTHENTICATION_REQUIRED') return code
  if (code === 'ACTOR_EMPLOYEE_NOT_FOUND' || code === 'FORBIDDEN' || code === 'PROCESS_START_CATALOG_SCOPE_REQUIRED' || message.includes('permission denied')) return 'PROCESS_START_CATALOG_FORBIDDEN'
  return 'PROCESS_START_CATALOG_FAILED'
}

export async function listStartableProcesses(dependencies?: ProcessStartCatalogDependencies): Promise<readonly StartableProcess[]> {
  const supabase = dependencies?.supabase ?? await createClient()
  const context = dependencies?.context ?? await requireAuthContext(supabase)
  if (!context.employeeId) throw new ProcessStartCatalogError('PROCESS_START_CATALOG_FORBIDDEN', 403)

  const { data, error } = await supabase.rpc('get_process_startable_catalog' as never, {
    requested_tenant_id: context.tenantId,
    requested_hr_group_id: requireHrGroupId(context),
  } as never)
  if (error) {
    const code = catalogErrorCode(error.message)
    throw new ProcessStartCatalogError(code, code === 'AUTHENTICATION_REQUIRED' ? 401 : code.endsWith('FORBIDDEN') ? 403 : 500, error.message)
  }

  const parsed = z.array(startableProcessSchema).safeParse(data)
  if (!parsed.success) throw new ProcessStartCatalogError('PROCESS_START_CATALOG_INVALID', 500)
  return parsed.data
}

export function localizedProcessText(value: Readonly<Record<string, string>> | null, locale: 'nl' | 'en'): string {
  if (!value) return ''
  return value[locale]?.trim() || value[locale === 'nl' ? 'en' : 'nl']?.trim() || ''
}
