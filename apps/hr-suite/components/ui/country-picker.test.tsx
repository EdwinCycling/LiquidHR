// @vitest-environment happy-dom

import { act, createElement, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'

import { CountryPicker } from './country-picker'

const options = [{ code: 'NL', name: 'NL' }, { code: 'FK', name: 'FK' }]

describe('CountryPicker hydration contract', () => {
  it('uses stable fallback labels for the server render', () => {
    const markup = renderToStaticMarkup(createElement(CountryPicker, { emptyLabel: 'Geen resultaten', locale: 'nl', onChange: vi.fn(), options, searchLabel: 'Zoek land', value: 'FK' }))
    expect(markup).toContain('>FK</option>')
    expect(markup).not.toContain('Falkland')
  })

  it('hydrates localized labels without changing the selected ISO code', async () => {
    const changes: string[] = []
    function Harness() {
      const [value, setValue] = useState('FK')
      return createElement(CountryPicker, { emptyLabel: 'Geen resultaten', locale: 'nl', name: 'countryCode', onChange: (next) => { changes.push(next); setValue(next) }, options, searchLabel: 'Zoek land', value })
    }
    const rootElement = document.createElement('div')
    document.body.appendChild(rootElement)
    const root = createRoot(rootElement)
    await act(async () => { root.render(createElement(Harness)) })
    expect((rootElement.querySelector('select[name="countryCode"]') as HTMLSelectElement | null)?.value).toBe('FK')
    expect(rootElement.textContent).toContain('Falkland')
    const nativeSelect = rootElement.querySelector('select[name="countryCode"]') as HTMLSelectElement
    nativeSelect.value = 'NL'
    await act(async () => { nativeSelect.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(changes).toEqual(['NL'])
    expect(nativeSelect.value).toBe('NL')
    root.unmount()
    rootElement.remove()
  })
})
