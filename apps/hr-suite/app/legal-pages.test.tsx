import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PrivacyPage, { metadata as privacyMetadata } from '@/app/privacy/page'
import TermsPage, { metadata as termsMetadata } from '@/app/terms/page'

describe('public legal pages', () => {
  it('renders the privacy policy with legal metadata and public navigation', async () => {
    const markup = renderToStaticMarkup(await PrivacyPage())

    expect(markup).toContain('Privacy Policy')
    expect(markup).toContain('Last updated: 3 September 2026')
    expect(markup).toContain('Edwin Solutions BV')
    expect(markup).toContain('href="/terms"')
    expect(markup).toContain('href="/login"')
    expect(privacyMetadata).toMatchObject({
      title: 'Privacy Policy | LiquidHR',
      description: expect.any(String),
    })
  })

  it('renders the terms of service with legal metadata and a privacy link', async () => {
    const markup = renderToStaticMarkup(await TermsPage())

    expect(markup).toContain('Terms of Service')
    expect(markup).toContain('Last updated: 3 September 2026')
    expect(markup).toContain('Edwin Solutions BV')
    expect(markup).toContain('href="/privacy"')
    expect(markup).toContain('href="/login"')
    expect(termsMetadata).toMatchObject({
      title: 'Terms of Service | LiquidHR',
      description: expect.any(String),
    })
  })
})
