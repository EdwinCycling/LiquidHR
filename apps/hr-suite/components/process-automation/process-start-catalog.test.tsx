import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { StartableProcess } from '@/lib/process-automation/start-catalog-service'
import { ProcessStartCatalog, type ProcessStartCatalogLabels } from './process-start-catalog'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))

const labels: ProcessStartCatalogLabels = {
  title: 'Nieuwe aanvraag', description: 'Kies een proces.', steps: 'Verwachte stappen', routes: 'Mogelijke vervolgroutes', responsible: 'Verantwoordelijke', startStep: 'Eerste stap', start: 'Aanvraag starten', starting: 'Aanvraag starten…', empty: 'Geen processen.', loadError: 'Laden mislukt.', startFailed: 'Start mislukt.', startDenied: 'Geen toegang.', startUnavailable: 'Niet beschikbaar.',
}

const process: StartableProcess = {
  processDefinitionId: '00000000-0000-4000-8000-000000000001',
  title: { nl: 'Opleidingsaanvraag', en: 'Training request' },
  description: { nl: 'Vraag een opleiding aan.', en: 'Request training.' },
  steps: [
    { title: { nl: 'Medewerker vraagt opleiding aan', en: 'Employee requests training' }, responsibleRole: { nl: 'Medewerker', en: 'Employee' }, isStart: true },
    { title: { nl: 'Manager beoordeelt', en: 'Manager reviews' }, responsibleRole: { nl: 'Manager', en: 'Manager' }, isStart: false },
    { title: { nl: 'HR verwerkt', en: 'HR processes' }, responsibleRole: { nl: 'HR', en: 'HR' }, isStart: false },
  ],
  routes: [{ fromTitle: { nl: 'Manager beoordeelt', en: 'Manager reviews' }, label: { nl: 'Wijzigingen vragen', en: 'Request changes' }, toTitle: { nl: 'Medewerker aanpassen', en: 'Employee updates' } }],
}

describe('ProcessStartCatalog', () => {
  it('renders process steps and recovery routes in the existing request workspace', () => {
    const markup = renderToStaticMarkup(createElement(ProcessStartCatalog, { locale: 'nl', labels, processes: [process] }))

    expect(markup).toContain('Opleidingsaanvraag')
    expect(markup).toContain('Manager beoordeelt')
    expect(markup).toContain('HR verwerkt')
    expect(markup).toContain('Wijzigingen vragen')
    expect(markup).toContain('Aanvraag starten')
    expect(markup).not.toContain('processDefinitionId')
    expect(markup).not.toContain('employee-request')
  })
})
