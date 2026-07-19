import Link from 'next/link'
import { Plus } from 'lucide-react'
import { EmployeeFilterPanel } from '@/components/employees/employee-filter-panel'
import { EmployeeList } from '@/components/employees/employee-list'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { listEmployeesOverview } from '@/lib/employment/employment-service'
import type { EmploymentStatus } from '@/lib/employment/employment-status'
import { getTranslator } from '@/lib/i18n/server'
import { getStoredEmployeesListPreferences } from '@/lib/preferences/employees'
import type { EmployeeArchiveFilter, EmployeeListSort, EmployeeListView, EmployeeStatusFilter } from '@/lib/preferences/employee-list-state'

interface EmployeesPageProps {
  searchParams: Promise<{ search?: string; status?: string; archive?: string; sort?: string; view?: string }>
}

const STATUSES: EmploymentStatus[] = [
  'ACTIVE_EMPLOYEE',
  'FUTURE_EMPLOYEE',
  'FORMER_EMPLOYEE',
  'NEVER_EMPLOYED',
]

export default async function EmployeesPage({ searchParams }: EmployeesPageProps) {
  const { search = '', status, archive, sort, view } = await searchParams
  const storedPreferences = await getStoredEmployeesListPreferences()
  const archiveFilter: EmployeeArchiveFilter = archive === 'archived' || archive === 'all' ? archive : archive === 'active' ? 'active' : storedPreferences.archive
  const [employees, canCreateEmployee, tEmployees, tEmployment] = await Promise.all([
    listEmployeesOverview(archiveFilter),
    canCreateEmployees(),
    getTranslator('employees'),
    getTranslator('employment'),
  ])
  const sortOrder: EmployeeListSort = sort === 'first-name' || sort === 'last-name' ? sort : storedPreferences.sort
  const viewMode: EmployeeListView = view === 'compact' || view === 'detail' ? view : storedPreferences.view
  const statusFilter: EmployeeStatusFilter = status === 'all'
    ? 'all'
    : STATUSES.includes(status as EmploymentStatus)
      ? (status as EmploymentStatus)
      : storedPreferences.status
  const collator = new Intl.Collator('nl', { sensitivity: 'base' })
  const normalizedQuery = search.trim().toLocaleLowerCase('nl')
  const filtered = employees.filter((employee) => {
    const matchesStatus = statusFilter === 'all' || employee.status === statusFilter
    const haystack = `${employee.firstName} ${employee.birthNamePrefix ?? ''} ${employee.birthName} ${employee.employeeNumber} ${employee.departmentName ?? ''} ${employee.jobTitle ?? ''} ${employee.workEmail ?? ''}`.toLocaleLowerCase('nl')
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{tEmployment('title')}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{tEmployees('title')}</h1>
        </div>
        {canCreateEmployee && <Link href="/employees/new" className="button-primary gap-2 self-start">
          <Plus aria-hidden="true" className="h-4 w-4" />{tEmployees('new')}
        </Link>}
      </div>

      <EmployeeFilterPanel
        activeStatus={statusFilter}
        archiveFilter={archiveFilter}
        archiveOptions={[
          { value: 'active', label: tEmployees('archive.active') },
          { value: 'archived', label: tEmployees('archive.archived') },
          { value: 'all', label: tEmployees('archive.all') },
        ]}
        initialOpen={storedPreferences.filterPanelOpen}
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
        }}
        resultCountLabel={tEmployees('resultCount', { count: sorted.length })}
        search={search}
        sort={sortOrder}
        view={viewMode}
        statusOptions={STATUSES.map((item) => ({ value: item, label: labels[item] }))}
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
          view={viewMode}
        />
      </div>
    </main>
  )
}

async function canCreateEmployees(): Promise<boolean> {
  try {
    await requirePermission('employee:write')
    return true
  } catch (error) {
    if (error instanceof AuthorizationError) return false
    throw error
  }
}
