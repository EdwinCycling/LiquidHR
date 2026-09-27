// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { LoginForm, type LoginFormLabels } from './login-form'

vi.mock('@/lib/auth/login-actions', () => ({
  requestPasswordReset: vi.fn(),
  signInWithGoogle: vi.fn(),
  signInWithPassword: vi.fn(),
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const labels: LoginFormLabels = {
  email: 'E-mailadres',
  password: 'Wachtwoord',
  signIn: 'Inloggen',
  signingIn: 'Bezig met inloggen',
  testLogin: 'Alleen lokaal testen',
  testLoginAsHrAdmin: 'Inloggen als Test HR Admin',
  testLoginFailed: 'Testinloggen is niet gelukt',
  signInWithGoogle: 'Doorgaan met Google',
  or: 'of',
  forgotPassword: 'Wachtwoord vergeten?',
  resetPassword: 'Herstel wachtwoord',
  resetInstruction: 'Vul je e-mailadres in.',
  sendReset: 'Verstuur herstellink',
  sendingReset: 'Bezig met versturen',
  backToLogin: 'Terug naar inloggen',
  resetSent: 'Je ontvangt een herstelmail.',
  invalidCredentials: 'E-mailadres of wachtwoord is onjuist.',
  authFailed: 'Inloggen is niet afgerond.',
  providerUnavailable: 'Google-inloggen is niet beschikbaar.',
  invitationOnly: 'Alleen toegankelijk op uitnodiging.',
}

function mount(testLoginEnabled: boolean) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(createElement(LoginForm, {
    authError: false,
    labels,
    nextPath: '/dashboard/start',
    providerError: false,
    testLoginEnabled,
    testLoginError: false,
  })))
  return { host, unmount: () => act(() => root.unmount()) }
}

describe('LoginForm local test harness', () => {
  it('keeps the test login absent when the server-side gate is closed and retains normal sign-in', () => {
    const mounted = mount(false)

    expect(mounted.host.querySelector('form[action="/api/auth/test-login"]')).toBeNull()
    expect(mounted.host.querySelector('input[name="email"]')).not.toBeNull()
    expect(mounted.host.querySelector('input[name="password"]')).not.toBeNull()
    expect(mounted.host.textContent).toContain(labels.signInWithGoogle)

    mounted.unmount()
  })

  it('posts only the fixed persona and exposes no test credential in the browser form', () => {
    const mounted = mount(true)
    const form = mounted.host.querySelector('form[action="/api/auth/test-login"]')

    expect(form).not.toBeNull()
    expect(form?.querySelectorAll('input')).toHaveLength(1)
    expect(form?.querySelector('input')?.name).toBe('persona')
    expect(form?.querySelector('input')?.value).toBe('hr-admin')
    expect(form?.querySelector('input[name="password"]')).toBeNull()
    expect(form?.querySelector('input[name="email"]')).toBeNull()
    expect(form?.textContent).toContain(labels.testLoginAsHrAdmin)

    mounted.unmount()
  })
})
