// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { createTranslator } from '@/lib/i18n/translator'
import type { FocusPreviewPageData } from './load-focus-preview-page'
import { FocusPreviewSection } from './focus-preview-section'
import { focusData } from './test-fixtures'
import nl from '@/messages/nl/focus.json'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))

function previewProps(): FocusPreviewPageData {
  const data = focusData({ readOnly: true, isPreview: true })
  return {
    data,
    locale: 'nl',
    t: createTranslator(nl),
    today: '2026-09-18',
    journeyTitle: 'Een goede start',
    journeyActionHref: null,
  }
}

describe('Focus read-only preview sections', () => {
  it('renders a preview-scoped profile page without linking to the HR dossier', () => {
    const props = previewProps()
    const markup = renderToStaticMarkup(<FocusPreviewSection {...props} activeKey="profile" />)
    const employeeId = props.data.employee!.id

    expect(markup).toContain('Mijn profiel')
    expect(markup).toContain(`/focus/preview/${employeeId}?section=profiel`)
    expect(markup).not.toContain(`/employees/${employeeId}`)
  })
})
