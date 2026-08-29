import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_START_PAGE_WINDOW_LAYOUT } from '@/lib/preferences/start-page-layout'
import type { StartPageData } from '@/lib/startpage/service'
import { StartPage } from './start-page'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

type StartPageLabels = Parameters<typeof StartPage>[0]['labels']

const labels = new Proxy({} as StartPageLabels, {
  get: (_target, property: string | symbol) => ({
    layoutLabel: 'Startpaginaweergave',
    full: 'Volledig',
    compact: 'Compact',
    documentsTitle: 'Bedrijfsdocumenten',
    drag: 'Venster slepen om de volgorde te wijzigen',
    moveDown: 'Venster omlaag verplaatsen',
    moveUp: 'Venster omhoog verplaatsen',
  }[String(property)] ?? String(property)),
})

const data: StartPageData = {
  activeAbsenceItems: [],
  activeAbsenceTotal: 0,
  administrationName: 'Administratie',
  canReadWorkforce: false,
  canReportAbsence: false,
  canSwitchScope: false,
  companyDocuments: 3,
  continuousAppraisal: null,
  employeeCount: 1,
  employeeId: 'employee-1',
  firstName: 'Edwin',
  isEmployeeOnly: false,
  isHrAdmin: false,
  isManager: false,
  journeys: [],
  journeyOnly: false,
  leaveAbsences: { today: [], tomorrow: [] },
  longTermSickCount: 0,
  nextCompanyActivity: null,
  nextHolidayInDays: 25,
  nextLeaveInDays: null,
  processWork: null,
  recurringAbsenceCount: 0,
  reminders: [],
  scope: 'company',
  teamAvailability: null,
  tenantName: 'Tenant',
  upcomingEvents: [],
  workforceLinks: [],
}

function render(viewMode: 'compact' | 'full'): string {
  return renderToStaticMarkup(createElement(StartPage, {
    data,
    dateFormat: 'DMY',
    greeting: 'Goedemiddag',
    initialPreferences: { layout: DEFAULT_START_PAGE_WINDOW_LAYOUT, viewMode },
    labels,
    locale: 'nl',
    today: '2026-08-29',
    timeFormat: '24H',
  }))
}

describe('StartPage view modes', () => {
  it('keeps widgets in compact mode while hiding reorder controls', () => {
    const markup = render('compact')

    expect(markup).toContain('Bedrijfsdocumenten')
    expect(markup).toContain('3')
    expect(markup).not.toContain('Venster slepen om de volgorde te wijzigen')
    expect(markup).not.toContain('Venster omhoog verplaatsen')
    expect(markup).not.toContain('Venster omlaag verplaatsen')
  })

  it('keeps widgets and reorder controls in expanded mode', () => {
    const markup = render('full')

    expect(markup).toContain('Bedrijfsdocumenten')
    expect(markup).toContain('Venster slepen om de volgorde te wijzigen')
    expect(markup).toContain('Venster omhoog verplaatsen')
    expect(markup).toContain('Venster omlaag verplaatsen')
  })

  it('keeps date-dependent markup stable when the client clock changes', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-08-29T23:59:59Z'))
      const serverMarkup = render('full')

      vi.setSystemTime(new Date('2026-08-30T00:00:01Z'))
      const clientMarkup = render('full')

      expect(clientMarkup).toBe(serverMarkup)
      expect(clientMarkup).toContain('zaterdag 29 augustus 2026')
    } finally {
      vi.useRealTimers()
    }
  })
})
