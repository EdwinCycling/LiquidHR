import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { createClient } from '@/lib/supabase/server'

export const TEST_ROLE_SWITCH_OWNER_EMAIL = 'edwin@editsolutions.nl'
export const TEST_ROLE_SWITCH_OWNER_COOKIE = 'liquidhr-local-persona-owner'
export const TEST_ROLE_SWITCH_SUPABASE_PROJECT_REF = 'wnpfloqpjvaacobppbpk'

export const TEST_ROLE_SWITCH_OWNER_IDENTITIES = [
  { key: 'edwin', email: TEST_ROLE_SWITCH_OWNER_EMAIL },
  { key: 'hr-admin', email: 'hradmin.fixture@liquidhr.test' },
] as const
export type TestRoleSwitchOwnerKey = (typeof TEST_ROLE_SWITCH_OWNER_IDENTITIES)[number]['key']

export const TEST_ROLE_SWITCH_TARGETS = [
  { key: 'edwin', email: TEST_ROLE_SWITCH_OWNER_EMAIL, available: true },
  { key: 'hr-admin', email: 'hradmin.fixture@liquidhr.test', available: true },
  { key: 'manager', email: 'manager.fixture@liquidhr.test', available: true },
  { key: 'employee', email: 'employee.fixture@liquidhr.test', available: true },
  { key: 'payroll-lisa', email: 'lisa.test@liquidhr.test', available: true },
  { key: 'payroll-jaap', email: 'jaap.test@liquidhr.test', available: false },
  { key: 'payroll-frits', email: 'frits.test@liquidhr.test', available: false },
  { key: 'payroll-demo-002', email: 'demo-002.payroll@liquidhr.test', available: false },
] as const

export type TestRoleSwitchTargetKey = (typeof TEST_ROLE_SWITCH_TARGETS)[number]['key']
export type TestRoleSwitchTarget = (typeof TEST_ROLE_SWITCH_TARGETS)[number]

export interface TestRoleSwitchEnvironment {
  nodeEnv?: string
  vercel?: string
  vercelEnv?: string
  vercelUrl?: string
  explicitFlag?: string
  supabaseUrl?: string
}

export interface LocalPersonaIdentity {
  email: string | null | undefined
  emailVerified: boolean
}

export async function getVerifiedLocalPersonaIdentity(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ userId: string; identity: LocalPersonaIdentity } | null> {
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const subject = claimsData?.claims?.sub
  if (claimsError || typeof subject !== 'string') return null

  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData.user
  if (userError || !user || user.id !== subject || user.is_anonymous === true) return null
  return {
    userId: subject,
    identity: { email: user.email, emailVerified: Boolean(user.email_confirmed_at) },
  }
}

function normalizedEnvironment(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}

export function normalizedEmail(email: string | null | undefined): string {
  return email?.trim().toLowerCase() ?? ''
}

export function resolveSupabaseProjectRef(supabaseUrl: string | undefined): string | null {
  if (!supabaseUrl) return null

  try {
    const parsed = new URL(supabaseUrl)
    if (
      parsed.protocol !== 'https:'
      || parsed.username
      || parsed.password
      || parsed.port
      || parsed.pathname !== '/'
      || parsed.search
      || parsed.hash
    ) return null

    const suffix = '.supabase.co'
    const hostname = parsed.hostname.toLowerCase()
    if (!hostname.endsWith(suffix)) return null

    const projectRef = hostname.slice(0, -suffix.length)
    return /^(?=.{1,63}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(projectRef)
      ? projectRef
      : null
  } catch {
    return null
  }
}

export function isTestRoleSwitchEnabled(environment: TestRoleSwitchEnvironment = {}): boolean {
  const nodeEnv = normalizedEnvironment(environment.nodeEnv ?? process.env.NODE_ENV)
  const vercel = normalizedEnvironment(environment.vercel ?? process.env.VERCEL)
  const vercelEnv = normalizedEnvironment(environment.vercelEnv ?? process.env.VERCEL_ENV)
  const vercelUrl = normalizedEnvironment(environment.vercelUrl ?? process.env.VERCEL_URL)
  const explicitFlag = normalizedEnvironment(environment.explicitFlag ?? process.env.LIQUIDHR_TEST_ROLE_SWITCH_ENABLED)
  const projectRef = resolveSupabaseProjectRef(environment.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL)
  const explicitlyEnabledForCanonicalProject = explicitFlag === 'true' && projectRef === TEST_ROLE_SWITCH_SUPABASE_PROJECT_REF

  return nodeEnv === 'development'
    && !vercel
    && !vercelEnv
    && !vercelUrl
    && explicitlyEnabledForCanonicalProject
}

export function isLocalhostHost(host: string | null | undefined): boolean {
  const candidate = host?.trim().toLowerCase()
  if (!candidate || candidate.includes(',') || candidate.includes('/') || candidate.includes('@')) return false

  try {
    const parsed = new URL(`http://${candidate}`)
    if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return false
    if (parsed.host.toLowerCase() !== candidate) return false
    return ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname.toLowerCase())
  } catch {
    return false
  }
}

