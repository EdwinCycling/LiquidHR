import { CheckCircle2, CircleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { SectionHeader } from '@/components/patterns/section-header'
import { Surface } from '@/components/ui/surface'
import type { CaoSetupCompletenessField, CaoSetupCompletenessRecord } from '@/lib/payroll/cao-setup-completeness'

type Labels = {
  readonly title: string
  readonly description: string
  readonly collectiveAgreement: string
  readonly companyPolicy: string
  readonly pensionArrangement: string
  readonly payrollReady: string
  readonly notReady: string
  readonly completeness: string
  readonly recordedCount: string
  readonly blockers: string
  readonly integrityHash: string
  readonly noRecords: string
  readonly sourceCore: string
  readonly sourceCatalog: string
  readonly sourceMissing: string
  readonly statusRecorded: string
  readonly statusMissing: string
  readonly statusReview: string
  readonly statusNotApplicable: string
  readonly fieldLabels: Readonly<Record<string, string>>
}

function kindLabel(record: CaoSetupCompletenessRecord, labels: Labels): string {
  if (record.kind === 'COLLECTIVE_AGREEMENT') return labels.collectiveAgreement
  if (record.kind === 'COMPANY_POLICY') return labels.companyPolicy
  return labels.pensionArrangement
}

function sourceLabel(field: CaoSetupCompletenessField, labels: Labels): string {
  if (field.source === 'CORE') return labels.sourceCore
  if (field.source === 'CATALOG') return labels.sourceCatalog
  return labels.sourceMissing
}

function statusLabel(field: CaoSetupCompletenessField, labels: Labels): string {
  if (field.status === 'RECORDED') return labels.statusRecorded
  if (field.status === 'MISSING') return labels.statusMissing
  if (field.status === 'REVIEW_REQUIRED') return labels.statusReview
  return labels.statusNotApplicable
}

function recordStatus(record: CaoSetupCompletenessRecord, labels: Labels) {
  return <Badge tone={record.payrollReady ? 'success' : 'warning'}>{record.payrollReady ? labels.payrollReady : labels.notReady}</Badge>
}

export function CaoSetupCompleteness({ records, labels }: { readonly records: readonly CaoSetupCompletenessRecord[]; readonly labels: Labels }) {
  return <Surface className="space-y-4 p-5">
    <SectionHeader title={labels.title} description={labels.description} />
    {records.length === 0
      ? <p className="text-sm text-muted-foreground">{labels.noRecords}</p>
      : <div className="grid gap-4 xl:grid-cols-2">
        {records.map((record) => <article className="rounded-2xl border border-border-subtle p-4" key={record.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{kindLabel(record, labels)}</p>
              <h3 className="mt-1 font-semibold">{record.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{record.version ?? '—'} · {record.effectiveFrom ?? '—'} — {record.effectiveTo ?? '—'}</p>
            </div>
            {recordStatus(record, labels)}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span><strong>{record.completenessPercent}%</strong> {labels.completeness}</span>
            <span className="text-muted-foreground">{record.recordedFieldCount}/{record.applicableFieldCount} {labels.recordedCount}</span>
          </div>
          <dl className="mt-4 grid gap-3 border-y border-border-subtle py-3 text-sm sm:grid-cols-2">
            {record.fields.map((field) => <div className="min-w-0" key={field.key}>
              <dt className="text-muted-foreground">{labels.fieldLabels[field.key] ?? field.key}</dt>
              <dd className="mt-1 flex items-start gap-2">
                {field.status === 'RECORDED' ? <CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0 text-success" size={15} /> : <CircleAlert aria-hidden="true" className="mt-0.5 shrink-0 text-warning" size={15} />}
                <span className="min-w-0 break-words">{field.value ?? '—'} <span className="text-xs text-muted-foreground">({sourceLabel(field, labels)} · {statusLabel(field, labels)})</span></span>
              </dd>
            </div>)}
          </dl>
          {record.blockers.length > 0 ? <div className="mt-3 rounded-[var(--radius-control)] bg-warning-surface p-3 text-sm"><p className="font-medium">{labels.blockers}</p><p className="mt-1 text-muted-foreground">{record.blockers.map((key) => labels.fieldLabels[key] ?? key).join(', ')}</p></div> : null}
          <p className="mt-3 break-all font-mono text-xs text-muted-foreground">{labels.integrityHash}: {record.sourceHash}</p>
        </article>)}
      </div>}
  </Surface>
}
