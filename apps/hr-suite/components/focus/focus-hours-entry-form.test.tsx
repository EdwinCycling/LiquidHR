// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ActualWorkEmployeeProjection } from '@/lib/actual-work/actual-work-service'
import { FocusHoursEntryForm, focusHoursErrorMessage, type FocusHoursEntryLabels } from './focus-hours-entry-form'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const labels: FocusHoursEntryLabels = {
  title: 'Uren toevoegen', editTitle: 'Uren corrigeren', existingTitle: 'Mijn geregistreerde uren', edit: 'Corrigeren', cancel: 'Annuleren',
  type: 'Type uren', selectType: 'Kies een type', searchTypes: 'Zoek type', date: 'Datum', hours: 'uur', hoursPlaceholder: 'bijv. 7,5', note: 'Notitie', correctionReason: 'Reden voor correctie',
  save: 'Uren opslaan', saveEdit: 'Correctie opslaan', saving: 'Opslaan…', saved: 'Opgeslagen.', failed: 'Mislukt.', noTypes: 'Geen typen.', errorClosedPeriod: 'Deze periode is gesloten.', errorFutureDate: 'Toekomstige uren zijn voor dit type niet toegestaan.', errorInactiveType: 'Dit urentype is niet actief.', errorLeaveOverlap: 'Deze invoer overlapt met verlof.', errorUnauthorized: 'Je mag deze uren niet wijzigen.', errorHoursInvalid: 'Vul een geldig positief aantal uren in.', errorStale: 'De registratie is intussen gewijzigd. Vernieuw de pagina en probeer opnieuw.', errorGeneric: 'De uren konden niet worden opgeslagen.', errorCommentRequired: 'Vul een notitie in voor dit urentype.',
}

const projection = {
  employment: { id: 'employment-1' },
  types: [{ id: 'type-1', name: 'Gewerkte uren', is_active: true, family: 'WORK', entry_granularity: 'DAY' }],
  entries: [{ id: 'entry-1', work_hour_type_id: 'type-1', subject_period_start: '2026-09-21', hours: 2.5, status: 'APPROVED', note: 'Eigen registratie' }],
} as unknown as ActualWorkEmployeeProjection

describe('Focus Actual Work self-service form', () => {
  it('renders an own-entry correction control alongside the create form', () => {
    const host = document.createElement('div')
    host.innerHTML = renderToStaticMarkup(<FocusHoursEntryForm employeeId="employee-1" labels={labels} projection={projection} today="2026-09-21" />)

    expect(host.textContent).toContain('Mijn geregistreerde uren')
    expect(host.textContent).toContain('2026-09-21')
    expect(host.textContent).toContain('Corrigeren')
    expect(host.querySelectorAll('button').length).toBeGreaterThanOrEqual(2)
  })

  it('maps canonical validation codes to employee-facing Dutch messages', () => {
    expect(focusHoursErrorMessage('ACTUAL_WORK_PERIOD_CLOSED', labels)).toBe('Deze periode is gesloten.')
    expect(focusHoursErrorMessage('ACTUAL_WORK_LEAVE_OVERLAP', labels)).toBe('Deze invoer overlapt met verlof.')
    expect(focusHoursErrorMessage('UNEXPECTED_CODE', labels)).toBe('De uren konden niet worden opgeslagen.')
  })
})
