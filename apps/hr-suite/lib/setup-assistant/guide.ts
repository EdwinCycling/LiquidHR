import type { AuthContext } from '@/lib/auth/permissions'

export const SETUP_ASSISTANT_GUIDE_CODE = 'CORE' as const

export type SetupAssistantCategoryKey = 'organization' | 'base' | 'configuration' | 'employment'
export type SetupAssistantSuggestionKey =
  | 'departments'
  | 'jobs'
  | 'hrStructure'
  | 'companyData'
  | 'branding'
  | 'customFields'
  | 'employees'
  | 'holidays'
  | 'leave'
  | 'absence'

type PermissionMode = 'all' | 'any'

export interface SetupAssistantRoute {
  readonly href: string
  readonly requiredPermissions: readonly string[]
  readonly permissionMode?: PermissionMode
}

export interface SetupAssistantStep {
  readonly stepKey: string
  readonly categoryKey: SetupAssistantCategoryKey
  readonly titleKey: string
  readonly descriptionKey: string
  readonly primaryRoute: SetupAssistantRoute
  readonly relatedRoute?: SetupAssistantRoute
  readonly suggestionKey?: SetupAssistantSuggestionKey
  readonly visibility: 'always' | 'salary-structure'
}

export interface SetupAssistantCategory {
  readonly categoryKey: SetupAssistantCategoryKey
  readonly titleKey: string
  readonly descriptionKey: string
  readonly steps: readonly SetupAssistantStep[]
}

