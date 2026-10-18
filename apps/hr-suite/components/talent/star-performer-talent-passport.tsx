import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { SectionHeader } from '@/components/patterns/section-header'
import { Badge } from '@/components/ui/badge'
import { Surface } from '@/components/ui/surface'
import type { StarPerformersDetail } from '@/lib/star-performers/v2-service'

export type StarPerformerTalentPassportLabels = {
  detailTitle: string
  readOnly: string
  employeeNumber: string
  department: string
  notAssessed: string
  approvedSignal: string
  noApprovedSignal: string
  closedOn: string
  movementUp: string
  movementDown: string
  movementStable: string
  movementNew: string
  performance: string
  potential: string
  grid: string
  skills: string
  skillsDescription: string
  noSkills: string
  jobProfile: string
  jobProfileDescription: string
  noJobProfile: string
  skillGaps: string
  noSkillGaps: string
  developmentPlans: string
  noDevelopmentPlans: string
  appraisal: string
  noAppraisal: string
  openGrid: string
  openSkills: string
  openRoleExplorer: string
  openComparison: string
  openDevelopment: string
  openAppraisal: string
  unavailable: string
  criticality: string
  tags: string
  noTags: string
}

function formatDate(value: string | null, locale: string): string | null {
  if (!value) return null
  return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value))
}

function employeeLabel(employee: StarPerformersDetail['employee']): string {
  return [employee.firstName, employee.birthName].filter((value) => value.trim().length > 0).join(' ') || employee.employeeNumber
}

function SourceLink({ href, label }: { href: string; label: string }) {
  return <Link className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={href}>{label}<ArrowUpRight aria-hidden="true" className="size-3.5" /></Link>
}

function PassportModule({
  children,
  description,
  href,
  label,
  state,
  title,
}: {
  children: ReactNode
  description?: string
  href: string
  label: string
  state: 'ready' | 'unavailable'
  title: string
}) {
  return <Surface className="p-4" variant="subtle">
    <SectionHeader description={description} title={title} />
    {state === 'unavailable' ? <p className="mt-3 text-sm text-muted-foreground">{children}</p> : <div className="mt-3">{children}</div>}
    <SourceLink href={href} label={label} />
  </Surface>
}

