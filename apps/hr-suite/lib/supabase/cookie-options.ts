function isLocalOrigin(value: string | undefined): boolean {
  if (!value) return false

  try {
    const parsed = new URL(value)
    const hostname = parsed.hostname.replace(/^\[|\]$/g, '')
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  } catch {
    return false
  }
}

export function getAuthCookieOptions(): { secure: boolean } {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim()
  const isProduction = process.env.NODE_ENV?.trim().toLowerCase() === 'production'
  const hasHttpsOrigin = configuredOrigin?.toLowerCase().startsWith('https://') ?? false
  const isVercelRuntime = Boolean(process.env.VERCEL_ENV?.trim() || process.env.VERCEL_URL?.trim())

  return {
    secure: isProduction && !isLocalOrigin(configuredOrigin) && (hasHttpsOrigin || isVercelRuntime),
  }
}
