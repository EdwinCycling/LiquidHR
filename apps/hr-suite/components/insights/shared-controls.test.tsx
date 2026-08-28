// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'

import { InsightsActiveFilters, InsightsExportAction } from './shared-controls'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function mount(element: React.ReactElement) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(element))
  return { host, unmount: () => act(() => root.unmount()) }
}

describe('shared Insights controls', () => {
  it('renders count, removable chips and clear/reset actions', () => {
    const remove = vi.fn()
    const clear = vi.fn()
    const reset = vi.fn()
    const mounted = mount(createElement(InsightsActiveFilters, {
      clearLabel: 'Alles wissen',
      filters: [
        { key: 'period', label: 'Periode', value: 'Dit jaar', onRemove: remove },
        { key: 'department', label: 'Team', value: 'Finance' },
      ],
      label: 'Actieve filters',
      onClear: clear,
      onReset: reset,
      removeLabel: 'Verwijder filter {filter}',
      resetLabel: 'Reset',
      selectedCountLabel: '{count} geselecteerd',
    }))

    expect(mounted.host.textContent).toContain('2 geselecteerd')
    expect(mounted.host.textContent).toContain('Periode: Dit jaar')
    expect(mounted.host.textContent).toContain('Team: Finance')
    act(() => (mounted.host.querySelector('button[aria-label^="Verwijder filter"]') as HTMLButtonElement).click())
    act(() => Array.from(mounted.host.querySelectorAll('button')).find((button) => button.textContent === 'Alles wissen')?.click())
    act(() => Array.from(mounted.host.querySelectorAll('button')).find((button) => button.textContent === 'Reset')?.click())
    expect(remove).toHaveBeenCalledOnce()
    expect(clear).toHaveBeenCalledOnce()
    expect(reset).toHaveBeenCalledOnce()
    mounted.unmount()
  })

  it('reports a successful export without navigating away from the report', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['report']) }))
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const mounted = mount(createElement(InsightsExportAction, {
      fileName: 'insights.csv',
      href: '/api/insights/example?report=example',
      label: 'Exporteren',
      labels: { error: 'Export mislukt', loading: 'Exporteren…', success: 'Export gereed' },
    }))
    act(() => (mounted.host.querySelector('button') as HTMLButtonElement).click())
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(mounted.host.textContent).toContain('Export gereed')
    expect(anchorClick).toHaveBeenCalledOnce()
    expect(createObjectUrl).toHaveBeenCalledOnce()
    expect(revokeObjectUrl).not.toHaveBeenCalled()
    mounted.unmount()
    createObjectUrl.mockRestore()
    revokeObjectUrl.mockRestore()
    anchorClick.mockRestore()
  })
})
