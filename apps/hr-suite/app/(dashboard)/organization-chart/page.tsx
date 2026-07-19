import { Building2, CalendarDays, UsersRound } from 'lucide-react'
import { OrganizationChartExplorer, type OrganizationChartExplorerLabels, type OrganizationChartExplorerQuery } from '@/components/organization-chart/organization-chart-explorer'
import { getLocale } from '@/lib/i18n/server'
import { createTranslator } from '@/lib/i18n/translator'
import { organizationChartQuerySchema } from '@/lib/organization-chart/schemas'
import { getOrganizationChart } from '@/lib/organization-chart/service'
import { getStoredOrganizationChartFilter } from '@/lib/preferences/organization-chart'
import type { AdministrationChartNode } from '@/lib/organization-chart/types'
import messagesEn from '@/messages/en/organization-chart.json'
import messagesNl from '@/messages/nl/organization-chart.json'

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

function safeView(value: string | undefined): 'department' | 'manager' | 'job' {
  return value === 'manager' || value === 'job' ? value : 'department'
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
  const translate = createTranslator(locale === 'en' ? messagesEn : messagesNl)
  const administration = graph.nodes.find((node): node is AdministrationChartNode => node.type === 'administration')
  const explorerQuery: OrganizationChartExplorerQuery = query
  const labels: OrganizationChartExplorerLabels = {
    viewLabel: translate('viewLabel'),
    viewDepartment: translate('viewDepartment'),
    viewManager: translate('viewManager'),
    viewJob: translate('viewJob'),
    primaryCountDepartment: translate('primaryCountDepartment', { count: graph.metadata.visiblePrimaryCount }),
    primaryCountManager: translate('primaryCountManager', { count: graph.metadata.visiblePrimaryCount }),
    primaryCountJob: translate('primaryCountJob', { count: graph.metadata.visiblePrimaryCount }),
    exploreTitle: translate('exploreTitle'), exploreSubtitle: translate('exploreSubtitle'),
    searchLabel: translate('searchLabel'), searchPlaceholder: translate('searchPlaceholder'), searchAction: translate('searchAction'),
    departmentLabel: translate('departmentLabel'), allDepartments: translate('allDepartments'), roleLabel: translate('roleLabel'), allRoles: translate('allRoles'),
    moreFilters: translate('moreFilters'), lessFilters: translate('lessFilters'), dateLabel: translate('dateLabel'), customFieldLabel: translate('customFieldLabel'), noCustomField: translate('noCustomField'),
    customFieldValueLabel: translate('customFieldValueLabel'), customFieldValuePlaceholder: translate('customFieldValuePlaceholder'), customFieldValueDisabled: translate('customFieldValueDisabled'), applyFilters: translate('applyFilters'),
    searchDepartment: translate('searchDepartment'), searchRole: translate('searchRole'), noFilterOptions: translate('noFilterOptions'), quickFilters: translate('quickFilters'),
    activeFilters: translate('activeFilters'), queryChip: translate('queryChip'), departmentChip: translate('departmentChip'), roleChip: translate('roleChip'), fieldChip: translate('fieldChip'), dateChip: translate('dateChip'), removeFilter: translate('removeFilter'), resetAll: translate('resetAll'),
    matchCount: translate('matchCount'), matchCountOne: translate('matchCountOne'), noMatchesTitle: translate('noMatchesTitle'), noMatchesBody: translate('noMatchesBody'), emptyTitle: translate('emptyTitle'), emptyBody: translate('emptyBody'),
    canvasLabel: translate('canvasLabel'), mobileTreeLabel: translate('mobileTreeLabel'), expandBranch: translate('expandBranch'),
    employees: translate('employees'), groupedEmployees: translate('groupedEmployees'), rootEmployees: translate('rootEmployees'), manager: translate('manager'), managerInherited: translate('managerInherited'), managerNone: translate('managerNone'), managerAmbiguous: translate('managerAmbiguous'),
    jobUnknown: translate('jobUnknown'), moreBadges: translate('moreBadges'), openEmployee: translate('openEmployee'), administrationNode: translate('administrationNode'), departmentNode: translate('departmentNode'), employeeNode: translate('employeeNode'),
    groupNode: translate('groupNode'),
    zoomIn: translate('zoomIn'), zoomOut: translate('zoomOut'), fitView: translate('fitView'), legendRoute: translate('legendRoute'), legendMatch: translate('legendMatch'), legendContext: translate('legendContext'),
  }

  return (
    <section className="mx-auto w-full max-w-[96rem] px-4 py-7 sm:px-8 sm:py-9 lg:px-10">
      <header className="mb-6 flex flex-col gap-5 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-foreground">{translate('eyebrow')}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">{translate('title')}</h1>
        </div>
        <div className="grid gap-2 text-xs sm:grid-cols-3">
          <div className="flex min-w-0 items-center gap-2 rounded-xl border bg-surface px-3 py-2.5"><Building2 aria-hidden="true" className="shrink-0 text-accent-foreground" size={16} /><div className="min-w-0"><p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{translate('administration')}</p><p className="mt-0.5 truncate font-semibold text-foreground">{administration ? `${administration.code} · ${administration.name}` : '—'}</p></div></div>
          <div className="flex items-center gap-2 rounded-xl border bg-surface px-3 py-2.5 text-muted-foreground"><CalendarDays aria-hidden="true" size={16} /><span>{translate('asOf', { date: graph.metadata.asOfDate })}</span></div>
          <div className="flex items-center gap-2 rounded-xl border bg-surface px-3 py-2.5 text-muted-foreground"><UsersRound aria-hidden="true" size={16} /><span>{query.view === 'manager' ? translate('primaryCountManager', { count: graph.metadata.visiblePrimaryCount }) : query.view === 'job' ? translate('primaryCountJob', { count: graph.metadata.visiblePrimaryCount }) : translate('primaryCountDepartment', { count: graph.metadata.visiblePrimaryCount })} · {translate('employeeCount', { count: graph.metadata.visibleEmployeeCount })}</span></div>
        </div>
      </header>

      <OrganizationChartExplorer defaultDate={defaultDate} graph={graph} labels={labels} query={explorerQuery} />
    </section>
  )
}
