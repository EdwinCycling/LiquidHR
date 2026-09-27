export function focusActAsHref(href: string, token?: string | null): string {
  void token
  if (!(href === '/focus' || href.startsWith('/focus/'))) return href
  const [path, hash] = href.split('#', 2)
  const [pathname, query] = path.split('?', 2)
  const params = new URLSearchParams(query ?? '')
  params.delete('actAs')
  const serialized = params.toString()
  return `${pathname}${serialized ? `?${serialized}` : ''}${hash ? `#${hash}` : ''}`
}
