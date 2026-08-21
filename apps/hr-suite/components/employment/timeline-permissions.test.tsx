// @vitest-environment happy-dom

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { CompanyLocationTimelineManager } from './company-location-timeline-manager'
import { OrganizationTimelineManager } from './organization-timeline-manager'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const company = {
  name: 'LiquidHR Nederland',
  single_location: false,
  address: null,
}

const companyLabels = {
  title: 'Bedrijfslocatie', description: 'Locatiehistorie', company: 'Bedrijf', companyAddress: 'Adres', locations: 'Locaties', current: 'Huidig', history: 'Historie', active: 'Actief', notRecorded: 'Niet vastgelegd', readOnly: 'Alleen lezen', noLocations: 'Geen actieve locaties', location: 'Locatie', locationSearch: 'Locatie zoeken', locationSearchPlaceholder: 'Kies een locatie', noLocationResults: 'Geen locaties gevonden', add: 'Toevoegen', edit: 'Wijzigen', save: 'Opslaan', cancel: 'Annuleren', effectiveOn: 'Geldig vanaf', failed: 'Opslaan mislukt', saving: 'Opslaan…', changeSaved: 'Opgeslagen', singleLocationMode: 'Één locatie',
}

const organizationLabels = {
  current: 'Huidig', history: 'Historie', add: 'Toevoegen', edit: 'Wijzigen', save: 'Opslaan', cancel: 'Annuleren', department: 'Afdeling', job: 'Functie', effectiveOn: 'Geldig vanaf', active: 'Actief', failed: 'Opslaan mislukt',
}

describe('timeline permission contracts', () => {
  it('renders Company Location assignments as static rows without edit or save controls when canWrite is false', () => {
    const markup = renderToStaticMarkup(createElement(CompanyLocationTimelineManager, {
      assignments: [{ effective_from: '2026-01-01', effective_to: null, id: 'assignment-1', location_id: 'location-1' }],
      canWrite: false,
      company,
      employmentId: 'employment-1',
      labels: companyLabels,
      locations: [{ id: 'location-1', is_active: true, name: 'Utrecht' }],
    }))

    expect(markup).toContain('Utrecht')
    expect(markup).toContain('2026-01-01')
    expect(markup).not.toContain('Opslaan')
    expect(markup).not.toContain('Wijzigen')
    expect(markup).not.toContain('<button')
    expect(markup).not.toContain('role="dialog"')
  })

  it('keeps existing Company Location assignments visible when there are no active locations', () => {
    const markup = renderToStaticMarkup(createElement(CompanyLocationTimelineManager, {
      assignments: [{ effective_from: '2025-06-01', effective_to: '2025-12-31', id: 'assignment-1', location_id: 'location-1' }],
      canWrite: true,
      company,
      employmentId: 'employment-1',
      labels: companyLabels,
      locations: [{ id: 'location-1', is_active: false, name: 'Historische locatie' }],
    }))

    expect(markup).toContain('Geen actieve locaties')
    expect(markup).toContain('Historische locatie')
    expect(markup).toContain('2025-06-01')
    expect(markup).not.toContain('>Toevoegen<')
  })

  it('renders Organization assignments as static rows without edit or save controls when canWrite is false', () => {
    const markup = renderToStaticMarkup(createElement(OrganizationTimelineManager, {
      canWrite: false,
      employmentId: 'employment-1',
      labels: organizationLabels,
      options: { departments: [{ code: 'OPS', id: 'department-1', name: 'Operations' }], jobs: [{ code: 'HR', id: 'job-1', name: 'HR Adviseur' }] },
      placements: [{ departmentId: 'department-1', departmentName: 'OPS · Operations', effectiveFrom: '2026-02-01', effectiveTo: null, id: 'placement-1', jobId: 'job-1', jobName: 'HR Adviseur' }],
    }))

    expect(markup).toContain('OPS · Operations')
    expect(markup).toContain('HR Adviseur')
    expect(markup).toContain('2026-02-01')
    expect(markup).not.toContain('Opslaan')
    expect(markup).not.toContain('Wijzigen')
    expect(markup).not.toContain('<button')
    expect(markup).not.toContain('role="dialog"')
  })
})
