import type { Json } from '@scope/db'

export const EMPLOYEE_DASHBOARD_WIDE_WIDGETS = ['personal', 'customFields', 'leave', 'absence', 'budgets', 'contracts', 'activity'] as const
export const EMPLOYEE_DASHBOARD_NARROW_WIDGETS = ['employment', 'profileLinks', 'reminders', 'workflows', 'assets', 'vehicles', 'software', 'education', 'documents', 'performance'] as const
export type EmployeeDashboardWideWidget = (typeof EMPLOYEE_DASHBOARD_WIDE_WIDGETS)[number]
export type EmployeeDashboardNarrowWidget = (typeof EMPLOYEE_DASHBOARD_NARROW_WIDGETS)[number]
export interface EmployeeDashboardLayout { wide: EmployeeDashboardWideWidget[]; narrow: EmployeeDashboardNarrowWidget[] }
export const DEFAULT_EMPLOYEE_DASHBOARD_LAYOUT: EmployeeDashboardLayout = { wide: [...EMPLOYEE_DASHBOARD_WIDE_WIDGETS], narrow: [...EMPLOYEE_DASHBOARD_NARROW_WIDGETS] }

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function ordered<T extends string>(value: unknown, known: readonly T[]): T[] { const requested = Array.isArray(value) ? value.filter((item): item is T => typeof item === 'string' && known.includes(item as T)) : []; return [...new Set([...requested, ...known])] }
export function parseEmployeeDashboardLayout(value: unknown): EmployeeDashboardLayout { const source = isRecord(value) ? value : {}; return { wide: ordered(source.wide, EMPLOYEE_DASHBOARD_WIDE_WIDGETS), narrow: ordered(source.narrow, EMPLOYEE_DASHBOARD_NARROW_WIDGETS) } }
export function employeeDashboardLayoutJson(layout: EmployeeDashboardLayout): Json { return { wide: layout.wide, narrow: layout.narrow } }
