import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveRequestOrigin } from './request-origin'

describe('resolveRequestOrigin', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('gebruikt de publieke forwarded host boven een verouderde configuratie', () => {
    expect(resolveRequestOrigin({
      forwardedHost: 'liquid-hr-hr-suite.vercel.app',
      forwardedProtocol: 'https',
      host: 'internal.vercel.app',
      canonicalUrl: 'https://liquidhr.vercel.app',
      trustedHosts: ['liquid-hr-hr-suite.vercel.app'],
    })).toBe('https://liquid-hr-hr-suite.vercel.app')
  })

  it('ondersteunt lokale http-ontwikkeling zonder een externe host te vertrouwen', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(resolveRequestOrigin({ host: 'localhost:3000', canonicalUrl: 'https://liquidhr.vercel.app' })).toBe('http://localhost:3000')
    expect(resolveRequestOrigin({ host: '127.0.0.1:3000', canonicalUrl: 'https://liquidhr.vercel.app' })).toBe('http://127.0.0.1:3000')
  })

  it('gebruikt in productie niet een lokaal Host-alias als publieke origin', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'production')
    expect(resolveRequestOrigin({
      host: 'localhost:3000',
      canonicalUrl: 'https://liquidhr.vercel.app',
    })).toBe('https://liquidhr.vercel.app')
  })

  it('vertrouwt een door Vercel aangeleverde deployment-host zonder hardcoded allowlist', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('VERCEL_URL', 'feature-git-main.vercel.app')
    expect(resolveRequestOrigin({
      forwardedHost: 'feature-git-main.vercel.app',
      forwardedProtocol: 'https',
      canonicalUrl: 'https://liquidhr.vercel.app',
    })).toBe('https://feature-git-main.vercel.app')
  })

  it('valt bij ongeldige proxyheaders veilig terug op de geconfigureerde origin', () => {
    expect(resolveRequestOrigin({
      forwardedHost: 'example.com/path',
      forwardedProtocol: 'javascript',
      host: 'example.com\\attacker.test',
      canonicalUrl: 'https://liquid-hr-hr-suite.vercel.app/app',
    })).toBe('https://liquid-hr-hr-suite.vercel.app')
  })

  it('pakt bij samengestelde proxyheaders uitsluitend de eerste hop', () => {
    expect(resolveRequestOrigin({
      forwardedHost: 'liquid-hr-hr-suite.vercel.app, internal.vercel.app',
      forwardedProtocol: 'https, http',
      canonicalUrl: 'https://liquidhr.vercel.app',
      trustedHosts: ['liquid-hr-hr-suite.vercel.app'],
    })).toBe('https://liquid-hr-hr-suite.vercel.app')
  })

  it('vertrouwt geen onbekende forwarded host en valt terug op de canonieke origin', () => {
    expect(resolveRequestOrigin({
      forwardedHost: 'attacker.example',
      forwardedProtocol: 'https',
      host: 'internal.vercel.app',
      canonicalUrl: 'https://liquid-hr-hr-suite.vercel.app',
      fallbackUrl: 'https://internal.vercel.app/auth/callback',
      trustedHosts: ['liquid-hr-hr-suite.vercel.app'],
    })).toBe('https://liquid-hr-hr-suite.vercel.app')
  })

  it('verwerpt een onbekende productiehost ook wanneer de fallback dezelfde host bevat', () => {
    expect(resolveRequestOrigin({
      forwardedHost: 'attacker.example:443',
      host: 'attacker.example:443',
      fallbackUrl: 'https://attacker.example/auth/callback',
      canonicalUrl: 'https://liquid-hr-hr-suite.vercel.app',
      trustedHosts: ['liquid-hr-hr-suite.vercel.app'],
    })).toBe('https://liquid-hr-hr-suite.vercel.app')
  })

  it('vertrouwt zonder canonical configuratie geen externe request-fallback', () => {
    expect(resolveRequestOrigin({
      forwardedHost: 'attacker.example',
      host: 'attacker.example',
      fallbackUrl: 'https://attacker.example/auth/callback',
    })).toBe('http://localhost:3000')
  })

  it('laat een expliciet toegestane Vercel Preview-host toe', () => {
    expect(resolveRequestOrigin({
      forwardedHost: 'feature-git-main.vercel.app',
      forwardedProtocol: 'https',
      canonicalUrl: 'https://liquid-hr-hr-suite.vercel.app',
      trustedHosts: ['feature-git-main.vercel.app', 'liquid-hr-hr-suite.vercel.app'],
    })).toBe('https://feature-git-main.vercel.app')
  })
})
