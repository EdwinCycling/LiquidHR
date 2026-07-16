import type { AuthContext } from '@/lib/auth/permissions'
import { createPersonalReminder } from '@/lib/reminders/reminder-service'
import { reminderDraftSchema } from './schemas'

type DraftStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED' | 'EXECUTED' | 'FAILED'

interface StoredDraft {
  id: string
  status: DraftStatus
  expiresAt: string
  payload: unknown
}

export interface SaveMemoryInput {
  content: string
  category: 'PREFERENCE' | 'WORKING_CONTEXT'
  sourceConversationId?: string
  explicitConsent: boolean
}

export interface HeRaServiceDependencies {
  saveMemoryItem?: (input: { tenantId: string; userId: string; content: string; category: 'PREFERENCE' | 'WORKING_CONTEXT'; sourceConversationId?: string }) => Promise<{ id: string }>
  claimDraft?: (context: AuthContext, draftId: string) => Promise<StoredDraft | null>
  markDraftExecuted?: (context: AuthContext, draftId: string) => Promise<void>
  createPersonalReminder?: (input: { title: string; description?: string; remindAt: string }) => Promise<string>
}

export class HeRaServiceError extends Error {
  constructor(readonly code: 'DRAFT_NOT_CONFIRMABLE' | 'HERA_SERVICE_NOT_CONFIGURED') {
    super(code)
  }
}

function notConfigured(): never {
  throw new HeRaServiceError('HERA_SERVICE_NOT_CONFIGURED')
}

export function createHeRaService(dependencies: HeRaServiceDependencies = {}) {
  return {
    async saveMemory(context: AuthContext, input: SaveMemoryInput): Promise<{ id: string } | null> {
      if (!input.explicitConsent) return null
      const saveMemoryItem = dependencies.saveMemoryItem ?? notConfigured
      return saveMemoryItem({
        tenantId: context.tenantId,
        userId: context.userId,
        content: input.content,
        category: input.category,
        sourceConversationId: input.sourceConversationId,
      })
    },

    async confirmDraft(context: AuthContext, draftId: string): Promise<{ reminderId: string }> {
      const claimDraft = dependencies.claimDraft ?? notConfigured
      const draft = await claimDraft(context, draftId)
      if (!draft || draft.status !== 'CONFIRMED' || new Date(draft.expiresAt).getTime() <= Date.now()) {
        throw new HeRaServiceError('DRAFT_NOT_CONFIRMABLE')
      }

      const payload = reminderDraftSchema.safeParse(draft.payload)
      if (!payload.success) throw new HeRaServiceError('DRAFT_NOT_CONFIRMABLE')

      const reminderId = await (dependencies.createPersonalReminder ?? createPersonalReminder)(payload.data)
      const markDraftExecuted = dependencies.markDraftExecuted ?? notConfigured
      await markDraftExecuted(context, draft.id)
      return { reminderId }
    },
  }
}
