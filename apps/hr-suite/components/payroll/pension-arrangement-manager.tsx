import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { SectionHeader } from '@/components/patterns/section-header'
import { Surface } from '@/components/ui/surface'
import type { CaoSetupPageData } from '@/lib/payroll/cao-setup-service'

type FormAction = (formData: FormData) => Promise<never>

type Labels = {
  readonly title: string
  readonly description: string
  readonly createTitle: string
  readonly createDescription: string
  readonly code: string
  readonly name: string
  readonly provider: string
  readonly sourceReference: string
  readonly sourceStatus: string
  readonly referenceOnly: string
  readonly employerRecorded: string
  readonly verifiedSource: string
  readonly effectiveFrom: string
  readonly effectiveTo: string
  readonly transitionDate: string
  readonly arrangementType: string
  readonly flatPremium: string
  readonly progressivePremium: string
  readonly grandfatheringMode: string
  readonly noGrandfathering: string
  readonly respectfulTransition: string
  readonly flatTotalRate: string
  readonly employeeShare: string
  readonly employerShare: string
  readonly annualFranchise: string
  readonly annualCap: string
  readonly salaryMethod: string
  readonly partTimeMethod: string
  readonly partMonthMethod: string
  readonly eligibilityRule: string
  readonly contractClassification: string
  readonly solidarity: string
  readonly nonSolidarity: string
  readonly unknown: string
  readonly classificationStatus: string
  readonly classificationSource: string
  readonly tiers: string
  readonly tiersHelp: string
  readonly save: string
  readonly versionTitle: string
  readonly versionDescription: string
  readonly versionJson: string
  readonly versionJsonHelp: string
  readonly saveVersion: string
  readonly managerRequired: string
  readonly sourceReviewNotice: string
  readonly saved: string
  readonly versionSaved: string
  readonly invalid: string
  readonly unavailable: string
}

function message(status: string | undefined, labels: Labels): ReactNode {
  if (status === 'saved') return <p className="border-l-2 border-success-border pl-3 text-sm text-success" role="status">{labels.saved}</p>
  if (status === 'versionSaved') return <p className="border-l-2 border-success-border pl-3 text-sm text-success" role="status">{labels.versionSaved}</p>
  if (status === 'invalid') return <p className="border-l-2 border-destructive-border pl-3 text-sm text-destructive" role="alert">{labels.invalid}</p>
  if (status && status !== 'forbidden') return <p className="border-l-2 border-destructive-border pl-3 text-sm text-destructive" role="alert">{labels.unavailable}</p>
  return null
}

function Field({ label, name, type = 'text', required = true, defaultValue, step, list }: {
  readonly label: string
  readonly name: string
  readonly type?: 'text' | 'date' | 'number' | 'url'
  readonly required?: boolean
  readonly defaultValue?: string | number | null
  readonly step?: string
  readonly list?: string
}) {
  return <label className="grid gap-1 text-sm font-medium">
    {label}
    <input name={name} type={type} required={required} step={step} list={list} defaultValue={defaultValue ?? ''} className="min-h-10 rounded-md border border-border bg-background px-3 font-normal" />
  </label>
}

