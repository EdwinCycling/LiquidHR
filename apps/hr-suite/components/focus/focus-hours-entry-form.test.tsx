// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ActualWorkEmployeeProjection } from '@/lib/actual-work/actual-work-service'
import { FocusHoursEntryForm, type FocusHoursEntryLabels } from './focus-hours-entry-form'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const labels: FocusHoursEntryLabels = {
  title: 'Uren toevoegen', editTitle: 'Uren corrigeren', existingTitle: 'Mijn geregistreerde uren', edit: 'Corrigeren', cancel: 'Annuleren',
  type: 'Type uren', selectType: 'Kies een type', searchTypes: 'Zoek type', date: 'Datum', hours: 'uur', hoursPlaceholder: 'bijv. 7,5', note: 'Notitie', correctionReason: 'Reden voor correctie',
  save: 'Uren opslaan', saveEdit: 'Correctie opslaan', saving: 'Opslaan…', saved: 'Opgeslagen.', failed: 'Mislukt.', noTypes: 'Geen typen.',
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
})
