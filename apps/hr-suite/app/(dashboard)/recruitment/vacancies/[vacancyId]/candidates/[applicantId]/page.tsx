import { notFound, redirect } from 'next/navigation'

import { PageShell } from '@/components/layout/page-shell'
import { RecruitmentCandidateDetail } from '@/components/recruitment/recruitment-candidate-detail'
import { AuthorizationError, getRequestAuthorizationContext, requireAnyPermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { ModuleError, requireTenantModule } from '@/lib/modules/module-service'
import { applicantDetailRouteParamsSchema, getRecruitmentApplicantDetail } from '@/lib/recruitment/applicant-detail-service'
import { listGuidedInterviews, listGuidedSets, listRecruitmentParticipantOptions, listRecruitmentPipelineStages } from '@/lib/recruitment/guided-service'

const tabs = ['overview', 'interviews', 'assessments', 'history'] as const
type ApplicantDetailTab = typeof tabs[number]

function parseTab(value: string | undefined): ApplicantDetailTab {
  return tabs.includes(value as ApplicantDetailTab) ? value as ApplicantDetailTab : 'overview'
}

export default async function RecruitmentApplicantDetailPage({ params, searchParams }: { readonly params: Promise<{ vacancyId: string; applicantId: string }>; readonly searchParams: Promise<{ tab?: string }> }) {
  try {
    await requireTenantModule('RECRUITMENT')
    await requireAnyPermission(['recruitment-candidate:read', 'recruitment-participation:read'])
  } catch (error) {
    if (error instanceof ModuleError && error.status === 404) notFound()
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }

  const routeParams = applicantDetailRouteParamsSchema.safeParse(await params)
  if (!routeParams.success) notFound()
  const [{ context, supabase }, t, { tab }] = await Promise.all([getRequestAuthorizationContext(), getTranslator('recruitment'), searchParams])
  const application = await getRecruitmentApplicantDetail(context, routeParams.data, supabase)
  if (!application) notFound()

  const canWrite = context.permissions.includes('recruitment-candidate:write')
  const canReadInterviews = context.permissions.some((permission) => ['recruitment-candidate:read', 'recruitment-assessment:read', 'recruitment-participation:read'].includes(permission))
  const [interviews, stages, sets, participants] = await Promise.all([
    canReadInterviews ? listGuidedInterviews(context, application.id, supabase) : Promise.resolve([]),
    canWrite ? listRecruitmentPipelineStages(context, supabase) : Promise.resolve([]),
    canWrite ? listGuidedSets(context, supabase) : Promise.resolve([]),
    canWrite ? listRecruitmentParticipantOptions(context, supabase) : Promise.resolve([]),
  ])

  const activeTab = parseTab(tab)
  const labels = {
    back: t('detail.back'), candidate: t('detail.candidate'), contact: t('detail.contact'), motivation: t('detail.motivation'), answers: t('detail.answers'), documents: t('detail.documents'), timeline: t('detail.timeline'), otherApplications: t('detail.otherApplications'), securityNotice: t('detail.securityNotice'), emptyValue: t('detail.emptyValue'), decisionReason: t('detail.decisionReason'), decisionNote: t('detail.decisionNote'), email: t('manual.email'), phone: t('manual.phone'), vacancy: t('guided.vacancy'), stage: t('guided.stage'), source: t('pipeline.source'), received: t('detail.received'), status: t('detail.status'), active: t('detail.active'), rejected: t('detail.rejected'), hired: t('detail.hired'), manual: t('detail.manual'), public: t('detail.public'), clean: t('detail.clean'), unknown: t('detail.unknown'),
    tabs: { label: t('detail.tabsLabel'), overview: t('detail.overviewTab'), interviews: t('detail.interviewsTab'), assessments: t('detail.assessmentsTab'), history: t('detail.historyTab'), previous: t('detail.previousTab'), next: t('detail.nextTab') },
    actions: { changeStage: t('detail.changeStage'), addInterview: t('detail.addInterview'), reject: t('pipeline.reject'), reopen: t('pipeline.reopen'), close: t('detail.close'), stageTitle: t('detail.stageTitle'), stageDescription: t('detail.stageDescription'), stageSearch: t('detail.stageSearch'), stageSave: t('detail.stageSave'), cancel: t('guided.cancel'), rejectTitle: t('detail.rejectTitle'), rejectDescription: t('detail.rejectDescription'), rejectReason: t('detail.rejectReason'), rejectReasonPlaceholder: t('detail.rejectReasonPlaceholder'), rejectConfirm: t('detail.rejectConfirm'), dirtyTitle: t('detail.dirtyTitle'), dirtyDescription: t('detail.dirtyDescription'), discard: t('detail.discard'), keepEditing: t('detail.keepEditing'), hire: t('detail.hireTitle'), hireDescription: t('detail.hireDescription'), administrationId: t('detail.administrationId'), employeeId: t('detail.employeeId'), employmentId: t('detail.employmentId'), hireConfirm: t('detail.confirmHire') },
    states: { noAnswers: t('detail.noAnswers'), noDocuments: t('detail.noDocuments'), noAssessments: t('detail.noAssessments'), noEvents: t('detail.noEvents'), noOtherApplications: t('detail.noOtherApplications'), event: t('detail.event'), changedStage: t('detail.changedStage'), applicationCreated: t('detail.applicationCreated'), rejectedEvent: t('detail.rejectedEvent'), reopenedEvent: t('detail.reopenedEvent'), interviewCreated: t('detail.interviewCreated'), hiredEvent: t('detail.hiredEvent'), unknownEvent: t('detail.unknownEvent') },
    feedback: { saved: t('detail.actionSaved'), failed: t('detail.actionFailed') },
    interview: { title: t('guided.interviewPlanner'), description: t('guided.interviewPlannerDescription'), newInterview: t('guided.newInterview'), interviewTitle: t('guided.interviewTitle'), scheduledAt: t('guided.scheduledAt'), set: t('guided.set'), noSet: t('guided.noSet'), participants: t('guided.participants'), searchParticipants: t('guided.searchParticipants'), createInterview: t('guided.createInterview'), cancel: t('guided.cancel'), saved: t('guided.saved'), noInterviews: t('guided.noInterviews'), emptyValue: t('detail.emptyValue'), close: t('detail.close'), dirtyTitle: t('detail.dirtyTitle'), dirtyDescription: t('detail.dirtyDescription'), discard: t('detail.discard'), keepEditing: t('detail.keepEditing') },
  }

  return <PageShell width="standard"><RecruitmentCandidateDetail activeTab={activeTab} application={application} basePath={`/recruitment/vacancies/${application.vacancyId}/candidates/${application.id}`} canWrite={canWrite} interviews={interviews} labels={labels} participants={participants} sets={sets} stages={stages.map((stage) => ({ id: stage.id, name: stage.name }))} /></PageShell>
}
