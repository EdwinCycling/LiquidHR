import Link from 'next/link'
import { ArrowLeft, UserPlus } from 'lucide-react'
import { redirect } from 'next/navigation'
import { InvitationWizard, type InvitationWizardLabels } from '@/components/invitations/invitation-wizard'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { buttonClasses } from '@/components/ui/button'
import { getInvitationDefaults, listInvitationCandidates, listInvitations } from '@/lib/auth/invitation-management'
import { AuthorizationError, AuthenticationError, requirePermission } from '@/lib/auth/permissions'
import { ContextAccessError } from '@/lib/context/administration-context'
import { ContextAuthenticationError } from '@/lib/context/server-context'
import { getLocale, getTranslator } from '@/lib/i18n/server'

async function loadInvitationPageData() {
  try {
    await requirePermission('user:invite')
    return await Promise.all([
      getLocale(),
      getTranslator('invitations'),
      listInvitationCandidates(),
      listInvitations(),
      getInvitationDefaults(),
    ]).then(([locale, t, candidates, invitations, defaults]) => ({ locale, t, candidates, invitations, defaults }))
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof ContextAuthenticationError) redirect('/login')
    if (error instanceof AuthorizationError || error instanceof ContextAccessError) redirect('/geen-toegang')
    throw error
  }
}

export default async function InvitationsPage() {
  const { locale, t, candidates, invitations, defaults } = await loadInvitationPageData()
    const labels: InvitationWizardLabels = {
      stepsLabel: t('stepsLabel'),
      stepSelect: t('stepSelect'),
      stepReview: t('stepReview'),
      stepResult: t('stepResult'),
      search: t('search'),
      searchPlaceholder: t('searchPlaceholder'),
      statusFilter: t('statusFilter'),
      allStatuses: t('allStatuses'),
      selectAll: t('selectAll'),
      clearAll: t('clearAll'),
      selectedCount: t('selectedCount', { count: '{count}' }),
      noCandidates: t('noCandidates'),
      noEmail: t('noEmail'),
      alreadyActive: t('alreadyActive'),
      notActivated: t('notActivated'),
      invited: t('invited'),
      expired: t('expired'),
      blocked: t('blocked'),
      continue: t('continue'),
      reviewTitle: t('reviewTitle'),
      reviewDescription: t('reviewDescription'),
      recipient: t('recipient'),
      purpose: t('purpose'),
      preboarding: t('preboarding'),
      fixedSecurity: t('fixedSecurity'),
      send: t('send'),
      sending: t('sending'),
      back: t('back'),
      resultTitle: t('resultTitle'),
      sent: t('sent'),
      notSent: t('notSent'),
      resultSuccess: t('resultSuccess'),
      resultFailed: t('resultFailed', { code: '{code}' }),
      restart: t('restart'),
      existingTitle: t('existingTitle'),
      existingEmpty: t('existingEmpty'),
      expires: t('expires', { date: '{date}' }),
      resend: t('resend'),
      revoke: t('revoke'),
      working: t('working'),
      actionFailed: t('actionFailed'),
      actionDone: t('actionDone'),
    }

    return (
      <PageShell className="space-y-6 py-6 sm:py-8" width="standard">
        <PageHeader
          actions={<Link className={buttonClasses({ variant: 'secondary' })} href="/settings"><ArrowLeft aria-hidden="true" />{t('back')}</Link>}
          description={t('description')}
          title={<span className="flex items-center gap-2"><UserPlus aria-hidden="true" className="size-6 text-primary" />{t('title')}</span>}
        />
        <InvitationWizard candidates={candidates} invitations={invitations} labels={labels} locale={locale} managementRoleId={defaults.managementRoleId} />
      </PageShell>
    )
}
