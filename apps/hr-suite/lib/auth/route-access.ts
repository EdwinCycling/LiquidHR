const publicPrefixes = ['/login', '/invite', '/auth', '/api', '/geen-toegang', '/vacancies', '/privacy', '/terms', '/icon.svg', '/brand/logo', '/manifest.webmanifest'] as const

export function isProtectedApplicationPath(pathname: string): boolean {
  if (pathname === '/') return false
  // The page itself enforces the canonical localhost Development gates.
  if (pathname === '/local/sign-in') return false
  return !publicPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
