import Link from 'next/link'
import { ArrowLeft, FileText, UserRound } from 'lucide-react'
import { FocusJourneyCard } from './focus-home'
import { focusPreviewHref } from './focus-preview'
import { focusDate, isPreboardingFocus, visibleFocusActions } from './focus-view'
import type { FocusPreviewPageData } from './load-focus-preview-page'
import { FocusShell } from './focus-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/patterns/page-header'
import { Surface } from '@/components/ui/surface'
import { buttonClasses } from '@/components/ui/button'
import type { FocusActionKey } from '@/lib/focus/service'

const sectionDescriptionKeys: Partial<Record<FocusActionKey, string>> = {
  profile: 'sections.profileDescription',
  documents: 'sections.documentsSigningOnly',
  requests: 'sections.requestsPendingDescription',
  work: 'sections.workDescription',
  team: 'sections.teamDescription',
}

export function FocusPreviewSection({ activeKey, ...props }: FocusPreviewPageData & { activeKey: FocusActionKey }) {
  const { data, locale, t } = props
  const actions = visibleFocusActions(data)
  const employee = data.employee
  const action = actions.find((candidate) => candidate.key === activeKey)
  if (!employee || !action) return null

  const preboarding = isPreboardingFocus(data)
  const descriptionKey = sectionDescriptionKeys[activeKey]
  const description = descriptionKey ? t(descriptionKey) : t(`actions.${activeKey}.description`)

  return (
    <FocusShell
      actions={actions}
      activeKey={activeKey}
      labels={{ product: t('nav.product'), home: t('nav.home'), menu: t('nav.menu'), actions: {
        journey: t('actions.journey.title'), profile: t('actions.profile.title'), documents: t('actions.documents.title'), leave: t('actions.leave.title'), requests: t('actions.requests.title'), work: t('actions.work.title'), team: t('actions.team.title'),
      } }}
      preview={{ title: t('preview.title'), status: t('preview.status'), closeLabel: t('preview.close'), employeeId: employee.id, returnHref: '/employees' }}
      readOnly
      width="reading"
    >
      <Link className={buttonClasses({ variant: 'ghost' })} href={focusPreviewHref(employee.id)} prefetch={false}><ArrowLeft aria-hidden="true" />{t('back')}</Link>
      <PageHeader title={t(`actions.${activeKey}.title`)} description={t(`actions.${activeKey}.description`)} />
      {activeKey === 'journey' ? data.journey ? <FocusJourneyCard {...props} /> : <EmptyState icon={<FileText />} title={t('journey.emptyTitle')} description={t(preboarding ? 'journey.preboardingEmptyDescription' : 'journey.emptyDescription')} /> : activeKey === 'profile' ? (
        <Surface className="space-y-4 p-4 sm:p-6">
          <UserRound aria-hidden="true" className="size-6 text-primary" />
          <dl className="space-y-3 text-sm"><div><dt className="text-muted-foreground">{t('sections.name')}</dt><dd className="font-medium">{employee.name}</dd></div>{employee.effectiveEmploymentStartDate ? <div><dt className="text-muted-foreground">{t('sections.startDate')}</dt><dd><time dateTime={employee.effectiveEmploymentStartDate}>{focusDate(employee.effectiveEmploymentStartDate, locale)}</time></dd></div> : null}</dl>
          <p className="text-sm text-muted-foreground">{description}</p>
        </Surface>
      ) : (
        <Surface className="space-y-3 p-4 sm:p-6">
          <p className="text-sm text-muted-foreground">{description}</p>
          <p className="border-t border-subtle pt-3 text-sm text-muted-foreground">{t('preview.status')}</p>
        </Surface>
      )}
    </FocusShell>
  )
}
