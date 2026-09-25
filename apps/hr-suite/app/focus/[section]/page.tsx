import Link from 'next/link'
import { ArrowLeft, ArrowRight, FileText } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { FocusAbsenceForm } from '@/components/focus/focus-absence-form'
import { FocusAbsenceWorkList } from '@/components/focus/focus-absence-work-list'
import { FocusDirectoryView, FocusHoursView, FocusLeaveView, FocusProfileView, type FocusProfileLabels } from '@/components/focus/focus-section-views'
import { FocusJourneyCard } from '@/components/focus/focus-home'
import { FocusHoursEntryForm } from '@/components/focus/focus-hours-entry-form'
import { FocusLeaveRequest } from '@/components/focus/focus-leave-request'
import { FocusDocuments } from '@/components/focus/focus-documents'
import { FocusProcessList } from '@/components/focus/focus-process-list'
import { FocusShell } from '@/components/focus/focus-shell'
import { FocusTeamCalendarView } from '@/components/focus/focus-team-calendar'
import { loadFocusPage } from '@/components/focus/load-focus-page'
import { visibleFocusActions } from '@/components/focus/focus-view'
import { PageHeader } from '@/components/patterns/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { listProcessWork } from '@/lib/process-automation/work-service'
import { AuthorizationError } from '@/lib/auth/permissions'
import { focusActAsHref } from '@/lib/focus/url'
import { getFocusAbsenceState, getFocusAbsenceWork, getFocusDocuments, getFocusDirectory, getFocusHoursOverview, getFocusLeaveOverview, getFocusProfileProjection, loadFocusSectionContext, type FocusSectionContext } from '@/lib/focus/section-service'
import { loadFocusTeamCalendarForContext } from '@/lib/focus/team-service'
import type { FocusActionKey } from '@/lib/focus/service'
import { getTranslator } from '@/lib/i18n/server'

type FocusSectionKind = FocusActionKey | 'directory' | 'more'

const sections: Record<string, FocusSectionKind | undefined> = {
  onboarding: 'journey', profiel: 'profile', documenten: 'documents', verlof: 'leave', uren: 'hours', aanvragen: 'requests', werk: 'work', team: 'team', ziek: 'absence', 'wie-is-wie': 'directory', meer: 'more',
}

function shellLabels(t: Awaited<ReturnType<typeof getTranslator>>, token: string | null | undefined) {
  return {
    actAsToken: token, product: t('nav.product'), home: t('nav.home'), menu: t('nav.menu'),
    actions: { journey: t('actions.journey.title'), profile: t('actions.profile.title'), documents: t('actions.documents.title'), leave: t('actions.leave.title'), hours: t('actions.hours.title'), requests: t('actions.requests.title'), work: t('actions.work.title'), team: t('actions.team.title'), absence: t('actions.absence.title') },
    bottom: { menu: t('nav.menu'), home: t('nav.home'), journey: t('nav.tasks'), profile: t('actions.profile.title'), documents: t('actions.documents.title'), requests: t('nav.requests'), leave: t('nav.leave'), hours: t('nav.hours'), work: t('nav.work'), team: t('nav.team'), more: t('nav.more') },
  }
}

function leaveDialogLabels(t: Awaited<ReturnType<typeof getTranslator>>) {
  return { title: t('requestTitle'), description: t('requestDescription'), employment: t('employment'), employmentRequired: t('employmentRequired'), viaPriority: t('viaPriority'), withoutPriority: t('withoutPriority'), leaveType: t('leaveType'), noLeaveTypes: t('noLeaveTypes'), priorityRule: t('priorityRule'), noPriorityRules: t('noPriorityRules'), currentBalance: t('currentBalance'), projectedBalance: t('projectedBalance'), unlimited: t('unlimited'), timeMode: t('timeMode'), fullDay: t('fullDay'), morning: t('morning'), afternoon: t('afternoon'), specificHours: t('specificHours'), startDate: t('startDate'), endDate: t('endDate'), timeStart: t('timeStart'), timeEnd: t('timeEnd'), totalTime: t('totalTime'), confirm: t('confirm'), cancel: t('cancel'), close: t('close'), loading: t('loading'), success: t('success'), failed: t('failed'), noBalance: t('noBalance'), discardTitle: t('discardTitle'), discardDescription: t('discardDescription'), keepEditing: t('keepEditing'), discardChanges: t('discardChanges') }
}

