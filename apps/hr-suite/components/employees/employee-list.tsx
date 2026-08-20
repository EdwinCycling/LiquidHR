import { ArrowUpRight, BriefcaseBusiness, Eye, Mail } from 'lucide-react'
/* eslint-disable @next/next/no-img-element -- private avatar routes and customer-hosted URLs are intentionally rendered without remote image configuration. */
import Link from 'next/link'
import type { EmployeeOverview } from '@/lib/employment/employment-service'
import type { EmploymentStatus } from '@/lib/employment/employment-status'
import type { EmployeeListView } from '@/lib/preferences/employee-list-state'
import { getEmployeeListAvatarUrl } from '@/lib/employees/employee-avatar-visibility'
import { EmailLink } from '@/components/shared/email-link'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { EmployeeDirectoryTrigger } from './employee-directory-trigger'
import { EmployeePhotoAvatar } from './employee-photo-avatar'

interface EmployeeListProps {
  employees: EmployeeOverview[]
  emptyLabel: string
  employeeTypeLabel: (employmentType: EmployeeOverview['employmentType'], status: EmploymentStatus) => string
  archiveLabel: string
  employeeNumberLabel: string
  administrationLabel: string
  departmentLabel: string
  jobTitleLabel: string
  noEmailLabel: string
  listLabel: string
  viewProfileLabel: string
  view: EmployeeListView
  directoryMode?: boolean
  currentEmployeeId?: string | null
  directoryVisibility?: { showJobDepartment: boolean; showWorkEmail: boolean }
  limitedDetailEmployeeIds?: string[]
  directoryLabels?: React.ComponentProps<typeof EmployeeDirectoryTrigger>['labels']
}

