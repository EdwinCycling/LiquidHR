import Link from 'next/link'
import { ArrowLeft, ArrowRight, FileText, UserRound } from 'lucide-react'
import { notFound } from 'next/navigation'
import { FocusJourneyCard } from '@/components/focus/focus-home'
import { loadFocusPage } from '@/components/focus/load-focus-page'
import { focusDate, isPreboardingFocus, visibleFocusActions } from '@/components/focus/focus-view'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { buttonClasses } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { getRequestAuthorizationContext } from '@/lib/auth/permissions'
import type { FocusActionKey } from '@/lib/focus/service'

const sections: Record<string, FocusActionKey | undefined> = {
  onboarding: 'journey', profiel: 'profile', documenten: 'documents',
  aanvragen: 'requests', werk: 'work', team: 'team',
}

export default async function FocusSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  const key = Object.hasOwn(sections, section) ? sections[section] : undefined
  if (!key) notFound()
  const props = await loadFocusPage()
  const { data, t, locale } = props
  if (!visibleFocusActions(data).some((action) => action.key === key)) notFound()
  const preboarding = isPreboardingFocus(data)
  const employee = data.employee
  const documentPermissions = key === 'documents'
    ? (await getRequestAuthorizationContext()).context.permissions
    : []
  const canReadDocuments = documentPermissions.includes('self:document:read')
  const canReadSignatures = documentPermissions.includes('self:document-signing:read')
  const destinations: Partial<Record<FocusActionKey, string>> = preboarding || !employee ? {} : {
    profile: `/employees/${employee.id}?tab=personal`,
    documents: canReadDocuments ? `/employees/${employee.id}?tab=documents` : undefined,
    leave: `/employees/${employee.id}/leave`,
    work: '/work',
    team: '/organization-chart?view=manager',
  }
  const destination = destinations[key]
  const hasJourney = data.journey && visibleFocusActions(data).some((action) => action.key === 'journey')

  return (
    <main className="min-h-dvh bg-workspace">
      <PageShell className="space-y-6 py-6 sm:py-8" width="reading">
        <Link className={buttonClasses({ variant: 'ghost' })} href="/focus"><ArrowLeft aria-hidden="true" />{t('back')}</Link>
        <PageHeader title={t(`actions.${key}.title`)} description={t(`actions.${key}.description`)} />
        {key === 'documents' && canReadSignatures ? <Link className={buttonClasses({ variant: 'secondary', className: 'whitespace-normal text-left' })} href="/my-signatures" prefetch={false}><FileText aria-hidden="true" />{t('sections.openSignatures')}</Link> : null}
        {key === 'journey' ? <FocusJourneyCard {...props} /> : destination ? (
          <Surface className="space-y-4 p-4 sm:p-6">
            <p className="text-sm text-muted-foreground">{t(`sections.${key}Description`)}</p>
            <Link className={buttonClasses({ className: 'whitespace-normal text-left' })} href={destination} prefetch={false}>{t(`sections.${key}Open`)}<ArrowRight aria-hidden="true" /></Link>
          </Surface>
        ) : key === 'profile' && employee ? (
          <Surface className="space-y-4 p-4 sm:p-6">
            <UserRound aria-hidden="true" className="size-6 text-primary" />
            <dl className="space-y-3 text-sm"><div><dt className="text-muted-foreground">{t('sections.name')}</dt><dd className="font-medium">{employee.name}</dd></div>{employee.effectiveEmploymentStartDate ? <div><dt className="text-muted-foreground">{t('sections.startDate')}</dt><dd><time dateTime={employee.effectiveEmploymentStartDate}>{focusDate(employee.effectiveEmploymentStartDate, locale)}</time></dd></div> : null}</dl>
            <p className="text-sm text-muted-foreground">{t('sections.preboardingProfile')}</p>
            {hasJourney ? <Link className={buttonClasses({ variant: 'secondary', className: 'whitespace-normal text-left' })} href="/focus/onboarding">{t('sections.openOnboarding')}<ArrowRight aria-hidden="true" /></Link> : null}
          </Surface>
        ) : (
          <EmptyState
            icon={<FileText />}
            title={t(key === 'documents' ? 'sections.documentsPendingTitle' : 'sections.requestsPendingTitle')}
            description={t(key === 'documents' ? preboarding ? 'sections.preboardingDocuments' : 'sections.documentsSigningOnly' : 'sections.requestsPendingDescription')}
            actions={hasJourney && key === 'documents' ? <Link className={buttonClasses({ variant: 'secondary', className: 'whitespace-normal text-left' })} href="/focus/onboarding">{t('sections.openOnboarding')}<ArrowRight aria-hidden="true" /></Link> : undefined}
          />
        )}
      </PageShell>
    </main>
  )
}
