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

function mount() {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(createElement(LoginForm, {
    authError: false,
    labels,
    nextPath: '/dashboard/start',
    providerError: false,
  })))
  return { host, unmount: () => act(() => root.unmount()) }
}

describe('LoginForm', () => {
  it('keeps ordinary sign-in available without a developer login action', () => {
    const mounted = mount()

    expect(mounted.host.querySelector('form[action="/api/auth/test-login"]')).toBeNull()
    expect(mounted.host.querySelector('input[name="email"]')).not.toBeNull()
    expect(mounted.host.querySelector('input[name="password"]')).not.toBeNull()
    expect(mounted.host.textContent).toContain(labels.signInWithGoogle)
    expect(mounted.host.textContent).not.toMatch(/test|fixture|demo|development/i)

    mounted.unmount()
  })

})
