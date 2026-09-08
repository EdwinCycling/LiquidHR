// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { TalentGoalSmartAction } from './talent-goal-smart-action'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const labels = { action: 'Maak doel SMART', working: 'Bezig…', reviewTitle: 'Beoordeel voorstel', apply: 'Vervangen in formulier', cancel: 'Annuleren', copy: 'Kopiëren', copied: 'Gekopieerd', retry: 'Opnieuw proberen', failed: 'Mislukt' }

describe('Talent goal SMART interaction', () => {
  it('keeps the source unchanged until Apply and lets Cancel discard the proposal', async () => {
    const originalFetch = globalThis.fetch
    const onApply = vi.fn()
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ data: { proposedText: 'Specifiek: oefen presenteren.\nMeetbaar: geef twee presentaties.' } }) } as Response)) as typeof fetch
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    try {
      act(() => root.render(createElement(TalentGoalSmartAction, { labels, locale: 'nl', onApply, sourceText: 'Beter worden in presenteren.' })))
      await act(async () => { (host.querySelector('button') as HTMLButtonElement).click(); await Promise.resolve() })
      expect(host.textContent).toContain('Specifiek: oefen presenteren.')
      expect(onApply).not.toHaveBeenCalled()
      act(() => (Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('Annuleren')) as HTMLButtonElement).click())
      expect(onApply).not.toHaveBeenCalled()
      expect(host.textContent).not.toContain('Specifiek: oefen presenteren.')
    } finally {
      globalThis.fetch = originalFetch
      root.unmount()
      host.remove()
    }
  })

  it('applies only to the local editor callback', async () => {
    const originalFetch = globalThis.fetch
    const onApply = vi.fn()
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ data: { proposedText: 'SMART voorstel.' } }) } as Response)) as typeof fetch
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    try {
      act(() => root.render(createElement(TalentGoalSmartAction, { labels, locale: 'nl', onApply, sourceText: 'Oorspronkelijk doel.' })))
      await act(async () => { (host.querySelector('button') as HTMLButtonElement).click(); await Promise.resolve() })
      act(() => (Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('Vervangen')) as HTMLButtonElement).click())
      expect(onApply).toHaveBeenCalledWith('SMART voorstel.')
    } finally {
      globalThis.fetch = originalFetch
      root.unmount()
      host.remove()
    }
  })
})
