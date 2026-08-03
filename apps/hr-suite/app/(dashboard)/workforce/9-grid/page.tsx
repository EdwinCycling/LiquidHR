import { redirect } from 'next/navigation'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { TalentReviewWorkspace, type TalentReviewLabels } from '@/components/talent/talent-review-workspace'
import { listTalentReviewWorkspace } from '@/lib/talent-review/service'
import { getTranslator } from '@/lib/i18n/server'

async function resolveMode(): Promise<'hr' | 'manager'> {
  try {
    await requirePermission('talent-review:manage')
    return 'hr'
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error
  }
  try {
    await requirePermission('talent-review:read')
    return 'manager'
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }
}

export default async function TalentReviewPage({ searchParams }: { searchParams: Promise<{ campaignId?: string }> }) {
  const [mode, t] = await Promise.all([resolveMode(), getTranslator('talentReview')])
  const params = await searchParams
  const initial = await listTalentReviewWorkspace(mode, params.campaignId ? { campaignId: params.campaignId } : {})
  const labels: TalentReviewLabels = {
    title: t('title'), subtitle: t('subtitle'), campaignOverview: t('campaignOverview'), newCampaign: t('newCampaign'), campaignName: t('campaignName'), description: t('description'), startsOn: t('startsOn'), endsOn: t('endsOn'), previousCampaign: t('previousCampaign'), noPreviousCampaign: t('noPreviousCampaign'), create: t('create'), save: t('save'), start: t('start'), close: t('close'), reopen: t('reopen'), remind: t('remind'), campaigns: t('campaigns'), noCampaigns: t('noCampaigns'), selectCampaign: t('selectCampaign'), active: t('active'), scheduled: t('scheduled'), draft: t('draft'), hrReview: t('hrReview'), closed: t('closed'), archived: t('archived'), progress: t('progress'), placed: t('placed'), managers: t('managers'), manager: t('manager'), team: t('team'), employees: t('employees'), searchEmployees: t('searchEmployees'), searchCampaigns: t('searchCampaigns'), dropHere: t('dropHere'), grid: t('grid'), performance: t('performance'), potential: t('potential'), low: t('low'), normal: t('normal'), high: t('high'), cellHighLow: t('cellHighLow'), cellHighNormal: t('cellHighNormal'), cellHighHigh: t('cellHighHigh'), cellNormalLow: t('cellNormalLow'), cellNormalNormal: t('cellNormalNormal'), cellNormalHigh: t('cellNormalHigh'), cellLowLow: t('cellLowLow'), cellLowNormal: t('cellLowNormal'), cellLowHigh: t('cellLowHigh'), selectedEmployee: t('selectedEmployee'), noEmployeeSelected: t('noEmployeeSelected'), previousScore: t('previousScore'), currentScore: t('currentScore'), note: t('note'), notePlaceholder: t('notePlaceholder'), saveDraft: t('saveDraft'), submitTeam: t('submitTeam'), submitted: t('submitted'), notStarted: t('notStarted'), inProgress: t('inProgress'), returned: t('returned'), reminderSent: t('reminderSent'), noTeam: t('noTeam'), noScores: t('noScores'), companyGrid: t('companyGrid'), teamGrid: t('teamGrid'), history: t('history'), noHistory: t('noHistory'), readOnly: t('readOnly'), saved: t('saved'), failed: t('failed'),
  }
  return <div className="mx-auto w-full max-w-[1600px] px-5 py-8 lg:px-10"><TalentReviewWorkspace initial={initial} labels={labels} mode={mode} /></div>
}
