// @vitest-environment happy-dom

import { act, createElement, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'

import { MultiSelect, type MultiSelectOption } from './multi-select'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const options: readonly MultiSelectOption[] = [
  { label: 'Alpha', value: 'alpha' },
  { label: 'Beta', value: 'beta' },
  { label: 'Gamma', value: 'gamma' },
]

function mount(element: React.ReactElement) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(element))
  return { host, unmount: () => act(() => root.unmount()) }
}

function optionButton(label: string): HTMLButtonElement {
  const option = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="option"]')).find((candidate) => candidate.textContent?.includes(label))
  if (!option) throw new Error(`Option not found: ${label}`)
  return option
}

describe('MultiSelect', () => {
  it('supports searchable controlled selection, select all and empty results', () => {
    const changes: string[][] = []
    function Harness() {
      const [value, setValue] = useState<string[]>([])
      return createElement(MultiSelect, {
        emptySelectionLabel: 'Alle opties',
        listLabel: 'Teams',
        noOptionsLabel: 'Geen opties gevonden',
        loadingLabel: 'Laden…',
        onChange: (next) => { changes.push(next); setValue(next) },
        options,
        searchPlaceholder: 'Teams zoeken',
        selectAllLabel: 'Alles selecteren',
        selectedCountLabel: '{count} geselecteerd',
        showSelectAll: true,
        value,
      })
    }

    const mounted = mount(createElement(Harness))
    const trigger = mounted.host.querySelector('button[aria-haspopup="listbox"]') as HTMLButtonElement
    act(() => trigger.click())
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelector('[role="listbox"]')).not.toBeNull()

    act(() => optionButton('Beta').click())
    expect(changes).toEqual([['beta']])
    expect(trigger.textContent).toContain('1 geselecteerd')

    const search = document.querySelector('input[placeholder="Teams zoeken"]') as HTMLInputElement
    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      valueSetter?.call(search, 'onbekend')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(document.body.textContent).toContain('Geen opties gevonden')

    act(() => (document.querySelector('[role="listbox"]') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })))
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)

    act(() => trigger.click())
    act(() => optionButton('Alles selecteren').click())
    expect(changes.at(-1)).toEqual(['beta', 'alpha', 'gamma'])
    act(() => optionButton('Alles selecteren').click())
    expect(changes.at(-1)).toEqual([])
    mounted.unmount()
  })

  it('exposes loading and no-options states without inventing fallback values', () => {
    const mounted = mount(createElement(MultiSelect, {
      emptySelectionLabel: 'Alle opties',
      loading: true,
      loadingLabel: 'Laden…',
      noOptionsLabel: 'Geen opties gevonden',
      onChange: vi.fn(),
      options: [],
      searchPlaceholder: 'Zoeken',
      selectedCountLabel: '{count} geselecteerd',
      value: [],
    }))
    expect(mounted.host.textContent).toContain('Laden…')
    expect((mounted.host.querySelector('button') as HTMLButtonElement).disabled).toBe(true)
    mounted.unmount()
  })
})
