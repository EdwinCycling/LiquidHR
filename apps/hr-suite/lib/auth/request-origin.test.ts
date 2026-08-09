import { describe, expect, it } from 'vitest'
import { resolveRequestOrigin } from './request-origin'

describe('resolveRequestOrigin', () => {
  it('gebruikt de publieke forwarded host boven een verouderde configuratie', () => {
    expect(resolveRequestOrigin({
      forwardedHost: 'liquid-hr-hr-suite.vercel.app',
      forwardedProtocol: 'https',
      host: 'internal.vercel.app',
      fallbackUrl: 'https://liquidhr.vercel.app',
    })).toBe('https://liquid-hr-hr-suite.vercel.app')
  })

  it('ondersteunt lokale http-ontwikkeling zonder een externe host te vertrouwen', () => {
    expect(resolveRequestOrigin({ host: 'localhost:3000' })).toBe('http://localhost:3000')
    expect(resolveRequestOrigin({ host: '127.0.0.1:3000' })).toBe('http://127.0.0.1:3000')
  })

  it('valt bij ongeldige proxyheaders veilig terug op de geconfigureerde origin', () => {
    expect(resolveRequestOrigin({
      forwardedHost: 'example.com/path',
      forwardedProtocol: 'javascript',
      host: 'example.com\\attacker.test',
      fallbackUrl: 'https://liquid-hr-hr-suite.vercel.app/app',
    })).toBe('https://liquid-hr-hr-suite.vercel.app')
  })

  it('pakt bij samengestelde proxyheaders uitsluitend de eerste hop', () => {
    expect(resolveRequestOrigin({
      forwardedHost: 'liquid-hr-hr-suite.vercel.app, internal.vercel.app',
      forwardedProtocol: 'https, http',
    })).toBe('https://liquid-hr-hr-suite.vercel.app')
  })
})
