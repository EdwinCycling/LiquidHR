import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { EmptyState } from './ui/empty-state'
import { IconButton } from './ui/icon-button'
import { Surface } from './ui/surface'
import { TextInput } from './ui/text-input'
import { DetailColumns } from './layout/detail-columns'
import { PageShell } from './layout/page-shell'
import { FilterBar } from './patterns/filter-bar'
import { InfoList } from './patterns/info-list'
import { PageHeader } from './patterns/page-header'
import { PageToolbar } from './patterns/page-toolbar'
import { SectionHeader } from './patterns/section-header'

const render = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element)

describe('LiquidHR foundation UI components', () => {
  it('renders all button variants and preserves native props', () => {
    const variants = ['primary', 'secondary', 'danger', 'ghost'] as const

    for (const variant of variants) {
      const markup = render(createElement(Button, {
        'aria-label': `${variant} actie`,
        name: 'action',
        type: 'submit',
        value: variant,
        variant,
      }, 'Actie'))

      expect(markup).toContain(`value="${variant}"`)
      expect(markup).toContain(`aria-label="${variant} actie"`)
      expect(markup).toContain('type="submit"')
      expect(markup).toContain('min-h-10')
    }
  })

  it('renders a disabled loading button without replacing its content', () => {
    const markup = render(createElement(Button, { loading: true }, 'Opslaan'))

    expect(markup).toContain('disabled=""')
    expect(markup).toContain('aria-busy="true"')
    expect(markup).toContain('Opslaan')
    expect(markup).toContain('animate-spin')
  })

  it('uses the required accessible label for an icon button', () => {
    const markup = render(createElement(IconButton, {
      children: createElement('span', null, '⌘'),
      label: 'Menu openen',
    }))

    expect(markup).toContain('aria-label="Menu openen"')
    expect(markup).toContain('min-h-10')
  })

  it('preserves native input props and styles invalid input', () => {
    const markup = render(createElement(TextInput, {
      'aria-invalid': true,
      id: 'email',
      name: 'email',
      placeholder: 'naam@bedrijf.nl',
      required: true,
      type: 'email',
    }))

    expect(markup).toContain('id="email"')
    expect(markup).toContain('name="email"')
    expect(markup).toContain('placeholder="naam@bedrijf.nl"')
    expect(markup).toContain('required=""')
    expect(markup).toContain('aria-invalid="true"')
    expect(markup).toContain('aria-[invalid=true]:border-destructive')
  })

  it('renders each surface variant', () => {
    const variants = {
      default: 'bg-surface',
      subtle: 'bg-surface-subtle',
      overlay: 'bg-surface-overlay',
    } as const

    for (const [variant, expectedClass] of Object.entries(variants)) {
      const markup = render(createElement(Surface, { children: 'Inhoud', variant: variant as keyof typeof variants }))

      expect(markup).toContain(expectedClass)
      expect(markup).toContain('Inhoud')
    }
  })

  it('renders each semantic badge tone', () => {
    const tones = {
      neutral: 'bg-muted',
      info: 'bg-info-surface',
      success: 'bg-success-surface',
      warning: 'bg-warning-surface',
      danger: 'bg-destructive-surface',
    } as const

    for (const [tone, expectedClass] of Object.entries(tones)) {
      const markup = render(createElement(Badge, { children: 'Status', tone: tone as keyof typeof tones }))

      expect(markup).toContain(expectedClass)
      expect(markup).toContain('Status')
    }
  })

  it('composes empty state content and actions', () => {
    const markup = render(createElement(EmptyState, {
      actions: createElement('button', { type: 'button' }, 'Opnieuw proberen'),
      description: 'Er zijn nog geen resultaten.',
      icon: createElement('span', null, 'i'),
      title: 'Geen resultaten',
    }))

    expect(markup).toContain('Geen resultaten')
    expect(markup).toContain('Er zijn nog geen resultaten.')
    expect(markup).toContain('Opnieuw proberen')
  })

  it('composes page and section headers with actions', () => {
    const pageMarkup = render(createElement(PageHeader, {
      actions: createElement('button', { type: 'button' }, 'Toevoegen'),
      description: 'Overzicht van medewerkers.',
      title: 'Medewerkers',
    }))
    const sectionMarkup = render(createElement(SectionHeader, {
      actions: createElement('button', { type: 'button' }, 'Bewerken'),
      description: 'Profielgegevens.',
      title: 'Profiel',
    }))

    expect(pageMarkup).toContain('Medewerkers')
    expect(pageMarkup).toContain('Overzicht van medewerkers.')
    expect(pageMarkup).toContain('Toevoegen')
    expect(sectionMarkup).toContain('Profiel')
    expect(sectionMarkup).toContain('Profielgegevens.')
    expect(sectionMarkup).toContain('Bewerken')
  })

  it('composes toolbar and filter bar content without owning state', () => {
    const toolbarMarkup = render(createElement(PageToolbar, {
      end: createElement('button', { type: 'button' }, 'Actie'),
      start: createElement('span', null, 'Zoeken'),
    }))
    const filterMarkup = render(createElement(FilterBar, {
      actions: createElement('button', { type: 'button' }, 'Wis filters'),
      children: createElement('span', null, 'Afdeling'),
    }))

    expect(toolbarMarkup).toContain('Zoeken')
    expect(toolbarMarkup).toContain('Actie')
    expect(filterMarkup).toContain('Afdeling')
    expect(filterMarkup).toContain('Wis filters')
  })

  it('renders info items in the requested column variant', () => {
    const markup = render(createElement(InfoList, {
      columns: 2,
      items: [
        { label: 'Naam', value: 'Ada Lovelace' },
        { label: 'Rol', value: 'HR Admin' },
      ],
    }))

    expect(markup).toContain('grid-cols-1 sm:grid-cols-2')
    expect(markup).toContain('Naam')
    expect(markup).toContain('Ada Lovelace')
    expect(markup).toContain('Rol')
    expect(markup).toContain('HR Admin')
  })

  it('renders all page shell widths', () => {
    const widths = ['reading', 'standard', 'wide'] as const

    for (const width of widths) {
      const markup = render(createElement(PageShell, { children: 'Pagina', width }))

      expect(markup).toContain('px-4')
      expect(markup).toContain('Pagina')
    }
  })

  it('keeps detail main content before the aside in the two-column layout', () => {
    const markup = render(createElement(DetailColumns, {
      aside: createElement('aside', null, 'Zijbalk'),
      main: createElement('section', null, 'Hoofdinhoud'),
    }))

    expect(markup).toContain('grid-cols-1')
    expect(markup).toContain('lg:grid-cols-3')
    expect(markup).toContain('lg:col-span-2')
    expect(markup.indexOf('Hoofdinhoud')).toBeLessThan(markup.indexOf('Zijbalk'))
  })
})