export const SETUP_ASSISTANT_GUIDE: readonly SetupAssistantCategory[] = [
  {
    categoryKey: 'organization',
    titleKey: 'categories.organization.title',
    descriptionKey: 'categories.organization.description',
    steps: [
      {
        stepKey: 'ORG-001',
        categoryKey: 'organization',
        titleKey: 'steps.org001.title',
        descriptionKey: 'steps.org001.description',
        primaryRoute: { href: '/departments', requiredPermissions: ['department:read'] },
        suggestionKey: 'departments',
        visibility: 'always',
      },
      {
        stepKey: 'ORG-002',
        categoryKey: 'organization',
        titleKey: 'steps.org002.title',
        descriptionKey: 'steps.org002.description',
        primaryRoute: { href: '/master-data/jobs', requiredPermissions: ['job-catalog:read'] },
        suggestionKey: 'jobs',
        visibility: 'always',
      },
      {
        stepKey: 'ORG-003',
        categoryKey: 'organization',
        titleKey: 'steps.org003.title',
        descriptionKey: 'steps.org003.description',
        primaryRoute: { href: '/authorization', requiredPermissions: ['authorization:read'] },
        relatedRoute: { href: '/role-assignments', requiredPermissions: ['authorization:read'] },
        visibility: 'always',
      },
    ],
  },
  {
    categoryKey: 'base',
    titleKey: 'categories.base.title',
    descriptionKey: 'categories.base.description',
    steps: [
      {
        stepKey: 'BAS-001',
        categoryKey: 'base',
        titleKey: 'steps.bas001.title',
        descriptionKey: 'steps.bas001.description',
        primaryRoute: { href: '/settings/business-structure', requiredPermissions: ['hr-group:read'] },
        suggestionKey: 'hrStructure',
        visibility: 'always',
      },
      {
        stepKey: 'BAS-002',
        categoryKey: 'base',
        titleKey: 'steps.bas002.title',
        descriptionKey: 'steps.bas002.description',
        primaryRoute: { href: '/settings/company-data', requiredPermissions: ['company-data:read'] },
        suggestionKey: 'companyData',
        visibility: 'always',
      },
      {
        stepKey: 'BAS-003',
        categoryKey: 'base',
        titleKey: 'steps.bas003.title',
        descriptionKey: 'steps.bas003.description',
        primaryRoute: { href: '/settings/company-branding', requiredPermissions: ['settings:read'] },
        suggestionKey: 'branding',
        visibility: 'always',
      },
    ],
  },
  {
    categoryKey: 'configuration',
    titleKey: 'categories.configuration.title',
    descriptionKey: 'categories.configuration.description',
    steps: [
      {
        stepKey: 'SET-001',
        categoryKey: 'configuration',
        titleKey: 'steps.set001.title',
        descriptionKey: 'steps.set001.description',
        primaryRoute: { href: '/settings/modules', requiredPermissions: ['modules:read'] },
        visibility: 'always',
      },
      {
        stepKey: 'SET-002',
        categoryKey: 'configuration',
        titleKey: 'steps.set002.title',
        descriptionKey: 'steps.set002.description',
        primaryRoute: { href: '/settings/employee-directory', requiredPermissions: ['settings:read'] },
        visibility: 'always',
      },
      {
        stepKey: 'SET-003',
        categoryKey: 'configuration',
        titleKey: 'steps.set003.title',
        descriptionKey: 'steps.set003.description',
        primaryRoute: { href: '/custom-fields', requiredPermissions: ['custom-fields:write'] },
        suggestionKey: 'customFields',
        visibility: 'always',
      },
      {
        stepKey: 'SET-004',
        categoryKey: 'configuration',
        titleKey: 'steps.set004.title',
        descriptionKey: 'steps.set004.description',
        primaryRoute: { href: '/settings/dashboard-widgets', requiredPermissions: ['dashboard-widget:write'] },
        relatedRoute: { href: '/settings/menu-order', requiredPermissions: ['settings:read'] },
        visibility: 'always',
      },
      {
        stepKey: 'SET-005',
        categoryKey: 'configuration',
        titleKey: 'steps.set005.title',
        descriptionKey: 'steps.set005.description',
        primaryRoute: {
          href: '/employees',
          requiredPermissions: ['employee:read', 'employee-directory:read'],
          permissionMode: 'any',
        },
        suggestionKey: 'employees',
        visibility: 'always',
      },
    ],
  },
  {
    categoryKey: 'employment',
    titleKey: 'categories.employment.title',
    descriptionKey: 'categories.employment.description',
    steps: [
      {
        stepKey: 'EMP-001',
        categoryKey: 'employment',
        titleKey: 'steps.emp001.title',
        descriptionKey: 'steps.emp001.description',
        primaryRoute: { href: '/settings/employment-contracts', requiredPermissions: ['contract:read'] },
        visibility: 'always',
      },
      {
        stepKey: 'EMP-002',
        categoryKey: 'employment',
        titleKey: 'steps.emp002.title',
        descriptionKey: 'steps.emp002.description',
        primaryRoute: { href: '/settings/employment-contracts', requiredPermissions: ['contract:read'] },
        visibility: 'always',
      },
      {
        stepKey: 'EMP-003',
        categoryKey: 'employment',
        titleKey: 'steps.emp003.title',
        descriptionKey: 'steps.emp003.description',
        primaryRoute: { href: '/master-data/salary-scales', requiredPermissions: ['salary-structure:read'] },
        visibility: 'salary-structure',
      },
      {
        stepKey: 'EMP-004',
        categoryKey: 'employment',
        titleKey: 'steps.emp004.title',
        descriptionKey: 'steps.emp004.description',
        primaryRoute: { href: '/settings/holidays', requiredPermissions: ['holidays:read'] },
        suggestionKey: 'holidays',
        visibility: 'always',
      },
      {
        stepKey: 'EMP-005',
        categoryKey: 'employment',
        titleKey: 'steps.emp005.title',
        descriptionKey: 'steps.emp005.description',
        primaryRoute: { href: '/settings/leave-accrual', requiredPermissions: ['leave:read'] },
        suggestionKey: 'leave',
        visibility: 'always',
      },
      {
        stepKey: 'EMP-006',
        categoryKey: 'employment',
        titleKey: 'steps.emp006.title',
        descriptionKey: 'steps.emp006.description',
        primaryRoute: { href: '/settings/absence', requiredPermissions: ['absence-settings:read'] },
        suggestionKey: 'absence',
        visibility: 'always',
      },
    ],
  },
] as const

function hasRoutePermission(route: SetupAssistantRoute, permissions: ReadonlySet<string>): boolean {
  return route.permissionMode === 'any'
    ? route.requiredPermissions.some((permission) => permissions.has(permission))
    : route.requiredPermissions.every((permission) => permissions.has(permission))
}

export function isSetupAssistantStepVisible(
  step: SetupAssistantStep,
  auth: Pick<AuthContext, 'permissions'>,
): boolean {
  if (step.visibility === 'salary-structure') return false
  return hasRoutePermission(step.primaryRoute, new Set(auth.permissions))
}

export function getVisibleSetupAssistantCategories(
  auth: Pick<AuthContext, 'permissions'>,
): SetupAssistantCategory[] {
  return SETUP_ASSISTANT_GUIDE
    .map((category) => ({
      ...category,
      steps: category.steps.filter((step) => isSetupAssistantStepVisible(step, auth)),
    }))
    .filter((category) => category.steps.length > 0)
}

export function getVisibleSetupAssistantSteps(
  auth: Pick<AuthContext, 'permissions'>,
): SetupAssistantStep[] {
  return getVisibleSetupAssistantCategories(auth).flatMap((category) => category.steps)
}

export function canOpenSetupAssistantRoute(
  route: SetupAssistantRoute,
  auth: Pick<AuthContext, 'permissions'>,
): boolean {
  return hasRoutePermission(route, new Set(auth.permissions))
}
