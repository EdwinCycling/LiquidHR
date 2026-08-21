import Link from 'next/link'
import { ArrowLeft, CalendarDays, CheckCircle2, ChevronDown, HeartPulse, ShieldAlert } from 'lucide-react'
import { AbsenceQuickForm } from '@/components/absence/absence-quick-form'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { SectionHeader } from '@/components/patterns/section-header'
import type { AbsenceCaseSummary } from '@/lib/absence/service'
import { formatDate } from '@/lib/preferences/formatters'
import type { DateFormat } from '@/lib/preferences/user-preferences'

interface AbsenceCaseDetailProps {
  employeeId: string
  employmentId?: string
  compact: boolean
  absenceCase: AbsenceCaseSummary
  locale: string
  dateFormat: DateFormat
  labels: {
    title: string
    dossier: string
    heading: string
    back: string
    status: string
    firstAbsence: string
    effectiveClockStart: string
    recoveryWindowEnds: string
    closedAt: string
    periods: string
    reportedAt: string
    expectedRecovery: string
    recoveredOn: string
    capacity: string
    capacityEffectiveOn: string
    nextReview: string
    safetyNet: string
    workAccident: string
    thirdPartyAccident: string
    frequentAbsence: string
    priorCases: string
    threshold: string
    noValue: string
    yes: string
    no: string
    unknown: string
    nowSick: string
    nowNotSick: string
    recoveryWindow: string
    report: string
    startDate: string
    percentage: string
    expectedRecoveryInput: string
    submit: string
    better: string
    partialRecover?: string
    saveFailed: string
    close: string
    employment?: string
    employmentPlaceholder?: string
    employmentSearch?: string
  }
}