export function PensionArrangementManager({
  data,
  labels,
  status,
  createAction,
  successorAction,
}: {
  readonly data: CaoSetupPageData
  readonly labels: Labels
  readonly status?: string
  readonly createAction: FormAction
  readonly successorAction: FormAction
}) {
  return <Surface className="space-y-5 p-5">
    <SectionHeader title={labels.title} description={labels.description} />
    {message(status, labels)}
    {!data.canManage
      ? <p className="border-l-2 border-warning-border pl-3 text-sm text-muted-foreground">{labels.managerRequired}</p>
      : <>
        <p className="border-l-2 border-warning-border pl-3 text-sm text-muted-foreground">{labels.sourceReviewNotice}</p>
        <details className="rounded-2xl border border-border-subtle bg-surface-subtle p-4" open={data.pensions.length === 0}>
          <summary className="cursor-pointer font-semibold">{labels.createTitle}</summary>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{labels.createDescription}</p>
          <form action={createAction} className="mt-4 grid gap-4 lg:grid-cols-2">
            <Field label={labels.code} name="code" />
            <Field label={labels.name} name="name" />
            <Field label={labels.provider} name="provider" list="pension-provider-options" />
            <Field label={labels.sourceReference} name="sourceReference" type="url" />
            <datalist id="pension-provider-options">
              {[...new Set(data.catalog.map((entry) => entry.pension.fundName))].map((provider) => <option key={provider} value={provider} />)}
            </datalist>
            <label className="grid gap-1 text-sm font-medium">
              {labels.sourceStatus}
              <select name="sourceValidationStatus" defaultValue="EMPLOYER_RECORDED" className="min-h-10 rounded-md border border-border bg-background px-3 font-normal">
                <option value="REFERENCE_ONLY">{labels.referenceOnly}</option>
                <option value="EMPLOYER_RECORDED">{labels.employerRecorded}</option>
                <option value="VERIFIED_SOURCE">{labels.verifiedSource}</option>
              </select>
            </label>
            <Field label={labels.effectiveFrom} name="effectiveFrom" type="date" defaultValue="2026-01-01" />
            <Field label={labels.effectiveTo} name="effectiveTo" type="date" required={false} />
            <Field label={labels.transitionDate} name="transitionDate" type="date" required={false} />
            <label className="grid gap-1 text-sm font-medium">
              {labels.arrangementType}
              <select name="arrangementType" defaultValue="FLAT_PREMIUM" className="min-h-10 rounded-md border border-border bg-background px-3 font-normal">
                <option value="FLAT_PREMIUM">{labels.flatPremium}</option>
                <option value="PROGRESSIVE_PREMIUM">{labels.progressivePremium}</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              {labels.grandfatheringMode}
              <select name="grandfatheringMode" defaultValue="NONE" className="min-h-10 rounded-md border border-border bg-background px-3 font-normal">
                <option value="NONE">{labels.noGrandfathering}</option>
                <option value="EERBIEDIGENDE_WERKING">{labels.respectfulTransition}</option>
              </select>
            </label>
            <Field label={labels.flatTotalRate} name="flatTotalRate" type="number" step="0.0001" required={false} />
            <Field label={labels.employeeShare} name="employeeSharePct" type="number" step="0.0001" defaultValue={0} />
            <Field label={labels.employerShare} name="employerSharePct" type="number" step="0.0001" defaultValue={100} />
            <Field label={labels.annualFranchise} name="annualFranchise" type="number" step="0.01" defaultValue={0} />
            <Field label={labels.annualCap} name="annualPensionableSalaryCap" type="number" step="0.01" required={false} />
            <Field label={labels.salaryMethod} name="pensionableSalaryMethod" />
            <Field label={labels.partTimeMethod} name="partTimeMethod" />
            <Field label={labels.partMonthMethod} name="partMonthMethod" />
            <Field label={labels.eligibilityRule} name="eligibilityRule" />
            <label className="grid gap-1 text-sm font-medium">
              {labels.contractClassification}
              <select name="contractClassification" defaultValue="UNKNOWN" className="min-h-10 rounded-md border border-border bg-background px-3 font-normal">
                <option value="SOLIDARITY">{labels.solidarity}</option>
                <option value="NON_SOLIDARITY">{labels.nonSolidarity}</option>
                <option value="UNKNOWN">{labels.unknown}</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              {labels.classificationStatus}
              <select name="contractClassificationStatus" defaultValue="UNVERIFIED" className="min-h-10 rounded-md border border-border bg-background px-3 font-normal">
                <option value="UNVERIFIED">{labels.unknown}</option>
                <option value="EMPLOYER_RECORDED">{labels.employerRecorded}</option>
                <option value="VERIFIED_SOURCE">{labels.verifiedSource}</option>
              </select>
            </label>
            <Field label={labels.classificationSource} name="contractClassificationSourceReference" type="url" required={false} />
            <label className="grid gap-1 text-sm font-medium lg:col-span-2">
              {labels.tiers}
              <textarea name="tiersJson" required rows={4} defaultValue="[]" className="rounded-md border border-border bg-background p-3 font-mono text-xs font-normal" />
              <span className="font-normal text-muted-foreground">{labels.tiersHelp}</span>
            </label>
            <Button type="submit" className="w-fit">{labels.save}</Button>
          </form>
        </details>

        {data.pensions.map((pension) => pension.currentVersionId && pension.successorDraft ? <details className="rounded-2xl border border-border-subtle p-4" key={pension.id}>
          <summary className="cursor-pointer font-semibold">{labels.versionTitle}: {pension.name} · {pension.code}</summary>
          <p className="mt-2 text-sm text-muted-foreground">{labels.versionDescription}</p>
          <form action={successorAction} className="mt-4 grid max-w-4xl gap-3">
            <input type="hidden" name="predecessorVersionId" value={pension.currentVersionId} />
            <label className="grid gap-1 text-sm font-medium">
              {labels.versionJson}
              <textarea name="successorJson" required rows={22} maxLength={20000} defaultValue={JSON.stringify(pension.successorDraft, null, 2)} className="min-h-80 rounded-md border border-border bg-background p-3 font-mono text-xs font-normal" />
              <span className="font-normal text-muted-foreground">{labels.versionJsonHelp}</span>
            </label>
            <Button type="submit" className="w-fit">{labels.saveVersion}</Button>
          </form>
        </details> : null)}
      </>}
  </Surface>
}
