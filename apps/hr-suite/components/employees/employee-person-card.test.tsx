import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { EmployeePersonCard, EMPLOYEE_PERSONAL_TABS, type EmployeePersonCardLabels } from './employee-person-card'
import type { EmployeeDetailViewModel } from './types'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const labels = {
  tabs: { personal: 'Persoonsgegevens', addresses: 'Adressen', bankAccounts: 'Bankrekeningen', relations: 'Relaties', additionalInformation: 'Aanvullende informatie' },
  additionalInformationTitle: 'Aanvullende informatie', customFields: { title: 'Vrije velden', subtitle: 'Aanvullende gegevens', save: 'Opslaan', saving: 'Opslaan…', saved: 'Opgeslagen', failed: 'Mislukt', readOnly: 'Alleen lezen', yes: 'Ja', no: 'Nee' },
  overviewTitle: 'Identiteit', contactTitle: 'Contact', workContact: 'Zakelijk contact', privateContact: 'Privécontact', noContact: 'Niet vastgelegd', currentAddress: 'Huidig adres', noAddress: 'Geen adres', primaryBank: 'Primaire rekening', noBankAccount: 'Geen bankrekening', emergencyContacts: 'Noodcontacten', noEmergencyContact: 'Geen noodcontact', employmentCount: 'Dienstverbanden', personalTitle: 'Persoonsgegevens', previous: 'Vorige', next: 'Volgende', editPersonal: 'Wijzigen', save: 'Opslaan', saving: 'Opslaan…', saved: 'Opgeslagen', cancel: 'Annuleren', genericError: 'Er ging iets mis', employeeNumber: 'Personeelsnummer', firstName: 'Voornaam', birthNamePrefix: 'Tussenvoegsel', birthName: 'Achternaam', nameUsage: 'Naamgebruik', nameUsageBirth: 'Geboortenaam', nameUsagePartner: 'Partnernaam', nameUsagePartnerBirth: 'Partnernaam – geboortenaam', nameUsageBirthPartner: 'Geboortenaam – partnernaam', gender: 'Geslacht', genderMale: 'Man', genderFemale: 'Vrouw', genderOther: 'Anders', genderUndisclosed: 'Zeg ik liever niet', birthDate: 'Geboortedatum', birthPlace: 'Geboorteplaats', birthCountry: 'Geboorteland', nationality: 'Nationaliteit', countrySearch: 'Zoek land', countryNoResults: 'Geen land gevonden', preferredLanguage: 'Voorkeurstaal', languageSearch: 'Zoek taal', languageNoResults: 'Geen taal gevonden', privateEmail: 'Privé e-mail', privatePhone: 'Privé telefoon', privateMobile: 'Privé mobiel', workEmail: 'Zakelijk e-mail', workPhone: 'Zakelijk telefoon', workPhoneExtension: 'Toestelnummer', workMobile: 'Zakelijk mobiel', bsnTitle: 'BSN', bsnProtected: 'Beschermd', revealBsn: 'Tonen', revealingBsn: 'Bezig…', bsnNotRecorded: 'Niet vastgelegd', bsnAuditHelp: 'Elke inzage wordt gelogd', addressesTitle: 'Adressen', addressesEmpty: 'Geen adressen', primaryAddress: 'Hoofdadres', secondaryAddress: 'Tweede adres', secondaryAddressDescription: 'Omschrijving', secondaryAddressHelp: 'Help', noSecondaryAddress: 'Geen tweede adres', relocateAddress: 'Verhuizen', addAddress: 'Adres toevoegen', editResource: 'Wijzigen', deleteResource: 'Verwijderen', confirmDelete: 'Weet je het zeker?', cannotDeleteLastAddress: 'Kan niet verwijderen', directReminderTitle: 'Herinneringen', directReminderHelp: 'Help', reminderHrAdmin: 'HR', reminderManager: 'Manager', reminderEmployee: 'Medewerker', country: 'Land', addressSearch: 'Adres zoeken', addressSearchPlaceholder: 'Zoek adres', manualEntry: 'Adres handmatig invoeren', searchNoResults: 'Geen resultaten', searchUnavailable: 'Niet beschikbaar', searchLoading: 'Laden…', lookupByPostalCode: 'Zoek op postcode', lookup: 'Zoeken', lookupHint: 'Hint', lookupUnavailable: 'Niet beschikbaar', addressLine1: 'Adresregel 1', addressLine2: 'Adresregel 2', region: 'Regio', current: 'Huidig', validFrom: 'Geldig vanaf', validUntil: 'Geldig tot', clearValidUntil: 'Wissen', street: 'Straat', streetHasNumberNote: 'Opmerking', houseNumber: 'Huisnummer', addition: 'Toevoeging', postalCode: 'Postcode', city: 'Plaats', province: 'Provincie', countryCode: 'Landcode', saveAddress: 'Adres opslaan', banksTitle: 'Bankrekeningen', banksEmpty: 'Geen bankrekening', addBank: 'Bankrekening toevoegen', primary: 'Primair', iban: 'IBAN', bic: 'BIC', accountHolder: 'Rekeninghouder', description: 'Omschrijving', makePrimary: 'Primair maken', saveBank: 'Bankrekening opslaan', relationsTitle: 'Relaties', relationsEmpty: 'Geen relaties', addRelation: 'Relatie toevoegen', relationType: 'Relatie type', relationPartner: 'Partner', relationChild: 'Kind', relationParent: 'Ouder', relationSibling: 'Broer of zus', relationDoctor: 'Huisarts', relationDentist: 'Tandarts', relationOther: 'Anders', emergencyContact: 'Noodcontact', lastName: 'Achternaam', mobile: 'Mobiel', email: 'E-mail', notes: 'Notities', saveRelation: 'Relatie opslaan', notRecorded: 'Niet vastgelegd', rolesTitle: 'Rollen', rolesEmpty: 'Geen rollen', roleDepartment: 'Afdeling', roleTenantWide: 'Tenantbreed', roleValidFrom: 'Geldig vanaf', roleValidUntil: 'Geldig tot',
} satisfies EmployeePersonCardLabels

const detail: EmployeeDetailViewModel = {
  employee: { id: 'employee-1', employeeNumber: 'EMP-001', firstName: 'Ada', birthName: 'Lovelace', privateEmail: null, workEmail: null },
  employments: [], employmentCards: [], status: 'NEVER_EMPLOYED', addresses: [], bankAccounts: [], relations: [], relationTypes: [],
  currentEmploymentSummary: { asOf: '2026-08-20', employmentId: null, laborCondition: null, hoursPerWeek: null, salary: null, departmentName: null, jobTitle: null, managerName: null },
  capabilities: { canEditEmployee: false, canReadBsn: false, canWriteBsn: false, canManageAddresses: false, canManageRelations: false, canManageBankAccounts: false, canReadSalary: false },
}

describe('Employee personal tab contract', () => {
  it('keeps the five accessible subtabs in the intended order', () => {
    const markup = renderToStaticMarkup(createElement(EmployeePersonCard, { detail, labels, locale: 'nl-NL', dateFormat: 'DMY', defaultCountryCode: 'NL' }))
    expect(markup).toContain('role="tablist"')
    expect(EMPLOYEE_PERSONAL_TABS).toEqual(['personal', 'addresses', 'bankAccounts', 'relations', 'additionalInformation'])
    for (const tab of EMPLOYEE_PERSONAL_TABS) expect(markup).toContain(`id="employee-tab-${tab}"`)
    expect(markup).toContain('aria-controls="employee-panel-personal"')
  })
})
