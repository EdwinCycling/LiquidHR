import { z } from 'zod'
import type { LibraryItemType } from './library-service'

export const setItemTypeSchema = z.enum(['INTERVIEW_QUESTION', 'CRITERION', 'PREPARATION'])

export function validateSetItems(itemTypes: readonly LibraryItemType[]): boolean {
  return itemTypes.length > 0 && itemTypes.every((itemType) => setItemTypeSchema.safeParse(itemType).success)
}

interface SetItemInput {
  readonly itemType: z.infer<typeof setItemTypeSchema>
  readonly title: string
  readonly content: Record<string, unknown>
}

export function buildSetSnapshot(items: readonly SetItemInput[]): {
  readonly interviewQuestions: readonly SetItemInput[]
  readonly criteria: readonly SetItemInput[]
  readonly preparation: readonly SetItemInput[]
} {
  return {
    interviewQuestions: items.filter((item) => item.itemType === 'INTERVIEW_QUESTION'),
    criteria: items.filter((item) => item.itemType === 'CRITERION'),
    preparation: items.filter((item) => item.itemType === 'PREPARATION'),
  }
}
