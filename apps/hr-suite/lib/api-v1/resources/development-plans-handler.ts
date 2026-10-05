import 'server-only'

import {
  createProtectedApiGetHandler,
  type ProtectedApiGetDependencies,
} from '@/lib/api-v1/core/protected-get'
import { readSelfDevelopmentPlans } from './development-plans'
import { selfDevelopmentPlansProjectionSchema } from './projections'

/**
 * Composes the first APIAI-01 resource with the shared bearer, AuthContext,
 * permission, limiter, audit, projection, and no-store response guards.
 * This returns a handler only; it does not mount a Next.js route.
 */
export function createSelfDevelopmentPlansApiHandler(
  dependencies: ProtectedApiGetDependencies,
): (request: Request) => Promise<Response> {
  return createProtectedApiGetHandler({
    resource: 'development-plans',
    requiredApiScopes: ['development-plans.self.read'],
    requiredLiquidHrPermission: 'self:talent-goal:read',
    selfOnly: true,
    read: (scope) => readSelfDevelopmentPlans({
      authContext: scope.authContext,
      rls: scope.rls,
    }),
    project: (plans) => plans,
    responseSchema: selfDevelopmentPlansProjectionSchema,
  }, dependencies)
}
