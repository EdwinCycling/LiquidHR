export type SidebarSectionId = 'daily' | 'peopleOrganization' | 'hrProcesses' | 'steering' | 'management'

export const SIDEBAR_SECTION_DEFINITIONS: readonly { id: SidebarSectionId; hrefs: readonly string[] }[] = [
  { id: 'daily', hrefs: ['/dashboard/start', '/work', '/hr-calendar'] },
  { id: 'peopleOrganization', hrefs: ['/employees', '/organization-chart', '/workforce'] },
  { id: 'hrProcesses', hrefs: ['/recruitment', '/journeys', '/research'] },
  { id: 'steering', hrefs: ['/insights'] },
  { id: 'management', hrefs: ['/settings', '/document-studio'] },
]

export const SIDEBAR_MENU_HREFS = SIDEBAR_SECTION_DEFINITIONS.flatMap((section) => section.hrefs)

export function normalizeSidebarMenuOrder(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const allowed = new Set(SIDEBAR_MENU_HREFS)
  const seen = new Set<string>()
  return value.filter((entry): entry is string => {
    if (typeof entry !== 'string' || !allowed.has(entry) || seen.has(entry)) return false
    seen.add(entry)
    return true
  })
}

export function sortSidebarItems<T extends { href: string }>(items: readonly T[], savedOrder: readonly string[]): T[] {
  const savedIndex = new Map(savedOrder.map((href, index) => [href, index]))
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftRank = savedIndex.get(left.item.href) ?? savedOrder.length + left.index
      const rightRank = savedIndex.get(right.item.href) ?? savedOrder.length + right.index
      return leftRank - rightRank
    })
    .map(({ item }) => item)
}

export function buildSidebarSections<T extends { href: string; visible: boolean }>(
  items: readonly T[],
  labels: Record<SidebarSectionId, string>,
  savedOrder: readonly string[],
): Array<{ id: SidebarSectionId; label: string; items: T[] }> {
  return SIDEBAR_SECTION_DEFINITIONS.flatMap((definition) => {
    const sectionItems = sortSidebarItems(
      definition.hrefs.flatMap((href) => {
        const item = items.find((candidate) => candidate.visible && candidate.href === href)
        return item ? [item] : []
      }),
      savedOrder,
    )
    return sectionItems.length > 0 ? [{ id: definition.id, label: labels[definition.id], items: sectionItems }] : []
  })
}