function absenceFormLabels(t: Awaited<ReturnType<typeof getTranslator>>) {
  return {
    title: t('absence.title'), description: t('absence.description'), startDate: t('absence.startDate'), expectedRecoveryOn: t('absence.expectedRecoveryOn'), optional: t('absence.optional'), submit: t('absence.submit'), submitting: t('absence.submitting'), success: t('absence.success'), failed: t('absence.failed'), recoveryTitle: t('absence.recoveryTitle'), recoveryDescription: t('absence.recoveryDescription'), recoveryDate: t('absence.recoveryDate'), recoverySubmit: t('absence.recoverySubmit'), recoverySubmitting: t('absence.recoverySubmitting'), recoverySuccess: t('absence.recoverySuccess'), recoveryFailed: t('absence.recoveryFailed'),
  }
}

function teamCalendarLabels(t: Awaited<ReturnType<typeof getTranslator>>) {
  return { month: t('team.month'), previous: t('team.previous'), next: t('team.next'), today: t('team.today'), employee: t('team.employee'), status: t('team.status'), present: t('team.present'), absent: t('team.absent'), available: t('team.available'), off: t('team.off'), leave: t('team.leave'), hours: t('team.hours'), selectedDay: t('team.selectedDay'), reportAbsence: t('team.reportAbsence'), reportRecovery: t('team.reportRecovery'), actAs: t('team.actAs'), acting: t('team.acting') }
}

