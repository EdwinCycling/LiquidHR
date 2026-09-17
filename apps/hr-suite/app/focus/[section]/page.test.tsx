// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTranslator } from '@/lib/i18n/translator'
import { focusData } from '@/components/focus/test-fixtures'
import type { Locale } from '@/lib/i18n/config'
import nl from '@/messages/nl/focus.json'
import en from '@/messages/en/focus.json'
import FocusSectionPage from './page'

const mocks = vi.hoisted(() => ({ load: vi.fn(), context: vi.fn() }))
vi.mock('@/components/focus/load-focus-page', () => ({ loadFocusPage: mocks.load }))
vi.mock('@/lib/auth/permissions', () => ({ getRequestAuthorizationContext: mocks.context }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND') } }))

function setup(experience: 'EMPLOYEE' | 'PREBOARDING' = 'EMPLOYEE', locale: Locale = 'nl') {
  const data = focusData({ experience, isPreboarding: experience === 'PREBOARDING' })
  mocks.load.mockResolvedValue({ data, locale, t: createTranslator(locale === 'nl' ? nl : en), today: '2026-09-17', journeyTitle: 'Onboarding', journeyActionHref: null })
  return data
}

async function render(section: string) {
  return renderToStaticMarkup(await FocusSectionPage({ params: Promise.resolve({ section }) }))
}

beforeEach(() => {
  setup()
  mocks.context.mockResolvedValue({ context: { permissions: ['self:document:read', 'self:document-signing:read'] } })
})

describe('Focus section route boundaries', () => {
  it.each(['aanvragen', 'werk', 'team'])('refuses direct preboarding navigation to %s', async (section) => {
    setup('PREBOARDING')
    await expect(render(section)).rejects.toThrow('NOT_FOUND')
  })

  it.each(['unknown', 'constructor', 'toString'])('refuses unknown section %s', async (section) => {
    await expect(render(section)).rejects.toThrow('NOT_FOUND')
    expect(mocks.load).not.toHaveBeenCalled()
  })

  it('refuses a section without the corresponding server action', async () => {
    const data = setup()
    data.actions = []
    await expect(render('profiel')).rejects.toThrow('NOT_FOUND')
  })

  it('shows only the limited profile and assigned onboarding for preboarding', async () => {
    setup('PREBOARDING')
    const markup = await render('profiel')
    expect(markup).toContain('Noah Test')
    expect(markup).toContain('href="/focus/onboarding"')
    expect(markup).not.toContain('/employees/')
  })

  it('offers signing without linking the full employee dossier for preboarding', async () => {
    setup('PREBOARDING')
    const markup = await render('documenten')
    expect(markup).toContain('href="/my-signatures"')
    expect(markup).not.toContain('/employees/')
    expect(markup).not.toContain('/company-documents')
  })

  it('does not offer signing to a document-only reader', async () => {
    setup('PREBOARDING')
    mocks.context.mockResolvedValue({ context: { permissions: ['self:document:read'] } })
    expect(await render('documenten')).not.toContain('/my-signatures')
  })

  it('does not offer the employee dossier to a signing-only reader', async () => {
    mocks.context.mockResolvedValue({ context: { permissions: ['self:document-signing:read'] } })
    const markup = await render('documenten')
    expect(markup).toContain('href="/my-signatures"')
    expect(markup).not.toContain('/employees/')
  })

  it.each(['nl', 'en'] as const)('resolves every section with real %s translations', async (locale) => {
    setup('EMPLOYEE', locale)
    for (const section of ['onboarding', 'profiel', 'documenten', 'aanvragen', 'werk', 'team']) {
      const markup = await render(section)
      expect(markup).toContain('href="/focus"')
      expect(markup).not.toMatch(/\{\w+\}/)
    }
  })

  it('links active employees to existing routes and keeps the requests seam explicit', async () => {
    expect(await render('profiel')).toContain('?tab=personal')
    expect(await render('documenten')).toContain('?tab=documents')
    expect(await render('werk')).toContain('href="/work"')
    expect(await render('team')).toContain('href="/organization-chart?view=manager"')
    const requests = await render('aanvragen')
    expect(requests).toContain('Dit overzicht is nog niet beschikbaar.')
    expect(requests).not.toContain('href="/work"')
  })
})
