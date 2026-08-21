// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { EmployeeDashboardLayout } from '@/lib/preferences/employee-dashboard-layout'
import type { EmployeeDetailViewModel } from './types'
import { EmployeeActivityFeed } from './employee-activity-feed'
import { EmployeeDashboardHeader } from './employee-dashboard'
import { EmployeeDashboardLayout as EmployeeDashboardLayoutView } from './employee-dashboard-layout'
import { EmployeeDashboardSummary, type EmployeeDashboardSummaryLabels } from './employee-dashboard-summary'
import { EmploymentDashboardSummary, type EmploymentDashboardSummaryLabels } from './employment-dashboard-summary'
import { ProfileLinkForm } from '../employment/profile-link-form'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const summaryLabels = {
  personal: 'Persoonlijke informatie', name: 'Naam', age: 'Leeftijd', daysUntilBirthday: 'Dagen tot verjaardag', workEmail: 'Werk e-mail', privateEmail: 'Privé e-mail', workPhone: 'Werktelefoon', privatePhone: 'Privételefoon', noContact: 'Niet vastgelegd', address: 'Adres', noAddress: 'Geen adres', contact: 'Bank', privateContact: 'Noodcontact', notRecorded: 'Niet vastgelegd', edit: 'Wijzigen',
} satisfies EmployeeDashboardSummaryLabels

const employmentLabels = {
  employment: 'Dienstverband', employmentEmpty: 'Geen actief dienstverband', department: 'Afdeling', jobTitle: 'Functie', manager: 'Manager', hoursPerWeek: 'Uren per week', salary: 'Salaris', salaryHidden: 'Salaris verborgen', salaryLoading: 'Laden…', salaryFailed: 'Mislukt', salaryMonthly: 'per maand', salaryHourly: 'per uur', salaryNotAvailable: 'Niet beschikbaar', notRecorded: 'Niet vastgelegd',
} satisfies EmploymentDashboardSummaryLabels

const detail: EmployeeDetailViewModel = {
  employee: { id: 'employee-1', employeeNumber: 'EMP-001', firstName: 'Ada', birthName: 'Lovelace', privateEmail: 'ada.private.with-a-very-long-domain-name@example.invalid', workEmail: 'ada.lovelace.with-a-very-long-address@example.invalid', workPhone: null, privatePhone: null, birthDate: '1990-01-01' },
  employments: [], employmentCards: [], status: 'ACTIVE_EMPLOYEE', addresses: [{ id: 'address-1', addressType: 'PRIMARY', description: null, addressLine1: 'Een zeer lange straatnaam voor een wraptest 123', addressLine2: null, street: null, houseNumber: null, houseNumberAddition: null, postalCode: '1234AB', city: 'Amsterdam', region: null, countryCode: 'NL', source: 'MANUAL', sourceReference: null, validFrom: '2020-01-01', validUntil: null }],
  bankAccounts: [{ id: 'bank-1', maskedIban: 'NL00 BANK 0000 0000 00', bic: null, accountHolder: 'Ada Lovelace with a deliberately long account holder name' , description: null, isPrimary: true }],
  relations: [{ id: 'relation-1', relationType: 'OTHER', isEmergencyContact: true, firstName: 'Grace', initials: null, prefix: null, lastName: 'Hopper with a long surname for wrapping', gender: null, birthDate: null, phone: null, mobile: null, email: null, notes: null }], relationTypes: [],
  currentEmploymentSummary: { asOf: '2026-08-21', employmentId: null, laborCondition: null, hoursPerWeek: null, salary: null, departmentName: null, jobTitle: null, managerName: null },
  capabilities: { canEditEmployee: true, canReadBsn: false, canWriteBsn: false, canManageAddresses: false, canManageRelations: false, canManageBankAccounts: false, canReadSalary: false },
}

const activeEmployment = {
  id: 'employment-1', employment_number: 'EMPLOYMENT-NUMBER-WITH-A-LONG-VALUE', starts_on: '2020-01-01', ends_on: null, record_status: 'ACTIVE',
} as unknown as EmployeeDetailViewModel['employments'][number]

const activeEmploymentTwo = {
  id: 'employment-2', employment_number: 'SECOND-EMPLOYMENT', starts_on: '2021-01-01', ends_on: null, record_status: 'ACTIVE',
} as unknown as EmployeeDetailViewModel['employments'][number]

