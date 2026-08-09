interface RequestOriginInput {
  fallbackUrl?: string | null
  forwardedHost?: string | null
  forwardedProtocol?: string | null
  host?: string | null
}

function firstHeaderValue(value: string | null | undefined): string | null {
  const first = value?.split(',', 1)[0]?.trim()
  return first || null
}

function normalizeHost(value: string | null | undefined): string | null {
  const host = firstHeaderValue(value)
  if (!host || /[\s/\\@?#]/.test(host)) return null

  try {
    const parsed = new URL(`http://${host}`)
    if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
      return null
    }
    return parsed.host
  } catch {
    return null
  }
}

function isLocalHost(host: string): boolean {
  const hostname = host.startsWith('[')
    ? host.slice(1, host.indexOf(']'))
    : host.split(':', 1)[0]

  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

function fallbackOrigin(value: string | null | undefined): string | null {
  if (!value) return null

  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : null
  } catch {
    return null
  }
}

export function resolveRequestOrigin(input: RequestOriginInput): string {
  const host = normalizeHost(input.forwardedHost) ?? normalizeHost(input.host)
  if (host) {
    const forwardedProtocol = firstHeaderValue(input.forwardedProtocol)
    const protocol = isLocalHost(host) && forwardedProtocol !== 'https' ? 'http' : 'https'
    return `${protocol}://${host}`
  }

  return fallbackOrigin(input.fallbackUrl) ?? 'http://localhost:3000'
}
