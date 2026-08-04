import { ArrowUpRight, BriefcaseBusiness, Eye, Mail } from 'lucide-react'
/* eslint-disable @next/next/no-img-element -- private avatar routes and customer-hosted URLs are intentionally rendered without remote image configuration. */
import Link from 'next/link'
import type { EmployeeOverview } from '@/lib/employment/employment-service'
import type { EmploymentStatus } from '@/lib/employment/employment-status'
import type { EmployeeListView } from '@/lib/preferences/employee-list-state'
import { EmailLink } from '@/components/shared/email-link'
import { EmployeeDirectoryTrigger } from './employee-directory-trigger'
import { EmployeePhotoAvatar } from './employee-photo-avatar'

interface EmployeeListProps {
  employees: EmployeeOverview[]
  labels: Record<EmploymentStatus, string>
  emptyLabel: string
  employmentCountLabel: (count: number) => string
  archiveLabel: string
  employeeNumberLabel: string
  departmentLabel: string
  jobTitleLabel: string
  noEmailLabel: string
  notRecordedLabel: string
  listLabel: string
  viewProfileLabel: string
  view: EmployeeListView
  directoryMode?: boolean
  currentEmployeeId?: string | null
  directoryVisibility?: { showJobDepartment: boolean; showWorkEmail: boolean }
  limitedDetailEmployeeIds?: string[]
  directoryLabels?: React.ComponentProps<typeof EmployeeDirectoryTrigger>['labels']
}

const STATUS_STYLES: Record<EmploymentStatus, string> = {
  ACTIVE_EMPLOYEE: 'bg-success-surface text-success',
  FUTURE_EMPLOYEE: 'bg-accent text-accent-foreground',
  FORMER_EMPLOYEE: 'bg-muted text-muted-foreground',
  NEVER_EMPLOYED: 'bg-warning-surface text-warning',
}