export function isLocalPersonaRuntime(
  host: string | null | undefined,
  environment: TestRoleSwitchEnvironment = {},
): boolean {
  return isTestRoleSwitchEnabled(environment) && isLocalhostHost(host)
}

export function isTestRoleSwitchAccount(email: string | null | undefined): boolean {
  const candidate = normalizedEmail(email)
  return TEST_ROLE_SWITCH_TARGETS.some((target) => target.email === candidate)
}

export function getLocalPersonaOwnerKey(
  host: string | null | undefined,
  identity: LocalPersonaIdentity,
  environment: TestRoleSwitchEnvironment = {},
): TestRoleSwitchOwnerKey | null {
  if (!isLocalPersonaRuntime(host, environment) || !identity.emailVerified) return null
  return TEST_ROLE_SWITCH_OWNER_IDENTITIES.find((owner) => owner.email === normalizedEmail(identity.email))?.key ?? null
}

export function getLocalPersonaOwnerEmail(ownerKey: string | null | undefined): string | null {
  return TEST_ROLE_SWITCH_OWNER_IDENTITIES.find((owner) => owner.key === ownerKey)?.email ?? null
}

export function getLocalPersonaOperatorTargetKeys(ownerKey: TestRoleSwitchOwnerKey): readonly TestRoleSwitchTargetKey[] {
  if (ownerKey === 'hr-admin') return ['manager', 'employee', 'payroll-lisa', 'payroll-jaap', 'payroll-frits', 'payroll-demo-002']
  return TEST_ROLE_SWITCH_TARGETS.filter((target) => target.key !== ownerKey).map((target) => target.key)
}

export function createLocalPersonaOwnerMarker(ownerKey: TestRoleSwitchOwnerKey): string | null {
  const secret = process.env.SUPABASE_SECRET_KEY
  if (!secret) return null
  const payload = `local-persona-owner:v1:${ownerKey}`
  const signature = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function readLocalPersonaOwnerMarker(marker: string | null | undefined): TestRoleSwitchOwnerKey | null {
  if (!marker) return null
  const match = /^local-persona-owner:v1:(edwin|hr-admin)\.([A-Za-z0-9_-]+)$/.exec(marker)
  const secret = process.env.SUPABASE_SECRET_KEY
  if (!match || !secret) return null
  const ownerKey = match[1] as TestRoleSwitchOwnerKey
  const expected = createHmac('sha256', secret).update(`local-persona-owner:v1:${ownerKey}`).digest()
  const actual = Buffer.from(match[2] ?? '', 'base64url')
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? ownerKey : null
}

export function canInitiateTestRoleSwitch(activeRoles: readonly string[]): boolean {
  return activeRoles.some((role) => role === 'TENANT_ADMIN' || role === 'HR_ADMIN')
}

export function canUseLocalPersonaSwitcher(
  host: string | null | undefined,
  identity: LocalPersonaIdentity,
  environment: TestRoleSwitchEnvironment = {},
): boolean {
  return getLocalPersonaOwnerKey(host, identity, environment) !== null
}

export function canReturnToLocalPersonaOwner(
  host: string | null | undefined,
  identity: LocalPersonaIdentity,
  ownerMarker: string | null | undefined,
  environment: TestRoleSwitchEnvironment = {},
): boolean {
  const ownerKey = readLocalPersonaOwnerMarker(ownerMarker)
  const ownerEmail = getLocalPersonaOwnerEmail(ownerKey)
  return Boolean(ownerEmail)
    && isLocalPersonaRuntime(host, environment)
    && identity.emailVerified
    && isTestRoleSwitchAccount(identity.email)
    && normalizedEmail(identity.email) !== ownerEmail
}

export function getTestRoleSwitchTarget(value: string | null | undefined): TestRoleSwitchTarget | null {
  return TEST_ROLE_SWITCH_TARGETS.find((target) => target.key === value) ?? null
}

export function getAvailableTestRoleSwitchTarget(value: string | null | undefined): TestRoleSwitchTarget | null {
  const target = getTestRoleSwitchTarget(value)
  return target?.available ? target : null
}