export function AbsenceCaseDetail({ employeeId, employmentId, compact, absenceCase, locale, dateFormat, labels }: AbsenceCaseDetailProps) {
  const statusLabel = absenceCase.status === 'ACTIVE'
    ? labels.nowSick
    : absenceCase.status === 'RECOVERY_WINDOW' && absenceCase.recoveryWindowEndsOn
      ? labels.recoveryWindow.replace('{date}', formatDate(absenceCase.recoveryWindowEndsOn, { locale, dateFormat }))
      : labels.nowNotSick
  const backHref = `/employees/${employeeId}?tab=absence&view=${compact ? 'compact' : 'expanded'}`
  const resolvedEmploymentId = absenceCase.employmentId ?? employmentId

  return <div className="space-y-5">
    <Link prefetch={false} href={backHref} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />{labels.back}
    </Link>
    <SectionHeader
      title={labels.heading.replace('{date}', formatDate(absenceCase.firstAbsenceOn, { locale, dateFormat }))}
      description={labels.dossier}
      actions={<Badge tone={absenceCase.status === 'ACTIVE' ? 'danger' : absenceCase.status === 'RECOVERY_WINDOW' ? 'info' : 'success'}>{statusLabel}</Badge>}
    />

    <Surface className="p-5">
      <SectionHeader title={<span className="flex items-center gap-2"><CalendarDays aria-hidden="true" className="h-5 w-5 text-primary" />{labels.status}</span>} />
      <dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
        <DetailField label={labels.firstAbsence} value={formatDate(absenceCase.firstAbsenceOn, { locale, dateFormat })} />
        <DetailField label={labels.effectiveClockStart} value={formatDate(absenceCase.effectiveClockStartOn, { locale, dateFormat })} />
        <DetailField label={labels.recoveryWindowEnds} value={absenceCase.recoveryWindowEndsOn ? formatDate(absenceCase.recoveryWindowEndsOn, { locale, dateFormat }) : labels.noValue} />
        <DetailField label={labels.closedAt} value={absenceCase.closedAt ? formatDate(absenceCase.closedAt, { locale, dateFormat }) : labels.noValue} />
        <DetailField label={labels.frequentAbsence} value={absenceCase.isFrequentAbsence ? labels.yes : labels.no} />
        <DetailField label={labels.priorCases} value={String(absenceCase.priorCaseCount12Months)} />
        <DetailField label={labels.threshold} value={String(absenceCase.frequentAbsenceThreshold)} />
      </dl>
      {absenceCase.hasSicknessBenefitSafetyNet !== null || absenceCase.isWorkAccident !== null || absenceCase.isThirdPartyTrafficAccident !== null ? <div className="mt-5 grid gap-3 border-t border-border/70 pt-5 sm:grid-cols-3">
        <Indicator icon={<ShieldAlert aria-hidden="true" className="h-4 w-4" />} label={labels.safetyNet} value={formatIndicator(absenceCase.hasSicknessBenefitSafetyNet, labels)} />
        <Indicator icon={<HeartPulse aria-hidden="true" className="h-4 w-4" />} label={labels.workAccident} value={formatIndicator(absenceCase.isWorkAccident, labels)} />
        <Indicator icon={<ShieldAlert aria-hidden="true" className="h-4 w-4" />} label={labels.thirdPartyAccident} value={formatIndicator(absenceCase.isThirdPartyTrafficAccident, labels)} />
      </div> : null}
    </Surface>

    <Surface className="p-5">
      <SectionHeader title={<span className="flex items-center gap-2"><HeartPulse aria-hidden="true" className="h-5 w-5 text-primary" />{labels.periods}</span>} />
      <div className="mt-4 space-y-3">
        {absenceCase.spells.length === 0 ? <EmptyState title={labels.periods} description={labels.noValue} /> : absenceCase.spells.map((spell) => {
          const startedOn = formatDate(spell.startedOn, { locale, dateFormat })
          const reportedAt = formatDate(spell.reportedAt, { locale, dateFormat })
          const expectedRecovery = spell.expectedRecoveryOn ? formatDate(spell.expectedRecoveryOn, { locale, dateFormat }) : labels.noValue
          const status = spell.recoveredOn ? <Badge tone="success"><CheckCircle2 aria-hidden="true" className="mr-1 inline size-3.5" />{labels.recoveredOn}</Badge> : <Badge tone="danger">{labels.nowSick}</Badge>
          return <details key={spell.id} className="group rounded-xl border border-border/70 bg-background">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
              <span className="min-w-0"><span className="flex flex-wrap items-center gap-2 font-semibold"><span>{startedOn}</span>{status}</span><span className="mt-1 block text-xs text-muted-foreground">{labels.reportedAt}: {reportedAt} · {labels.expectedRecovery}: {expectedRecovery} · {labels.capacity}: {spell.absencePercentage === null ? labels.noValue : `${spell.absencePercentage}%`}</span></span>
              <ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-border/70 px-4 pb-4 pt-4"><dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
              <DetailField label={labels.reportedAt} value={reportedAt} />
              <DetailField label={labels.expectedRecovery} value={expectedRecovery} />
              <DetailField label={labels.recoveredOn} value={spell.recoveredOn ? formatDate(spell.recoveredOn, { locale, dateFormat }) : labels.noValue} />
              <DetailField label={labels.capacity} value={spell.absencePercentage === null ? labels.noValue : `${spell.absencePercentage}%`} />
              <DetailField label={labels.capacityEffectiveOn} value={spell.capacityEffectiveOn ? formatDate(spell.capacityEffectiveOn, { locale, dateFormat }) : labels.noValue} />
              <DetailField label={labels.nextReview} value={spell.expectedNextReviewOn ? formatDate(spell.expectedNextReviewOn, { locale, dateFormat }) : labels.noValue} />
            </dl></div>
          </details>
        })}
      </div>
    </Surface>

    <AbsenceQuickForm employeeId={employeeId} employmentId={resolvedEmploymentId} currentCase={absenceCase} recoveryMode="form" showReportAction={false} labels={{ report: labels.report, startDate: labels.startDate, percentage: labels.percentage, expectedRecovery: labels.expectedRecoveryInput, hasSafetyNet: labels.safetyNet, workAccident: labels.workAccident, thirdPartyAccident: labels.thirdPartyAccident, unknown: labels.unknown, yes: labels.yes, no: labels.no, submit: labels.submit, recover: labels.better, partialRecover: labels.partialRecover, recoveredOn: labels.recoveredOn, capacityEffectiveOn: labels.capacityEffectiveOn, failed: labels.saveFailed, close: labels.close, employment: labels.employment, employmentPlaceholder: labels.employmentPlaceholder, employmentSearch: labels.employmentSearch }} />
  </div>
}

function DetailField({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-[0.11em] text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-semibold">{value}</dd></div>
}

function Indicator({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex items-start gap-2.5"><span className="mt-0.5 text-primary">{icon}</span><div><p className="text-xs font-semibold uppercase tracking-[0.11em] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div></div>
}

function formatIndicator(value: boolean | null, labels: Pick<AbsenceCaseDetailProps['labels'], 'unknown' | 'yes' | 'no'>): string {
  return value === null ? labels.unknown : value ? labels.yes : labels.no
}
