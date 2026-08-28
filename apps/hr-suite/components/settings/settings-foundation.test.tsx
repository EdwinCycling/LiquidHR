import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { CompanyDataManager } from './company-data-manager'
import { EmployeeDirectorySettingsForm } from './employee-directory-settings-form'
import { MenuOrderForm } from './menu-order-form'
import { ModuleSettingsForm } from './module-settings-form'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const companyLabels = {
  companySection: 'Bedrijfsadres', companySectionDescription: 'Hoofdadres.', locationsSection: 'Locaties', locationsSectionDescription: 'Locaties.', addressSearchHint: 'Zoek.', saveHint: 'Opslaan.', singleLocation: 'Een locatie', singleLocationDescription: 'Beschrijving.', singleLocationDisabled: 'Uitgeschakeld.', save: 'Opslaan', saving: 'Opslaan…', saved: 'Opgeslagen', ready: 'Klaar', failed: 'Mislukt', addLocation: 'Locatie toevoegen', editLocation: 'Locatie wijzigen', locationName: 'Naam', locationActive: 'Actief', active: 'Actief', inactive: 'Inactief', emptyLocations: 'Geen locaties', deleteLocation: 'Verwijderen', deleteConfirm: 'Zeker?', locationInUse: 'In gebruik', close: 'Sluiten', cancel: 'Annuleren', discardTitle: 'Wijzigingen negeren?', discardDescription: 'Niet-opgeslagen wijzigingen gaan verloren.', discardChanges: 'Wijzigingen negeren', keepEditing: 'Verder bewerken', country: 'Land', countrySearch: 'Zoek land', countryEmpty: 'Geen land', addressSearch: 'Adres zoeken', addressSearchPlaceholder: 'Zoek adres', manualEntry: 'Handmatig', searchNoResults: 'Geen resultaten', searchUnavailable: 'Niet beschikbaar', searchLoading: 'Laden', lookupByPostalCode: 'Postcode', lookup: 'Aanvullen', lookupHint: 'Hint', lookupUnavailable: 'Mislukt', addressLine1: 'Adresregel 1', addressLine2: 'Adresregel 2', street: 'Straat', houseNumber: 'Huisnummer', addition: 'Toevoeging', postalCode: 'Postcode', city: 'Plaats', region: 'Regio', addressHelp: 'Hulp', genericError: 'Fout', companyHasLocations: 'Locaties bestaan', singleLocationError: 'Een locatie',
}

describe('R7-1 settings Foundation convergence', () => {
  it('uses the canonical switch for tenant module activation', () => {
    const markup = renderToStaticMarkup(<ModuleSettingsForm labels={{ save: 'Opslaan', cancel: 'Annuleren', saving: 'Opslaan…', saved: 'Opgeslagen', failed: 'Mislukt', comingSoon: 'Binnenkort', names: { HERA: 'HeRa' }, descriptions: { HERA: 'Assistent' } }} modules={[{ code: 'HERA', status: 'AVAILABLE', toggleable: true, state: { is_enabled: true } }]} />)
    expect(markup).toContain('role="switch"')
    expect(markup).toContain('Annuleren')
    expect(markup).not.toContain('aria-pressed')
  })

  it('keeps menu ordering local while exposing Foundation action controls', () => {
    const markup = renderToStaticMarkup(<MenuOrderForm cancelLabel="Annuleren" sections={[{ id: 'daily', label: 'Dagelijks', items: [{ href: '/dashboard/start', label: 'Startpagina' }] }, { id: 'people', label: 'Mensen', items: [{ href: '/employees', label: 'Medewerkers' }] }]} moveDownLabel="omlaag" moveUpLabel="omhoog" saveLabel="Opslaan" savedLabel="Opgeslagen" />)
    expect(markup).toContain('Startpagina omhoog')
    expect(markup).toContain('Medewerkers omlaag')
    expect(markup).toContain('Annuleren')
  })

  it('uses switches and checkboxes for directory settings', () => {
    const directory = renderToStaticMarkup(<EmployeeDirectorySettingsForm initial={{ enabled: true, showName: true, showJobDepartment: true, showWorkEmail: true, showWorkPhone: true, showPresence: false, showSchedule: true }} labels={{ enabled: 'Openen', enabledDescription: 'Beschrijving', fieldsTitle: 'Velden', fieldsDescription: 'Beschrijving', name: 'Naam', nameAlwaysOn: 'altijd', jobDepartment: 'Functie', workEmail: 'E-mail', workPhone: 'Telefoon', presence: 'Aanwezigheid', schedule: 'Rooster', save: 'Opslaan', cancel: 'Annuleren', saving: 'Opslaan…', saved: 'Opgeslagen', failed: 'Mislukt' }} />)
    expect(directory).toContain('role="switch"')
  })

  it('renders company data tabs and modal actions through Foundation contracts', () => {
    const markup = renderToStaticMarkup(<CompanyDataManager initial={{ company: { id: 'company-1', singleLocation: false, addressLine1: '', addressLine2: '', street: '', houseNumber: '', houseNumberAddition: '', postalCode: '', city: '', region: '', countryCode: 'NL' }, locations: [] }} labels={companyLabels} />)
    expect(markup).toContain('role="tab"')
    expect(markup).toContain('type="submit"')
    expect(markup).not.toContain('window.confirm')
  })
})
