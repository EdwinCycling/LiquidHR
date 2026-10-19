import Link from 'next/link'
import { ArrowUpRight, CheckCircle2, CircleAlert, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { SectionHeader } from '@/components/patterns/section-header'
import { Surface } from '@/components/ui/surface'
import type { Json } from '@scope/db'
import type { CaoSetupPageData } from '@/lib/payroll/cao-setup-service'

type Labels = {
  readonly catalogTitle: string
  readonly catalogDescription: string
  readonly grossEngineSupported: string
  readonly sourceReviewRequired: string
  readonly effectivePeriod: string
  readonly versionHash: string
  readonly standardHours: string
  readonly pensionFund: string
  readonly pensionSourceTitle: string
  readonly pensionSourceDescription: string
  readonly pensionFields: string
  readonly pensionRecordsTitle: string
  readonly pensionRecordsDescription: string
  readonly pensionRecordsEmpty: string
  readonly pensionVersion: string
  readonly pensionFranchise: string
  readonly pensionCap: string
  readonly pensionEmployeeShare: string
  readonly pensionEmployerShare: string
  readonly pensionProvider: string
  readonly pensionSourceReference: string
  readonly pensionSalaryMethod: string
  readonly pensionPartTimeMethod: string
  readonly pensionPartMonthMethod: string
  readonly pensionEligibilityRule: string
  readonly pensionIntegrityHash: string
  readonly caoMappingsTitle: string
  readonly caoMappingsDescription: string
  readonly caoMappingsEmpty: string
  readonly mappingFor: string
  readonly openEmploymentSettings: string
  readonly openPensionAssignments: string
  readonly sourceStatusReference: string
  readonly sourceStatusValidated: string
}

function amount(value: number | null, locale: 'nl' | 'en'): string {
  if (value === null) return '—'
  return new Intl.NumberFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', { style: 'currency', currency: 'EUR' }).format(value)
}

function percentage(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}%`
}

function objectText(value: Json, key: string): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return '—'
  const candidate = value[key]
  return typeof candidate === 'string' && candidate.trim() !== '' ? candidate : '—'
}

function sourceBadge(status: 'REFERENCE_ONLY' | 'VALIDATED' | 'REVIEW_REQUIRED', labels: Labels) {
  const validated = status === 'VALIDATED'
  return <Badge tone={validated ? 'success' : 'warning'}>{validated ? labels.sourceStatusValidated : status === 'REFERENCE_ONLY' ? labels.sourceStatusReference : labels.sourceReviewRequired}</Badge>
}

function employmentConditionName(data: CaoSetupPageData, id: string): string {
  for (const timeline of data.employmentSettings.laborConditionTimelines) {
    const version = timeline.versions.find((candidate) => candidate.id === id)
    if (version) return `${version.name} · ${version.code}`
  }
  return id
}

export function CaoSetupOverview({ data, locale, labels }: { readonly data: CaoSetupPageData; readonly locale: 'nl' | 'en'; readonly labels: Labels }) {
  return <div className="space-y-5">
    <Surface className="space-y-4 border border-info-border bg-info-surface p-5">
      <SectionHeader title={labels.catalogTitle} description={labels.catalogDescription} />
      <div className="grid gap-4 xl:grid-cols-2">
        {data.catalog.map((entry) => <article className="rounded-2xl border border-border bg-background/80 p-4" key={entry.packageId}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">{entry.displayName}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{labels.pensionFund}: {entry.pension.fundName}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="info">{labels.grossEngineSupported}</Badge>
              {sourceBadge(entry.sourceStatus, labels)}
            </div>
          </div>
          <dl className="mt-4 grid gap-3 border-y border-border-subtle py-3 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">{labels.standardHours}</dt><dd className="font-medium">{entry.standardHoursPerWeek} uur/week</dd></div>
            <div><dt className="text-muted-foreground">{labels.pensionFund}</dt><dd className="font-medium">{entry.pension.fundName}</dd></div>
          </dl>
          <ul className="mt-3 divide-y divide-border-subtle">
            {entry.versions.map((version) => <li className="py-2 text-sm" key={version.version}>
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{version.version}</span>{sourceBadge(version.sourceStatus, labels)}</div>
              <p className="mt-1 text-muted-foreground">{labels.effectivePeriod}: {version.effectiveFrom} — {version.effectiveTo ?? '—'}</p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{labels.versionHash}: {version.packageVersionHash}</p>
            </li>)}
          </ul>
        </article>)}
      </div>
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline" href="/settings/employment-contracts">
        {labels.openEmploymentSettings} <ArrowUpRight aria-hidden="true" size={16} />
      </Link>
    </Surface>

    <Surface className="space-y-4 p-5">
      <SectionHeader title={labels.pensionSourceTitle} description={labels.pensionSourceDescription} />
      <div className="grid gap-3 md:grid-cols-2">
        {data.catalog.map((entry) => <article className="rounded-2xl border border-border-subtle bg-surface-subtle p-4" key={entry.pension.code}>
          <p className="font-semibold">{entry.pension.fundName}</p>
          <p className="mt-1 text-sm text-muted-foreground">{entry.pension.code}</p>
          <div className="mt-3">{sourceBadge(entry.pension.sourceStatus, labels)}</div>
          <p className="mt-3 text-sm text-muted-foreground">{labels.pensionFields}: {entry.pension.requiredFields.join(', ')}.</p>
          <ul className="mt-3 space-y-1 text-sm">
            {entry.pension.sourceReferences.map((source) => <li key={source.url}><a className="inline-flex items-center gap-1 text-primary hover:underline" href={source.url} rel="noreferrer" target="_blank">{source.title}<ExternalLink aria-hidden="true" size={13} /></a></li>)}
          </ul>
        </article>)}
      </div>
    </Surface>

    <Surface className="space-y-4 p-5">
      <SectionHeader title={labels.pensionRecordsTitle} description={labels.pensionRecordsDescription} />
      {data.pensions.length === 0
        ? <p className="text-sm text-muted-foreground">{labels.pensionRecordsEmpty}</p>
        : <div className="grid gap-4 lg:grid-cols-2">
          {data.pensions.map((pension) => <article className="rounded-2xl border border-border-subtle p-4" key={pension.id}>
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{pension.name}</h3><p className="text-sm text-muted-foreground">{pension.code} · {pension.arrangementType}</p></div>{sourceBadge(pension.sourceStatus, labels)}</div>
            <dl className="mt-4 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">{labels.pensionVersion}</dt><dd>{pension.versionNumber ?? '—'}</dd></div>
              <div><dt className="text-muted-foreground">{labels.effectivePeriod}</dt><dd>{pension.effectiveFrom} — {pension.effectiveTo ?? '—'}</dd></div>
              <div><dt className="text-muted-foreground">{labels.pensionFranchise}</dt><dd>{amount(pension.annualFranchise, locale)}</dd></div>
              <div><dt className="text-muted-foreground">{labels.pensionCap}</dt><dd>{amount(pension.annualPensionableSalaryCap, locale)}</dd></div>
              <div><dt className="text-muted-foreground">{labels.pensionEmployeeShare}</dt><dd>{percentage(pension.employeeSharePct)}</dd></div>
              <div><dt className="text-muted-foreground">{labels.pensionEmployerShare}</dt><dd>{percentage(pension.employerSharePct)}</dd></div>
              <div><dt className="text-muted-foreground">{labels.pensionProvider}</dt><dd>{objectText(pension.pensionableSalaryDefinition, 'provider')}</dd></div>
              <div className="sm:col-span-2"><dt className="text-muted-foreground">{labels.pensionSourceReference}</dt><dd className="break-all">{objectText(pension.pensionableSalaryDefinition, 'sourceReference')}</dd></div>
              <div><dt className="text-muted-foreground">{labels.pensionSalaryMethod}</dt><dd>{objectText(pension.pensionableSalaryDefinition, 'method')}</dd></div>
              <div><dt className="text-muted-foreground">{labels.pensionPartTimeMethod}</dt><dd>{objectText(pension.pensionableSalaryDefinition, 'partTimeMethod')}</dd></div>
              <div><dt className="text-muted-foreground">{labels.pensionPartMonthMethod}</dt><dd>{objectText(pension.pensionableSalaryDefinition, 'partMonthMethod')}</dd></div>
              <div className="sm:col-span-2"><dt className="text-muted-foreground">{labels.pensionEligibilityRule}</dt><dd>{objectText(pension.eligibilityRule, 'description')}</dd></div>
            </dl>
            <p className="mt-3 break-all font-mono text-xs text-muted-foreground">{labels.pensionIntegrityHash}: {pension.integrityHash}</p>
          </article>)}
        </div>}
    </Surface>

    <Surface className="space-y-4 p-5">
      <SectionHeader title={labels.caoMappingsTitle} description={labels.caoMappingsDescription} />
      {data.pensionMappings.length === 0
        ? <p className="text-sm text-muted-foreground">{labels.caoMappingsEmpty}</p>
        : <ul className="divide-y divide-border-subtle border-y border-border-subtle">
          {data.pensionMappings.map((mapping) => <li className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm" key={mapping.id}>
            <div><p className="font-medium">{employmentConditionName(data, mapping.laborConditionSetId)}</p><p className="text-muted-foreground">{labels.mappingFor}: {mapping.pensionArrangementId} · {mapping.participantGroup} · {mapping.effectiveFrom} — {mapping.effectiveTo ?? '—'}</p></div>
            <div className="flex items-center gap-2">{mapping.sourceStatus === 'VALIDATED' ? <CheckCircle2 aria-hidden="true" className="text-success" size={16} /> : <CircleAlert aria-hidden="true" className="text-warning" size={16} />}{sourceBadge(mapping.sourceStatus, labels)}</div>
          </li>)}
        </ul>}
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline" href="/employees">
        {labels.openPensionAssignments} <ArrowUpRight aria-hidden="true" size={16} />
      </Link>
    </Surface>
  </div>
}
