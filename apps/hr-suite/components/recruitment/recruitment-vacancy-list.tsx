import Link from 'next/link'
import { ArrowRight, BriefcaseBusiness, CalendarDays, ChevronLeft, ChevronRight, MapPin, Plus, Search, UsersRound } from 'lucide-react'
import type { Locale } from '@/lib/i18n/config'
import type { VacancySummary, VacancyListPublication, VacancyListSort, VacancyListStatus, RecruitmentVacancyListQuery } from '@/lib/recruitment/vacancy-service'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { FilterBar } from '@/components/patterns/filter-bar'
import { PageToolbar } from '@/components/patterns/page-toolbar'

type VacancyStatus = VacancySummary['status']
type VacancyListStatusLabel = Exclude<VacancyListStatus, 'ALL'>
type VacancyListPublicationLabel = Exclude<VacancyListPublication, 'ALL'>

export interface RecruitmentVacancyListLabels {
  readonly search: string
  readonly searchPlaceholder: string
  readonly applyFilters: string
  readonly clearFilters: string
  readonly status: string
  readonly allStatuses: string
  readonly statuses: Record<VacancyListStatusLabel, string>
  readonly publication: string
  readonly allPublications: string
  readonly publications: Record<VacancyListPublicationLabel, string>
  readonly sort: string
  readonly sorts: Record<VacancyListSort, string>
  readonly resultCount: string
  readonly updated: string
  readonly applications: string
  readonly activeApplications: string
  readonly workModes: Record<'ON_SITE' | 'HYBRID' | 'REMOTE', string>
  readonly notSet: string
  readonly edit: string
  readonly view: string
  readonly emptyTitle: string
  readonly emptyDescription: string
  readonly noResultsTitle: string
  readonly noResultsDescription: string
  readonly newVacancy: string
  readonly previousPage: string
  readonly nextPage: string
  readonly pageOf: string
}

const statusTones: Record<VacancyStatus, BadgeTone> = {
  DRAFT: 'warning',
  ACTIVE: 'success',
  CLOSED: 'neutral',
  ARCHIVED: 'danger',
}

function pageHref(query: RecruitmentVacancyListQuery, page: number): string {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  if (query.status !== 'ALL') params.set('status', query.status)
  if (query.publication !== 'ALL') params.set('publication', query.publication)
  if (query.sort !== 'UPDATED_DESC') params.set('sort', query.sort)
  if (page > 1) params.set('page', String(page))
  const search = params.toString()
  return `/recruitment/vacancies${search ? `?${search}` : ''}`
}

function formatUpdatedAt(value: string, locale: Locale, fallback: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return fallback
  return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
}

function workModeLabel(vacancy: VacancySummary, labels: RecruitmentVacancyListLabels): string {
  return vacancy.workMode ? labels.workModes[vacancy.workMode] : labels.notSet
}

