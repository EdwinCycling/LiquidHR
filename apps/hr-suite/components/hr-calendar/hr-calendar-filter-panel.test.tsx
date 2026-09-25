// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HrCalendarFilterPanel } from './hr-calendar-filter-panel'

const { routerReplace } = vi.hoisted(() => ({ routerReplace: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: routerReplace }) }))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function mount(element: ReactNode): { host: HTMLDivElement; root: Root } {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(element))
  return { host, root }
}

afterEach(() => {
  routerReplace.mockReset()
  vi.unstubAllGlobals()
})

describe('HrCalendarFilterPanel', () => {
  it('starts with filters collapsed and toggles them without saving a preference', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { host, root } = mount(
      <HrCalendarFilterPanel
        actions={[{ id: 'today', label: 'Vandaag', href: '/hr-calendar?month=2026-09' }]}
        departments={[]}
        employees={[]}
        jobGroups={[]}
        jobs={[]}
        labels={{
          actions: 'Acties',
          filters: 'Filters',
          month: 'Maand',
          showFilters: 'Filters en weergave tonen',
          hideFilters: 'Filters en weergave verbergen',
          search: 'Zoeken',
          searchPlaceholder: 'Zoek persoon…',
          department: 'Afdeling',
          employee: 'Medewerker',
          all: 'Alle',
          dataToShow: 'Gegevens tonen',
          activeFilters: 'Actieve filters',
          weekNumbers: 'Weeknummers tonen',
          weekNumbersHint: 'Weeknummers in de kalender tonen.',
          dayOccupancy: 'Dagbezetting tonen',
          dayOccupancyHint: 'De bezetting per dag tonen.',
          weekendHoliday: 'Weekenden en feestdagen tonen',
          weekendHolidayHint: 'Weekenden en feestdagen tonen.',
          reminders: 'Persoonsreminders tonen',
          remindersHint: 'Persoonsreminders tonen.',
          scheduledHours: 'Roosteruren per dag tonen',
          scheduledHoursHint: 'Roosteruren per dag tonen.',
          leave: 'Verlof tonen',
          leaveHint: 'Verlof tonen.',
          absence: 'Verzuim tonen',
          absenceHint: 'Verzuim tonen.',
          notAvailableYet: 'Nog niet beschikbaar',
          jobGroup: 'Functiegroep',
          job: 'Functie',
        }}
        month="2026-09"
        query={{
          q: '',
          showWeekendsAndHolidays: true,
          showReminders: true,
          showScheduledHours: true,
          showWeekNumbers: false,
          showDayOccupancy: false,
        }}
      />,
    )

    const filterButton = host.querySelector('button[aria-label="Filters en weergave tonen"]') as HTMLButtonElement
    expect(filterButton.getAttribute('aria-expanded')).toBe('false')
    expect(host.querySelector('input[aria-label="Zoeken"]')).toBeNull()

    act(() => filterButton.click())

    expect(host.querySelector('button[aria-label="Filters en weergave verbergen"]')?.getAttribute('aria-expanded')).toBe('true')
    expect(host.querySelector('input[aria-label="Zoeken"]')).not.toBeNull()
    expect(host.textContent).not.toContain('Tijdlijngebeurtenissen')
    expect(host.textContent).not.toContain('Filter op vandaag')
    expect(fetchMock).not.toHaveBeenCalled()

    act(() => root.unmount())
    host.remove()
  })
})
