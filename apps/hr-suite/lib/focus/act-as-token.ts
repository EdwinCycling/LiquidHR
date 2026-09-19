import 'server-only'

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import type { Json } from '@scope/db'
import { AuthorizationError, getRequestAuthorizationContext, type AuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { focusActAsHref } from './url'

export const FOCUS_ACT_AS_QUERY = 'actAs'
export const FOCUS_ACT_AS_MODE = 'FOCUS_ESS' as const
const ACT_AS_MAX_AGE_SECONDS = 10 * 60

export interface FocusActAsTokenPayload {
  actorUserId: string
  tenantId: string
  hrGroupId: string
  subjectEmployeeId: string
  mode: typeof FOCUS_ACT_AS_MODE
  issuedAt: number
  expiresAt: number
  nonce: string
}

export interface FocusActAsSession {
  token: string
  actorUserId: string
  tenantId: string
  hrGroupId: string
  subjectEmployeeId: string
  mode: typeof FOCUS_ACT_AS_MODE
  expiresAt: number
  subjectName: string
}

function tokenSecret(): string {
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('FOCUS_ACT_AS_SECRET_MISSING')
  return secret
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function sign(value: string): string {
  return createHmac('sha256', tokenSecret()).update(value).digest('base64url')
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export function createFocusActAsToken(input: Omit<FocusActAsTokenPayload, 'issuedAt' | 'expiresAt' | 'nonce'>): string {
  const now = Math.floor(Date.now() / 1000)
  const payload: FocusActAsTokenPayload = {
    ...input,
    mode: FOCUS_ACT_AS_MODE,
    issuedAt: now,
    expiresAt: now + ACT_AS_MAX_AGE_SECONDS,
    nonce: randomUUID(),
  }
  const encodedPayload = encode(JSON.stringify(payload))
  return `${encodedPayload}.${sign(encodedPayload)}`
}

export function readFocusActAsToken(token: string | null): FocusActAsTokenPayload | null {
  if (!token) return null
  const [encodedPayload, encodedSignature] = token.split('.')
  if (!encodedPayload || !encodedSignature) return null

  const expectedSignature = Buffer.from(sign(encodedPayload), 'utf8')
  const receivedSignature = Buffer.from(encodedSignature, 'utf8')
  if (expectedSignature.length !== receivedSignature.length || !timingSafeEqual(expectedSignature, receivedSignature)) return null

  try {
    const raw = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<FocusActAsTokenPayload>
    const now = Math.floor(Date.now() / 1000)
    if (
      raw.mode !== FOCUS_ACT_AS_MODE
      || typeof raw.actorUserId !== 'string' || !isValidUuid(raw.actorUserId)
      || typeof raw.tenantId !== 'string' || !isValidUuid(raw.tenantId)
      || typeof raw.hrGroupId !== 'string' || !isValidUuid(raw.hrGroupId)
      || typeof raw.subjectEmployeeId !== 'string' || !isValidUuid(raw.subjectEmployeeId)
      || typeof raw.issuedAt !== 'number' || typeof raw.expiresAt !== 'number'
      || typeof raw.nonce !== 'string' || !isValidUuid(raw.nonce)
      || raw.issuedAt > now + 60
      || raw.expiresAt <= now
      || raw.expiresAt - raw.issuedAt > ACT_AS_MAX_AGE_SECONDS
    ) return null
    return raw as FocusActAsTokenPayload
  } catch {
    return null
  }
}

export async function requireFocusActAsStartPermission(): Promise<Awaited<ReturnType<typeof getRequestAuthorizationContext>>> {
  const requestContext = await getRequestAuthorizationContext()
  if (!requestContext.context.permissions.includes('focus:act-as-employee')) {
    throw new AuthorizationError('Je hebt geen recht om als medewerker in Focus te handelen.')
  }
  if (requestContext.context.activeRoles.some((role) => role === 'TENANT_ADMIN' || role === 'HR_ADMIN') === false) {
    throw new AuthorizationError('Alleen HR-beheerders kunnen als medewerker in Focus handelen.')
  }
  return requestContext
}

export async function resolveFocusActAsSession(
  token: string | null | undefined,
  context: AuthContext,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<FocusActAsSession | null> {
  if (!token) return null
  const payload = readFocusActAsToken(token)
  if (
    !payload
    || payload.actorUserId !== context.userId
    || payload.tenantId !== context.tenantId
    || payload.hrGroupId !== context.hrGroupId
    || !context.permissions.includes('focus:act-as-employee')
    || !context.activeRoles.some((role) => role === 'TENANT_ADMIN' || role === 'HR_ADMIN')
  ) throw new AuthorizationError('Deze Focus-sessie is ongeldig of verlopen.')

  const { data, error } = await supabase
    .from('employees')
    .select('id,first_name,birth_name,is_active,is_archived,deleted_at')
    .eq('tenant_id', payload.tenantId)
    .eq('hr_group_id', payload.hrGroupId)
    .eq('id', payload.subjectEmployeeId)
    .maybeSingle()
  if (error) throw error
  if (!data || !data.is_active || data.is_archived || data.deleted_at !== null) {
    throw new AuthorizationError('Deze medewerker is niet beschikbaar voor Focus.')
  }

  return {
    token,
    actorUserId: payload.actorUserId,
    tenantId: payload.tenantId,
    hrGroupId: payload.hrGroupId,
    subjectEmployeeId: payload.subjectEmployeeId,
    mode: payload.mode,
    expiresAt: payload.expiresAt,
    subjectName: `${data.first_name} ${data.birth_name}`.trim(),
  }
}

export async function createFocusActAsSession(employeeId: string): Promise<{ token: string; href: string }> {
  const requestContext = await requireFocusActAsStartPermission()
  const { context, supabase } = requestContext
  if (!context.hrGroupId) throw new AuthorizationError('HR-groepcontext ontbreekt.')
  if (employeeId === context.employeeId) throw new AuthorizationError('Kies een andere medewerker voor Focus act-as.')

  const { data, error } = await supabase
    .from('employees')
    .select('id,is_active,is_archived,deleted_at')
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', context.hrGroupId)
    .eq('id', employeeId)
    .maybeSingle()
  if (error) throw error
  if (!data || !data.is_active || data.is_archived || data.deleted_at !== null) throw new AuthorizationError('Deze medewerker is niet beschikbaar voor Focus.')

  const token = createFocusActAsToken({
    actorUserId: context.userId,
    tenantId: context.tenantId,
    hrGroupId: context.hrGroupId,
    subjectEmployeeId: employeeId,
    mode: FOCUS_ACT_AS_MODE,
  })
  await writeFocusActAsAudit(supabase, context, employeeId, 'START', {
    mode: FOCUS_ACT_AS_MODE,
    expiresAt: readFocusActAsToken(token)?.expiresAt ?? null,
  })
  return { token, href: focusActAsHref('/focus', token) }
}

export async function writeFocusActAsAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  context: Pick<AuthContext, 'tenantId' | 'userId' | 'administrationId'>,
  subjectEmployeeId: string,
  action: 'START' | 'STOP',
  changes: Record<string, Json>,
): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    tenant_id: context.tenantId,
    administration_id: context.administrationId,
    entity_name: 'focus_act_as_session',
    entity_id: subjectEmployeeId,
    actor_user_id: context.userId,
    subject_employee_id: subjectEmployeeId,
    action,
    changes,
  })
  if (error) throw error
}
