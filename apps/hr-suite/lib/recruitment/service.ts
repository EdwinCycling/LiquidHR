import type { AuthContext } from '@/lib/auth/permissions'
import type { ToggleableModuleCode } from '@/lib/modules/module-catalog'
import type { RecruitmentActorContext, TerminalTransitionInput } from './domain'
import { RecruitmentError } from './errors'
import type { RecruitmentRepository } from './repository'

export interface RecruitmentServiceDependencies {
  readonly repository: RecruitmentRepository
  readonly authorize: (permissions: readonly string[]) => Promise<AuthContext>
  readonly requireModule: (moduleCode: ToggleableModuleCode) => Promise<void>
}

function actor(context: AuthContext): RecruitmentActorContext {
  if (!context.hrGroupId) throw new RecruitmentError('RECRUITMENT_HR_GROUP_REQUIRED', 409)
  return { userId: context.userId, employeeId: context.employeeId, tenantId: context.tenantId, hrGroupId: context.hrGroupId, permissions: context.permissions }
}

export function createRecruitmentService(dependencies: RecruitmentServiceDependencies) {
  async function contextFor(permissions: readonly string[]): Promise<RecruitmentActorContext> {
    const context = await dependencies.authorize(permissions)
    await dependencies.requireModule('RECRUITMENT')
    return actor(context)
  }

  return {
    async getApplication(applicationId: string) {
      const context = await contextFor(['recruitment-candidate:read', 'recruitment-participation:read'])
      const application = await dependencies.repository.getApplication(context, applicationId)
      if (!application) throw new RecruitmentError('RECRUITMENT_APPLICATION_NOT_FOUND', 404)
      return application
    },
    async transitionStage(input: { readonly applicationId: string; readonly stageId: string; readonly expectedVersion: number; readonly idempotencyKey: string }) {
      await contextFor(['recruitment-candidate:write'])
      return dependencies.repository.transitionStage(input)
    },
    async transitionTerminal(input: TerminalTransitionInput) {
      await contextFor(['recruitment-candidate:write'])
      return dependencies.repository.transitionTerminal(input)
    },
    async reopen(input: { readonly applicationId: string; readonly stageId: string; readonly expectedVersion: number; readonly idempotencyKey: string }) {
      await contextFor(['recruitment-candidate:write'])
      return dependencies.repository.reopen(input)
    },
  }
}
