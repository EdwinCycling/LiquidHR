// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { FocusHoursOverview, FocusProfileProjection } from '@/lib/focus/section-service'
import { FocusHoursView, FocusLeaveView, FocusProfileView } from './focus-section-views'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const profile: FocusProfileProjection = {
  employeeId: 'employee-1',
  firstName: 'Noah',
  updatedAt: '2026-09-20T10:00:00.000Z',
  canEdit: true,
  canEditRelations: true,
  name: 'Noah Hendriks',
  avatarUrl: null,
  editable: { title: null, initials: null, firstName: 'Noah', birthNamePrefix: null, birthName: 'Hendriks', partnerNamePrefix: null, partnerName: null, nameUsage: 'BIRTH_NAME', privateEmail: 'noah@example.invalid', privatePhone: null, privateMobile: null },
  personal: [{ key: 'language', value: 'nl-NL' }],
  contact: [{ key: 'privateEmail', value: 'noah@example.invalid', href: 'mailto:noah@example.invalid' }],
  relations: [],
  relationTypes: [{ code: 'PARTNER', nameNl: 'Partner', nameEn: 'Partner' }],
  address: ['Voorbeeldstraat 1', '1000 AA Amsterdam'],
  work: [{ key: 'jobTitle', value: 'Test manager' }],
  bank: { iban: '•••• 1234', bic: 'TESTNL2A', holder: 'Noah Hendriks' },
}

const labels = {
  personal: 'Persoonlijk', contact: 'Contact', relations: 'Relaties', address: 'Adres', work: 'Werk', bank: 'Bankrekening', empty: 'Geen gegevens beschikbaar.',
  language: 'Voorkeurstaal', workEmail: 'Werk-e-mail', workPhone: 'Werktelefoon', privateEmail: 'Privé-e-mail', privatePhone: 'Privételefoon', privateMobile: 'Privémobiel', jobTitle: 'Functie', department: 'Afdeling', startDate: 'Startdatum', hoursPerWeek: 'Uren per week', hoursUnit: 'uur', noAddress: 'Geen adres beschikbaar.', noRelations: 'Geen relaties vastgelegd.', noBank: 'Geen bankrekening beschikbaar.', masked: 'IBAN', bic: 'BIC', accountHolder: 'Rekeninghouder', editTitle: 'Persoonsgegevens aanpassen', edit: 'Bewerken', nameSection: 'Naamgegevens', contactSection: 'Privécontact', title: 'Titel', initials: 'Initialen', firstName: 'Voornaam', birthNamePrefix: 'Tussenvoegsel geboortenaam', birthName: 'Geboortenaam', partnerNamePrefix: 'Tussenvoegsel partnernaam', partnerName: 'Partnernaam', nameUsage: 'Naamgebruik', nameUsageBirth: 'Geboortenaam', nameUsagePartner: 'Partnernaam', nameUsagePartnerBirth: 'Partnernaam vóór geboortenaam', nameUsageBirthPartner: 'Geboortenaam vóór partnernaam', cancel: 'Annuleren', close: 'Sluiten', discardTitle: 'Wijzigingen verwerpen?', discardDescription: 'Je hebt niet-opgeslagen wijzigingen.', discardConfirm: 'Verwerpen', discardCancel: 'Verder bewerken', save: 'Opslaan', saving: 'Opslaan…', saved: 'Opgeslagen.', failed: 'Opslaan is niet gelukt.', relationAdd: 'Relatie toevoegen', relationEdit: 'Relatie wijzigen', relationEditTitle: 'Relatie wijzigen', relationAddTitle: 'Relatie toevoegen', relationType: 'Relatietype', relationFirstName: 'Voornaam', relationInitials: 'Initialen', relationPrefix: 'Tussenvoegsel', relationLastName: 'Achternaam', relationGender: 'Geslacht', relationGenderMale: 'Man', relationGenderFemale: 'Vrouw', relationGenderOther: 'Anders', relationGenderUndisclosed: 'Wil ik niet zeggen', relationBirthDate: 'Geboortedatum', relationPhone: 'Telefoon', relationMobile: 'Mobiel', relationEmail: 'E-mail', relationNotes: 'Notities', relationEmergencyContact: 'Noodcontact', relationSave: 'Relatie opslaan', relationDelete: 'Verwijderen', relationDeleteTitle: 'Relatie verwijderen?', relationDeleteDescription: 'De relatie wordt verwijderd.', relationDeleteConfirm: 'Verwijderen', relationTypeSearch: 'Zoek relatietype', relationGenderSearch: 'Zoek geslacht',
}

describe('Focus profile', () => {
  it('offers a complete name and private-contact editor while protected data stays read-only until opened', () => {
    const host = document.createElement('div')
    host.innerHTML = renderToStaticMarkup(<FocusProfileView labels={labels} locale="nl" profile={profile} />)

    expect(host.textContent).toContain('Bewerken')
    expect(host.querySelector('input[name="firstName"]')).toBeNull()
    expect(host.textContent).toContain('•••• 1234')
    expect(host.textContent).toContain('Voorbeeldstraat 1')
    expect(host.textContent).not.toContain('{')
  })

  it('does not render a self-edit control for an act-as or read-only projection', () => {
    const host = document.createElement('div')
    host.innerHTML = renderToStaticMarkup(<FocusProfileView labels={labels} locale="nl" profile={{ ...profile, canEdit: false, canEditRelations: false }} />)

    expect(host.querySelector('input[name="firstName"]')).toBeNull()
  })
})

