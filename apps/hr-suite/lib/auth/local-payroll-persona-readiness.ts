import 'server-only'

import type { User } from '@supabase/supabase-js'
import { normalizedEmail } from '@/lib/auth/test-role-switch'
import { createAdminClient } from '@/lib/supabase/admin'

export const LOCAL_PAYROLL_PERSONA_RECORDS = {
  'payroll-lisa': {
    email: 'lisa.test@liquidhr.test',
    employeeId: '64ad3a23-f59a-4ed0-af41-26dda20ff067',
    employmentId: 'b7391845-77d4-407c-bfe6-555a8a3d463b',
    provisionable: false,
  },
  'payroll-jaap': {
    email: 'jaap.test@liquidhr.test',
    employeeId: 'dd9bde02-76bb-4f7c-8add-db544a148f3f',
    employmentId: '29058c73-5cfa-409d-b9d4-80dd30f36962',
    provisionable: true,
  },
  'payroll-frits': {
    email: 'frits.test@liquidhr.test',
    employeeId: '79091d14-ef66-41fe-a2d5-92df108727e5',
    employmentId: 'd19bace9-bb97-4822-a462-eed22821ed05',
    provisionable: true,
  },
} as const

export type LocalPayrollPersonaKey = keyof typeof LOCAL_PAYROLL_PERSONA_RECORDS
export type LocalPayrollPersonaReadiness = {
  readonly key: LocalPayrollPersonaKey
  readonly status: 'account-required' | 'link-required' | 'first-sign-in-required' | 'available' | 'conflict' | 'unavailable'
  readonly available: boolean
  readonly canStartSignIn: boolean
  readonly canProvision: boolean
  readonly authUserId: string | null
}

const AUTH_USER_PAGE_SIZE = 1000
const MAX_AUTH_USER_PAGES = 100

async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<User | null> {
  for (let page = 1; page <= MAX_AUTH_USER_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: AUTH_USER_PAGE_SIZE })
    if (error) throw new Error('LOCAL_PERSONA_STATUS_UNAVAILABLE')
    const matches = data.users.filter((user) => normalizedEmail(user.email) === normalizedEmail(email))
    if (matches.length > 1) throw new Error('LOCAL_PERSONA_STATUS_CONFLICT')
    if (matches[0]) return matches[0]
    if (data.lastPage <= page) return null
  }
  throw new Error('LOCAL_PERSONA_STATUS_UNAVAILABLE')
}

export async function getLocalPayrollPersonaReadiness(
  key: LocalPayrollPersonaKey,
  admin: ReturnType<typeof createAdminClient> = createAdminClient(),
): Promise<LocalPayrollPersonaReadiness> {
  const record = LOCAL_PAYROLL_PERSONA_RECORDS[key]
  const [authUser, employeeResult] = await Promise.all([
    findAuthUserByEmail(admin, record.email),
    admin.from('employees').select('auth_user_id').eq('id', record.employeeId).is('deleted_at', null).maybeSingle(),
  ])
  if (employeeResult.error || !employeeResult.data) throw new Error('LOCAL_PERSONA_STATUS_UNAVAILABLE')

  const linkedEmployeeIds = authUser
    ? await admin.from('employees').select('id').eq('auth_user_id', authUser.id).is('deleted_at', null).limit(1000)
    : null
  if (linkedEmployeeIds?.error) throw new Error('LOCAL_PERSONA_STATUS_UNAVAILABLE')

  if (!authUser) {
    if (employeeResult.data.auth_user_id !== null) {
      return { key, status: 'conflict', available: false, canStartSignIn: false, canProvision: false, authUserId: null }
    }
    return {
      key,
      status: 'account-required',
      available: false,
      canStartSignIn: false,
      canProvision: record.provisionable,
      authUserId: null,
    }
  }

  const linkedIds = linkedEmployeeIds?.data?.map((row) => row.id) ?? []
  if (
    !authUser.email_confirmed_at
    || authUser.is_anonymous === true
    || linkedIds.some((employeeId) => employeeId !== record.employeeId)
    || (employeeResult.data.auth_user_id !== null && employeeResult.data.auth_user_id !== authUser.id)
  ) {
    return { key, status: 'conflict', available: false, canStartSignIn: false, canProvision: false, authUserId: authUser.id }
  }

  if (employeeResult.data.auth_user_id !== authUser.id || !linkedIds.includes(record.employeeId)) {
    return {
      key,
      status: 'link-required',
      available: false,
      canStartSignIn: false,
      canProvision: record.provisionable,
      authUserId: authUser.id,
    }
  }

  if (!authUser.last_sign_in_at) {
    return {
      key,
      status: 'first-sign-in-required',
      available: false,
      canStartSignIn: true,
      canProvision: false,
      authUserId: authUser.id,
    }
  }

  return {
    key,
    status: 'available',
    available: true,
    canStartSignIn: true,
    canProvision: false,
    authUserId: authUser.id,
  }
}
