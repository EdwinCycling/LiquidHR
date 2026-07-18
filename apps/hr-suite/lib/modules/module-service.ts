import { NextResponse } from 'next/server'
import { permissionErrorResponse, requireAuthContext, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { getModuleCatalog, type ToggleableModuleCode } from './module-catalog'
import type { ModuleSelectionInput } from './schemas'

export class ModuleError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code)
    this.name = 'ModuleError'
  }
}

export async function getEnabledTenantModules(): Promise<ToggleableModuleCode[]> {
  const auth = await requireAuthContext()
  const supabase = await createClient()
  const { data, error } = await supabase.from('tenant_modules').select('module_code')
    .eq('tenant_id', auth.tenantId).eq('is_enabled', true)
  if (error) throw new ModuleError('MODULES_READ_FAILED', 500)
  return (data ?? []).map((module) => module.module_code as ToggleableModuleCode)
}

export async function listTenantModules() {
  const auth = await requirePermission('modules:read')
  const supabase = await createClient()
  const { data, error } = await supabase.from('tenant_modules')
    .select('module_code, is_enabled, enabled_at, disabled_at')
    .eq('tenant_id', auth.tenantId)
  if (error) throw new ModuleError('MODULES_READ_FAILED', 500)
  const state = new Map((data ?? []).map((module) => [module.module_code, module]))
  return getModuleCatalog().map((definition) => ({ ...definition, state: state.get(definition.code) ?? null }))
}

export async function saveTenantModules(input: ModuleSelectionInput): Promise<void> {
  const auth = await requirePermission('modules:write')
  const enabled = new Set(input.enabled)
  const now = new Date().toISOString()
  const supabase = await createClient()
  const rows = (['HERA', 'DOCUMENTS', 'REMINDERS'] as const).map((moduleCode) => ({
    tenant_id: auth.tenantId,
    module_code: moduleCode,
    is_enabled: enabled.has(moduleCode),
    enabled_at: enabled.has(moduleCode) ? now : null,
    enabled_by: enabled.has(moduleCode) ? auth.userId : null,
    disabled_at: enabled.has(moduleCode) ? null : now,
    disabled_by: enabled.has(moduleCode) ? null : auth.userId,
  }))
  const { error } = await supabase.from('tenant_modules').upsert(rows, { onConflict: 'tenant_id,module_code' })
  if (error) throw new ModuleError('MODULES_SAVE_FAILED', 500)
}

export async function requireTenantModule(code: ToggleableModuleCode): Promise<void> {
  const enabled = await getEnabledTenantModules()
  if (!enabled.includes(code)) throw new ModuleError('MODULE_NOT_ACTIVE', 404)
}

export function moduleErrorResponse(error: unknown): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof ModuleError) return NextResponse.json({ error: error.code }, { status: error.status })
  return NextResponse.json({ error: 'MODULE_OPERATION_FAILED' }, { status: 500 })
}