describe('Focus leave overview', () => {
  it('shows the total current hours instead of the number of leave types', () => {
    const host = document.createElement('div')
    host.innerHTML = renderToStaticMarkup(<FocusLeaveView labels={{ balance: 'Je verlofsaldo', total: 'Totaal', upcoming: 'Gepland en aangevraagd', request: 'Verlof aanvragen', noBalance: 'Geen saldo', noUpcoming: 'Geen aanvragen', hours: 'uur', status: {} }} overview={{ employmentId: 'employment-1', balances: [{ id: 'above', name: 'Boven wettelijk', hours: 40, unlimited: false }, { id: 'statutory', name: 'Wettelijk verlof', hours: 160, unlimited: false }, { id: 'other', name: 'Overig', hours: 0, unlimited: false }, { id: 'unused', name: 'Niet gebruikt', hours: 0, unlimited: false }], upcoming: [] }} requestHref="/focus/verlof?request=1" />)

    expect(host.textContent).toContain('Totaal: 200 uur')
    expect(host.textContent).not.toContain('Totaal: 4')
  })

  it('renders the reusable team calendar collapsed and only shows future days', () => {
    const host = document.createElement('div')
    host.innerHTML = renderToStaticMarkup(<FocusLeaveView labels={{ balance: 'Je verlofsaldo', total: 'Totaal', upcoming: 'Gepland en aangevraagd', request: 'Verlof aanvragen', noBalance: 'Geen saldo', noUpcoming: 'Geen aanvragen', hours: 'uur', status: {} }} overview={{ employmentId: 'employment-1', balances: [], upcoming: [] }} requestHref="/focus/verlof?request=1" teamCalendar={{ title: 'Mijn team', description: 'Bekijk wanneer je collega’s afwezig zijn.', today: '2026-09-23', calendar: { month: '2026-09', dates: ['2026-09-22', '2026-09-23', '2026-09-24'], selectedDate: '2026-09-23', members: [{ employeeId: 'employee-1', employeeName: 'Noah Hendriks', avatarUrl: null, employmentId: 'employment-1', activeAbsenceCaseId: null, cells: [{ date: '2026-09-22', status: 'PRESENT', scheduledMinutes: 480 }, { date: '2026-09-23', status: 'ABSENT', scheduledMinutes: 480 }, { date: '2026-09-24', status: 'PRESENT', scheduledMinutes: 480 }] }], viewerMode: 'EMPLOYEE', canReportAbsence: false, canRecoverAbsence: false, canActAs: true }, labels: { month: 'Maand', previous: 'Vorige maand', next: 'Volgende maand', today: 'Vandaag', employee: 'Collega', status: 'Status', present: 'Aanwezig', absent: 'Afwezig', available: 'Aanwezig', off: 'Niet ingepland', leave: 'Verlof', hours: 'uur', selectedDay: 'Gekozen dag', reportAbsence: 'Ziek melden', reportRecovery: 'Hersteld melden', actAs: 'Handelen als', acting: 'Focus openen…' } }} />)

    const disclosure = host.querySelector('details')
    expect(disclosure).not.toBeNull()
    expect(disclosure?.hasAttribute('open')).toBe(false)
    expect(host.textContent).toContain('Mijn team')
    expect(host.textContent).toContain('Maand: september 2026')
    expect(Array.from(host.querySelectorAll('thead th')).map((cell) => cell.textContent?.trim())).toEqual(['Collega', 'wo 23 sep', 'do 24 sep'])
    expect(host.querySelector('table')?.className).toContain('min-w-max')
    expect(host.querySelector('thead th:nth-child(2)')?.className).toContain('min-w-28')
    expect(host.querySelector('tbody td')?.className).toContain('min-w-28')
    expect(host.querySelector('tbody td span')?.className).toContain('whitespace-nowrap')
    expect(host.textContent).toContain('Afwezig')
    expect(host.textContent).not.toContain('Handelen als')
  })
})

describe('Focus hours overview', () => {
  it('shows a chronological own-entry list, correction state and the primary add action', () => {
    const overview: FocusHoursOverview = {
      employeeName: 'Noah Hendriks',
      employmentId: 'employment-1',
      days: [],
      canEdit: true,
      entries: [
        { id: 'entry-2', date: '2026-09-22', type: 'Gewerkte uren', hours: 7.5, status: 'APPROVED', corrected: true },
        { id: 'entry-1', date: '2026-09-21', type: 'Gewerkte uren', hours: 8, status: 'APPROVED', corrected: false },
      ],
      projection: null,
    }
    const host = document.createElement('div')
    host.innerHTML = renderToStaticMarkup(<FocusHoursView editHref="/focus/uren?edit=1" labels={{ expected: 'Verwacht', recorded: 'Geregistreerd', actionNeeded: 'Actie nodig', noAction: 'Bijgewerkt', fill: 'Uren toevoegen', noData: 'Geen weekgegevens', hours: 'uur', entries: 'Mijn geregistreerde uren', noEntries: 'Geen geregistreerde uren.', date: 'Datum', type: 'Type uren', status: 'Status', correction: 'Correctie', statusLabels: { APPROVED: 'Goedgekeurd' } }} overview={overview} locale="nl-NL" />)

    expect(host.textContent).toContain('Uren toevoegen')
    expect(host.textContent).toContain('Mijn geregistreerde uren')
    expect(host.textContent).toContain('22-09-2026')
    expect(host.textContent).toContain('Correctie')
    expect(host.textContent).toContain('Goedgekeurd')
    expect(host.textContent).toContain('7,5')
  })
})
