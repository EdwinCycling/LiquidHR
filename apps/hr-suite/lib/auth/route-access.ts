const publicPrefixes = ['/login', '/invite', '/auth', '/api', '/geen-toegang'] as const

export function isProtectedApplicationPath(pathname: string): boolean {
  if (pathname === '/') return false
  return !publicPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