export function RecruitmentVacancyList({
  canWrite,
  labels,
  locale,
  query,
  result,
}: {
  readonly canWrite: boolean
  readonly labels: RecruitmentVacancyListLabels
  readonly locale: Locale
  readonly query: RecruitmentVacancyListQuery
  readonly result: { readonly items: readonly VacancySummary[]; readonly total: number; readonly page: number; readonly pageCount: number }
}) {
  const hasFilters = Boolean(query.q) || query.status !== 'ALL' || query.publication !== 'ALL' || query.sort !== 'UPDATED_DESC'
  const statusLabels = Object.entries(labels.statuses) as Array<[VacancyListStatusLabel, string]>
  const publicationLabels = Object.entries(labels.publications) as Array<[VacancyListPublicationLabel, string]>
  const hasResults = result.items.length > 0

  return (
    <>
      <form action="/recruitment/vacancies" method="get">
        <FilterBar className="mt-6" actions={<div className="flex flex-wrap items-center gap-2">
          <Button size="sm" type="submit"><Search aria-hidden="true" />{labels.applyFilters}</Button>
          {hasFilters ? <Link className={buttonClasses({ size: 'sm', variant: 'ghost' })} href="/recruitment/vacancies">{labels.clearFilters}</Link> : null}
        </div>}>
          <label className="min-w-0 flex-1 sm:min-w-56">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.search}</span>
            <TextInput aria-label={labels.search} defaultValue={query.q} leadingIcon={<Search aria-hidden="true" />} name="q" placeholder={labels.searchPlaceholder} />
          </label>
          <label className="w-full sm:w-48">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.status}</span>
            <DropdownSelect aria-label={labels.status} defaultValue={query.status} id="vacancy-status" name="status" searchable searchPlaceholder={labels.search}>
              <option value="ALL">{labels.allStatuses}</option>
              {statusLabels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </DropdownSelect>
          </label>
          <label className="w-full sm:w-48">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.publication}</span>
            <DropdownSelect aria-label={labels.publication} defaultValue={query.publication} id="vacancy-publication" name="publication" searchable searchPlaceholder={labels.search}>
              <option value="ALL">{labels.allPublications}</option>
              {publicationLabels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </DropdownSelect>
          </label>
          <label className="w-full sm:w-52">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.sort}</span>
            <DropdownSelect aria-label={labels.sort} defaultValue={query.sort} id="vacancy-sort" name="sort" searchable searchPlaceholder={labels.search}>
              {Object.entries(labels.sorts).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </DropdownSelect>
          </label>
        </FilterBar>
      </form>

      <PageToolbar className="mt-5" start={<p className="text-sm text-muted-foreground">{labels.resultCount}</p>} end={result.pageCount > 1 ? <nav aria-label={labels.pageOf} className="flex items-center gap-1">
        {result.page > 1 ? <Link aria-label={labels.previousPage} className={buttonClasses({ size: 'sm', variant: 'secondary', className: 'size-9 p-0' })} href={pageHref(query, result.page - 1)}><ChevronLeft aria-hidden="true" className="size-4" /></Link> : <span aria-hidden="true" className="inline-flex size-9 items-center justify-center rounded-[var(--radius-control)] border border-border-subtle text-muted-foreground"><ChevronLeft className="size-4" /></span>}
        <span className="px-2 text-sm font-medium tabular-nums text-muted-foreground">{result.page} {labels.pageOf} {result.pageCount}</span>
        {result.page < result.pageCount ? <Link aria-label={labels.nextPage} className={buttonClasses({ size: 'sm', variant: 'secondary', className: 'size-9 p-0' })} href={pageHref(query, result.page + 1)}><ChevronRight aria-hidden="true" className="size-4" /></Link> : <span aria-hidden="true" className="inline-flex size-9 items-center justify-center rounded-[var(--radius-control)] border border-border-subtle text-muted-foreground"><ChevronRight className="size-4" /></span>}
      </nav> : undefined} />

      <div className="mt-3">
        {!hasResults ? <EmptyState actions={canWrite && !hasFilters ? <Link className={buttonClasses({ className: 'gap-2' })} href="/recruitment/vacancies/new"><Plus aria-hidden="true" />{labels.newVacancy}</Link> : hasFilters ? <Link className={buttonClasses({ variant: 'ghost' })} href="/recruitment/vacancies">{labels.clearFilters}</Link> : undefined} description={hasFilters ? labels.noResultsDescription : labels.emptyDescription} icon={<BriefcaseBusiness />} title={hasFilters ? labels.noResultsTitle : labels.emptyTitle} /> : <Surface className="overflow-hidden">
          <div className="divide-y divide-border/70">
            {result.items.map((vacancy) => <article className="group px-4 py-4 sm:px-5 sm:py-5" key={vacancy.id}>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_13rem_11rem_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Link className="min-w-0 text-base font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={`/recruitment/vacancies/${vacancy.id}`}>{vacancy.title}</Link>
                    <Badge tone={statusTones[vacancy.status]}>{labels.statuses[vacancy.status]}</Badge>
                    <Badge tone={vacancy.publication?.status === 'OPEN' ? 'success' : 'neutral'}>{labels.publications[vacancy.publication?.status ?? 'UNPUBLISHED']}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex min-w-0 items-center gap-1.5"><MapPin aria-hidden="true" className="size-4 shrink-0" />{vacancy.locationLabel || labels.notSet}</span>
                    <span className="inline-flex min-w-0 items-center gap-1.5"><BriefcaseBusiness aria-hidden="true" className="size-4 shrink-0" />{workModeLabel(vacancy, labels)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <UsersRound aria-hidden="true" className="size-4 shrink-0" />
                  <span><span className="font-semibold text-foreground tabular-nums">{vacancy.activeApplicationCount}</span> {labels.activeApplications}<span className="sr-only">, {vacancy.applicationCount} {labels.applications}</span></span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
                  <span><span className="sr-only">{labels.updated}: </span>{formatUpdatedAt(vacancy.updatedAt, locale, labels.notSet)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <Link className={buttonClasses({ size: 'sm', variant: 'secondary', className: 'gap-1.5' })} href={`/recruitment/vacancies/${vacancy.id}`}>{labels.view}<ArrowRight aria-hidden="true" className="size-4" /></Link>
                  {canWrite ? <Link className={buttonClasses({ size: 'sm', variant: 'ghost' })} href={`/recruitment/vacancies/${vacancy.id}/edit`}>{labels.edit}</Link> : null}
                </div>
              </div>
            </article>)}
          </div>
        </Surface>}
      </div>
    </>
  )
}