export function EmployeeList({
  employees,
  labels,
  emptyLabel,
  employmentCountLabel,
  archiveLabel,
  employeeNumberLabel,
  departmentLabel,
  jobTitleLabel,
  noEmailLabel,
  notRecordedLabel,
  listLabel,
  viewProfileLabel,
  view,
  directoryMode = false,
  currentEmployeeId = null,
  directoryVisibility = { showJobDepartment: true, showWorkEmail: true },
  limitedDetailEmployeeIds = [],
  directoryLabels,
}: EmployeeListProps) {
  if (employees.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed bg-surface/70 px-6 py-14 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <BriefcaseBusiness aria-hidden="true" className="h-5 w-5" />
        </div>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground">{emptyLabel}</p>
      </section>
    )
  }

  if (view === 'card') {
    return (
      <section aria-label={listLabel} className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,17rem),1fr))] gap-4 sm:gap-5">
        {employees.map((employee) => (
          <EmployeeCard
            key={employee.id}
            employee={employee}
            labels={labels}
            archiveLabel={archiveLabel}
            employeeNumberLabel={employeeNumberLabel}
            departmentLabel={departmentLabel}
            jobTitleLabel={jobTitleLabel}
            noEmailLabel={noEmailLabel}
            notRecordedLabel={notRecordedLabel}
            viewProfileLabel={viewProfileLabel}
            directoryMode={directoryMode}
            currentEmployeeId={currentEmployeeId}
            directoryVisibility={directoryVisibility}
            limitedDetailEmployeeIds={limitedDetailEmployeeIds}
            directoryLabels={directoryLabels}
          />
        ))}
      </section>
    )
  }

  if (view === 'photo-large' || view === 'photo' || view === 'photo-small' || view === 'photo-only' || view === 'photo-collage') {
    const photoSize = view === 'photo-large' ? 'large' : view === 'photo-small' ? 'small' : view === 'photo-only' ? 'only' : view === 'photo-collage' ? 'collage' : 'medium'
    return (
      <EmployeePhotoGrid
        employees={employees}
        listLabel={listLabel}
        size={photoSize}
        directoryMode={directoryMode}
        currentEmployeeId={currentEmployeeId}
        limitedDetailEmployeeIds={limitedDetailEmployeeIds}
        directoryLabels={directoryLabels}
      />
    )
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-surface shadow-sm">
      <ul className="divide-y">
        {employees.map((employee, index) => (
          <li key={employee.id} className={index % 2 === 1 ? 'bg-muted/20' : ''}>
            <div className={`group relative grid cursor-pointer px-4 transition-colors hover:bg-accent/45 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6 ${view === 'compact' ? 'gap-3 py-2.5' : 'gap-4 py-4 sm:py-5'}`}>
              {directoryLabels && employee.id !== currentEmployeeId && (directoryMode || limitedDetailEmployeeIds.includes(employee.id)) ? <EmployeeDirectoryTrigger employeeId={employee.id} ariaLabel={[employee.firstName, employee.birthNamePrefix, employee.birthName].filter(Boolean).join(' ')} labels={directoryLabels} /> : <Link aria-label={[employee.firstName, employee.birthNamePrefix, employee.birthName].filter(Boolean).join(' ')} className="absolute inset-0 z-0 rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" href={`/employees/${employee.id}`} prefetch={false} />}
              <div className="relative z-10 min-w-0 pointer-events-none">
                <div className={`flex min-w-0 items-center ${view === 'compact' ? 'gap-2.5' : 'gap-3.5'}`}>
                  {view === 'detail' ? (
                    employee.avatarUrl ? <img src={employee.avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover shadow-sm" /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold tracking-wide text-primary-foreground shadow-sm">{employee.firstName.slice(0, 1)}{employee.birthName.slice(0, 1)}</span>
                  ) : null}
                  <div className="min-w-0">
                    {(!directoryMode && !limitedDetailEmployeeIds.includes(employee.id)) ? <p className="truncate text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {employeeNumberLabel}: {employee.employeeNumber}
                    </p> : null}
                    <p className={`truncate font-semibold text-foreground ${view === 'compact' ? 'text-sm' : ''}`}>
                      {[employee.firstName, employee.birthNamePrefix, employee.birthName].filter(Boolean).join(' ')}
                    </p>
                    {view === 'detail' && directoryVisibility.showJobDepartment ? <p className="mt-1 truncate text-sm text-muted-foreground">
                      <span className="font-medium text-foreground/80">{departmentLabel}:</span>{' '}
                      {employee.departmentName ?? notRecordedLabel}
                      <span aria-hidden="true" className="px-1.5 text-muted-foreground/70">·</span>
                      <span className="font-medium text-foreground/80">{jobTitleLabel}:</span>{' '}
                      {employee.jobTitle ?? notRecordedLabel}
                    </p> : null}
                  </div>
                </div>
                {view === 'detail' && directoryVisibility.showWorkEmail ? <span className="mt-1 flex min-w-0 items-center gap-1.5 pl-[3.875rem] text-sm text-muted-foreground">
                  <Mail aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  {employee.workEmail ? <EmailLink className="pointer-events-auto relative z-20 inline-flex min-h-6 items-center truncate hover:underline" email={employee.workEmail} /> : <span className="truncate">{noEmailLabel}</span>}
                </span> : null}
              </div>
              <div className={`relative z-10 flex items-center justify-between gap-3 pointer-events-none sm:justify-end ${view === 'detail' ? 'pl-[3.4rem] sm:pl-0' : 'pl-0'}`}>
                {employee.isArchived && <span className="rounded-md bg-warning-surface px-2.5 py-1 text-xs font-semibold text-warning">{archiveLabel}</span>}
                <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[employee.status]}`}>
                  {labels[employee.status]}
                </span>
                <span className="hidden text-xs font-medium text-muted-foreground md:inline">
                  {employmentCountLabel(employee.employmentCount)}
                </span>
                <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

interface EmployeeCardProps {
  employee: EmployeeOverview
  labels: Record<EmploymentStatus, string>
  archiveLabel: string
  employeeNumberLabel: string
  departmentLabel: string
  jobTitleLabel: string
  noEmailLabel: string
  notRecordedLabel: string
  viewProfileLabel: string
  directoryMode: boolean
  currentEmployeeId: string | null
  directoryVisibility: { showJobDepartment: boolean; showWorkEmail: boolean }
  limitedDetailEmployeeIds: string[]
  directoryLabels?: React.ComponentProps<typeof EmployeeDirectoryTrigger>['labels']
}

function EmployeeCard({
  employee,
  labels,
  archiveLabel,
  employeeNumberLabel,
  departmentLabel,
  jobTitleLabel,
  noEmailLabel,
  notRecordedLabel,
  viewProfileLabel,
  directoryMode,
  currentEmployeeId,
  directoryVisibility,
  limitedDetailEmployeeIds,
  directoryLabels,
}: EmployeeCardProps) {
  const name = [employee.firstName, employee.birthNamePrefix, employee.birthName].filter(Boolean).join(' ')
  const limitedDirectoryEmployee = directoryMode || limitedDetailEmployeeIds.includes(employee.id)
  const opensDirectory = Boolean(directoryLabels && employee.id !== currentEmployeeId && limitedDirectoryEmployee)
  const ariaLabel = opensDirectory ? name : `${viewProfileLabel}: ${name}`

  const cardContent = (
    <>
      <div className="relative z-10 flex items-end justify-between gap-3 px-5 pt-0 pointer-events-none">
        {employee.avatarUrl ? (
          <img src={employee.avatarUrl} alt="" className="-mt-11 h-[5.5rem] w-[5.5rem] rounded-full border-4 border-surface object-cover shadow-lg" />
        ) : (
          <span className="-mt-11 flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-full border-4 border-surface bg-primary text-lg font-bold tracking-wide text-primary-foreground shadow-lg">
            {employee.firstName.slice(0, 1)}{employee.birthName.slice(0, 1)}
          </span>
        )}
        <div className="mb-1 flex flex-wrap justify-end gap-2">
          {employee.isArchived ? <span className="rounded-full bg-warning-surface px-2.5 py-1 text-[0.68rem] font-semibold text-warning">{archiveLabel}</span> : null}
          <span className={`rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${STATUS_STYLES[employee.status]}`}>
            {labels[employee.status]}
          </span>
        </div>
      </div>

      <div className="relative z-10 px-5 pt-4 pointer-events-none">
        {!limitedDirectoryEmployee ? <p className="truncate text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {employeeNumberLabel}: {employee.employeeNumber}
        </p> : null}
        <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-foreground">{name}</h2>
        {directoryVisibility.showJobDepartment ? (
          <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            <p className="truncate"><span className="font-medium text-foreground/80">{jobTitleLabel}:</span> {employee.jobTitle ?? notRecordedLabel}</p>
            <p className="truncate"><span className="font-medium text-foreground/80">{departmentLabel}:</span> {employee.departmentName ?? notRecordedLabel}</p>
          </div>
        ) : null}
        {directoryVisibility.showWorkEmail ? (
          <p className="mt-3 flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <Mail aria-hidden="true" className="h-4 w-4 shrink-0" />
            {employee.workEmail ? <EmailLink className="pointer-events-auto relative z-20 truncate hover:underline" email={employee.workEmail} /> : <span className="truncate">{noEmailLabel}</span>}
          </p>
        ) : null}
      </div>

      <div className="relative z-10 mt-5 flex items-center justify-between gap-3 border-t px-5 py-3.5 pointer-events-none">
        {directoryVisibility.showWorkEmail && employee.workEmail ? (
          <span className="pointer-events-auto relative z-20 inline-flex min-w-0 items-center gap-2 text-sm font-medium text-muted-foreground">
            <Mail aria-hidden="true" className="h-4 w-4 shrink-0" />
            <EmailLink className="truncate hover:text-foreground hover:underline" email={employee.workEmail} />
          </span>
        ) : <span />}
        <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primary">
          <Eye aria-hidden="true" className="h-4 w-4" />
          {viewProfileLabel}
          <ArrowUpRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </span>
      </div>
    </>
  )

  return (
    <article className="group relative overflow-hidden rounded-2xl border bg-surface shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-within:ring-2 focus-within:ring-primary/60">
      <div aria-hidden="true" className="h-20 bg-gradient-to-br from-primary/90 via-primary to-accent-foreground/80" />
      {opensDirectory && directoryLabels ? <EmployeeDirectoryTrigger employeeId={employee.id} ariaLabel={ariaLabel} labels={directoryLabels} /> : <Link aria-label={ariaLabel} className="absolute inset-0 z-0 rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" href={`/employees/${employee.id}`} prefetch={false} />}
      {cardContent}
    </article>
  )
}

type EmployeePhotoSize = 'large' | 'medium' | 'small' | 'only' | 'collage'

interface EmployeePhotoGridProps {
  employees: EmployeeOverview[]
  listLabel: string
  size: EmployeePhotoSize
  directoryMode: boolean
  currentEmployeeId: string | null
  limitedDetailEmployeeIds: string[]
  directoryLabels?: React.ComponentProps<typeof EmployeeDirectoryTrigger>['labels']
}

function EmployeePhotoGrid({ employees, listLabel, size, directoryMode, currentEmployeeId, limitedDetailEmployeeIds, directoryLabels }: EmployeePhotoGridProps) {
  const gridClass = size === 'large'
    ? 'grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))] gap-4 sm:gap-5'
    : size === 'small'
      ? 'grid-cols-[repeat(auto-fit,minmax(min(100%,5rem),1fr))] gap-2 sm:gap-2.5'
    : size === 'only' || size === 'collage'
        ? size === 'collage' ? 'grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))] gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-sm sm:grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))]' : 'grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-3 sm:gap-4'
        : 'grid-cols-[repeat(auto-fit,minmax(min(100%,6rem),1fr))] gap-2.5 sm:gap-3 lg:gap-4'

  return (
    <section aria-label={listLabel} className={`grid ${gridClass}`}>
      {employees.map((employee) => (
        <EmployeePhotoTile
          key={employee.id}
          employee={employee}
          size={size}
          directoryMode={directoryMode}
          currentEmployeeId={currentEmployeeId}
          limitedDetailEmployeeIds={limitedDetailEmployeeIds}
          directoryLabels={directoryLabels}
        />
      ))}
    </section>
  )
}

interface EmployeePhotoTileProps {
  employee: EmployeeOverview
  size: EmployeePhotoSize
  directoryMode: boolean
  currentEmployeeId: string | null
  limitedDetailEmployeeIds: string[]
  directoryLabels?: React.ComponentProps<typeof EmployeeDirectoryTrigger>['labels']
}

function EmployeePhotoTile({ employee, size, directoryMode, currentEmployeeId, limitedDetailEmployeeIds, directoryLabels }: EmployeePhotoTileProps) {
  const name = [employee.firstName, employee.birthNamePrefix, employee.birthName].filter(Boolean).join(' ')
  const opensDirectory = Boolean(directoryLabels && employee.id !== currentEmployeeId && (directoryMode || limitedDetailEmployeeIds.includes(employee.id)))
  const photoOnly = size === 'only' || size === 'collage'
  const photoCollage = size === 'collage'
  const contentClass = size === 'large'
    ? 'min-h-60 px-3 py-6'
    : size === 'small'
      ? 'min-h-28 px-1.5 py-3'
      : size === 'only' || size === 'collage'
        ? photoCollage ? 'aspect-square h-full p-0' : 'aspect-square p-1.5'
        : 'min-h-36 px-2 py-4 sm:min-h-40 sm:px-2.5 sm:py-5'
  const content = (
    <div className={`relative z-10 flex flex-col items-center justify-center text-center pointer-events-none ${contentClass}`}>
      <EmployeePhotoAvatar src={employee.avatarUrl} initials={`${employee.firstName.slice(0, 1)}${employee.birthName.slice(0, 1)}`} size={size} square={photoOnly} collage={photoCollage} />
      {!photoOnly ? <h2 className={`mt-2 max-w-full truncate font-semibold tracking-tight text-foreground ${size === 'large' ? 'text-base' : size === 'small' ? 'text-xs' : 'text-sm'}`}>{employee.firstName}</h2> : null}
    </div>
  )

  return (
    <article className={`group relative overflow-hidden bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-within:ring-2 focus-within:ring-primary/60 ${photoCollage ? 'aspect-square rounded-none border-0 shadow-none' : photoOnly ? 'aspect-square rounded-xl border border-border shadow-sm' : 'rounded-2xl border shadow-sm'}`}>
      {!photoOnly ? <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/80 via-primary to-accent-foreground/70" /> : null}
      {opensDirectory && directoryLabels ? <EmployeeDirectoryTrigger employeeId={employee.id} ariaLabel={name} labels={directoryLabels} /> : <Link aria-label={name} className="absolute inset-0 z-0 rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" href={`/employees/${employee.id}`} prefetch={false} />}
      {content}
    </article>
  )
}
