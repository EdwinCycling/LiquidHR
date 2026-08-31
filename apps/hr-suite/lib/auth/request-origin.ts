interface RequestOriginInput {
  canonicalUrl?: string | null
  fallbackUrl?: string | null
  forwardedHost?: string | null
  forwardedProtocol?: string | null
  host?: string | null
  trustedHosts?: readonly (string | null | undefined)[]
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

function allowsLocalHost(): boolean {
  const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase() ?? ''
  const vercelEnv = process.env.VERCEL_ENV?.trim().toLowerCase() ?? ''

  return !vercelEnv
    ? nodeEnv !== 'production'
    : ['development', 'test'].includes(vercelEnv)
}

function fallbackOrigin(value: string | null | undefined): string | null {
  if (!value) return null

  try {
    const parsed = new URL(value)
    if (parsed.protocol === 'https:') return parsed.origin
    return parsed.protocol === 'http:' && isLocalHost(parsed.host) ? parsed.origin : null
  } catch {
    return null
  }
}

function trustedHostSet(input: RequestOriginInput, canonicalOrigin: string | null): Set<string> {
  const configuredHosts = [
    ...(input.trustedHosts ?? []),
    canonicalOrigin ? new URL(canonicalOrigin).host : null,
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]

  return new Set(configuredHosts.flatMap((value) => {
    const normalized = normalizeHost(value)
    return normalized ? [normalized] : []
  }))
}

function isTrustedHost(host: string, trustedHosts: Set<string>): boolean {
  return (isLocalHost(host) && allowsLocalHost()) || trustedHosts.has(host)
}

function trustedFallbackOrigin(value: string | null | undefined, trustedHosts: Set<string>): string | null {
  const origin = fallbackOrigin(value)
  if (!origin) return null

  const host = normalizeHost(new URL(origin).host)
  return host && isTrustedHost(host, trustedHosts) ? origin : null
}

export function resolveRequestOrigin(input: RequestOriginInput): string {
  const canonicalOrigin = fallbackOrigin(input.canonicalUrl ?? process.env.NEXT_PUBLIC_APP_URL)
  const trustedHosts = trustedHostSet(input, canonicalOrigin)
  const host = [input.forwardedHost, input.host]
    .map(normalizeHost)
    .find((candidate): candidate is string => candidate !== null && isTrustedHost(candidate, trustedHosts))

  if (host) {
    const forwardedProtocol = firstHeaderValue(input.forwardedProtocol)
    const protocol = isLocalHost(host) && forwardedProtocol !== 'https' ? 'http' : 'https'
    return `${protocol}://${host}`
  }

  return canonicalOrigin ?? trustedFallbackOrigin(input.fallbackUrl, trustedHosts) ?? 'http://localhost:3000'
}
