/** @vitest-environment happy-dom */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PublicApplicationForm, type PublicApplicationLabels, type TurnstileApi, type TurnstileRenderOptions } from './public-application-form'

vi.mock('next/script', () => ({ default: () => null }))

const labels: PublicApplicationLabels = {
  title: 'Sollicitatieformulier',
  firstName: 'Voornaam',
  lastName: 'Achternaam',
  email: 'E-mailadres',
  phone: 'Telefoonnummer',
  motivation: 'Motivatie',
  cv: 'CV',
  privacy: 'Privacytekst',
  privacyLink: 'Privacybeleid',
  challenge: 'Beveiligingscontrole',
  challengeDescription: 'Bevestig dat je geen geautomatiseerd formulier gebruikt.',
  challengeLoading: 'Beveiligingscontrole laden…',
  challengeUnavailable: 'De beveiligingscontrole is tijdelijk niet beschikbaar.',
  challengeError: 'De beveiligingscontrole kon niet worden geladen. Probeer opnieuw.',
  challengeRetry: 'Nieuwe beveiligingscontrole',
  submit: 'Versturen',
  submitting: 'Bezig…',
  securityBlocked: 'Geblokkeerd',
  confirmed: 'Ontvangen',
  confirmedDescription: 'Bedankt.',
  error: 'Mislukt',
}

describe('PublicApplicationForm Turnstile contract', () => {
  let container: HTMLDivElement
  let root: Root
  let challengeOptions: TurnstileRenderOptions
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>
  const renderMock = vi.fn((_element: HTMLElement, options: TurnstileRenderOptions) => {
    challengeOptions = options
    return 'widget-1'
  })
  const resetMock = vi.fn()
  const removeMock = vi.fn()

  beforeEach(async () => {
    container = document.createElement('div')
    document.body.append(container)
    const turnstile: TurnstileApi = { render: renderMock, reset: resetMock, remove: removeMock }
    window.turnstile = turnstile
    fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
    await act(async () => {
      root = createRoot(container)
      root.render(<PublicApplicationForm labels={labels} publicId="publication-1" siteKey="site-key" slug="vacancy" />)
    })
    await act(async () => {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
    })
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    delete window.turnstile
    vi.restoreAllMocks()
    renderMock.mockClear()
    resetMock.mockClear()
    removeMock.mockClear()
  })

  it('does not submit while the challenge has no valid token', async () => {
    const form = container.querySelector('form')
    const submit = container.querySelector('button[type="submit"]') as HTMLButtonElement

    expect(renderMock).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ sitekey: 'site-key' }))
    expect(submit.disabled).toBe(true)
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends the successful challenge token as challengeToken', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ state: 'CONFIRMED' }), { status: 201 }))
    const form = container.querySelector('form')
    ;(container.querySelector('input[name="firstName"]') as HTMLInputElement).value = 'SEC012'
    ;(container.querySelector('input[name="lastName"]') as HTMLInputElement).value = 'Synthetic'
    ;(container.querySelector('input[name="email"]') as HTMLInputElement).value = 'sec012@example.com'

    await act(async () => {
      challengeOptions.callback('challenge-token')
    })
    expect((container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(false)
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    const requestBody = fetchMock.mock.calls[0]?.[1]?.body
    expect(requestBody).toBeInstanceOf(FormData)
    expect((requestBody as FormData).get('challengeToken')).toBe('challenge-token')
  })

  it('clears the token after expiry and reset', async () => {
    await act(async () => {
      challengeOptions.callback('challenge-token')
      challengeOptions['expired-callback']()
    })
    expect((container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true)

    await act(async () => {
      challengeOptions.callback('challenge-token')
      challengeOptions['error-callback']()
    })
    const retry = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === labels.challengeRetry)
    expect(retry).toBeDefined()
    await act(async () => retry?.click())

    expect(resetMock).toHaveBeenCalledWith('widget-1')
    expect((container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true)
  })
})
