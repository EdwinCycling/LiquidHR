import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { SectionHeader } from '@/components/patterns/section-header'
import { Surface } from '@/components/ui/surface'
import { Button, buttonClasses } from '@/components/ui/button'
import {
  EmploymentPensionArrangementError,
  getEmploymentPensionArrangementPageData,
} from '@/lib/employment/pension-arrangement-service'
import { getTranslator } from '@/lib/i18n/server'
import { assignEmploymentPensionArrangementAction, createPensionArrangementSuccessorAction } from './actions'

type PageProps = {
  params: Promise<{ employeeId: string; employmentId: string }>
  searchParams: Promise<{ saved?: string; error?: string }>
}

export default async function EmploymentPensionPage({ params, searchParams }: PageProps) {
  const [{ employeeId, employmentId }, query, t] = await Promise.all([
    params,
    searchParams,
    getTranslator('employment'),
  ])
  let data: Awaited<ReturnType<typeof getEmploymentPensionArrangementPageData>>
  try {
    data = await getEmploymentPensionArrangementPageData(employeeId, employmentId)
  } catch (error) {
    if (error instanceof EmploymentPensionArrangementError && error.status === 404) notFound()
    throw error
  }

  const today = new Date().toISOString().slice(0, 10)
  const isError = query.error === 'invalid' || query.error === 'blocked' || query.error === 'unavailable'
  const errorMessage = query.error === 'invalid'
    ? t('pensionAssignmentInvalid')
    : query.error === 'blocked'
      ? t('pensionAssignmentBlocked')
      : t('pensionAssignmentUnavailable')

  return <PageShell className="space-y-6 py-6 lg:py-9">
    <Link
      prefetch={false}
      className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
      href={`/employees/${employeeId}/employments/${employmentId}?tab=overview&view=expanded`}
    >
      {t('pensionBackToEmployment')}
    </Link>
    <PageHeader
      title={t('pensionPageTitle')}
      description={t('pensionPageDescription', { employmentNumber: data.employment.employment_number })}
    />
    {query.saved === 'saved' ? <p role="status" className="border-l-2 border-success-border pl-3 text-sm text-success">{t('pensionAssignmentSaved')}</p> : null}
    {query.saved === 'versionSaved' ? <p role="status" className="border-l-2 border-success-border pl-3 text-sm text-success">{t('pensionSuccessorSaved')}</p> : null}
    {isError ? <p role="alert" className="border-l-2 border-destructive-border pl-3 text-sm text-destructive">{errorMessage}</p> : null}

    <Surface className="space-y-4 p-5 sm:p-6">
      <SectionHeader title={t('pensionAssignmentsTitle')} />
      {data.assignments.length === 0
        ? <p className="text-sm text-muted-foreground">{t('pensionAssignmentsEmpty')}</p>
        : <ul className="divide-y divide-subtle border-y border-subtle">
          {data.assignments.map((assignment) => <li key={assignment.id} className="space-y-1 py-3 text-sm">
            <p className="font-medium">{assignment.arrangement?.name ?? t('pensionArrangementUnavailable')}</p>
            <p className="text-muted-foreground">{assignment.arrangement?.code ?? '—'} · {t('pensionVersionLabel', { version: assignment.version_number })} · {t('pensionParticipationStart')}: {assignment.participation_start_date} · {t('pensionEffectiveFrom')}: {assignment.effective_from}{assignment.effective_to ? ` – ${assignment.effective_to}` : ''}</p>
            <p className="text-muted-foreground">{assignment.assignment_reason}</p>
            {assignment.provenance_json && typeof assignment.provenance_json === 'object' && !Array.isArray(assignment.provenance_json)
              && 'sourceClassification' in assignment.provenance_json
              ? <p className="text-muted-foreground">{String(assignment.provenance_json.sourceClassification)}</p>
              : null}
          </li>)}
        </ul>}
    </Surface>

    <Surface className="space-y-4 p-5 sm:p-6">
      <SectionHeader title={t('pensionCaoMappingTitle')} description={t('pensionCaoMappingScopeNotice')} />
      {data.laborConditionSet
        ? <>
          <p className="text-sm font-medium">{data.laborConditionSet.name} · {data.laborConditionSet.code}</p>
          {data.laborConditionMappings.length === 0
            ? <p className="text-sm text-muted-foreground">{t('pensionCaoMappingEmpty')}</p>
            : <ul className="divide-y divide-subtle border-y border-subtle">
              {data.laborConditionMappings.map((mapping) => <li key={mapping.id} className="space-y-1 py-3 text-sm">
                <p className="font-medium">{mapping.arrangement?.name ?? t('pensionArrangementUnavailable')} · {t('pensionVersionLabel', { version: mapping.version_number })}</p>
                <p className="text-muted-foreground">{mapping.participant_group} · {mapping.effective_from}{mapping.effective_to ? ` – ${mapping.effective_to}` : ''}</p>
                {mapping.provenance_json && typeof mapping.provenance_json === 'object' && !Array.isArray(mapping.provenance_json)
                  && 'sourceClassification' in mapping.provenance_json
                  ? <p className="text-muted-foreground">{String(mapping.provenance_json.sourceClassification)}</p>
                  : null}
              </li>)}
            </ul>}
        </>
        : <p className="text-sm text-muted-foreground">{t('pensionCaoMappingUnavailable')}</p>}
    </Surface>

    {data.canWrite ? <Surface className="space-y-4 p-5 sm:p-6">
      <SectionHeader title={t('pensionAssignTitle')} description={t('pensionSyntheticPolicyNotice')} />
      {data.assignments.some((row) => row.effective_to === null || row.effective_to >= today)
        ? <p className="text-sm text-muted-foreground">{t('pensionAssignmentOverlapPresent')}</p>
        : null}
      {data.arrangements.length === 0
        ? <p className="text-sm text-muted-foreground">{t('pensionNoArrangementOptions')}</p>
        : data.laborConditionSet === null
          ? <p className="text-sm text-muted-foreground">{t('pensionCaoMappingUnavailable')}</p>
          : <form action={assignEmploymentPensionArrangementAction} className="grid max-w-2xl gap-4">
            <input type="hidden" name="employeeId" value={employeeId} />
            <input type="hidden" name="employmentId" value={employmentId} />
            <input type="hidden" name="requestKey" value={crypto.randomUUID()} />
            <label className="grid gap-1 text-sm font-medium">
              {t('pensionArrangementPredecessor')}
              <select name="supersedesMappingId" defaultValue="" className="min-h-10 rounded-md border border-border bg-background px-3 font-normal">
                <option value="">{t('pensionNoPredecessor')}</option>
                {data.laborConditionMappings.map((mapping) => <option key={mapping.id} value={mapping.id}>{mapping.effective_from} · {mapping.arrangement?.name ?? mapping.pension_arrangement_id}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              {t('pensionAssignmentPredecessor')}
              <select name="supersedesAssignmentId" defaultValue="" className="min-h-10 rounded-md border border-border bg-background px-3 font-normal">
                <option value="">{t('pensionNoPredecessor')}</option>
                {data.assignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.effective_from} · {assignment.arrangement?.name ?? assignment.pension_arrangement_id}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              {t('pensionArrangementLabel')}
              <select name="arrangementId" required defaultValue="" className="min-h-10 rounded-md border border-border bg-background px-3 font-normal">
                <option value="" disabled>{t('pensionChooseArrangement')}</option>
                {data.arrangements.map((arrangement) => <option key={arrangement.id} value={arrangement.id}>{arrangement.name} · {arrangement.code}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              {t('pensionParticipationStart')}
              <input name="participationStartDate" type="date" required defaultValue={data.employment.starts_on} className="min-h-10 rounded-md border border-border bg-background px-3 font-normal" />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              {t('pensionEffectiveFrom')}
              <input name="effectiveFrom" type="date" required defaultValue={today} className="min-h-10 rounded-md border border-border bg-background px-3 font-normal" />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              {t('pensionEffectiveTo')}
              <input name="effectiveTo" type="date" className="min-h-10 rounded-md border border-border bg-background px-3 font-normal" />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              {t('pensionParticipantGroup')}
              <select name="participantGroup" required defaultValue="NEW_ENTRANT" className="min-h-10 rounded-md border border-border bg-background px-3 font-normal">
                <option value="NEW_ENTRANT">{t('pensionNewEntrant')}</option>
                <option value="GRANDFATHERED">{t('pensionGrandfathered')}</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              {t('pensionProvenanceMode')}
              <select name="provenanceMode" required defaultValue="USER_RECORDED" className="min-h-10 rounded-md border border-border bg-background px-3 font-normal">
                <option value="USER_RECORDED">{t('pensionUserRecorded')}</option>
                {data.canCreateSyntheticFixture ? <option value="SYNTHETIC_TEST_FIXTURE">{t('pensionSyntheticTestFixture')}</option> : null}
              </select>
            </label>
            {data.canCreateSyntheticFixture
              ? <label className="grid gap-1 text-sm font-medium">
                {t('pensionTestScenario')}
                <input name="testScenario" type="text" maxLength={180} className="min-h-10 rounded-md border border-border bg-background px-3 font-normal" />
                <span className="text-xs font-normal text-muted-foreground">{t('pensionTestScenarioHelp')}</span>
              </label>
              : <input type="hidden" name="testScenario" value="" />}
            <label className="flex items-start gap-3 text-sm">
              <input name="confirmMapping" type="checkbox" value="yes" required className="mt-1" />
              <span>{t('pensionConfirmCaoMapping', { conditionSet: data.laborConditionSet.name })}</span>
            </label>
            <Button type="submit" className="w-fit">{t('pensionAssignAction')}</Button>
          </form>}
      <Link className={buttonClasses({ variant: 'secondary' })} href={`/employees/${employeeId}/employments/${employmentId}?tab=overview&view=expanded`}>
        {t('pensionBackToEmployment')}
      </Link>
    </Surface> : null}

    <Surface className="space-y-4 p-5 sm:p-6">
      <SectionHeader title={t('pensionVersionHistoryTitle')} description={t('pensionVersionHistoryDescription')} />
      {data.arrangements.length === 0
        ? <p className="text-sm text-muted-foreground">{t('pensionNoArrangementOptions')}</p>
        : data.arrangements.map((arrangement) => {
          const versions = data.versionsByArrangementId.get(arrangement.id) ?? []
          const leaves = versions.filter((version) => !versions.some((candidate) => candidate.supersedes_version_id === version.id))
          const leaf = leaves.length === 1 ? leaves[0] : null
          const tiers = leaf ? data.versionTiersById.get(leaf.id) ?? [] : []
          const successorDraft = leaf ? {
            effective_from: leaf.effective_from,
            effective_to: leaf.effective_to,
            arrangement_type: leaf.arrangement_type,
            transition_date: leaf.transition_date,
            grandfathering_mode: leaf.grandfathering_mode,
            flat_total_rate: leaf.flat_total_rate,
            employer_share_pct: leaf.employer_share_pct,
            employee_share_pct: leaf.employee_share_pct,
            annual_franchise: leaf.annual_franchise,
            annual_pensionable_salary_cap: leaf.annual_pensionable_salary_cap,
            pensionable_salary_definition: leaf.pensionable_salary_definition,
            eligibility_rule: leaf.eligibility_rule,
            contract_classification: leaf.contract_classification,
            contract_classification_provenance: leaf.contract_classification_provenance,
            provenance_json: leaf.provenance_json,
            is_active: leaf.is_active,
            tiers: tiers.map((tier) => ({ min_age: tier.min_age, max_age: tier.max_age, total_rate: tier.total_rate })),
            supersession_reason: 'Explicit configuration correction through the versioned pension arrangement editor.',
            supersession_provenance: { status: 'USER_RECORDED', interface: 'pension-arrangement-version-editor' },
          } : null
          return <article key={arrangement.id} className="space-y-3 border-t border-subtle pt-4 first:border-0 first:pt-0">
            <h3 className="font-semibold">{arrangement.name} · {arrangement.code}</h3>
            {versions.length === 0
              ? <p className="text-sm text-muted-foreground">{t('pensionVersionHistoryUnavailable')}</p>
              : <ol className="space-y-2 text-sm">
                {versions.map((version) => <li key={version.id} className="rounded-md border border-subtle p-3">
                  <p className="font-medium">{t('pensionVersionLabel', { version: version.version_number })} · {version.effective_from} · {version.arrangement_type}</p>
                  <p className="text-muted-foreground">{version.is_active ? t('pensionVersionActive') : t('pensionVersionInactive')} · {version.supersedes_version_id ?? t('pensionVersionInitial')}</p>
                  {version.supersession_reason ? <p className="text-muted-foreground">{version.supersession_reason}</p> : null}
                </li>)}
              </ol>}
            {data.canWrite && leaf && successorDraft ? <details className="rounded-md border border-subtle p-3">
              <summary className="cursor-pointer font-medium">{t('pensionSuccessorTitle')}</summary>
              <p className="mt-2 text-sm text-muted-foreground">{t('pensionSuccessorJsonHelp')}</p>
              <form action={createPensionArrangementSuccessorAction} className="mt-3 grid max-w-3xl gap-3">
                <input type="hidden" name="employeeId" value={employeeId} />
                <input type="hidden" name="employmentId" value={employmentId} />
                <input type="hidden" name="predecessorVersionId" value={leaf.id} />
                <label className="grid gap-1 text-sm font-medium">
                  {t('pensionSuccessorJsonLabel')}
                  <textarea name="successorJson" required rows={22} maxLength={20000} defaultValue={JSON.stringify(successorDraft, null, 2)} className="min-h-80 rounded-md border border-border bg-background p-3 font-mono text-xs font-normal" />
                </label>
                <Button type="submit" className="w-fit">{t('pensionSuccessorSave')}</Button>
              </form>
            </details> : data.canWrite && versions.length > 0 ? <p className="text-sm text-muted-foreground">{t('pensionSuccessorUnavailable')}</p> : null}
          </article>
        })}
    </Surface>
  </PageShell>
}
