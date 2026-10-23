export type ProcessWorkReturnContext = 'focus-requests' | 'focus-work'

export function getProcessWorkItemHref(domain: string | null | undefined, workItemId: string): string {
  switch (domain) {
    case 'LEAVE':
      return `/leave/requests/${workItemId}`
    case 'ACTUAL_WORK':
      return `/actual-work/workflows/${workItemId}`
    case 'P_MUTATION':
    case 'OTHER':
    default:
      return `/work/${workItemId}`
  }
}

export function parseProcessWorkReturnContext(value: string): ProcessWorkReturnContext | undefined {
  return value === 'focus-requests' || value === 'focus-work' ? value : undefined
}

export function processWorkReturnHref(value: string | null | undefined): string | undefined {
  if (value === 'focus-requests') return '/focus/aanvragen'
  if (value === 'focus-work') return '/focus/werk'
  return undefined
}

export function withProcessWorkReturnContext(href: string, context?: ProcessWorkReturnContext): string {
  if (!context || !href.startsWith('/work/')) return href
  const hashIndex = href.indexOf('#')
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : ''
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href
  const queryIndex = withoutHash.indexOf('?')
  const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash
  const params = new URLSearchParams(queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : '')
  params.set('returnTo', context)
  return `${pathname}?${params.toString()}${hash}`
}
