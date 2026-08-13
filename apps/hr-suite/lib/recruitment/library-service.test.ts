import { describe, expect, it } from 'vitest'
import { canMutateLibraryItem, filterLibraryItems, libraryItemInputSchema, type LibraryItem } from './library-service'

const items: LibraryItem[] = [
  { id: '11111111-1111-4111-8111-111111111111', ownerType: 'SYSTEM', itemType: 'INTERVIEW_QUESTION', title: 'TEST-RECRUITMENT-Systems', isActive: true, stableCode: 'SYSTEMS' },
  { id: '22222222-2222-4222-8222-222222222222', ownerType: 'HR_GROUP', itemType: 'CRITERION', title: 'TEST-RECRUITMENT-Eigenaarschap', isActive: false, stableCode: 'OWNERSHIP' },
]

describe('guided recruitment library service', () => {
  it('valideert afzonderlijke librarytypen en bewaart de ankerstructuur voor criteria', () => {
    expect(libraryItemInputSchema.safeParse({
      itemType: 'CRITERION',
      title: 'TEST-RECRUITMENT-Eigenaarschap',
      stableCode: 'OWNERSHIP',
      content: { anchors: { 1: 'Laag', 3: 'Midden', 5: 'Hoog' } },
    }).success).toBe(true)
  })

  it('maakt systeemcontent immutable maar laat HR-eigen content wijzigen', () => {
    expect(canMutateLibraryItem(items[0], 'UPDATE')).toBe(false)
    expect(canMutateLibraryItem(items[1], 'UPDATE')).toBe(true)
    expect(canMutateLibraryItem(items[0], 'TOGGLE')).toBe(true)
  })

  it('filtert lijst-eerst op zoekterm, bron en actiefstatus', () => {
    expect(filterLibraryItems(items, { query: 'eigenaarschap', ownerType: 'HR_GROUP', isActive: false })).toEqual([items[1]])
  })
})
