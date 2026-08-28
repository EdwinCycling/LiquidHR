import { describe, expect, it } from 'vitest'
import { buildSidebarSections, normalizeSidebarMenuOrder } from './sidebar-navigation'

describe('sidebar navigation contract', () => {
  const labels = {
    daily: 'Dagelijks',
    peopleOrganization: 'Mensen & organisatie',
    hrProcesses: 'HR-processen',
    steering: 'Sturen',
    management: 'Beheer',
  }

  it('keeps the canonical section order and only applies saved order within a section', () => {
    const sections = buildSidebarSections([
      { href: '/settings', visible: true },
      { href: '/hr-calendar', visible: true },
      { href: '/employees', visible: true },
      { href: '/work', visible: true },
      { href: '/dashboard/start', visible: true },
      { href: '/insights', visible: true },
      { href: '/workforce', visible: true },
      { href: '/organization-chart', visible: true },
      { href: '/research', visible: true },
      { href: '/journeys', visible: true },
      { href: '/recruitment', visible: true },
    ], labels, ['/settings', '/employees', '/dashboard/start', '/hr-calendar', '/work'])

    expect(sections.map((section) => section.label)).toEqual(['Dagelijks', 'Mensen & organisatie', 'HR-processen', 'Sturen', 'Beheer'])
    expect(sections.map((section) => section.items.map((item) => item.href))).toEqual([
      ['/dashboard/start', '/hr-calendar', '/work'],
      ['/employees', '/organization-chart', '/workforce'],
      ['/recruitment', '/journeys', '/research'],
      ['/insights'],
      ['/settings'],
    ])
  })

  it('hides sections when all items in that section are unavailable', () => {
    const sections = buildSidebarSections([
      { href: '/dashboard/start', visible: true },
      { href: '/work', visible: false },
      { href: '/hr-calendar', visible: false },
      { href: '/employees', visible: false },
      { href: '/organization-chart', visible: false },
      { href: '/workforce', visible: false },
      { href: '/recruitment', visible: false },
      { href: '/journeys', visible: false },
      { href: '/research', visible: false },
      { href: '/insights', visible: false },
      { href: '/settings', visible: false },
    ], labels, [])

    expect(sections).toHaveLength(1)
    expect(sections[0]?.id).toBe('daily')
  })

  it('normalizes legacy order without Dashboard, product updates or stale entries', () => {
    expect(normalizeSidebarMenuOrder([
      '/dashboard', '/insights', '/product-updates', '/insights', '/not-a-route', '/settings', 42,
    ])).toEqual(['/insights', '/settings'])
    expect(normalizeSidebarMenuOrder('not-an-array')).toEqual([])
  })
})
