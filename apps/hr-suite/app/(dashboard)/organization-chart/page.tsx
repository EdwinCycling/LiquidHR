import Link from 'next/link'
import { Building2, CalendarDays, UsersRound } from 'lucide-react'
import { OrganizationChartExplorer, type OrganizationChartExplorerLabels, type OrganizationChartExplorerQuery } from '@/components/organization-chart/organization-chart-explorer'
import { buttonClasses } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AuthorizationError, getRequestAuthorizationContext, requirePermission } from '@/lib/auth/permissions'
import { getLocale } from '@/lib/i18n/server'
import { createTranslator } from '@/lib/i18n/translator'
import { organizationChartQuerySchema } from '@/lib/organization-chart/schemas'
import { getOrganizationChart } from '@/lib/organization-chart/service'
import { getStoredOrganizationChartFilter } from '@/lib/preferences/organization-chart'
import type { AdministrationChartNode } from '@/lib/organization-chart/types'
import messagesEn from '@/messages/en/organization-chart.json'
import messagesNl from '@/messages/nl/organization-chart.json'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'

interface OrganizationChartPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function amsterdamDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function safeText(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed && trimmed.length <= 160 ? trimmed : undefined
}

function safeView(value: string | undefined): 'department' | 'manager' {
  return value === 'manager' ? 'manager' : 'department'
}

function safeUuid(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed) ? trimmed : undefined
}

function safeDate(value: string | undefined, fallback: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? fallback : value
}

export default async function OrganizationChartPage({ searchParams }: OrganizationChartPageProps) {
  const [params, locale, storedFilter] = await Promise.all([searchParams, getLocale(), getStoredOrganizationChartFilter()])
  const defaultDate = amsterdamDate()
  const hasQuery = Object.values(params).some((value) => (Array.isArray(value) ? value.length > 0 : Boolean(value)))
  const source = hasQuery ? params : storedFilter
  const field = safeUuid(first(source.field))
  const value = safeText(first(source.value))
  const candidate = {
    view: safeView(first(source.view)),
    date: safeDate(first(source.date), defaultDate),
    q: safeText(first(source.q)),
    department: safeUuid(first(source.department)),
    role: safeText(first(source.role)),
    field: field && value ? field : undefined,
    value: field && value ? value : undefined,
  }
  const query = organizationChartQuerySchema.parse(candidate)
  const graph = await getOrganizationChart(query)
  const authContext = (await getRequestAuthorizationContext()).context
  let canWrite = true
  try { await requirePermission('department:write') }
  catch (error) { if (error instanceof AuthorizationError) canWrite = false; else throw error }
  const translate = createTranslator(locale === 'en' ? messagesEn : messagesNl)
  const administration = graph.nodes.find((node): node is AdministrationChartNode => node.type === 'administration')
  const explorerQuery: OrganizationChartExplorerQuery = query
  const labels: OrganizationChartExplorerLabels = {
    viewLabel: translate('viewLabel'),
    viewDepartment: translate('viewDepartment'),
    viewManager: translate('viewManager'),
    searchLabel: translate('searchLabel'), searchPlaceholder: translate('searchPlaceholder'), searchAction: translate('searchAction'),
    departmentLabel: translate('departmentLabel'), allDepartments: translate('allDepartments'), roleLabel: translate('roleLabel'), allRoles: translate('allRoles'),
    moreFilters: translate('moreFilters'), lessFilters: translate('lessFilters'), dateLabel: translate('dateLabel'), customFieldLabel: translate('customFieldLabel'), noCustomField: translate('noCustomField'),
    customFieldValueLabel: translate('customFieldValueLabel'), customFieldValuePlaceholder: translate('customFieldValuePlaceholder'), customFieldValueDisabled: translate('customFieldValueDisabled'), applyFilters: translate('applyFilters'),
    searchDepartment: translate('searchDepartment'), searchRole: translate('searchRole'), noFilterOptions: translate('noFilterOptions'), quickFilters: translate('quickFilters'),
    activeFilters: translate('activeFilters'), queryChip: translate('queryChip'), departmentChip: translate('departmentChip'), roleChip: translate('roleChip'), fieldChip: translate('fieldChip'), dateChip: translate('dateChip'), removeFilter: translate('removeFilter'), resetAll: translate('resetAll'),
    matchCount: translate('matchCount'), matchCountOne: translate('matchCountOne'), noMatchesTitle: translate('noMatchesTitle'), noMatchesBody: translate('noMatchesBody'), emptyTitle: translate('emptyTitle'), emptyBody: translate('emptyBody'),
    canvasLabel: translate('canvasLabel'), mobileTreeLabel: translate('mobileTreeLabel'), expandBranch: translate('expandBranch'),
    employees: translate('employees'), groupedEmployees: translate('groupedEmployees'), rootEmployees: translate('rootEmployees'), manager: translate('manager'), managerInherited: translate('managerInherited'), managerNone: translate('managerNone'), managerAmbiguous: translate('managerAmbiguous'),
    jobUnknown: translate('jobUnknown'), moreBadges: translate('moreBadges'), openEmployee: translate('openEmployee'), administrationNode: translate('administrationNode'), departmentNode: translate('departmentNode'), employeeNode: translate('employeeNode'), startProcess: translate('startProcess'), canStartProcess: authContext.permissions.includes('process-instance:start'), canStartSelfProcess: authContext.permissions.includes('self:process-instance:start'), currentEmployeeId: authContext.employeeId,
    groupNode: translate('groupNode'),
    zoomIn: translate('zoomIn'), zoomOut: translate('zoomOut'), fitView: translate('fitView'), previousTab: translate('previousTab'), nextTab: translate('nextTab'), manageDepartments: translate('manageDepartments'),
  }

  return (
    <PageShell className="space-y-6 py-7 sm:py-9" width="wide">
      <PageHeader
        actions={<div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2"><CalendarDays aria-hidden="true" size={16} />{translate('asOf', { date: graph.metadata.asOfDate })}</span>
          <span className="inline-flex items-center gap-2"><UsersRound aria-hidden="true" size={16} />{translate('employeeCount', { count: graph.metadata.visibleEmployeeCount })}</span>
          {canWrite ? <Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/departments"><Building2 aria-hidden="true" />{translate('manageDepartments')}</Link> : null}
        </div>}
        description={administration ? <span className="inline-flex items-center gap-2"><Badge>{translate('administration')}</Badge>{`${administration.code} · ${administration.name}`}</span> : undefined}
        title={translate('title')}
      />
      <OrganizationChartExplorer defaultDate={defaultDate} graph={graph} labels={labels} query={explorerQuery} />
    </PageShell>
  )
}