describe('Employee 360 dashboard Foundation contract', () => {
  it('keeps the dashboard header contextual and the personal edit action local', () => {
    const header = renderToStaticMarkup(createElement(EmployeeDashboardHeader, { subtitle: 'Een helder overzicht van vandaag', title: 'Medewerkerdashboard' }))
    const personal = renderToStaticMarkup(createElement(EmployeeDashboardSummary, { detail, labels: summaryLabels }))

    expect(header).toContain('Een helder overzicht van vandaag')
    expect(header).not.toContain('Medewerkerdetails openen')
    expect(header).not.toContain('<a')
    expect(personal).toContain('href="?tab=personal"')
    expect(personal).toContain('Wijzigen')
  })

  it('uses Surface and preserves long personal values without truncation', () => {
    const markup = renderToStaticMarkup(createElement(EmployeeDashboardSummary, { detail, labels: summaryLabels }))

    expect(markup).toContain('bg-surface')
    expect(markup).toContain('break-words')
    expect(markup).toContain('ada.lovelace.with-a-very-long-address@example.invalid')
    expect(markup).toContain('Een zeer lange straatnaam voor een wraptest 123')
    expect(markup).not.toContain('shadow-sm')
    expect(markup).not.toContain('truncate')
  })

  it('keeps active employment selection accessible with canonical tabs', () => {
    const markup = renderToStaticMarkup(createElement(EmploymentDashboardSummary, {
      cards: [
        { employmentId: activeEmployment.id, administrationName: 'Liquid HR', departmentName: 'People Operations', jobTitle: 'HR Manager', hoursPerWeek: 36, laborConditionName: 'CAO', employmentType: 'EMPLOYEE' },
        { employmentId: activeEmploymentTwo.id, administrationName: 'Liquid HR', departmentName: 'Finance', jobTitle: 'Controller', hoursPerWeek: 32, laborConditionName: 'CAO', employmentType: 'EMPLOYEE' },
      ],
      canReadSalary: false,
      currentSummary: { asOf: '2026-08-21', employmentId: activeEmployment.id, laborCondition: null, hoursPerWeek: 36, salary: null, departmentName: 'People Operations', jobTitle: 'HR Manager', managerName: 'Manager' },
      employeeId: 'employee-1', employments: [activeEmployment, activeEmploymentTwo], labels: employmentLabels, locale: 'nl-NL',
    }))

    expect(markup).toContain('role="tablist"')
    expect(markup).toContain('role="tab"')
    expect(markup).toContain('aria-selected="true"')
    expect(markup).toContain('EMPLOYMENT-NUMBER-WITH-A-LONG-VALUE')
    expect(markup).toContain('border-primary')
  })

  it('uses Foundation IconButtons while retaining reorder controls and layout shape', () => {
    const layout: EmployeeDashboardLayout = { wide: ['personal', 'customFields'], narrow: ['employment'] }
    const markup = renderToStaticMarkup(createElement(EmployeeDashboardLayoutView, {
      initialLayout: layout,
      labels: { moveUp: 'Omhoog', moveDown: 'Omlaag', drag: 'Verslepen', saving: 'Opslaan…', saved: 'Opgeslagen', failed: 'Mislukt' },
      narrow: [{ id: 'employment', node: createElement('div', null, 'Employment') }],
      wide: [{ id: 'personal', node: createElement('div', null, 'Personal') }, { id: 'customFields', node: createElement('div', null, 'Custom fields') }],
    }))

    expect(markup).toContain('aria-label="Omhoog"')
    expect(markup).toContain('aria-label="Omlaag"')
    expect(markup).toContain('min-w-8')
    expect(markup).not.toContain('shadow-sm')
  })

  it('uses FormField controls in the activity add flow', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(createElement(EmployeeActivityFeed, { canWrite: true, dateFormat: 'DMY', employeeId: 'employee-1', items: [], labels: { add: 'Bericht toevoegen', empty: 'Geen berichten', failed: 'Mislukt', placeholder: 'Bericht', save: 'Opslaan', saving: 'Opslaan…' }, locale: 'nl-NL', timeFormat: '24H' })))

    act(() => (host.querySelector('button') as HTMLButtonElement).click())

    expect(host.querySelector('label[for]')).not.toBeNull()
    expect(host.querySelector('textarea')).not.toBeNull()
    expect(host.querySelector('button[type="submit"]')).not.toBeNull()
    root.unmount()
    host.remove()
  })

  it('uses TextInput and FormField in the profile link add flow', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(createElement(ProfileLinkForm, { employeeId: 'employee-1', labels: { add: 'LinkedIn-link toevoegen', failed: 'Mislukt', label: 'Label', save: 'Opslaan', url: 'URL' } })))

    act(() => (host.querySelector('button') as HTMLButtonElement).click())

    expect(host.querySelector('label[for]')).not.toBeNull()
    expect(host.querySelector('input[name="label"]')).not.toBeNull()
    expect(host.querySelector('input[name="url"]')).not.toBeNull()
    root.unmount()
    host.remove()
  })

  it('renders the employment empty state through the Foundation component', () => {
    const markup = renderToStaticMarkup(createElement(EmploymentDashboardSummary, {
      cards: [], canReadSalary: false, currentSummary: detail.currentEmploymentSummary, employeeId: 'employee-1', employments: [], labels: employmentLabels, locale: 'nl-NL',
    }))

    expect(markup).toContain('Geen actief dienstverband')
    expect(markup).toContain('border-dashed')
  })

})
