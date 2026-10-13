import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, UsersRound } from 'lucide-react'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { EmployeeFilterPanel } from '@/components/employees/employee-filter-panel'
import { EmployeeList } from '@/components/employees/employee-list'
import { buttonClasses } from '@/components/ui/button'
import { getRequestAuthorizationContext, requireAnyPermission } from '@/lib/auth/permissions'
import { listEmployeesOverviewPage } from '@/lib/employment/employment-service'
import { getEmployeeOverviewPageRange } from '@/lib/employment/employee-overview'
import type { EmploymentStatus } from '@/lib/employment/employment-status'
import { getTranslator } from '@/lib/i18n/server'
import { getStoredEmployeesListPreferences } from '@/lib/preferences/employees'
import { ACTIVE_FUTURE_EXTERNAL_STATUS, employeeListHref, type EmployeeArchiveFilter, type EmployeeListScope, type EmployeeListSort, type EmployeeListView, type EmployeeStatusFilter } from '@/lib/preferences/employee-list-state'

interface EmployeesPageProps {
  searchParams: Promise<{ search?: string; status?: string; archive?: string; sort?: string; view?: string; scope?: string; page?: string }>
}

const PAGE_SIZE = 50

const STATUSES: EmploymentStatus[] = [
  'ACTIVE_EMPLOYEE',
  'FUTURE_EMPLOYEE',
  'FORMER_EMPLOYEE',
  'NEVER_EMPLOYED',
]

function parsePage(value: string | undefined): number {
  const page = Number(value)
  return Number.isSafeInteger(page) && page >= 1 && page <= 1_000_000 ? page : 1
}