export function EmployeeList({
  employees,
  emptyLabel,
  employeeTypeLabel,
  archiveLabel,
  employeeNumberLabel,
  administrationLabel,
  departmentLabel,
  jobTitleLabel,
  noEmailLabel,
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
    return <EmptyState icon={<BriefcaseBusiness />} title={emptyLabel} />
  }

  if (view === 'card') {
    return (
      <section aria-label={listLabel} className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,17rem),1fr))] gap-4 sm:gap-5">
        {employees.map((employee) => (
          <EmployeeCard
            key={employee.id}
            employee={employee}
            employeeTypeLabel={employeeTypeLabel}
            archiveLabel={archiveLabel}
            employeeNumberLabel={employeeNumberLabel}
            departmentLabel={departmentLabel}
            jobTitleLabel={jobTitleLabel}
            noEmailLabel={noEmailLabel}
            viewProfileLabel={viewProfileLabel}
            directoryMode={directoryMode}
            currentEmployeeId={currentEmployeeId}
            avatarUrl={getEmployeeListAvatarUrl(employee, directoryMode, currentEmployeeId)}
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
    <Surface className="overflow-hidden">
      <ul className="divide-y">
        {employees.map((employee, index) => {
          const avatarUrl = getEmployeeListAvatarUrl(employee, directoryMode, currentEmployeeId)
          const employeeName = [employee.firstName, employee.birthNamePrefix, employee.birthName].filter(Boolean).join(' ')
          const limitedDetailEmployee = directoryMode || limitedDetailEmployeeIds.includes(employee.id)
          const showAdministration = !limitedDetailEmployee
            && employee.hrGroupAdministrationCount > 1
            && employee.administrationNames.length > 0
          const departmentName = optionalEmployeeValue(employee.departmentName)
          const jobTitle = optionalEmployeeValue(employee.jobTitle)
          const compactMeta = directoryVisibility.showJobDepartment
            ? [departmentName, jobTitle ? `${jobTitle}${showAdministration ? ` (${employee.administrationNames.join(', ')})` : ''}` : null].filter((value): value is string => Boolean(value))
            : []
          return <li key={employee.id} className={index % 2 === 1 ? 'bg-muted/20' : ''}>
            <div className={`group relative grid cursor-pointer px-4 transition-colors hover:bg-accent/25 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6 ${view === 'compact' ? 'gap-3 py-2.5' : 'gap-3 py-3.5 sm:py-4'}`}>
              {directoryLabels && employee.id !== currentEmployeeId && (directoryMode || limitedDetailEmployeeIds.includes(employee.id)) ? <EmployeeDirectoryTrigger employeeId={employee.id} ariaLabel={employeeName} labels={directoryLabels} /> : <Link aria-label={employeeName} className="absolute inset-0 z-0 rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" href={`/employees/${employee.id}`} prefetch={false} />}
              <div className="relative z-10 min-w-0 pointer-events-none">
                <div className={`flex min-w-0 items-center ${view === 'compact' ? 'gap-2.5' : 'gap-3.5'}`}>
                  {view === 'detail' ? (
                    avatarUrl ? <img src={avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">{employee.firstName.slice(0, 1)}{employee.birthName.slice(0, 1)}</span>
                  ) : null}
                  <div className="min-w-0">
                    {view === 'compact' ? <p className="truncate whitespace-nowrap text-sm font-semibold text-foreground">
                      {employeeName}
                      {!limitedDetailEmployee ? <span className="font-normal text-muted-foreground"> [{employee.employeeNumber}]</span> : null}
                      {compactMeta.map((value, index) => <span key={`${value}-${index}`}>
                        <span aria-hidden="true" className="px-1.5 font-normal text-muted-foreground/70"> - </span>
                        <span className="font-normal text-muted-foreground">{value}</span>
                      </span>)}
                    </p> : <>
                      {(!limitedDetailEmployee) ? <p className="truncate text-xs font-medium text-muted-foreground">
                        {employeeNumberLabel}: {employee.employeeNumber}
                      </p> : null}
                      <p className="truncate text-sm font-semibold text-foreground">
                        {employeeName}
                      </p>
                    </>}
                    {view === 'detail' && directoryVisibility.showJobDepartment && (departmentName || jobTitle) ? <p className="mt-1 truncate text-sm text-muted-foreground">
                      {departmentName ? <><span className="font-medium text-foreground/70">{departmentLabel}:</span>{' '}{departmentName}</> : null}
                      {departmentName && jobTitle ? <span aria-hidden="true" className="px-1.5 text-muted-foreground/70">·</span> : null}
                      {jobTitle ? <><span className="font-medium text-foreground/70">{jobTitleLabel}:</span>{' '}{jobTitle}</> : null}
                    </p> : null}
                    {view === 'detail' && showAdministration ? <p className="mt-1 truncate text-sm text-muted-foreground">
                      <span className="font-medium text-foreground/70">{administrationLabel}:</span>{' '}
                      {employee.administrationNames.join(', ')}
                    </p> : null}
                  </div>
                </div>
                {view === 'detail' && directoryVisibility.showWorkEmail ? <span className="mt-1 flex min-w-0 items-center gap-1.5 pl-[3.375rem] text-sm text-muted-foreground">
                  <Mail aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  {employee.workEmail ? <EmailLink className="pointer-events-auto relative z-20 inline-flex min-h-6 items-center truncate hover:underline" email={employee.workEmail} /> : <span className="truncate">{noEmailLabel}</span>}
                </span> : null}
              </div>
              <div className={`relative z-10 flex items-center justify-between gap-3 pointer-events-none sm:justify-end ${view === 'detail' ? 'pl-[3.375rem] sm:pl-0' : 'pl-0'}`}>
                {employeeTypeLabel(employee.employmentType, employee.status) ? <Badge>{employeeTypeLabel(employee.employmentType, employee.status)}</Badge> : null}
                {employee.isArchived && <Badge tone="warning">{archiveLabel}</Badge>}
                <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
              </div>
            </div>
          </li>
        })}
      </ul>
    </Surface>
  )
}

interface EmployeeCardProps {
  employee: EmployeeOverview
  employeeTypeLabel: (employmentType: EmployeeOverview['employmentType'], status: EmploymentStatus) => string
  archiveLabel: string
  employeeNumberLabel: string
  departmentLabel: string
  jobTitleLabel: string
  noEmailLabel: string
  viewProfileLabel: string
  directoryMode: boolean
  currentEmployeeId: string | null
  avatarUrl: string | null
  directoryVisibility: { showJobDepartment: boolean; showWorkEmail: boolean }
  limitedDetailEmployeeIds: string[]
  directoryLabels?: React.ComponentProps<typeof EmployeeDirectoryTrigger>['labels']
}

function EmployeeCard({
  employee,
  employeeTypeLabel,
  archiveLabel,
  employeeNumberLabel,
  departmentLabel,
  jobTitleLabel,
  noEmailLabel,
  viewProfileLabel,
  directoryMode,
  currentEmployeeId,
  avatarUrl,
  directoryVisibility,
  limitedDetailEmployeeIds,
  directoryLabels,
}: EmployeeCardProps) {
  const name = [employee.firstName, employee.birthNamePrefix, employee.birthName].filter(Boolean).join(' ')
  const limitedDirectoryEmployee = directoryMode || limitedDetailEmployeeIds.includes(employee.id)
  const opensDirectory = Boolean(directoryLabels && employee.id !== currentEmployeeId && limitedDirectoryEmployee)
  const ariaLabel = opensDirectory ? name : `${viewProfileLabel}: ${name}`
  const jobTitle = optionalEmployeeValue(employee.jobTitle)
  const departmentName = optionalEmployeeValue(employee.departmentName)

  const cardContent = (
    <>
      <div className="relative z-10 flex items-end justify-between gap-3 px-5 pt-0 pointer-events-none">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="-mt-8 h-20 w-20 rounded-lg border-2 border-surface object-cover" />
        ) : (
          <span className="-mt-8 flex h-20 w-20 items-center justify-center rounded-lg border-2 border-surface bg-primary text-lg font-semibold text-primary-foreground">
            {employee.firstName.slice(0, 1)}{employee.birthName.slice(0, 1)}
          </span>
        )}
        <div className="mb-1 flex flex-wrap justify-end gap-2">
          {employeeTypeLabel(employee.employmentType, employee.status) ? <Badge>{employeeTypeLabel(employee.employmentType, employee.status)}</Badge> : null}
          {employee.isArchived ? <Badge tone="warning">{archiveLabel}</Badge> : null}
        </div>
      </div>

      <div className="relative z-10 px-5 pt-4 pointer-events-none">
        {!limitedDirectoryEmployee ? <p className="truncate text-xs font-medium text-muted-foreground">
          {employeeNumberLabel}: {employee.employeeNumber}
        </p> : null}
        <h2 className="mt-1 truncate text-base font-semibold text-foreground">{name}</h2>
        {directoryVisibility.showJobDepartment && (jobTitle || departmentName) ? (
          <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            {jobTitle ? <p className="truncate"><span className="font-medium text-foreground/70">{jobTitleLabel}:</span> {jobTitle}</p> : null}
            {departmentName ? <p className="truncate"><span className="font-medium text-foreground/70">{departmentLabel}:</span> {departmentName}</p> : null}
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
          <ArrowUpRight aria-hidden="true" className="h-4 w-4 transition-colors group-hover:text-foreground" />
        </span>
      </div>
    </>
  )

  return (
    <article className="group relative overflow-hidden rounded-lg border border-border/90 bg-surface shadow-none transition-colors duration-150 hover:border-primary/40 hover:bg-surface-raised focus-within:ring-2 focus-within:ring-primary/60">
      <div aria-hidden="true" className="h-12 bg-muted/70" />
      {opensDirectory && directoryLabels ? <EmployeeDirectoryTrigger employeeId={employee.id} ariaLabel={ariaLabel} labels={directoryLabels} /> : <Link aria-label={ariaLabel} className="absolute inset-0 z-0 rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" href={`/employees/${employee.id}`} prefetch={false} />}
      {cardContent}
    </article>
  )
}

function optionalEmployeeValue(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? ''
  if (!normalized) return null
  const lower = normalized.toLocaleLowerCase('nl')
  return lower === 'niet vastgelegd' || lower === 'not recorded' ? null : normalized
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
        ? size === 'collage' ? 'grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))] gap-px overflow-hidden rounded-lg border border-border/90 bg-border sm:grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))]' : 'grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-3 sm:gap-4'
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
  const avatarUrl = getEmployeeListAvatarUrl(employee, directoryMode, currentEmployeeId)
  const contentClass = size === 'large'
    ? 'min-h-60 px-3 py-6'
    : size === 'small'
      ? 'min-h-28 px-1.5 py-3'
      : size === 'only' || size === 'collage'
        ? photoCollage ? 'aspect-square h-full p-0' : 'aspect-square p-1.5'
        : 'min-h-36 px-2 py-4 sm:min-h-40 sm:px-2.5 sm:py-5'
  const content = (
    <div className={`relative z-10 flex flex-col items-center justify-center text-center pointer-events-none ${contentClass}`}>
      <EmployeePhotoAvatar src={avatarUrl} initials={`${employee.firstName.slice(0, 1)}${employee.birthName.slice(0, 1)}`} size={size} square={photoOnly} collage={photoCollage} />
      {!photoOnly ? <h2 className={`mt-2 max-w-full truncate font-semibold tracking-tight text-foreground ${size === 'large' ? 'text-base' : size === 'small' ? 'text-xs' : 'text-sm'}`}>{employee.firstName}</h2> : null}
    </div>
  )

  return (
    <article className={`group relative overflow-hidden bg-surface transition-colors duration-150 hover:bg-surface-raised focus-within:ring-2 focus-within:ring-primary/60 ${photoCollage ? 'aspect-square rounded-none border-0' : photoOnly ? 'aspect-square rounded-lg border border-border/90' : 'rounded-lg border border-border/90'}`}>
      {!photoOnly ? <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-accent" /> : null}
      {opensDirectory && directoryLabels ? <EmployeeDirectoryTrigger employeeId={employee.id} ariaLabel={name} labels={directoryLabels} /> : <Link aria-label={name} className="absolute inset-0 z-0 rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" href={`/employees/${employee.id}`} prefetch={false} />}
      {content}
    </article>
  )
}