export default async function FocusSectionPage({ params, searchParams = Promise.resolve({}) }: { params: Promise<{ section: string }>; searchParams?: Promise<{ actAs?: string; month?: string; day?: string; request?: string; edit?: string; reportEmployee?: string; recoverEmployee?: string; q?: string }> }) {
  const [{ section }, query] = await Promise.all([params, searchParams])
  const kind = Object.prototype.hasOwnProperty.call(sections, section) ? sections[section] : undefined
  if (!kind) notFound()
  const props = await loadFocusPage(query.actAs)
  const { data, t, locale } = props
  const actions = visibleFocusActions(data)
  const isSpecial = kind === 'directory' || kind === 'more'
  if (!isSpecial && !actions.some((action) => action.key === kind)) notFound()
  if (data.isPreboarding && isSpecial) notFound()
  let context: FocusSectionContext
  try {
    context = await loadFocusSectionContext(query.actAs)
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }
  const employeeId = data.employee?.id ?? context.employeeId
  const labels = shellLabels(t, data.actAs?.token ?? query.actAs)
  const activeKey: FocusActionKey | 'more' | undefined = kind === 'more' ? 'more' : kind === 'directory' ? 'team' : kind

  let content
  if (kind === 'journey') {
    content = data.journey ? <FocusJourneyCard {...props} /> : <EmptyState icon={<FileText />} title={t('journey.emptyTitle')} description={t(data.isPreboarding ? 'journey.preboardingEmptyDescription' : 'journey.emptyDescription')} />
  } else if (kind === 'profile') {
    const profile = await getFocusProfileProjection(context)
    const profileLabels: FocusProfileLabels = { personal: t('profile.personal'), contact: t('profile.contact'), relations: t('profile.relations'), address: t('profile.address'), work: t('profile.work'), bank: t('profile.bank'), empty: t('profile.empty'), language: t('profile.language'), workEmail: t('profile.workEmail'), workPhone: t('profile.workPhone'), privateEmail: t('profile.privateEmail'), privatePhone: t('profile.privatePhone'), privateMobile: t('profile.privateMobile'), jobTitle: t('profile.jobTitle'), department: t('profile.department'), startDate: t('profile.startDate'), hoursPerWeek: t('profile.hoursPerWeek'), hoursUnit: t('leave.hours'), noAddress: t('profile.noAddress'), noRelations: t('profile.noRelations'), noBank: t('profile.noBank'), masked: t('profile.masked'), bic: t('profile.bic'), accountHolder: t('profile.accountHolder'), editTitle: t('profile.editTitle'), edit: t('profile.edit'), nameSection: t('profile.nameSection'), contactSection: t('profile.contactSection'), title: t('profile.title'), initials: t('profile.initials'), firstName: t('profile.firstName'), birthNamePrefix: t('profile.birthNamePrefix'), birthName: t('profile.birthName'), partnerNamePrefix: t('profile.partnerNamePrefix'), partnerName: t('profile.partnerName'), nameUsage: t('profile.nameUsage'), nameUsageBirth: t('profile.nameUsageBirth'), nameUsagePartner: t('profile.nameUsagePartner'), nameUsagePartnerBirth: t('profile.nameUsagePartnerBirth'), nameUsageBirthPartner: t('profile.nameUsageBirthPartner'), cancel: t('profile.cancel'), close: t('profile.close'), discardTitle: t('profile.discardTitle'), discardDescription: t('profile.discardDescription'), discardConfirm: t('profile.discardConfirm'), discardCancel: t('profile.discardCancel'), save: t('profile.save'), saving: t('profile.saving'), saved: t('profile.saved'), failed: t('profile.failed'), relationAdd: t('profile.relationAdd'), relationEdit: t('profile.relationEdit'), relationEditTitle: t('profile.relationEditTitle'), relationAddTitle: t('profile.relationAddTitle'), relationType: t('profile.relationType'), relationFirstName: t('profile.relationFirstName'), relationInitials: t('profile.relationInitials'), relationPrefix: t('profile.relationPrefix'), relationLastName: t('profile.relationLastName'), relationGender: t('profile.relationGender'), relationGenderMale: t('profile.relationGenderMale'), relationGenderFemale: t('profile.relationGenderFemale'), relationGenderOther: t('profile.relationGenderOther'), relationGenderUndisclosed: t('profile.relationGenderUndisclosed'), relationBirthDate: t('profile.relationBirthDate'), relationPhone: t('profile.relationPhone'), relationMobile: t('profile.relationMobile'), relationEmail: t('profile.relationEmail'), relationNotes: t('profile.relationNotes'), relationEmergencyContact: t('profile.relationEmergencyContact'), relationSave: t('profile.relationSave'), relationDelete: t('profile.relationDelete'), relationDeleteTitle: t('profile.relationDeleteTitle'), relationDeleteDescription: t('profile.relationDeleteDescription'), relationDeleteConfirm: t('profile.relationDeleteConfirm'), relationTypeSearch: t('profile.relationTypeSearch'), relationGenderSearch: t('profile.relationGenderSearch') }
    content = <FocusProfileView actAsToken={data.actAs?.token ?? query.actAs} labels={profileLabels} locale={locale} profile={profile} />
  } else if (kind === 'documents') {
    const groups = await getFocusDocuments(context)
    const documentLabels = await getTranslator('documents', locale)
    content = groups.some((group) => group.documents.length > 0) ? <FocusDocuments groups={groups} locale={locale} labels={{ added: t('documents.added'), expires: t('documents.expires'), open: documentLabels('view'), download: documentLabels('download'), close: documentLabels('viewerClose'), unsupported: documentLabels('viewerUnsupported'), previewLoading: documentLabels('viewerPreviewLoading'), previewUnavailable: documentLabels('viewerPreviewUnavailable'), category: documentLabels('category'), salarySensitive: documentLabels('salarySensitive'), tags: documentLabels('tags') }} /> : <EmptyState icon={<FileText />} title={t('actions.documents.title')} description={t('documents.empty')} />
  } else if (kind === 'leave') {
    const overview = await getFocusLeaveOverview(context)
    const request = query.request === '1' && data.canRequestLeave
    const leaveT = await getTranslator('leaveWorkflow', locale)
    if (request) {
      content = <FocusLeaveRequest actAsToken={data.actAs?.token ?? query.actAs} employeeId={employeeId} labels={leaveDialogLabels(leaveT)} locale={locale} />
    } else {
      const calendar = await loadFocusTeamCalendarForContext(context.context, query.month, { subjectEmployeeId: data.actAs?.subjectEmployeeId, privacyMode: 'EMPLOYEE', selectedDate: query.day, supabase: context.supabase })
      content = <FocusLeaveView labels={{ balance: t('leave.balance'), total: t('leave.total'), upcoming: t('leave.upcoming'), request: t('leave.request'), noBalance: t('leave.noBalance'), noUpcoming: t('leave.noUpcoming'), hours: t('leave.hours'), status: { PENDING: t('leave.status.PENDING'), CHANGES_REQUESTED: t('leave.status.CHANGES_REQUESTED'), APPROVED: t('leave.status.APPROVED'), REJECTED: t('leave.status.REJECTED'), CANCELLED: t('leave.status.CANCELLED') } }} overview={overview} requestHref={focusActAsHref('/focus/verlof?request=1', data.actAs?.token ?? query.actAs)} teamCalendar={{ title: t('leave.teamTitle'), description: t('leave.teamDescription'), calendar, labels: teamCalendarLabels(t), actAsToken: data.actAs?.token ?? query.actAs, locale, today: props.today }} />
    }
  } else if (kind === 'hours') {
    const overview = await getFocusHoursOverview(context)
    content = <><FocusHoursView editHref={overview.canEdit ? focusActAsHref('/focus/uren?edit=1', data.actAs?.token ?? query.actAs) : undefined} labels={{ expected: t('hours.expected'), recorded: t('hours.recorded'), actionNeeded: t('hours.actionNeeded'), noAction: t('hours.noAction'), fill: t('hours.fill'), noData: t('hours.noData'), hours: t('hours.hours'), entries: t('hours.entries'), noEntries: t('hours.noEntries'), date: t('hours.date'), type: t('hours.type'), status: t('hours.status'), correction: t('hours.correction'), statusLabels: { APPROVED: t('hours.statusLabels.APPROVED'), PENDING: t('hours.statusLabels.PENDING'), DRAFT: t('hours.statusLabels.DRAFT'), REVOKED: t('hours.statusLabels.REVOKED'), unknown: t('hours.statusLabels.unknown') } }} locale={locale} overview={overview} />{query.edit === '1' && overview.canEdit && overview.projection ? <FocusHoursEntryForm employeeId={employeeId} labels={{ title: t('hours.entryTitle'), editTitle: t('hours.editTitle'), existingTitle: t('hours.existingTitle'), edit: t('hours.edit'), cancel: t('hours.cancel'), type: t('hours.type'), selectType: t('hours.selectType'), searchTypes: t('hours.searchTypes'), date: t('hours.date'), hours: t('hours.hours'), hoursPlaceholder: t('hours.hoursPlaceholder'), note: t('hours.note'), correctionReason: t('hours.correctionReason'), save: t('hours.save'), saveEdit: t('hours.saveEdit'), saving: t('hours.saving'), saved: t('hours.saved'), failed: t('hours.failed'), noTypes: t('hours.noTypes'), errorClosedPeriod: t('hours.errorClosedPeriod'), errorFutureDate: t('hours.errorFutureDate'), errorInactiveType: t('hours.errorInactiveType'), errorLeaveOverlap: t('hours.errorLeaveOverlap'), errorUnauthorized: t('hours.errorUnauthorized'), errorHoursInvalid: t('hours.errorHoursInvalid'), errorStale: t('hours.errorStale'), errorCommentRequired: t('hours.errorCommentRequired'), errorGeneric: t('hours.errorGeneric') }} projection={overview.projection} today={props.today} /> : null}</>
  } else if (kind === 'requests' || kind === 'work') {
    const work = await listProcessWork({ view: kind === 'requests' ? 'REQUESTS' : 'WORK', tab: kind === 'requests' ? 'ALL' : 'TODO', subjectEmployeeId: kind === 'requests' ? employeeId : undefined, language: locale === 'nl' ? 'nl' : 'en', limit: 40, offset: 0 }, { context: context.context, supabase: context.supabase }).catch(() => ({ items: [], total: 0, hasMore: false }))
    const absenceWork = kind === 'work' ? await getFocusAbsenceWork(context) : []
    content = <div className="space-y-8">{absenceWork.length ? <FocusAbsenceWorkList items={absenceWork} labels={{ title: t('absence.workTitle'), description: t('absence.workDescription'), sickness: t('absence.sickness'), from: t('absence.from'), confirm: t('absence.confirm'), correction: t('absence.correction'), failed: t('absence.failed'), correctionSent: t('absence.correctionSent') }} locale={locale} /> : null}<FocusProcessList data={work} labels={{ actionNeeded: t('process.actionNeeded'), empty: t('process.empty'), waiting: t('process.waiting'), inProgress: t('process.inProgress'), completed: t('process.completed'), open: t('process.open'), leave: t('process.leave'), work: t('process.work'), request: t('process.request') }} manager={kind === 'work'} token={data.actAs?.token ?? query.actAs} /></div>
  } else if (kind === 'team') {
    const calendar = await loadFocusTeamCalendarForContext(context.context, query.month, { subjectEmployeeId: data.actAs?.subjectEmployeeId, privacyMode: data.experience === 'MANAGER' && !data.actAs ? 'MANAGER' : 'EMPLOYEE', selectedDate: query.day, supabase: context.supabase })
    const reportMember = query.reportEmployee ? calendar.members.find((member) => member.employeeId === query.reportEmployee) : null
    const recoveryMember = query.recoverEmployee ? calendar.members.find((member) => member.employeeId === query.recoverEmployee) : null
    content = <>{reportMember && calendar.canReportAbsence ? <FocusAbsenceForm employeeId={reportMember.employeeId} employmentId={reportMember.employmentId} endpoint="/api/absence/report" labels={{ ...absenceFormLabels(t), title: t('absence.managerTitle'), description: t('absence.managerDescription') }} today={props.today} /> : null}{recoveryMember?.activeAbsenceCaseId && calendar.canRecoverAbsence ? <FocusAbsenceForm employeeId={recoveryMember.employeeId} recoveryCaseId={recoveryMember.activeAbsenceCaseId} mode="recovery" labels={{ ...absenceFormLabels(t), recoveryTitle: t('absence.managerRecoveryTitle'), recoveryDescription: t('absence.managerRecoveryDescription') }} today={props.today} /> : null}<FocusTeamCalendarView actAsToken={data.actAs?.token ?? query.actAs} calendar={calendar} labels={teamCalendarLabels(t)} locale={locale} /></>
  } else if (kind === 'absence') {
    const absenceState = await getFocusAbsenceState(context, props.today)
    const canShowReport = !data.readOnly && (!absenceState || (absenceState.pendingConfirmation && absenceState.confirmationStatus === 'CORRECTION_REQUESTED'))
    content = <div className="space-y-4">{absenceState?.pendingConfirmation ? <Surface className="space-y-2 p-4" role="status"><h2 className="font-semibold">{absenceState.confirmationStatus === 'CORRECTION_REQUESTED' ? t('absence.correctionRequestedTitle') : t('absence.pendingTitle')}</h2><p className="text-sm text-muted-foreground">{absenceState.confirmationStatus === 'CORRECTION_REQUESTED' ? t('absence.correctionRequestedDescription') : t('absence.pendingDescription')}</p></Surface> : null}{canShowReport ? <FocusAbsenceForm employeeId={employeeId} initialStartDate={absenceState?.firstAbsenceOn ?? undefined} showExpectedRecoveryOn={false} labels={absenceFormLabels(t)} today={props.today} token={data.actAs?.token ?? query.actAs} /> : null}{data.readOnly ? <EmptyState title={t('absence.previewTitle')} description={t('absence.previewDescription')} /> : null}</div>
  } else if (kind === 'directory') {
    const directory = await getFocusDirectory(context, query.q)
    content = <FocusDirectoryView actAsToken={data.actAs?.token ?? query.actAs} directory={directory} labels={{ search: t('directory.search'), mail: t('directory.mail'), call: t('directory.call'), empty: t('directory.empty'), disabled: t('directory.disabled') }} query={query.q} />
  } else {
    content = <section className="grid gap-3 sm:grid-cols-2">{actions.map((action) => <Link className="group" href={focusActAsHref(action.href, data.actAs?.token ?? query.actAs)} key={action.key} prefetch={false}><Surface className="flex min-h-20 items-center gap-3 p-4 transition-colors group-hover:bg-surface-raised"><div className="min-w-0 flex-1"><p className="font-semibold">{labels.actions[action.key]}</p><p className="mt-1 text-sm text-muted-foreground">{t(`actions.${action.key}.description`)}</p></div><ArrowRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" /></Surface></Link>)}<Link className="group" href={focusActAsHref('/focus/wie-is-wie', data.actAs?.token ?? query.actAs)} prefetch={false}><Surface className="flex min-h-20 items-center gap-3 p-4 transition-colors group-hover:bg-surface-raised"><div className="min-w-0 flex-1"><p className="font-semibold">{t('directory.title')}</p><p className="mt-1 text-sm text-muted-foreground">{t('sections.directoryDescription')}</p></div><ArrowRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" /></Surface></Link></section>
  }

  const title = kind === 'more' ? t('more.title') : kind === 'directory' ? t('directory.title') : t(`actions.${kind}.title`)
  const description = kind === 'more' ? t('more.description') : kind === 'directory' ? t('sections.directoryDescription') : t(`actions.${kind}.description`)
  return <FocusShell actions={actions} activeKey={activeKey} actAs={data.actAs ? { title: t('actAs.title'), description: t('actAs.description'), subjectName: data.actAs.subjectName, stopLabel: t('actAs.stop'), token: data.actAs.token } : null} labels={labels} readOnly={data.readOnly} width="reading"><Link className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary hover:underline" href={focusActAsHref('/focus', data.actAs?.token ?? query.actAs)}><ArrowLeft aria-hidden="true" className="size-4" />{t('back')}</Link><PageHeader description={description} title={title} />{content}</FocusShell>
}