export default async function EmployeesPage({ searchParams }: EmployeesPageProps) {
  const { search = '', status, archive, sort, view, scope, page } = await searchParams
  const requestContext = await getRequestAuthorizationContext()
  const authContext = await requireAnyPermission(['employee:read', 'employee-directory:read'])
  const directoryMode = !authContext.permissions.includes('employee:read')
  if (directoryMode && !authContext.administrationId) redirect('/geen-toegang')
  const canSelectTeamScope = authContext.activeRoles.includes('DIRECT_MANAGER')
  const limitsManagerDetails = canSelectTeamScope && !authContext.activeRoles.includes('TENANT_ADMIN')
  const [storedPreferences, [tEmployees, tEmployment]] = await Promise.all([
    getStoredEmployeesListPreferences({ supabase: requestContext.supabase, userId: authContext.userId }),
    Promise.all([getTranslator('employees'), getTranslator('employment')]),
  ])

  const requestedArchiveFilter: EmployeeArchiveFilter = archive === 'archived' || archive === 'all'
    ? archive
    : archive === 'active'
      ? 'active'
      : scope === 'team'
        ? 'active'
        : storedPreferences.archive
  const archiveFilter: EmployeeArchiveFilter = directoryMode ? 'active' : requestedArchiveFilter
  const requestedScope: EmployeeListScope | null = scope === 'team' || scope === 'all' ? scope : null
  const employeeScope: EmployeeListScope = canSelectTeamScope ? (requestedScope ?? 'team') : 'all'
  const sortOrder: EmployeeListSort = sort === 'first-name' || sort === 'last-name' ? sort : storedPreferences.sort
  const viewMode: EmployeeListView = view === 'compact' || view === 'detail' || view === 'card' || view === 'photo-large' || view === 'photo' || view === 'photo-small' || view === 'photo-only' || view === 'photo-collage'
    ? view
    : storedPreferences.view
  const statusFilter: EmployeeStatusFilter = directoryMode
    ? 'ACTIVE_EMPLOYEE'
    : status === 'all'
      ? 'all'
      : status === 'active-future-external'
        ? ACTIVE_FUTURE_EXTERNAL_STATUS
        : STATUSES.includes(status as EmploymentStatus)
          ? (status as EmploymentStatus)
          : scope === 'team'
            ? ACTIVE_FUTURE_EXTERNAL_STATUS
            : storedPreferences.status
  const requestedPage = parsePage(page)
  const employeesPage = await listEmployeesOverviewPage({
    archiveFilter,
    statusFilter,
    search,
    sort: sortOrder,
    scope: employeeScope,
    page: requestedPage,
  }, {
    context: authContext,
    supabase: requestContext.supabase,
  })

  if (directoryMode && !employeesPage.directoryAccess) redirect('/geen-toegang')
  const pageRange = getEmployeeOverviewPageRange(employeesPage.totalCount, requestedPage, PAGE_SIZE)
  const pageCount = pageRange.pageCount
  const listState = {
    search,
    status: statusFilter,
    archive: archiveFilter,
    sort: sortOrder,
    view: viewMode,
    scope: employeeScope,
  }
  if (requestedPage > pageCount) redirect(employeeListHref({ ...listState, page: pageCount }))

  const canCreateEmployee = authContext.permissions.includes('employee:write')
  const labels: Record<EmploymentStatus, string> = {
    ACTIVE_EMPLOYEE: tEmployment('active'),
    FUTURE_EMPLOYEE: tEmployment('future'),
    FORMER_EMPLOYEE: tEmployees('former'),
    NEVER_EMPLOYED: tEmployees('external'),
  }
  const visiblePageCount = Math.min(5, pageCount)
  const firstVisiblePage = Math.max(1, Math.min(pageCount - visiblePageCount + 1, requestedPage - Math.floor(visiblePageCount / 2)))
  const visiblePages = Array.from({ length: visiblePageCount }, (_, index) => firstVisiblePage + index)
  const rangeStart = pageRange.from
  const rangeEnd = pageRange.to
  const pageHref = (targetPage: number) => employeeListHref({ ...listState, page: targetPage })

  return (
    <PageShell width="standard" className="py-6 lg:py-8">
      <PageHeader title={tEmployees('title')} actions={canCreateEmployee ? <Link href="/employees/new" className={buttonClasses({ className: 'gap-2' })}><Plus aria-hidden="true" className="h-4 w-4" />{tEmployees('new')}</Link> : undefined} />
      <EmployeeFilterPanel
        activeStatus={statusFilter}
        archiveFilter={archiveFilter}
        archiveOptions={directoryMode
          ? [{ value: 'active', label: tEmployees('archive.active') }]
          : [
              { value: 'active', label: tEmployees('archive.active') },
              { value: 'archived', label: tEmployees('archive.archived') },
              { value: 'all', label: tEmployees('archive.all') },
            ]}
        labels={{
          all: tEmployees('all'),
          employeeNumber: tEmployees('employeeNumber'),
          searchPlaceholder: tEmployees('searchPlaceholder'),
          searchAction: tEmployees('search'),
          clearSearch: tEmployees('clearSearch'),
          statusFilter: tEmployees('statusFilter'),
          archiveFilter: tEmployees('archiveFilter'),
          sortLabel: tEmployees('sortLabel'),
          sortFirstName: tEmployees('sortFirstName'),
          sortLastName: tEmployees('sortLastName'),
          showFilters: tEmployees('showFilters'),
          hideFilters: tEmployees('hideFilters'),
          clearFilters: tEmployees('clearFilters'),
          viewLabel: tEmployees('viewLabel'),
          viewCompact: tEmployees('viewCompact'),
          viewDetail: tEmployees('viewDetail'),
          viewCard: tEmployees('viewCard'),
          viewPhotoLarge: tEmployees('viewPhotoLarge'),
          viewPhoto: tEmployees('viewPhoto'),
          viewPhotoSmall: tEmployees('viewPhotoSmall'),
          viewPhotoOnly: tEmployees('viewPhotoOnly'),
          viewPhotoCollage: tEmployees('viewPhotoCollage'),
          activeFutureExternal: tEmployees('activeFutureExternal'),
          scopeLabel: tEmployees('scopeLabel'),
          myTeam: tEmployees('myTeam'),
          allEmployees: tEmployees('allEmployees'),
        }}
        headerAction={null}
        search={search}
        scope={employeeScope}
        canSelectTeamScope={canSelectTeamScope}
        sort={sortOrder}
        view={viewMode}
        statusOptions={(directoryMode ? ['ACTIVE_EMPLOYEE' as EmploymentStatus] : STATUSES).map((item) => ({ value: item, label: labels[item] }))}
      />

      <div className="mt-3">
        <EmployeeList
          archiveLabel={tEmployees('archived')}
          administrationLabel={tEmployees('administration')}
          departmentLabel={tEmployees('department')}
          employeeNumberLabel={tEmployees('employeeNumber')}
          emptyLabel={tEmployees('empty')}
          employees={employeesPage.employees}
          employeeTypeLabel={(employmentType, employmentStatus) => employmentType === 'EMPLOYEE'
            ? tEmployment('workerEmployee')
            : employmentType === 'INTERN' || employmentType === 'APPRENTICE'
              ? tEmployment('workerStudentIntern')
              : employmentType === 'CONTRACTOR' || employmentType === 'TEMPORARY_AGENCY'
                ? tEmployment('workerTemporaryAgency')
                : employmentType === 'FREELANCER'
                  ? tEmployment('workerFreelancer')
                  : employmentType === 'VOLUNTEER'
                    ? tEmployment('workerVolunteer')
                    : employmentType === 'NO_PAYROLL'
                      ? tEmployment('workerNoPayroll')
                      : employmentStatus === 'NEVER_EMPLOYED' ? labels[employmentStatus] : ''}
          jobTitleLabel={tEmployees('jobTitle')}
          noEmailLabel={tEmployees('noEmail')}
          listLabel={tEmployees('title')}
          viewProfileLabel={tEmployees('viewProfile')}
          view={viewMode}
          directoryMode={directoryMode}
          currentEmployeeId={authContext.employeeId}
          directoryVisibility={employeesPage.directoryVisibility}
          limitedDetailEmployeeIds={limitsManagerDetails ? employeesPage.limitedDetailEmployeeIds : []}
          directoryLabels={{ loading: tEmployees('directoryLoading'), close: tEmployees('directoryClose'), unavailable: tEmployees('directoryUnavailable'), job: tEmployees('jobTitle'), department: tEmployees('department'), email: tEmployees('workEmail'), phone: tEmployees('workPhone'), presence: tEmployees('directoryPresence'), schedule: tEmployees('directorySchedule'), working: tEmployees('directoryWorking'), off: tEmployees('directoryOff'), absent: tEmployees('directoryAbsent'), noDetails: tEmployees('directoryEyebrow') }}
        />
      </div>

      <div className="mt-4 flex flex-col gap-3 px-1 text-sm font-medium text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2">
          <UsersRound aria-hidden="true" className="h-4 w-4 shrink-0" />
          {tEmployees('resultRange', { from: rangeStart, to: rangeEnd, count: employeesPage.totalCount })}
        </p>
        {pageCount > 1 ? (
          <nav aria-label={tEmployees('paginationLabel')} className="flex items-center gap-1 overflow-x-auto">
            {requestedPage > 1 ? (
              <Link href={pageHref(requestedPage - 1)} rel="prev" className="inline-flex min-h-10 shrink-0 items-center rounded-md border px-3 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{tEmployees('previous')}</Link>
            ) : (
              <span aria-disabled="true" className="inline-flex min-h-10 shrink-0 items-center rounded-md border px-3 opacity-50">{tEmployees('previous')}</span>
            )}
            {visiblePages.map((pageNumber) => (
              <Link
                key={pageNumber}
                href={pageHref(pageNumber)}
                aria-current={pageNumber === requestedPage ? 'page' : undefined}
                aria-label={tEmployees('pageNumber', { page: pageNumber })}
                className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-md border px-3 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
              >
                {pageNumber}
              </Link>
            ))}
            {requestedPage < pageCount ? (
              <Link href={pageHref(requestedPage + 1)} rel="next" className="inline-flex min-h-10 shrink-0 items-center rounded-md border px-3 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{tEmployees('next')}</Link>
            ) : (
              <span aria-disabled="true" className="inline-flex min-h-10 shrink-0 items-center rounded-md border px-3 opacity-50">{tEmployees('next')}</span>
            )}
          </nav>
        ) : null}
      </div>
    </PageShell>
  )
}