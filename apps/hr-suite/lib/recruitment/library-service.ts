import { z } from 'zod'

export const libraryItemTypeSchema = z.enum(['APPLICATION_QUESTION', 'INTERVIEW_QUESTION', 'CRITERION', 'PREPARATION'])
export const libraryItemInputSchema = z.object({
  itemType: libraryItemTypeSchema,
  title: z.string().trim().min(1).max(240),
  stableCode: z.string().regex(/^[A-Z][A-Z0-9_]{1,80}$/),
  content: z.record(z.string(), z.unknown()),
}).strict()

export type LibraryItemType = z.infer<typeof libraryItemTypeSchema>
export interface LibraryItem {
  readonly id: string
  readonly ownerType: 'SYSTEM' | 'HR_GROUP'
  readonly itemType: LibraryItemType
  readonly title: string
  readonly isActive: boolean
  readonly stableCode: string
  readonly content?: Record<string, unknown>
}

export function canMutateLibraryItem(item: Pick<LibraryItem, 'ownerType'>, action: 'UPDATE' | 'DELETE' | 'TOGGLE'): boolean {
  return item.ownerType === 'HR_GROUP' || action === 'TOGGLE'
}

export function filterLibraryItems(items: readonly LibraryItem[], filter: { readonly query?: string; readonly ownerType?: LibraryItem['ownerType']; readonly isActive?: boolean }): LibraryItem[] {
  const query = filter.query?.trim().toLocaleLowerCase() ?? ''
  return items.filter((item) => {
    if (filter.ownerType && item.ownerType !== filter.ownerType) return false
    if (filter.isActive !== undefined && item.isActive !== filter.isActive) return false
    if (!query) return true
    return `${item.title} ${item.stableCode} ${item.itemType}`.toLocaleLowerCase().includes(query)
  })
}
