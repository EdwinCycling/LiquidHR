import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FormField } from '@/components/patterns/form-field'
import { DropdownSelect } from './dropdown-select'

describe('DropdownSelect accessible trigger name', () => {
  it('uses its visible FormField label instead of the generic placeholder name', () => {
    const markup = renderToStaticMarkup(
      <FormField control={<DropdownSelect id="target-mode" value="ALL"><option value="ALL">All active employees</option></DropdownSelect>} label="Select audience" />,
    )
    const button = markup.match(/<button(?=[^>]*id="target-mode")[^>]*>/)?.[0] ?? ''

    expect(markup).toMatch(/<label[^>]*for="target-mode">Select audience<\/label>/)
    expect(button).not.toContain('aria-label="Selecteer een optie"')
  })

  it('keeps an explicit accessible name for a standalone control', () => {
    const markup = renderToStaticMarkup(
      <DropdownSelect aria-label="Filter category" value="ALL"><option value="ALL">All categories</option></DropdownSelect>,
    )
    const button = markup.match(/<button[^>]*>/)?.[0] ?? ''

    expect(button).toContain('aria-label="Filter category"')
  })
})
