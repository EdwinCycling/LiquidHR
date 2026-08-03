import { redirect } from 'next/navigation'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { TalentAssessmentWorkspace } from '@/components/talent/talent-assessment-workspace'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { listTalentAssessmentWorkspace } from '@/lib/talent/assessment-service'

export default async function WorkforceTalentAssessmentsPage() {
  try { await requirePermission('talent-assessment:read') } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  const [initial, t] = await Promise.all([listTalentAssessmentWorkspace('manager'), getTranslator('talent')])
  const labels = { title: t('assessmentTitle'), subtitle: t('assessmentManagerSubtitle'), cycles: t('assessmentCycles'), noCycles: t('assessmentNoCycles'), selectCycle: t('assessmentSelectCycle'), createCycle: t('assessmentCreateCycle'), code: t('assessmentCode'), name: t('assessmentName'), description: t('assessmentDescription'), opensOn: t('assessmentOpensOn'), closesOn: t('assessmentClosesOn'), itemTitle: t('assessmentItemTitle'), prompt: t('assessmentPrompt'), maxScore: t('assessmentMaxScore'), create: t('assessmentCreate'), save: t('assessmentSave'), submit: t('assessmentSubmit'), status: t('assessmentStatus'), open: t('assessmentOpen'), close: t('assessmentClose'), archive: t('assessmentArchive'), draft: t('assessmentDraft'), opened: t('assessmentOpened'), closed: t('assessmentClosed'), archived: t('assessmentArchived'), response: t('assessmentResponse'), self: t('assessmentSelf'), manager: t('assessmentManager'), participant: t('assessmentParticipant'), chooseParticipant: t('assessmentChooseParticipant'), answer: t('assessmentAnswer'), privateNote: t('assessmentPrivateNote'), privateNoteHint: t('assessmentPrivateNoteHint'), noItems: t('assessmentNoItems'), noResponses: t('assessmentNoResponses'), responseStatus: t('assessmentResponseStatus'), lock: t('assessmentLock'), finalize: t('assessmentFinalize'), reopen: t('assessmentReopen'), saved: t('assessmentSaved'), failed: t('assessmentFailed'), readOnly: t('assessmentAuditHint') }
  return <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10"><AdminSettingsPageHeader backHref="/workforce/talent" backLabel={t('backToWorkforceTalent')} title={t('assessmentTitle')} subtitle={t('assessmentManagerSubtitle')} /><TalentAssessmentWorkspace mode="manager" initial={initial} labels={labels} /></section>
}
