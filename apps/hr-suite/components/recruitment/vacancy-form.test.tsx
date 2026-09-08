// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { VacancyForm, type VacancyFormLabels } from './vacancy-form'

vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn(), refresh: vi.fn() }) }))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const labels: VacancyFormLabels = {
  title: 'Functietitel', location: 'Locatie', workMode: 'Werkvorm', onSite: 'Op locatie', hybrid: 'Hybride', remote: 'Op afstand', hours: 'Uren', salary: 'Salaris', salaryVisible: 'Toon salaris', sections: 'Inhoud', sectionHint: 'Vaste blokken', save: 'Opslaan', saving: 'Opslaan…', cancel: 'Annuleren', saved: 'Opgeslagen', invalid: 'Ongeldig',
  aiTitle: 'Schrijf vacaturetekst met AI', aiDescription: 'Controleer het voorstel.', aiTarget: 'Vacatureblok', aiInstruction: 'Instructie', aiInstructionPlaceholder: 'Optioneel', aiGenerate: 'Schrijf vacaturetekst', aiWorking: 'Bezig…', aiReviewTitle: 'AI-voorstel beoordelen', aiApply: 'Vervangen in blok', aiCancel: 'Annuleren', aiCopy: 'Kopiëren', aiCopied: 'Gekopieerd', aiRetry: 'Opnieuw proberen', aiFailed: 'Mislukt', aiTargets: { ALL: 'Alle blokken', INTRODUCTION: 'Introductie', ROLE: 'Rol', PROFILE: 'Profiel', OFFER: 'Aanbod', PROCESS: 'Procedure', CONTACT: 'Contact' },
}

describe('Vacancy AI interaction', () => {
  it('shows a draft and replaces only the selected local block', async () => {
    const originalFetch = globalThis.fetch
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ data: { proposedText: 'Werk samen met het team.' } }) } as Response))
    globalThis.fetch = fetchMock as typeof fetch
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    try {
      act(() => root.render(createElement(VacancyForm, { aiAvailable: true, initial: { title: 'HR adviseur' }, labels, locale: 'nl' })))
      const aiButton = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('Schrijf vacaturetekst')) as HTMLButtonElement
      await act(async () => { aiButton.click(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve() })
      const textareas = Array.from(host.querySelectorAll('textarea')) as HTMLTextAreaElement[]
      expect(host.textContent).toContain('Werk samen met het team.')
      expect(textareas[0]?.value).toBe('')
      act(() => (Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('Vervangen in blok')) as HTMLButtonElement).click())
      expect(textareas[0]?.value).toBe('Werk samen met het team.')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      globalThis.fetch = originalFetch
      root.unmount()
      host.remove()
    }
  })
})