export function StarPerformerTalentPassport({ detail, labels, locale }: { detail: StarPerformersDetail; labels: StarPerformerTalentPassportLabels; locale: string }) {
  const employee = detail.employee
  const assessment = employee.assessment
  const grid = detail.grid.signal
  const selectedTagIds = new Set(assessment?.tagIds ?? [])
  const selectedTags = detail.tags.filter((tag) => tag.isActive && selectedTagIds.has(tag.id))

  return <section className="mt-8 space-y-5" aria-labelledby="talent-passport-title">
    <Surface className="p-5 sm:p-6">
      <SectionHeader actions={<Badge tone="neutral">{labels.readOnly}</Badge>} description={labels.readOnly} title={labels.detailTitle} />
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4 border-t border-border-subtle pt-5">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight" id="talent-passport-title">{employeeLabel(employee)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{employee.jobName ?? labels.jobProfile}{employee.jobGroupName ? ` · ${employee.jobGroupName}` : ''}</p>
          <p className="mt-1 text-xs text-muted-foreground">{[employee.departmentName, `${labels.employeeNumber}: ${employee.employeeNumber}`].filter(Boolean).join(' · ')}</p>
        </div>
        {assessment ? <Badge tone={assessment.criticalityLevel >= 4 ? 'warning' : 'info'}>{labels.criticality} {assessment.criticalityLevel}/5</Badge> : <Badge tone="neutral">{labels.notAssessed}</Badge>}
      </div>
      {selectedTags.length > 0 ? <div className="mt-4 flex flex-wrap gap-2" aria-label={labels.tags}>{selectedTags.map((tag) => <Badge key={tag.id}>{tag.name}</Badge>)}</div> : assessment ? <p className="mt-4 text-sm text-muted-foreground">{labels.noTags}</p> : null}
    </Surface>

    <div className="grid gap-4 lg:grid-cols-2">
      <PassportModule href={detail.links.grid} label={labels.openGrid} state={detail.grid.state} title={labels.approvedSignal}>
        {detail.grid.state === 'unavailable' ? labels.unavailable : grid ? <div className="space-y-3 text-sm"><div className="flex flex-wrap items-center gap-2"><Badge tone={grid.isHighHigh ? 'success' : 'info'}>{grid.gridCell ?? labels.approvedSignal}</Badge>{grid.movement === 'UP' ? <span className="text-success">{labels.movementUp}</span> : null}{grid.movement === 'DOWN' ? <span className="text-destructive">{labels.movementDown}</span> : null}{grid.movement === 'STABLE' ? <span className="text-muted-foreground">{labels.movementStable}</span> : null}{grid.movement === 'NEW' ? <span className="text-muted-foreground">{labels.movementNew}</span> : null}</div><p className="text-muted-foreground">{grid.campaignName}{grid.closedAt ? ` · ${labels.closedOn} ${formatDate(grid.closedAt, locale)}` : ''}</p><dl className="grid grid-cols-2 gap-3"><div><dt className="text-xs text-muted-foreground">{labels.performance}</dt><dd className="mt-1 font-semibold">{grid.performanceScore ?? labels.notAssessed}</dd></div><div><dt className="text-xs text-muted-foreground">{labels.potential}</dt><dd className="mt-1 font-semibold">{grid.potentialScore ?? labels.notAssessed}</dd></div></dl></div> : labels.noApprovedSignal}
      </PassportModule>

      <PassportModule description={labels.skillsDescription} href={detail.links.skills} label={labels.openSkills} state={detail.skills.state} title={labels.skills}>
        {detail.skills.state === 'unavailable' ? labels.unavailable : detail.skills.records.length > 0 ? <div className="space-y-2">{detail.skills.records.map((record) => <div className="flex items-start justify-between gap-3 border-b border-border-subtle pb-2 last:border-0 last:pb-0" key={record.id}><div className="min-w-0"><p className="truncate text-sm font-medium">{record.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{record.type} · {record.source}</p></div><div className="shrink-0 text-right text-xs"><p className="font-semibold">{record.level ?? labels.notAssessed}</p><p className="mt-0.5 text-muted-foreground">{record.evidenceStatus ?? labels.notAssessed}</p></div></div>)}</div> : labels.noSkills}
      </PassportModule>

      <PassportModule description={labels.jobProfileDescription} href={detail.links.roleExplorer} label={labels.openRoleExplorer} state={detail.jobProfile.state} title={labels.jobProfile}>
        {detail.jobProfile.state === 'unavailable' ? labels.unavailable : detail.jobProfile.profile ? <div><p className="text-sm font-medium">{detail.jobProfile.profile.jobCode}{detail.jobProfile.profile.jobGroupName ? ` · ${detail.jobProfile.profile.jobGroupName}` : ''}</p><p className="mt-1 text-xs text-muted-foreground">v{detail.jobProfile.profile.version}</p><div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.skillGaps}</p>{detail.jobProfile.gaps.length > 0 ? <ul className="mt-2 space-y-2">{detail.jobProfile.gaps.map((gap, index) => <li className="flex items-start justify-between gap-3 text-sm" key={`${gap.name}-${index}`}><span className="min-w-0">{gap.name}</span><Badge tone={gap.status === 'GAP' ? 'warning' : 'neutral'}>{gap.status}</Badge></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">{labels.noSkillGaps}</p>}</div></div> : labels.noJobProfile}
      </PassportModule>

      <PassportModule href={detail.links.comparison} label={labels.openComparison} state={detail.jobProfile.state} title={labels.grid}>
        {detail.jobProfile.state === 'unavailable' ? labels.unavailable : labels.openComparison}
      </PassportModule>

      <PassportModule href={detail.links.development} label={labels.openDevelopment} state={detail.development.state} title={labels.developmentPlans}>
        {detail.development.state === 'unavailable' ? labels.unavailable : detail.development.plans.length > 0 ? <div className="space-y-3">{detail.development.plans.map((plan) => <div key={plan.id}><div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium">{plan.title}</span><span className="tabular-nums text-muted-foreground">{plan.progressPercent}%</span></div><div aria-label={`${plan.title}: ${plan.progressPercent}%`} className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, plan.progressPercent))}%` }} /></div><p className="mt-1 text-xs text-muted-foreground">{plan.status} · {formatDate(plan.periodStart, locale) ?? plan.periodStart}{plan.periodEnd ? ` – ${formatDate(plan.periodEnd, locale) ?? plan.periodEnd}` : ''}</p></div>)}</div> : labels.noDevelopmentPlans}
      </PassportModule>

      <PassportModule href={detail.links.appraisal} label={labels.openAppraisal} state={detail.appraisal.state} title={labels.appraisal}>
        {detail.appraisal.state === 'unavailable' ? labels.unavailable : detail.appraisal.items.length > 0 ? <div className="space-y-2">{detail.appraisal.items.map((item) => <div className="flex items-start justify-between gap-3 border-b border-border-subtle pb-2 last:border-0 last:pb-0" key={item.id}><div><p className="text-sm font-medium">{item.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.itemType} · {formatDate(item.occurredOn, locale) ?? item.occurredOn}</p></div><Badge tone="neutral">{item.status}</Badge></div>)}</div> : labels.noAppraisal}
      </PassportModule>
    </div>
  </section>
}
