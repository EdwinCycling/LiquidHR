import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { EmployeeFilterPanel } from '@/components/employees/employee-filter-panel'
import { EmployeeList } from '@/components/employees/employee-list'
import { getRequestAuthorizationContext, requireAnyPermission } from '@/lib/auth/permissions'
import { getEmployeeDirectoryAccess, getEmployeeDirectoryVisibility } from '@/lib/employee-directory/service'
import { listEmployeesOverview } from '@/lib/employment/employment-service'
import type { EmploymentStatus } from '@/lib/employment/employment-status'
import { getTranslator } from '@/lib/i18n/server'
import { listDirectTeamEmployeeIds } from '@/lib/organization/team-scope'
import { getStoredEmployeesListPreferences } from '@/lib/preferences/employees'
import { ACTIVE_FUTURE_EXTERNAL_STATUS, matchesEmployeeStatus, type EmployeeArchiveFilter, type EmployeeListScope, type EmployeeListSort, type EmployeeListView, type EmployeeStatusFilter } from '@/lib/preferences/employee-list-state'

interface EmployeesPageProps {
  searchParams: Promise<{ search?: string; status?: string; archive?: string; sort?: string; view?: string; scope?: string }>
}

const STATUSES: EmploymentStatus[] = [
  'ACTIVE_EMPLOYEE',
  'FUTURE_EMPLOYEE',
  'FORMER_EMPLOYEE',
  'NEVER_EMPLOYED',
]

