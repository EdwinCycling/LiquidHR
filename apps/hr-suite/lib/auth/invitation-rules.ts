import { createHash } from 'node:crypto'

export type InvitationEmailKind = 'PRIVATE' | 'BUSINESS'
export type InvitationPurpose = 'PREBOARDING_EMPLOYEE' | 'BUSINESS_USER'
export type InvitationScopeType = 'TENANT' | 'ADMINISTRATION'

export type InvitationRuleErrorCode =
  | 'BUSINESS_EMAIL_REQUIRED'
  | 'PRIVATE_EMAIL_REQUIRED'
  | 'EMPLOYEE_REQUIRED'
  | 'ADMINISTRATION_REQUIRED'
  | 'TENANT_SCOPE_REQUIRES_NO_ADMINISTRATION'

export interface InvitationRuleInput {
  purpose: InvitationPurpose
  emailKind: InvitationEmailKind
  employeeId: string | null
  administrationId: string | null
  scopeType: InvitationScopeType
}

export type InvitationRuleResult =
  | { ok: true }
  | { ok: false; code: InvitationRuleErrorCode }

export interface CreateInvitationInput extends InvitationRuleInput {
  email: string
  managementRoleId: string
  origin: string
}

export interface CreatedInvitation {
  id: string
  expiresAt: string
}

export type InvitationErrorCode =
  | InvitationRuleErrorCode
  | 'INVITATION_ALREADY_PENDING'
  | 'INVITATION_CREATE_FAILED'
  | 'INVITATION_DELIVERY_FAILED'

export class InvitationError extends Error {
  constructor(
    readonly code: InvitationErrorCode,
    readonly status: 400 | 409 | 502,
  ) {
    super(code)
    this.name = 'InvitationError'
  }
}

export function normalizeInvitationEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function validateInvitationRules(input: InvitationRuleInput): InvitationRuleResult {
  if (input.purpose === 'BUSINESS_USER' && input.emailKind !== 'BUSINESS') {
    return { ok: false, code: 'BUSINESS_EMAIL_REQUIRED' }
  }

  if (input.purpose === 'PREBOARDING_EMPLOYEE' && input.emailKind !== 'PRIVATE') {
    return { ok: false, code: 'PRIVATE_EMAIL_REQUIRED' }
  }

  if (input.purpose === 'PREBOARDING_EMPLOYEE' && !input.employeeId) {
    return { ok: false, code: 'EMPLOYEE_REQUIRED' }
  }

  if (input.scopeType === 'ADMINISTRATION' && !input.administrationId) {
    return { ok: false, code: 'ADMINISTRATION_REQUIRED' }
  }

  if (input.scopeType === 'TENANT' && input.administrationId) {
    return { ok: false, code: 'TENANT_SCOPE_REQUIRES_NO_ADMINISTRATION' }
  }

  return { ok: true }
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function buildInvitationRedirectUrl(origin: string, token: string): string {
  const url = new URL('/invite/accept', origin)
  const isLocalHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)

  if (url.protocol !== 'https:' && !isLocalHttp) {
    throw new InvitationError('INVITATION_CREATE_FAILED', 400)
  }

  url.searchParams.set('invitation', token)
  return url.toString()
}
