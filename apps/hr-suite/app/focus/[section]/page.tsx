import Link from 'next/link'
import { ArrowLeft, ArrowRight, FileText } from 'lucide-react'
import { notFound } from 'next/navigation'
import { FocusAbsenceForm } from '@/components/focus/focus-absence-form'
import { FocusAbsenceWorkList } from '@/components/focus/focus-absence-work-list'
import { FocusDirectoryView, FocusHoursView, FocusLeaveView, FocusProfileView, type FocusProfileLabels } from '@/components/focus/focus-section-views'
import { FocusJourneyCard } from '@/components/focus/focus-home'
import { FocusHoursEntryForm } from '@/components/focus/focus-hours-entry-form'
import { FocusLeaveRequest } from '@/components/focus/focus-leave-request'
import { FocusProcessList } from '@/components/focus/focus-process-list'
import { FocusShell } from '@/components/focus/focus-shell'
import { FocusTeamCalendarView } from '@/components/focus/focus-team-calendar'
import { loadFocusPage } from '@/components/focus/load-focus-page'
import { visibleFocusActions } from '@/components/focus/focus-view'
import { PageHeader } from '@/components/patterns/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { listProcessWork } from '@/lib/process-automation/work-service'
import { focusActAsHref } from '@/lib/focus/url'
import { getFocusAbsenceState, getFocusAbsenceWork, getFocusDocuments, getFocusDirectory, getFocusHoursOverview, getFocusLeaveOverview, getFocusProfileProjection, loadFocusSectionContext } from '@/lib/focus/section-service'
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
    bottom: { home: t('nav.home'), journey: t('nav.tasks'), profile: t('actions.profile.title'), documents: t('actions.documents.title'), requests: t('nav.requests'), leave: t('nav.leave'), hours: t('nav.hours'), work: t('nav.work'), team: t('nav.team'), more: t('nav.more') },
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
  const context = await loadFocusSectionContext(query.actAs)
  const employeeId = data.employee?.id ?? context.employeeId
  const labels = shellLabels(t, data.actAs?.token ?? query.actAs)
  const activeKey: FocusActionKey | 'more' | undefined = kind === 'more' ? 'more' : kind === 'directory' ? 'team' : kind

  let content
  if (kind === 'journey') {
    content = data.journey ? <FocusJourneyCard {...props} /> : <EmptyState icon={<FileText />} title={t('journey.emptyTitle')} description={t(data.isPreboarding ? 'journey.preboardingEmptyDescription' : 'journey.emptyDescription')} />
  } else if (kind === 'profile') {
    const profile = await getFocusProfileProjection(context)
    const profileLabels: FocusProfileLabels = { personal: t('profile.personal'), contact: t('profile.contact'), relations: t('profile.relations'), address: t('profile.address'), work: t('profile.work'), bank: t('profile.bank'), empty: t('profile.empty'), language: t('profile.language'), workEmail: t('profile.workEmail'), workPhone: t('profile.workPhone'), privateEmail: t('profile.privateEmail'), privatePhone: t('profile.privatePhone'), jobTitle: t('profile.jobTitle'), department: t('profile.department'), startDate: t('profile.startDate'), hoursPerWeek: t('profile.hoursPerWeek'), hoursUnit: t('leave.hours'), noAddress: t('profile.noAddress'), noRelations: t('profile.noRelations'), noBank: t('profile.noBank'), masked: t('profile.masked'), bic: t('profile.bic'), accountHolder: t('profile.accountHolder') }
    content = <FocusProfileView labels={profileLabels} profile={profile} />
  } else if (kind === 'documents') {
    const documents = await getFocusDocuments(context)
    content = documents.length ? <section className="space-y-3">{documents.map((document) => <Surface className="flex flex-wrap items-center gap-3 p-4" key={document.id}><FileText aria-hidden="true" className="size-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="font-medium">{document.title}</p><p className="mt-1 text-sm text-muted-foreground">{document.expiresOn ? `${t('documents.expires')}: ${document.expiresOn}` : `${t('documents.added')}: ${document.createdAt.slice(0, 10)}`}</p></div></Surface>)}</section> : <EmptyState icon={<FileText />} title={t('actions.documents.title')} description={t('documents.empty')} />
  } else if (kind === 'leave') {
    const overview = await getFocusLeaveOverview(context)
    const request = query.request === '1' && data.canRequestLeave
    const leaveT = await getTranslator('leaveWorkflow', locale)
    content = request ? <FocusLeaveRequest actAsToken={data.actAs?.token ?? query.actAs} employeeId={employeeId} labels={leaveDialogLabels(leaveT)} locale={locale} /> : <FocusLeaveView labels={{ balance: t('leave.balance'), upcoming: t('leave.upcoming'), request: t('leave.request'), noBalance: t('leave.noBalance'), noUpcoming: t('leave.noUpcoming'), hours: t('leave.hours'), status: { PENDING: t('leave.status.PENDING'), CHANGES_REQUESTED: t('leave.status.CHANGES_REQUESTED'), APPROVED: t('leave.status.APPROVED'), REJECTED: t('leave.status.REJECTED'), CANCELLED: t('leave.status.CANCELLED') } }} overview={overview} requestHref={focusActAsHref('/focus/verlof?request=1', data.actAs?.token ?? query.actAs)} />
  } else if (kind === 'hours') {
    const overview = await getFocusHoursOverview(context)
    content = <><FocusHoursView editHref={overview.canEdit ? focusActAsHref('/focus/uren?edit=1', data.actAs?.token ?? query.actAs) : undefined} labels={{ expected: t('hours.expected'), recorded: t('hours.recorded'), actionNeeded: t('hours.actionNeeded'), noAction: t('hours.noAction'), fill: t('hours.fill'), noData: t('hours.noData'), hours: t('hours.hours') }} overview={overview} />{query.edit === '1' && overview.canEdit && overview.projection ? <FocusHoursEntryForm employeeId={employeeId} labels={{ title: t('hours.entryTitle'), type: t('hours.type'), selectType: t('hours.selectType'), searchTypes: t('hours.searchTypes'), date: t('hours.date'), hours: t('hours.hours'), hoursPlaceholder: t('hours.hoursPlaceholder'), note: t('hours.note'), save: t('hours.save'), saving: t('hours.saving'), saved: t('hours.saved'), failed: t('hours.failed'), noTypes: t('hours.noTypes') }} projection={overview.projection} today={props.today} /> : null}</>
  } else if (kind === 'requests' || kind === 'work') {
    const work = await listProcessWork({ view: kind === 'requests' ? 'REQUESTS' : 'WORK', tab: kind === 'requests' ? 'ALL' : 'TODO', subjectEmployeeId: employeeId, language: locale === 'nl' ? 'nl' : 'en', limit: 40, offset: 0 }, { context: context.context, supabase: context.supabase }).catch(() => ({ items: [], total: 0, hasMore: false }))
    const absenceWork = kind === 'work' ? await getFocusAbsenceWork(context) : []
    content = <div className="space-y-8">{absenceWork.length ? <FocusAbsenceWorkList items={absenceWork} labels={{ title: t('absence.workTitle'), description: t('absence.workDescription'), sickness: t('absence.sickness'), from: t('absence.from'), confirm: t('absence.confirm'), correction: t('absence.correction'), failed: t('absence.failed'), correctionSent: t('absence.correctionSent') }} locale={locale} /> : null}<FocusProcessList data={work} labels={{ actionNeeded: t('process.actionNeeded'), empty: t('process.empty'), waiting: t('process.waiting'), inProgress: t('process.inProgress'), completed: t('process.completed'), open: t('process.open'), leave: t('process.leave'), work: t('process.work'), request: t('process.request') }} manager={kind === 'work'} token={data.actAs?.token ?? query.actAs} /></div>
  } else if (kind === 'team') {
    const calendar = await loadFocusTeamCalendarForContext(context.context, query.month, { subjectEmployeeId: data.actAs?.subjectEmployeeId, privacyMode: data.experience === 'MANAGER' && !data.actAs ? 'MANAGER' : 'EMPLOYEE', selectedDate: query.day, supabase: context.supabase })
    const reportMember = query.reportEmployee ? calendar.members.find((member) => member.employeeId === query.reportEmployee) : null
    const recoveryMember = query.recoverEmployee ? calendar.members.find((member) => member.employeeId === query.recoverEmployee) : null
    content = <>{reportMember && calendar.canReportAbsence ? <FocusAbsenceForm employeeId={reportMember.employeeId} employmentId={reportMember.employmentId} endpoint="/api/absence/report" labels={{ ...absenceFormLabels(t), title: t('absence.managerTitle'), description: t('absence.managerDescription') }} today={props.today} /> : null}{recoveryMember?.activeAbsenceCaseId && calendar.canRecoverAbsence ? <FocusAbsenceForm employeeId={recoveryMember.employeeId} recoveryCaseId={recoveryMember.activeAbsenceCaseId} mode="recovery" labels={{ ...absenceFormLabels(t), recoveryTitle: t('absence.managerRecoveryTitle'), recoveryDescription: t('absence.managerRecoveryDescription') }} today={props.today} /> : null}<FocusTeamCalendarView actAsToken={data.actAs?.token ?? query.actAs} calendar={calendar} labels={{ month: t('team.month'), previous: t('team.previous'), next: t('team.next'), today: t('team.today'), employee: t('team.employee'), status: t('team.status'), present: t('team.present'), absent: t('team.absent'), available: t('team.available'), off: t('team.off'), leave: t('team.leave'), hours: t('team.hours'), selectedDay: t('team.selectedDay'), reportAbsence: t('team.reportAbsence'), reportRecovery: t('team.reportRecovery'), actAs: t('team.actAs'), acting: t('team.acting') }} locale={locale} /></>
  } else if (kind === 'absence') {
    const absenceState = await getFocusAbsenceState(context)
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
