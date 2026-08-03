import { redirect } from 'next/navigation'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { TalentGoalWorkspace } from '@/components/talent/talent-goal-workspace'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { listTalentGoals } from '@/lib/talent/goal-service'

export default async function TalentGoalsSettingsPage() {
  try { await requirePermission('talent-goal:manage') } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  const [initial, t] = await Promise.all([listTalentGoals('admin'), getTranslator('talent')])
  const labels = { title: t('goalTitle'), subtitle: t('goalAdminSubtitle'), add: t('goalAdd'), edit: t('goalEdit'), save: t('goalSave'), cancel: t('goalCancel'), employee: t('goalEmployee'), chooseEmployee: t('goalChooseEmployee'), capability: t('goalCapability'), noCapability: t('goalNoCapability'), notAvailable: t('notAvailable'), goalTitle: t('goalName'), description: t('goalDescription'), periodStart: t('goalPeriodStart'), periodEnd: t('goalPeriodEnd'), progress: t('goalProgress'), status: t('goalStatus'), draft: t('goalDraft'), active: t('goalActive'), completed: t('goalCompleted'), cancelled: t('goalCancelled'), archived: t('goalArchived'), complete: t('goalComplete'), cancelGoal: t('goalCancelAction'), archive: t('goalArchive'), all: t('goalAll'), empty: t('goalEmpty'), noResults: t('goalNoResults'), saved: t('goalSaved'), failed: t('goalFailed'), readOnly: t('goalAuditHint'), checkIns: { title: t('checkInTitle'), open: t('checkInOpen'), reflection: t('checkInReflection'), observation: t('checkInObservation'), followUp: t('checkInFollowUp'), body: t('checkInBody'), followUpTitle: t('checkInFollowUpTitle'), dueOn: t('checkInDueOn'), save: t('checkInSave'), complete: t('checkInComplete'), empty: t('checkInEmpty'), saved: t('checkInSaved'), failed: t('checkInFailed') } }
  return <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10"><AdminSettingsPageHeader backHref="/settings/talent" backLabel={t('backToTalent')} title={t('goalTitle')} subtitle={t('goalAdminSubtitle')} /><TalentGoalWorkspace mode="admin" initial={initial} labels={labels} /></section>
}
