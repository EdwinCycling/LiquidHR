export const securityHeaders: Array<{ key: string; value: string }> = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
]

const DOCUMENT_PREVIEW_PATH = /^\/api\/employees\/[^/]+\/documents\/[^/]+\/preview$/

export function frameOptionsForPath(pathname: string): 'DENY' | 'SAMEORIGIN' {
  return DOCUMENT_PREVIEW_PATH.test(pathname) ? 'SAMEORIGIN' : 'DENY'
}
