import { isIP } from 'node:net'

export type TrustedClientIdentityFailure =
  | 'LOCAL_RUNTIME'
  | 'UNSUPPORTED_RUNTIME'
  | 'MISSING_PROVENANCE'
  | 'MISSING_CLIENT_IDENTITY'
  | 'INVALID_CLIENT_IDENTITY'
  | 'MISMATCHED_CROSS_CHECK'
  | 'UNSUPPORTED_PROXY_HEADER'

export type TrustedClientIdentityResult =
  | { readonly ok: true; readonly kind: 'TRUSTED_VERCEL_CLIENT'; readonly identity: string }
  | { readonly ok: false; readonly kind: 'UNAVAILABLE'; readonly reason: TrustedClientIdentityFailure }

export type TrustedClientIdentityTestSeam = {
  readonly testIdentity?: string
}

type RuntimeEnvironment = {
  readonly vercel?: string
  readonly vercelEnvironment?: string
}

const UNSUPPORTED_PROXY_HEADERS = ['cf-connecting-ip', 'true-client-ip', 'x-client-ip']

function unavailable(reason: TrustedClientIdentityFailure): TrustedClientIdentityResult {
  return { ok: false, kind: 'UNAVAILABLE', reason }
}

function normalizeAddress(value: string | null): string | null {
  if (value === null) return null
  const trimmed = value.trim()
  if (!trimmed || value !== trimmed || trimmed.includes(',') || trimmed.includes(';') || /\s/.test(trimmed)) return null
  const candidate = trimmed.startsWith('[') && trimmed.endsWith(']') ? trimmed.slice(1, -1) : trimmed
  if (!candidate || candidate.includes('[') || candidate.includes(']')) return null
  return isIP(candidate) === 0 ? null : candidate.toLowerCase()
}

function hasSingleProvenanceValue(headers: Headers, name: string): boolean {
  const value = headers.get(name)?.trim() ?? ''
  return value.length > 0 && !value.includes(',') && !value.includes('\n') && !value.includes('\r')
}

function runtimeEnvironment(): RuntimeEnvironment {
  return { vercel: process.env.VERCEL, vercelEnvironment: process.env.VERCEL_ENV }
}

export function getTrustedClientIdentity(
  request: Request,
  seam: TrustedClientIdentityTestSeam = {},
  environment: RuntimeEnvironment = runtimeEnvironment(),
): TrustedClientIdentityResult {
  if (process.env.NODE_ENV === 'test' && seam.testIdentity !== undefined) {
    const identity = normalizeAddress(seam.testIdentity)
    return identity ? { ok: true, kind: 'TRUSTED_VERCEL_CLIENT', identity } : unavailable('INVALID_CLIENT_IDENTITY')
  }

  if (environment.vercel !== '1') return unavailable(environment.vercelEnvironment ? 'UNSUPPORTED_RUNTIME' : 'LOCAL_RUNTIME')
  if (environment.vercelEnvironment !== 'production' && environment.vercelEnvironment !== 'preview') return unavailable('UNSUPPORTED_RUNTIME')

  if (UNSUPPORTED_PROXY_HEADERS.some((name) => request.headers.has(name))) return unavailable('UNSUPPORTED_PROXY_HEADER')
  if (!hasSingleProvenanceValue(request.headers, 'x-vercel-id') || !hasSingleProvenanceValue(request.headers, 'x-vercel-deployment-url')) return unavailable('MISSING_PROVENANCE')

  const identity = normalizeAddress(request.headers.get('x-forwarded-for'))
  if (!identity) return unavailable(request.headers.has('x-forwarded-for') ? 'INVALID_CLIENT_IDENTITY' : 'MISSING_CLIENT_IDENTITY')

  return { ok: true, kind: 'TRUSTED_VERCEL_CLIENT', identity }
}
