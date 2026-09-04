// @vitest-environment happy-dom

import { act } from 'react'
import { type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { buttonClasses } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { DropdownSelect } from './ui/dropdown-select'
import { IconButton } from './ui/icon-button'
import { RadioGroup } from './ui/radio-group'
import { Switch } from './ui/switch'
import { Textarea } from './ui/textarea'
import { TextInput } from './ui/text-input'
import { FormField } from './patterns/form-field'
import { ScrollableTabs, TabButton, TabLink, tabLinkClasses } from './patterns/scrollable-tabs'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function renderStatic(element: ReactElement): string {
  return renderToStaticMarkup(element)
}

function mount(element: ReactElement) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(element))
  return {
    host,
    unmount: () => act(() => root.unmount()),
  }
}

describe('LiquidHR foundation controls', () => {
  it('supports leading and trailing adornments without making icons interactive', () => {
    const markup = renderStatic(<TextInput leadingIcon={<span>in</span>} trailingIcon={<span>out</span>} />)

    expect(markup).toContain('aria-hidden="true"')
    expect(markup).toContain('pl-10')
    expect(markup).toContain('pr-10')
  })

  it('keeps Button icon sizing and IconButton as the icon-only contract', () => {
    const iconButtonMarkup = renderStatic(<IconButton label="Menu openen"><span>ico</span></IconButton>)

    expect(buttonClasses()).toContain('[&_svg]:size-4')
    expect(iconButtonMarkup).toContain('aria-label="Menu openen"')
    expect(iconButtonMarkup).toContain('min-w-10')
  })

  it('associates FormField label, help and error with the control', () => {
    const markup = renderStatic(
      <FormField description="Gebruik je werkmail." error="Dit veld is verplicht." label="E-mail" required control={<TextInput type="email" />} />,
    )

    expect(markup).toContain('for="')
    expect(markup).toContain('Gebruik je werkmail.')
    expect(markup).toContain('Dit veld is verplicht.')
    expect(markup).toContain('aria-invalid="true"')
    expect(markup).toContain('aria-describedby="')
  })

  it('renders native Checkbox semantics and propagates change and disabled state', () => {
    const onChange = vi.fn()
    const mounted = mount(<Checkbox aria-label="Primaire account" defaultChecked name="primary" onChange={onChange} />)
    const input = mounted.host.querySelector('input[type="checkbox"]') as HTMLInputElement

    expect(input.checked).toBe(true)
    input.click()

    expect(input.checked).toBe(false)
    expect(onChange).toHaveBeenCalledOnce()
    mounted.unmount()

    const disabled = mount(<Checkbox aria-label="Uitgeschakeld" disabled />)
    expect((disabled.host.querySelector('input') as HTMLInputElement).disabled).toBe(true)
    disabled.unmount()
  })

  it('supports controlled RadioGroup selection and disabled options', () => {
    const onValueChange = vi.fn()
    const mounted = mount(
      <RadioGroup
        aria-label="Weergave"
        name="view"
        onValueChange={onValueChange}
        options={[
          { label: 'Compact', value: 'compact' },
          { disabled: true, label: 'Niet beschikbaar', value: 'disabled' },
          { label: 'Uitgebreid', value: 'expanded' },
        ]}
        value="compact"
      />,
    )
    const radios = mounted.host.querySelectorAll('input[type="radio"]')

    expect((radios[0] as HTMLInputElement).checked).toBe(true)
    expect((radios[1] as HTMLInputElement).disabled).toBe(true)
    ;(radios[2] as HTMLInputElement).click()
    expect(onValueChange).toHaveBeenCalledWith('expanded')
    mounted.unmount()
  })

  it('keeps Switch native keyboard state and supports onCheckedChange', () => {
    const onCheckedChange = vi.fn()
    const mounted = mount(<Switch defaultChecked label="Meldingen" onCheckedChange={onCheckedChange} />)
    const input = mounted.host.querySelector('input[role="switch"]') as HTMLInputElement

    expect(input.checked).toBe(true)
    input.click()
    expect(input.checked).toBe(false)
    expect(onCheckedChange).toHaveBeenCalledWith(false)
    mounted.unmount()
  })

  it('preserves native Textarea value, invalid and disabled contracts', () => {
    const markup = renderStatic(<Textarea aria-invalid id="notes" name="notes" disabled value="Notities" onChange={() => undefined} />)

    expect(markup).toContain('id="notes"')
    expect(markup).toContain('aria-invalid="true"')
    expect(markup).toContain('disabled=""')
    expect(markup).toContain('>Notities</textarea>')
  })

  it('supports regular and searchable DropdownSelect markup', () => {
    const regular = mount(
      <DropdownSelect aria-label="Status" defaultValue="active" disabled={false}>
        <option value="active">Actief</option>
        <option disabled value="blocked">Geblokkeerd</option>
      </DropdownSelect>,
    )
    expect(regular.host.querySelector('[aria-haspopup="listbox"]')).not.toBeNull()
    regular.unmount()

    const searchable = mount(
      <DropdownSelect aria-label="Medewerker" emptyLabel="Geen resultaten" searchable searchPlaceholder="Zoeken…">
        <option value="ada">Ada Lovelace</option>
      </DropdownSelect>,
    )
    const trigger = searchable.host.querySelector('button[aria-haspopup="listbox"]') as HTMLButtonElement
    act(() => trigger.click())
    expect(document.querySelector('input[placeholder="Zoeken…"]')).not.toBeNull()
    expect(document.querySelector('[role="option"]')).not.toBeNull()
    searchable.unmount()
  })

  it('changes DropdownSelect values, skips disabled options and renders empty search results', () => {
    const onChange = vi.fn()
    const mounted = mount(
      <DropdownSelect aria-label="Status" onChange={onChange} searchable searchPlaceholder="Zoeken…">
        <option disabled value="blocked">Geblokkeerd</option>
        <option value="active">Actief</option>
      </DropdownSelect>,
    )
    const trigger = mounted.host.querySelector('button[aria-haspopup="listbox"]') as HTMLButtonElement
    act(() => trigger.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' })))
    const disabledOption = document.querySelector('[role="option"][disabled]') as HTMLButtonElement
    act(() => disabledOption?.click())
    expect(onChange).not.toHaveBeenCalled()

    const activeOption = document.querySelector('[role="option"]:not([disabled])') as HTMLButtonElement
    act(() => activeOption.click())
    expect(onChange).toHaveBeenCalledOnce()

    act(() => trigger.click())
    const search = document.querySelector('input[placeholder="Zoeken…"]') as HTMLInputElement
    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      valueSetter?.call(search, 'onbekend')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(document.body.textContent).toContain('Geen opties gevonden')
    mounted.unmount()
  })

  it('provides canonical route and button tabs with keyboard semantics', () => {
    const mounted = mount(
      <div role="tablist">
        <TabButton active onClick={() => undefined}>Overzicht</TabButton>
        <TabButton onClick={() => undefined}>Instellingen</TabButton>
        <TabLink active href="/employees">Medewerkers</TabLink>
      </div>,
    )
    const buttons = mounted.host.querySelectorAll('button[role="tab"]')
    const second = buttons[1] as HTMLButtonElement

    expect(buttons).toHaveLength(2)
    expect((buttons[0] as HTMLButtonElement).getAttribute('aria-selected')).toBe('true')
    expect((mounted.host.querySelector('a') as HTMLAnchorElement).getAttribute('aria-current')).toBe('page')
    act(() => (buttons[0] as HTMLButtonElement).dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' })))
    expect(document.activeElement).toBe(second)
    expect(tabLinkClasses({ active: true })).toContain('border-b-[3px]')
    expect(tabLinkClasses({ active: true })).toContain('bg-accent/45')
    expect(tabLinkClasses({ active: false })).not.toContain('bg-accent/45')
    mounted.unmount()
  })

  it('shows ScrollableTabs controls only when actual overflow exists', async () => {
    const mounted = mount(
      <ScrollableTabs ariaLabel="Secties" leftLabel="Vorige secties" rightLabel="Volgende secties">
        <TabLink href="/one">Een</TabLink>
        <TabLink href="/two">Twee</TabLink>
      </ScrollableTabs>,
    )
    const scroller = mounted.host.querySelector('.tabs-scroll') as HTMLDivElement
    let scrollLeft = 0
    Object.defineProperties(scroller, {
      clientWidth: { configurable: true, value: 100 },
      scrollLeft: { configurable: true, get: () => scrollLeft, set: (value: number) => { scrollLeft = value } },
      scrollWidth: { configurable: true, value: 240 },
    })
    Object.defineProperty(scroller, 'scrollBy', {
      configurable: true,
      value: ({ left }: { left: number }) => {
        scrollLeft += left
        scroller.dispatchEvent(new Event('scroll'))
      },
    })
    await act(async () => {
      scroller.dispatchEvent(new Event('scroll'))
    })

    expect(mounted.host.querySelector('button[aria-label="Volgende secties"]')).not.toBeNull()
    mounted.unmount()
  })
})
