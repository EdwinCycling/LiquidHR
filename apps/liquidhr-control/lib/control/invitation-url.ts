import { InvitationError } from './invitation-rules'

export function buildInvitationRedirectUrl(origin: string, token: string): string {
  const url = new URL(`/invite/${encodeURIComponent(token)}`, origin)
  const isLocalHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
  if (url.protocol !== 'https:' && !isLocalHttp) throw new InvitationError('INVITATION_CREATE_FAILED', 400)
  return url.toString()
}
