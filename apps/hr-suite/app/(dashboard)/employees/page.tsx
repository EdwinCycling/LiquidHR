import Link from 'next/link'
import { Plus, Search, UsersRound } from 'lucide-react'
import { EmployeeList } from '@/components/employees/employee-list'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { listEmployeesOverview } from '@/lib/employment/employment-service'
import type { EmploymentStatus } from '@/lib/employment/employment-status'
import { getTranslator } from '@/lib/i18n/server'

interface EmployeesPageProps {
  searchParams: Promise<{ search?: string; status?: string; archive?: string }>
}

const STATUSES: EmploymentStatus[] = [
  'ACTIVE_EMPLOYEE',
  'FUTURE_EMPLOYEE',
  'FORMER_EMPLOYEE',
  'NEVER_EMPLOYED',
]

export default async function EmployeesPage({ searchParams }: EmployeesPageProps) {
  const { search = '', status, archive } = await searchParams
  const archiveFilter = archive === 'archived' || archive === 'all' ? archive : 'active'
  const [employees, canCreateEmployee, tEmployees, tEmployment] = await Promise.all([
    listEmployeesOverview(archiveFilter),
    canCreateEmployees(),
    getTranslator('employees'),
    getTranslator('employment'),
  ])
  const normalizedQuery = search.trim().toLocaleLowerCase('nl')
  const activeStatus = STATUSES.includes(status as EmploymentStatus) ? (status as EmploymentStatus) : null
  const filtered = employees.filter((employee) => {
    const matchesStatus = !activeStatus || employee.status === activeStatus
    const haystack = `${employee.firstName} ${employee.birthName} ${employee.employeeNumber} ${employee.workEmail ?? ''}`.toLocaleLowerCase('nl')
    return matchesStatus && (!normalizedQuery || haystack.includes(normalizedQuery))
  })
  const labels: Record<EmploymentStatus, string> = {
    ACTIVE_EMPLOYEE: tEmployment('active'),
    FUTURE_EMPLOYEE: tEmployment('future'),
    FORMER_EMPLOYEE: tEmployees('former'),
    NEVER_EMPLOYED: tEmployees('external'),
  }
  const filterHref = (nextStatus?: EmploymentStatus) => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (nextStatus) params.set('status', nextStatus)
    if (archiveFilter !== 'active') params.set('archive', archiveFilter)
    const query = params.toString()
    return query ? `/employees?${query}` : '/employees'
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{tEmployment('title')}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{tEmployees('title')}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">{tEmployees('subtitle')}</p>
        </div>
        {canCreateEmployee && <Link href="/employees/new" className="button-primary gap-2 self-start">
          <Plus aria-hidden="true" className="h-4 w-4" />{tEmployees('new')}
        </Link>}
      </div>

      <div className="mt-7 rounded-2xl border bg-surface p-4 shadow-sm">
        <form className="grid gap-3 sm:grid-cols-[1fr_auto]">
          {activeStatus && <input type="hidden" name="status" value={activeStatus} />}
          {archiveFilter !== 'active' && <input type="hidden" name="archive" value={archiveFilter} />}
          <label className="relative">
            <span className="sr-only">{tEmployees('searchPlaceholder')}</span>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input name="search" defaultValue={search} placeholder={tEmployees('searchPlaceholder')} className="form-field pl-10" />
          </label>
          <button className="button-secondary" type="submit">{tEmployees('search')}</button>
        </form>

        <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex gap-2 overflow-x-auto pb-1" aria-label={tEmployees('statusFilter')}>
            <Link href={filterHref()} className={`filter-chip ${activeStatus === null ? 'filter-chip-active' : ''}`}>
              {tEmployees('all')}
            </Link>
            {STATUSES.map((item) => (
              <Link key={item} href={filterHref(item)} className={`filter-chip ${activeStatus === item ? 'filter-chip-active' : ''}`}>
                {labels[item]}
              </Link>
            ))}
          </nav>
          <nav className="flex gap-2 overflow-x-auto pb-1" aria-label={tEmployees('archiveFilter')}>
            {(['active', 'archived', 'all'] as const).map((value) => {
              const params = new URLSearchParams()
              if (search) params.set('search', search)
              if (activeStatus) params.set('status', activeStatus)
              if (value !== 'active') params.set('archive', value)
              const href = params.toString() ? `/employees?${params.toString()}` : '/employees'
              return <Link key={value} href={href} className={`filter-chip ${archiveFilter === value ? 'filter-chip-active' : ''}`}>{tEmployees(`archive.${value}`)}</Link>
            })}
          </nav>
          <span className="flex shrink-0 items-center gap-2 text-sm font-medium text-muted-foreground">
            <UsersRound aria-hidden="true" className="h-4 w-4" />{tEmployees('resultCount', { count: filtered.length })}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <EmployeeList
          employees={filtered}
          labels={labels}
          emptyLabel={tEmployees('empty')}
          employmentCountLabel={(count) => tEmployees('employmentCount', { count })}
          archiveLabel={tEmployees('archived')}
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
