import 'server-only'

import type { AuthContext } from '@/lib/auth/permissions'
import type { DelegatedBearerRlsClient, SupabaseBearerRlsClient } from '@/lib/api-v1/auth'
import { listSelfDevelopmentPlans } from '@/lib/talent/goal-service'
import {
  ApiResourceProjectionError,
  projectSelfDevelopmentPlans,
  type SelfDevelopmentPlanProjection,
} from './projections'

/**
 * Leest uitsluitend de ontwikkelplannen van de actuele medewerkercontext.
 *
 * `listSelfDevelopmentPlans` blijft de autorisatie- en RLS-bron. Deze adapter
 * accepteert geen employeeId, tenantId of mode van de aanroeper en controleert
 * daarna nogmaals de returned rows voordat de externe projectie wordt gemaakt.
 */
export async function readSelfDevelopmentPlans(input: {
  readonly authContext: AuthContext
  readonly rls: DelegatedBearerRlsClient<SupabaseBearerRlsClient>
}): Promise<SelfDevelopmentPlanProjection[]> {
  const context = input.authContext
  if (
    typeof context.tenantId !== 'string'
    || context.tenantId.trim().length === 0
    || typeof context.employeeId !== 'string'
    || context.employeeId.trim().length === 0
  ) {
    throw new ApiResourceProjectionError('SELF_CONTEXT_REQUIRED')
  }

  const goals = await listSelfDevelopmentPlans({
    authContext: context,
    rls: input.rls,
  })

  return projectSelfDevelopmentPlans(context, { goals })
}
