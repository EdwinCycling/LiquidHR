// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { FocusProfileProjection } from '@/lib/focus/section-service'
import { FocusProfileView } from './focus-section-views'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const profile: FocusProfileProjection = {
  employeeId: 'employee-1',
  firstName: 'Noah',
  updatedAt: '2026-09-20T10:00:00.000Z',
  canEdit: true,
  name: 'Noah Hendriks',
  avatarUrl: null,
  personal: [{ key: 'language', value: 'nl-NL' }],
  contact: [{ key: 'privateEmail', value: 'noah@example.invalid', href: 'mailto:noah@example.invalid' }],
  relations: [],
  address: ['Voorbeeldstraat 1', '1000 AA Amsterdam'],
  work: [{ key: 'jobTitle', value: 'Test manager' }],
  bank: { iban: '•••• 1234', bic: 'TESTNL2A', holder: 'Noah Hendriks' },
}

const labels = {
  personal: 'Persoonlijk', contact: 'Contact', relations: 'Relaties', address: 'Adres', work: 'Werk', bank: 'Bankrekening', empty: 'Geen gegevens beschikbaar.',
  language: 'Voorkeurstaal', workEmail: 'Werk-e-mail', workPhone: 'Werktelefoon', privateEmail: 'Privé-e-mail', privatePhone: 'Privételefoon', jobTitle: 'Functie', department: 'Afdeling', startDate: 'Startdatum', hoursPerWeek: 'Uren per week', hoursUnit: 'uur', noAddress: 'Geen adres beschikbaar.', noRelations: 'Geen relaties vastgelegd.', noBank: 'Geen bankrekening beschikbaar.', masked: 'IBAN', bic: 'BIC', accountHolder: 'Rekeninghouder', editTitle: 'Persoonsgegevens aanpassen', firstName: 'Voornaam', save: 'Opslaan', saving: 'Opslaan…', saved: 'Opgeslagen.', failed: 'Opslaan is niet gelukt.',
}

describe('Focus profile', () => {
  it('offers only the policy-approved first-name editor while protected data stays read-only', () => {
    const host = document.createElement('div')
    host.innerHTML = renderToStaticMarkup(<FocusProfileView labels={labels} profile={profile} />)

    expect(host.querySelector('input[name="firstName"]')?.getAttribute('value')).toBe('Noah')
    expect(host.querySelectorAll('input, textarea, select')).toHaveLength(1)
    expect(host.textContent).toContain('•••• 1234')
    expect(host.textContent).toContain('Voorbeeldstraat 1')
    expect(host.textContent).not.toContain('{')
  })

  it('does not render a self-edit control for an act-as or read-only projection', () => {
    const host = document.createElement('div')
    host.innerHTML = renderToStaticMarkup(<FocusProfileView labels={labels} profile={{ ...profile, canEdit: false }} />)

    expect(host.querySelector('input[name="firstName"]')).toBeNull()
  })
})
