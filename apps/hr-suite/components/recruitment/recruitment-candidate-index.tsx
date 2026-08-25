import Link from 'next/link'
import { Search } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { pageItems } from '@/components/ui/pagination'
import { TextInput } from '@/components/ui/text-input'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { DataTableShell } from '@/components/patterns/data-table-shell'
import { CollectionPagination } from '@/components/patterns/collection-pagination'
import { CollectionToolbar } from '@/components/patterns/collection-toolbar'
import { FilterBar } from '@/components/patterns/filter-bar'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import type {
  CandidateIndexApplication,
  CandidateIndexData,
  CandidateIndexQuery,
  CandidateIndexRow,
} from '@/lib/recruitment/candidate-service'

export interface RecruitmentCandidateIndexLabels {
  readonly title: string
  readonly description: string
  readonly search: string
  readonly searchPlaceholder: string
  readonly filters: string
  readonly state: string
  readonly allStates: string
  readonly active: string
  readonly accepted: string
  readonly rejected: string
  readonly vacancy: string
  readonly allVacancies: string
  readonly stage: string
  readonly allStages: string
  readonly sort: string
  readonly recent: string
  readonly name: string
  readonly applyFilters: string
  readonly clear: string
  readonly candidate: string
  readonly applications: string
  readonly lastActivity: string
  readonly contact: string
  readonly source: string
  readonly manual: string
  readonly public: string
  readonly noStage: string
  readonly noContact: string
  readonly noApplications: string
  readonly possibleDuplicate: string
  readonly noResultsTitle: string
  readonly noResultsDescription: string
  readonly noResultsClear: string
  readonly applicationCount: (count: number) => string
  readonly resultRange: (from: number, to: number, total: number) => string
  readonly perPage: (count: number) => string
  readonly openApplication: (candidate: string, vacancy: string) => string
  readonly previous: string
  readonly next: string
  readonly pagination: string
}

interface RecruitmentCandidateIndexProps {
  readonly data: CandidateIndexData
  readonly query: CandidateIndexQuery
  readonly queryString: string
  readonly labels: RecruitmentCandidateIndexLabels
  readonly locale: string
}

function applicationStateLabel(application: CandidateIndexApplication, labels: RecruitmentCandidateIndexLabels): string {
  if (application.state === 'ACTIVE') return labels.active
  if (application.state === 'AANGENOMEN') return labels.accepted
  return labels.rejected
}

function applicationStateTone(application: CandidateIndexApplication): BadgeTone {
  if (application.state === 'ACTIVE') return 'info'
  if (application.state === 'AANGENOMEN') return 'success'
  return 'danger'
}

