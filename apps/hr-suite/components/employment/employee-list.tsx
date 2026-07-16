import Link from 'next/link'
import type { EmployeeOverview } from '@/lib/employment/employment-service'
import type { EmploymentStatus } from '@/lib/employment/employment-status'

interface EmployeeListProps {
  employees: EmployeeOverview[]
  labels: Record<EmploymentStatus, string>
  emptyLabel: string
}

const STATUS_STYLES: Record<EmploymentStatus, string> = {
  ACTIVE_EMPLOYEE: 'bg-success/12 text-success',
  FUTURE_EMPLOYEE: 'bg-info/12 text-info',
  FORMER_EMPLOYEE: 'bg-muted text-muted-foreground',
  NEVER_EMPLOYED: 'bg-warning/12 text-warning-foreground',
}

export function EmployeeList({ employees, labels, emptyLabel }: EmployeeListProps) {
  if (employees.length === 0) {
    return <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">{emptyLabel}</div>
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-surface shadow-sm">
      <ul className="divide-y">
        {employees.map((employee) => (
          <li key={employee.id}>
            <Link
              href={`/employees/${employee.id}`}
              className="group grid gap-2 px-4 py-4 transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:grid-cols-[1fr_auto] sm:items-center sm:px-6"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">
                  {employee.firstName} {employee.birthName}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {employee.employeeNumber}
                  {employee.workEmail ? ` · ${employee.workEmail}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[employee.status]}`}>
                  {labels[employee.status]}
                </span>
                <span className="text-sm tabular-nums text-muted-foreground">{employee.employmentCount}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
