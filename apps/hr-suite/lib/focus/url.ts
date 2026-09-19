export function focusActAsHref(href: string, token: string | null | undefined): string {
  if (!token || !(href === '/focus' || href.startsWith('/focus/'))) return href
  const [path, hash] = href.split('#', 2)
  const [pathname, query] = path.split('?', 2)
  const params = new URLSearchParams(query ?? '')
  params.set('actAs', token)
  const serialized = params.toString()
  return `${pathname}${serialized ? `?${serialized}` : ''}${hash ? `#${hash}` : ''}`
}
