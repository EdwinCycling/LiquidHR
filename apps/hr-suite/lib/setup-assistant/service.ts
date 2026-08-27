import 'server-only'

import type { Database } from '@scope/db'
import { NextResponse } from 'next/server'
import { AuthorizationError, getRequestAuthorizationContext, permissionErrorResponse, requireHrGroupId, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { canOpenSetupAssistantRoute, SETUP_ASSISTANT_GUIDE_CODE, getVisibleSetupAssistantSteps } from './guide'
import { getSetupAssistantSuggestions } from './suggestions'
import type { SetupAssistantState } from './types'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>
type SetupDependencies = { auth: AuthContext; supabase: SupabaseServerClient }

export type { SetupAssistantState }

export class SetupAssistantError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code)
    this.name = 'SetupAssistantError'
  }
}

export function canUseSetupAssistant(auth: Pick<AuthContext, 'activeRoles' | 'permissions'>): boolean {
  return auth.activeRoles.includes('TENANT_ADMIN') && auth.permissions.includes('settings:read')
}

function assertSetupReadAccess(auth: AuthContext): void {
  if (!canUseSetupAssistant(auth)) {
    throw new AuthorizationError('Je hebt geen toegang tot de Setup Assistent.')
  }
}

function assertSetupWriteAccess(auth: AuthContext): void {
  assertSetupReadAccess(auth)
  if (!auth.permissions.includes('settings:write')) {
    throw new AuthorizationError('Je hebt geen schrijfrecht voor de Setup Assistent.')
  }
}

async function resolveDependencies(
  dependencies: SetupDependencies | undefined,
  operation: 'read' | 'write',
): Promise<SetupDependencies> {
  if (dependencies) {
    if (operation === 'read') assertSetupReadAccess(dependencies.auth)
    else assertSetupWriteAccess(dependencies.auth)
    return dependencies
  }

  const auth = operation === 'read'
    ? await requirePermission('settings:read')
    : await requirePermission('settings:write')
  const { supabase } = await getRequestAuthorizationContext()
  if (operation === 'read') assertSetupReadAccess(auth)
  else assertSetupWriteAccess(auth)
  return { auth, supabase }
}

export async function getSetupAssistantState(dependencies?: SetupDependencies): Promise<SetupAssistantState> {
  const { auth, supabase } = await resolveDependencies(dependencies, 'read')
  const hrGroupId = requireHrGroupId(auth)
  const [{ data: setting, error: settingError }, { data: completions, error: completionError }] = await Promise.all([
    supabase
      .from('setup_guide_settings')
      .select('is_enabled')
      .eq('tenant_id', auth.tenantId)
      .eq('hr_group_id', hrGroupId)
      .eq('guide_code', SETUP_ASSISTANT_GUIDE_CODE)
      .maybeSingle(),
    supabase
      .from('setup_step_completion')
      .select('step_key,is_completed')
      .eq('tenant_id', auth.tenantId)
      .eq('hr_group_id', hrGroupId)
      .eq('guide_code', SETUP_ASSISTANT_GUIDE_CODE)
      .limit(500),
  ])

  if (settingError || completionError) throw new SetupAssistantError('SETUP_ASSISTANT_READ_FAILED', 500)

  const visibleSteps = getVisibleSetupAssistantSteps(auth)
  const suggestions = setting?.is_enabled
    ? await getSetupAssistantSuggestions({ auth, supabase, visibleSteps })
    : []
  return {
    guideCode: SETUP_ASSISTANT_GUIDE_CODE,
    isEnabled: setting?.is_enabled ?? false,
    canWrite: auth.permissions.includes('settings:write'),
    visibleStepKeys: visibleSteps.map((step) => step.stepKey),
    availableRelatedRouteKeys: visibleSteps
      .filter((step) => step.relatedRoute && canOpenSetupAssistantRoute(step.relatedRoute, auth))
      .map((step) => step.stepKey),
    completedStepKeys: (completions ?? [])
      .filter((completion) => completion.is_completed)
      .map((completion) => completion.step_key),
    suggestions,
  }
}

export async function setSetupAssistantEnabled(
  isEnabled: boolean,
  dependencies?: SetupDependencies,
): Promise<void> {
  const { auth, supabase } = await resolveDependencies(dependencies, 'write')
  const hrGroupId = requireHrGroupId(auth)
  const payload: Database['public']['Tables']['setup_guide_settings']['Insert'] = {
    tenant_id: auth.tenantId,
    hr_group_id: hrGroupId,
    guide_code: SETUP_ASSISTANT_GUIDE_CODE,
    is_enabled: isEnabled,
    created_by: auth.userId,
    updated_by: auth.userId,
  }
  const { error } = await supabase
    .from('setup_guide_settings')
    .upsert(payload, { onConflict: 'tenant_id,hr_group_id,guide_code' })
  if (error) throw new SetupAssistantError('SETUP_ASSISTANT_SAVE_FAILED', 500)
}

export async function setSetupStepCompletion(
  stepKey: string,
  isCompleted: boolean,
  dependencies?: SetupDependencies,
): Promise<void> {
  const { auth, supabase } = await resolveDependencies(dependencies, 'write')
  const hrGroupId = requireHrGroupId(auth)
  const payload: Database['public']['Tables']['setup_step_completion']['Insert'] = {
    tenant_id: auth.tenantId,
    hr_group_id: hrGroupId,
    guide_code: SETUP_ASSISTANT_GUIDE_CODE,
    step_key: stepKey,
    is_completed: isCompleted,
    completed_at: isCompleted ? new Date().toISOString() : null,
    completed_by: isCompleted ? auth.userId : null,
    updated_by: auth.userId,
  }
  const { error } = await supabase
    .from('setup_step_completion')
    .upsert(payload, { onConflict: 'tenant_id,hr_group_id,guide_code,step_key' })
  if (error) throw new SetupAssistantError('SETUP_ASSISTANT_COMPLETION_SAVE_FAILED', 500)
}

export function setupAssistantErrorResponse(error: unknown): NextResponse {
  const permissionResponse = permissionErrorResponse(error)
  if (permissionResponse) return permissionResponse
  if (error instanceof SetupAssistantError) return NextResponse.json({ error: error.code }, { status: error.status })
  return NextResponse.json({ error: 'SETUP_ASSISTANT_OPERATION_FAILED' }, { status: 500 })
}