export default async function EmployeesPage({ searchParams }: EmployeesPageProps) {
  const { search = '', status, archive, sort, view, scope } = await searchParams
  const requestContext = await getRequestAuthorizationContext()
  const authContext = await requireAnyPermission(['employee:read', 'employee-directory:read'])
  const directoryMode = !authContext.permissions.includes('employee:read')
  if (directoryMode && !authContext.administrationId) redirect('/geen-toegang')
  const directoryDependencies = { context: authContext, supabase: requestContext.supabase }
  const canSelectTeamScope = authContext.activeRoles.includes('DIRECT_MANAGER')
  const limitsManagerDetails = canSelectTeamScope && !authContext.activeRoles.includes('TENANT_ADMIN')
  const storedPreferencesPromise = getStoredEmployeesListPreferences({ supabase: requestContext.supabase, userId: authContext.userId })
  const directoryAccessPromise = directoryMode ? getEmployeeDirectoryAccess(directoryDependencies) : Promise.resolve(true)
  const directoryVisibilityPromise = getEmployeeDirectoryVisibility(directoryDependencies)
  const translationsPromise = Promise.all([getTranslator('employees'), getTranslator('employment')])
  const directTeamEmployeeIdsPromise = canSelectTeamScope ? listDirectTeamEmployeeIds(authContext, requestContext.supabase) : Promise.resolve([])
  const storedPreferences = await storedPreferencesPromise
  const requestedArchiveFilter: EmployeeArchiveFilter = archive === 'archived' || archive === 'all' ? archive : archive === 'active' ? 'active' : scope === 'team' ? 'active' : storedPreferences.archive
  const archiveFilter: EmployeeArchiveFilter = directoryMode ? 'active' : requestedArchiveFilter
  const requestedScope: EmployeeListScope | null = scope === 'team' || scope === 'all' ? scope : null
  const employeeScope: EmployeeListScope = canSelectTeamScope ? (requestedScope ?? 'team') : 'all'
  const employeesPromise = listEmployeesOverview(archiveFilter, employeeScope, { activeDirectoryOnly: directoryMode }, {
    context: authContext,
    supabase: requestContext.supabase,
    teamEmployeeIds: canSelectTeamScope ? directTeamEmployeeIdsPromise : undefined,
  })
  const [directoryAccess, directoryVisibility, [tEmployees, tEmployment], directTeamEmployeeIds, employees] = await Promise.all([
    directoryAccessPromise,
    directoryVisibilityPromise,
    translationsPromise,
    directTeamEmployeeIdsPromise,
    employeesPromise,
  ])
  if (directoryMode && !directoryAccess) redirect('/geen-toegang')
  const canCreateEmployee = authContext.permissions.includes('employee:write')
  const sortOrder: EmployeeListSort = sort === 'first-name' || sort === 'last-name' ? sort : storedPreferences.sort
  const viewMode: EmployeeListView = view === 'compact' || view === 'detail' || view === 'card' || view === 'photo-large' || view === 'photo' || view === 'photo-small' || view === 'photo-only' || view === 'photo-collage' ? view : storedPreferences.view
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
  const collator = new Intl.Collator('nl', { sensitivity: 'base' })
  const normalizedQuery = search.trim().toLocaleLowerCase('nl')
  const filtered = employees.filter((employee) => {
    const matchesStatus = matchesEmployeeStatus(employee.status, statusFilter)
    const limitedDirectoryEmployee = directoryMode || (limitsManagerDetails && employee.id !== authContext.employeeId && !directTeamEmployeeIds.includes(employee.id))
    const haystack = `${employee.firstName} ${employee.birthNamePrefix ?? ''} ${employee.birthName} ${limitedDirectoryEmployee ? '' : employee.employeeNumber} ${directoryVisibility.showJobDepartment ? `${employee.departmentName ?? ''} ${employee.jobTitle ?? ''}` : ''} ${directoryVisibility.showWorkEmail ? employee.workEmail ?? '' : ''}`.toLocaleLowerCase('nl')
    return matchesStatus && (!normalizedQuery || haystack.includes(normalizedQuery))
  })
  const sorted = [...filtered].sort((left, right) => {
    if (sortOrder === 'first-name') {
      const firstNameComparison = collator.compare(left.firstName, right.firstName)
      if (firstNameComparison !== 0) return firstNameComparison
      return collator.compare(left.birthName, right.birthName)
    }

    const lastNameComparison = collator.compare(left.birthName, right.birthName)
    if (lastNameComparison !== 0) return lastNameComparison
    return collator.compare(left.firstName, right.firstName)
  })
  const labels: Record<EmploymentStatus, string> = {
    ACTIVE_EMPLOYEE: tEmployment('active'),
    FUTURE_EMPLOYEE: tEmployment('future'),
    FORMER_EMPLOYEE: tEmployees('former'),
    NEVER_EMPLOYED: tEmployees('external'),
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
      {canCreateEmployee && <div className="mb-4 flex justify-end">
        <Link href="/employees/new" className="button-primary gap-2">
          <Plus aria-hidden="true" className="h-4 w-4" />{tEmployees('new')}
        </Link>
      </div>}

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
        resultCountLabel={tEmployees('resultCount', { count: sorted.length })}
        search={search}
        scope={employeeScope}
        canSelectTeamScope={canSelectTeamScope}
        sort={sortOrder}
        view={viewMode}
        statusOptions={(directoryMode ? ['ACTIVE_EMPLOYEE' as EmploymentStatus] : STATUSES).map((item) => ({ value: item, label: labels[item] }))}
      />

      <div className="mt-4">
        <EmployeeList
          archiveLabel={tEmployees('archived')}
          departmentLabel={tEmployees('department')}
          employeeNumberLabel={tEmployees('employeeNumber')}
          labels={labels}
          emptyLabel={tEmployees('empty')}
          employees={sorted}
          employmentCountLabel={(count) => tEmployees('employmentCount', { count })}
          jobTitleLabel={tEmployees('jobTitle')}
          noEmailLabel={tEmployees('noEmail')}
          notRecordedLabel={tEmployees('notRecorded')}
          listLabel={tEmployees('title')}
          viewProfileLabel={tEmployees('viewProfile')}
          view={viewMode}
          directoryMode={directoryMode}
          currentEmployeeId={authContext.employeeId}
          directoryVisibility={directoryVisibility}
          limitedDetailEmployeeIds={limitsManagerDetails ? sorted.filter((employee) => employee.id !== authContext.employeeId && !directTeamEmployeeIds.includes(employee.id)).map((employee) => employee.id) : []}
          directoryLabels={{ loading: tEmployees('directoryLoading'), close: tEmployees('directoryClose'), unavailable: tEmployees('directoryUnavailable'), job: tEmployees('jobTitle'), department: tEmployees('department'), email: tEmployees('workEmail'), phone: tEmployees('workPhone'), presence: tEmployees('directoryPresence'), schedule: tEmployees('directorySchedule'), working: tEmployees('directoryWorking'), off: tEmployees('directoryOff'), absent: tEmployees('directoryAbsent'), noDetails: tEmployees('directoryEyebrow') }}
        />
      </div>
    </main>
  )
}
