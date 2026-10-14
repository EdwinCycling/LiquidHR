import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LocalPersonaSwitcher, type LocalPersonaOption } from './local-persona-switcher'

const labels = {
  choosePersona: 'Kies een account',
  switchAccount: 'Account openen',
  returnToOwner: 'Terug naar Edwin',
  unavailable: 'momenteel niet beschikbaar',
  returnDescription: 'Je wordt opnieuw aangemeld bij je eigen account.',
}

const options: LocalPersonaOption[] = [
  { key: 'edwin', email: 'edwin@editsolutions.nl', available: true, label: 'Mijn account — Edwin' },
  { key: 'hr-admin', email: 'hradmin.fixture@liquidhr.test', available: true, label: 'HR-beheerder' },
  { key: 'manager', email: 'manager.fixture@liquidhr.test', available: true, label: 'Manager' },
  { key: 'employee', email: 'employee.fixture@liquidhr.test', available: true, label: 'Medewerker' },
  { key: 'payroll-lisa', email: 'lisa.test@liquidhr.test', available: true, label: 'Payroll — Lisa' },
  { key: 'payroll-jaap', email: 'jaap.test@liquidhr.test', available: false, label: 'Payroll — Jaap' },
  { key: 'payroll-frits', email: 'frits.test@liquidhr.test', available: false, label: 'Payroll — Frits' },
]

describe('LocalPersonaSwitcher', () => {
  it('shows available accounts and disables personas without an Auth link', () => {
    const markup = renderToStaticMarkup(createElement(LocalPersonaSwitcher, { isOwner: true, options, labels }))

    expect(markup).toContain('value="payroll-lisa"')
    expect(markup).toContain('disabled="" value="payroll-jaap"')
    expect(markup).toContain('disabled="" value="payroll-frits"')
    expect(markup).toContain('action="/api/auth/test-role-switch"')
    expect(markup).not.toContain('edwin@editsolutions.nl')
    expect(markup).not.toContain('hashed_token')
  })

  it('offers only a return to Edwin when a persona is active', () => {
    const markup = renderToStaticMarkup(createElement(LocalPersonaSwitcher, { isOwner: false, options, labels }))

    expect(markup).toContain('value="edwin"')
    expect(markup).toContain(labels.returnToOwner)
    expect(markup).not.toContain('local-persona-target')
    expect(markup).not.toContain('value="manager"')
  })
})
