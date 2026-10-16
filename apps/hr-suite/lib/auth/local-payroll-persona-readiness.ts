import 'server-only'

import type { User } from '@supabase/supabase-js'
import { normalizedEmail } from '@/lib/auth/test-role-switch'
import { createAdminClient } from '@/lib/supabase/admin'

export const PAYFULL02_MARS_SCOPE = {
  tenantId: '07249eb9-545c-883b-b26b-d52f83b4f4a1',
  hrGroupId: '6ba6f1df-e376-40f2-abff-ffdf000172e1',
  administrationId: '2057f6ec-cd3e-3c28-9126-c41235d4ffae',
} as const

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
  'payroll-demo-002': {
    email: 'demo-002.payroll@liquidhr.test',
    employeeId: '1620bd56-4f74-db62-9f9e-a5ce1d286bc5',
    employmentId: '6236ee34-182d-1676-6635-ad8eed4c21f3',
    provisionable: true,
    scope: PAYFULL02_MARS_SCOPE,
  },
} as const

export type LocalPayrollPersonaKey = keyof typeof LOCAL_PAYROLL_PERSONA_RECORDS
export type LocalPayrollPersonaReadiness = {
  readonly key: LocalPayrollPersonaKey
  readonly status: 'account-required' | 'link-required' | 'context-access-required' | 'first-sign-in-required' | 'available' | 'conflict' | 'unavailable'
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
  const [authUser, employeeResult, employmentResult] = await Promise.all([
    findAuthUserByEmail(admin, record.email),
    admin.from('employees').select('auth_user_id, tenant_id, hr_group_id, is_active, is_archived').eq('id', record.employeeId).is('deleted_at', null).maybeSingle(),
    admin.from('employments').select('tenant_id, hr_group_id, administration_id').eq('id', record.employmentId).eq('employee_id', record.employeeId).eq('record_status', 'CONFIRMED').is('deleted_at', null).maybeSingle(),
  ])
  if (employeeResult.error || !employeeResult.data || employmentResult.error) throw new Error('LOCAL_PERSONA_STATUS_UNAVAILABLE')
  const employee = employeeResult.data
  const expectedScope = 'scope' in record ? record.scope : null
  const employment = employmentResult.data
  const scopeIsConsistent = employment !== null
    && (!expectedScope || (
      employee.tenant_id === expectedScope.tenantId
      && employee.hr_group_id === expectedScope.hrGroupId
      && employee.is_active === true
      && employee.is_archived === false
      && employment.tenant_id === expectedScope.tenantId
      && employment.hr_group_id === expectedScope.hrGroupId
      && employment.administration_id === expectedScope.administrationId
    ))
  if (!scopeIsConsistent) {
    return { key, status: 'conflict', available: false, canStartSignIn: false, canProvision: false, authUserId: null }
  }

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

  if (expectedScope) {
    const [roleResult, accessResult, groupResult] = await Promise.all([
      admin.from('management_roles').select('id').eq('code', 'EMPLOYEE').is('tenant_id', null).eq('is_active', true).is('deleted_at', null).maybeSingle(),
      admin.from('user_access').select('tenant_id, hr_group_id, administration_id, management_role_id, scope_type, is_active').eq('user_id', authUser.id).limit(2),
      admin.from('user_hr_group_access').select('tenant_id, hr_group_id, management_role_id, is_active').eq('user_id', authUser.id).limit(2),
    ])
    if (roleResult.error || !roleResult.data || accessResult.error || groupResult.error) {
      throw new Error('LOCAL_PERSONA_STATUS_UNAVAILABLE')
    }
    const isAlreadyLinked = employee.auth_user_id === authUser.id && linkedIds.includes(record.employeeId)
    const accessRows = accessResult.data ?? []
    const groupRows = groupResult.data ?? []
    const exactEmployeeAccess = accessRows.length === 1
      && accessRows[0]?.tenant_id === expectedScope.tenantId
      && accessRows[0]?.hr_group_id === expectedScope.hrGroupId
      && accessRows[0]?.administration_id === expectedScope.administrationId
      && accessRows[0]?.management_role_id === roleResult.data.id
      && accessRows[0]?.scope_type === 'ADMINISTRATION'
      && accessRows[0]?.is_active === true
    const exactGroupAccess = groupRows.length === 1
      && groupRows[0]?.tenant_id === expectedScope.tenantId
      && groupRows[0]?.hr_group_id === expectedScope.hrGroupId
      && groupRows[0]?.management_role_id === roleResult.data.id
      && groupRows[0]?.is_active === true
    if (isAlreadyLinked ? !exactEmployeeAccess || !exactGroupAccess : accessRows.length !== 0 || groupRows.length !== 0) {
      return { key, status: 'conflict', available: false, canStartSignIn: false, canProvision: false, authUserId: authUser.id }
    }
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

  const [groupAccess, administrationAccess] = await Promise.all([
    admin.from('user_hr_group_access').select('id').eq('user_id', authUser.id).eq('tenant_id', employee.tenant_id).eq('hr_group_id', employee.hr_group_id).eq('is_active', true).limit(1),
    admin.from('user_access').select('scope_type, administration_id, hr_group_id').eq('user_id', authUser.id).eq('tenant_id', employee.tenant_id).eq('is_active', true).limit(500),
  ])
  if (groupAccess.error || administrationAccess.error || (administrationAccess.data?.length ?? 0) >= 500) {
    throw new Error('LOCAL_PERSONA_STATUS_UNAVAILABLE')
  }
  const hasAdministrationAccess = administrationAccess.data?.some((access) =>
    access.scope_type === 'TENANT'
    || (access.scope_type === 'ADMINISTRATION'
      && access.hr_group_id === employee.hr_group_id
      && access.administration_id === employment?.administration_id))
  if (!groupAccess.data?.length || !hasAdministrationAccess) {
    return {
      key,
      status: 'context-access-required',
      available: false,
      canStartSignIn: false,
      canProvision: false,
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
