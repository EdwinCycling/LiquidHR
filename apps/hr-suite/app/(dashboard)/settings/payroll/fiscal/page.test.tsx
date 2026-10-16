import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createTranslator } from '@/lib/i18n/translator'
import nl from '@/messages/nl/settings.json'
import en from '@/messages/en/settings.json'

const mocks = vi.hoisted(() => ({ locale: 'nl' }))
vi.mock('@/lib/i18n/server', () => ({
  getLocale: async () => mocks.locale,
  getTranslator: async () => createTranslator(mocks.locale === 'nl' ? nl : en),
}))
vi.mock('@/lib/preferences/server', () => ({ getUserPreferences: async () => ({ dateFormat: 'yyyy-MM-dd' }) }))
vi.mock('@/lib/employment/employment-payroll-tax-profile-service', () => ({
  EmploymentPayrollTaxProfileError: class extends Error {},
  getPayrollFiscalAdministrationSettings: async () => ({ administration: { name: 'Mars BV' }, rows: [], payrollTaxNumbers: [] }),
}))
import FiscalSettingsPage from './page'

describe('Fiscale inrichting met echte vertalingen', () => {
  it.each(['nl', 'en'])('rendert de lege lijst en zoekactie in %s', async locale => {
    mocks.locale = locale
    const html = renderToStaticMarkup(await FiscalSettingsPage({ searchParams: Promise.resolve({}) }))
    expect(html).toContain('Mars BV')
    expect(html).toContain(createTranslator(locale === 'nl' ? nl : en)('payrollFiscal.applyFilter'))
    expect(html).not.toContain('I18N_MESSAGE_MISSING')
  })
})