function formatDate(value: string, locale: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value.slice(0, 10)
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function sourceLabel(source: CandidateIndexApplication['source'], labels: RecruitmentCandidateIndexLabels): string {
  return source === 'PUBLIC' ? labels.public : labels.manual
}

function ApplicationLinks({ applications, candidateName, labels, locale }: {
  readonly applications: readonly CandidateIndexApplication[]
  readonly candidateName: string
  readonly labels: RecruitmentCandidateIndexLabels
  readonly locale: string
}) {
  if (applications.length === 0) return <span className="text-sm text-muted-foreground">{labels.noApplications}</span>

  return (
    <ul className="min-w-0 space-y-2">
      {applications.map((application) => (
        <li key={application.id}>
          <Link
            aria-label={labels.openApplication(candidateName, application.vacancyTitle)}
            className="group flex min-w-0 flex-wrap items-center gap-2 rounded-[var(--radius-control)] px-2 py-1.5 -mx-2 underline-offset-2 hover:bg-muted hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            href={`/recruitment/applications/${application.id}`}
          >
            <span className="min-w-0 break-words font-medium text-primary">{application.vacancyTitle}</span>
            <Badge tone={applicationStateTone(application)}>{applicationStateLabel(application, labels)}</Badge>
            <span className="text-xs text-muted-foreground">{application.stageName ?? labels.noStage}</span>
            <span className="text-xs text-muted-foreground">{sourceLabel(application.source, labels)} · {formatDate(application.updatedAt, locale)}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function CandidateContact({ row, labels }: { readonly row: CandidateIndexRow; readonly labels: RecruitmentCandidateIndexLabels }) {
  if (!row.privateEmail && !row.phone) return <span className="text-sm text-muted-foreground">{labels.noContact}</span>
  return (
    <div className="min-w-0 space-y-0.5 text-xs text-muted-foreground">
      {row.privateEmail ? <p className="break-all">{row.privateEmail}</p> : null}
      {row.phone ? <p>{row.phone}</p> : null}
    </div>
  )
}

function CandidatePagination({ currentPage, queryString, totalPages, labels }: {
  readonly currentPage: number
  readonly queryString: string
  readonly totalPages: number
  readonly labels: RecruitmentCandidateIndexLabels
}) {
  if (totalPages <= 1) return null
  const paramsForPage = (page: number): string => {
    const params = new URLSearchParams(queryString)
    if (page <= 1) params.delete('page')
    else params.set('page', String(page))
    const value = params.toString()
    return value ? `?${value}` : '/recruitment/candidates'
  }
  const items = pageItems(currentPage, totalPages)
  const secondaryButton = buttonClasses({ size: 'sm', variant: 'secondary', className: 'min-w-9 px-2' })
  return (
    <nav aria-label={labels.pagination} className="mt-3 flex justify-end">
      <ul className="flex flex-wrap items-center gap-1">
        <li>
          {currentPage > 1 ? <Link aria-label={labels.previous} className={secondaryButton} href={paramsForPage(currentPage - 1)}><span aria-hidden="true">‹</span><span className="hidden sm:inline">{labels.previous}</span></Link> : <span aria-disabled="true" className={`${secondaryButton} pointer-events-none opacity-50`}><span aria-hidden="true">‹</span><span className="hidden sm:inline">{labels.previous}</span></span>}
        </li>
        {items.map((item, index) => item === 'ellipsis' ? (
          <li aria-hidden="true" className="px-1 text-muted-foreground" key={`ellipsis-${index}`}>…</li>
        ) : (
          <li key={item}><Link aria-current={item === currentPage ? 'page' : undefined} aria-label={String(item)} className={buttonClasses({ size: 'sm', variant: item === currentPage ? 'primary' : 'secondary', className: 'min-w-9 px-2' })} href={paramsForPage(item)}>{item}</Link></li>
        ))}
        <li>
          {currentPage < totalPages ? <Link aria-label={labels.next} className={secondaryButton} href={paramsForPage(currentPage + 1)}><span className="hidden sm:inline">{labels.next}</span><span aria-hidden="true">›</span></Link> : <span aria-disabled="true" className={`${secondaryButton} pointer-events-none opacity-50`}><span className="hidden sm:inline">{labels.next}</span><span aria-hidden="true">›</span></span>}
        </li>
      </ul>
    </nav>
  )
}

function CandidateRows({ data, labels, locale }: { readonly data: CandidateIndexData; readonly labels: RecruitmentCandidateIndexLabels; readonly locale: string }) {
  return (
    <>
      <div className="hidden md:block">
        <DataTableShell caption={labels.title}>
          <thead className="border-b border-border-subtle bg-surface-subtle text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold" scope="col">{labels.candidate}</th>
              <th className="px-4 py-3 font-semibold" scope="col">{labels.applications}</th>
              <th className="px-4 py-3 font-semibold" scope="col">{labels.lastActivity}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {data.rows.map((row) => (
              <tr key={row.id}>
                <td className="max-w-[18rem] px-4 py-4 align-top">
                  <div className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                    <span className="break-words">{row.name}</span>
                    {row.possibleDuplicate ? <Badge tone="warning">{labels.possibleDuplicate}</Badge> : null}
                  </div>
                  <div className="mt-2"><CandidateContact labels={labels} row={row} /></div>
                </td>
                <td className="min-w-[22rem] px-4 py-4 align-top">
                  <ApplicationLinks applications={row.applications} candidateName={row.name} labels={labels} locale={locale} />
                </td>
                <td className="whitespace-nowrap px-4 py-4 align-top text-sm text-muted-foreground">
                  <span className="block">{labels.applicationCount(row.applicationCount)}</span>
                  <time dateTime={row.updatedAt}>{formatDate(row.updatedAt, locale)}</time>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTableShell>
      </div>
      <Surface className="overflow-hidden md:hidden">
        <ol aria-label={labels.title} className="divide-y divide-border-subtle">
          {data.rows.map((row) => (
            <li className="min-w-0 space-y-4 px-4 py-4" key={row.id}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                  <span className="break-words">{row.name}</span>
                  {row.possibleDuplicate ? <Badge tone="warning">{labels.possibleDuplicate}</Badge> : null}
                </div>
                <div className="mt-2"><CandidateContact labels={labels} row={row} /></div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.applications}</p>
                <ApplicationLinks applications={row.applications} candidateName={row.name} labels={labels} locale={locale} />
              </div>
              <p className="text-xs text-muted-foreground">{labels.applicationCount(row.applicationCount)} · <time dateTime={row.updatedAt}>{formatDate(row.updatedAt, locale)}</time></p>
            </li>
          ))}
        </ol>
      </Surface>
    </>
  )
}

export function RecruitmentCandidateIndex({ data, labels, locale, query, queryString }: RecruitmentCandidateIndexProps) {
  const resultFrom = data.totalResults === 0 ? 0 : ((data.page - 1) * data.pageSize) + 1
  const resultTo = Math.min(data.page * data.pageSize, data.totalResults)
  return (
    <PageShell className="py-8 lg:py-10" width="wide">
      <p className="eyebrow">{labels.title}</p>
      <PageHeader className="mt-2" description={labels.description} title={labels.title} />
      <form action="/recruitment/candidates" className="mt-7 space-y-3" method="get">
        <CollectionToolbar search={<div className="flex min-w-0 flex-1 items-center gap-2"><div className="min-w-0 flex-1"><label className="sr-only" htmlFor="candidate-search">{labels.search}</label><TextInput defaultValue={query.search} id="candidate-search" leadingIcon={<Search aria-hidden="true" />} name="q" placeholder={labels.searchPlaceholder} /></div><button className={buttonClasses({ size: 'md', variant: 'primary' })} type="submit">{labels.applyFilters}</button></div>} />
        <FilterBar aria-label={labels.filters} actions={<Link className={buttonClasses({ size: 'sm', variant: 'ghost' })} href="/recruitment/candidates">{labels.clear}</Link>}>
          <div className="grid min-w-0 flex-1 basis-48 gap-1.5"><label className="text-xs font-medium text-muted-foreground" htmlFor="candidate-state">{labels.state}</label><DropdownSelect defaultValue={query.state} id="candidate-state" name="state"><option value="ALL">{labels.allStates}</option><option value="ACTIVE">{labels.active}</option><option value="AANGENOMEN">{labels.accepted}</option><option value="AFGEWEZEN">{labels.rejected}</option></DropdownSelect></div>
          <div className="grid min-w-0 flex-1 basis-48 gap-1.5"><label className="text-xs font-medium text-muted-foreground" htmlFor="candidate-vacancy">{labels.vacancy}</label><DropdownSelect defaultValue={query.vacancyId} id="candidate-vacancy" name="vacancy" searchable searchPlaceholder={labels.vacancy}><option value="ALL">{labels.allVacancies}</option>{data.vacancies.map((vacancy) => <option key={vacancy.id} value={vacancy.id}>{vacancy.title}</option>)}</DropdownSelect></div>
          <div className="grid min-w-0 flex-1 basis-48 gap-1.5"><label className="text-xs font-medium text-muted-foreground" htmlFor="candidate-stage">{labels.stage}</label><DropdownSelect defaultValue={query.stageId} id="candidate-stage" name="stage" searchable searchPlaceholder={labels.stage}><option value="ALL">{labels.allStages}</option>{data.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</DropdownSelect></div>
          <div className="grid min-w-0 flex-1 basis-48 gap-1.5"><label className="text-xs font-medium text-muted-foreground" htmlFor="candidate-sort">{labels.sort}</label><DropdownSelect defaultValue={query.sort} id="candidate-sort" name="sort"><option value="RECENT">{labels.recent}</option><option value="NAME">{labels.name}</option></DropdownSelect></div>
        </FilterBar>
      </form>
      <section aria-live="polite" className="mt-7" data-testid="recruitment-candidate-index">
        {data.totalResults === 0 ? <EmptyState description={labels.noResultsDescription} title={labels.noResultsTitle} actions={<Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/recruitment/candidates">{labels.noResultsClear}</Link>} /> : <CandidateRows data={data} labels={labels} locale={locale} />}
        {data.totalResults > 0 ? <><CollectionPagination className="mt-4" pageSize={labels.perPage(data.pageSize)} resultRange={labels.resultRange(resultFrom, resultTo, data.totalResults)} /><CandidatePagination currentPage={data.page} labels={labels} queryString={queryString} totalPages={data.totalPages} /></> : null}
      </section>
    </PageShell>
  )
}
