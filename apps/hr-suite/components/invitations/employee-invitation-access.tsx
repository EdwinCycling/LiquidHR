'use client'

import { Mail, RefreshCw, Send, ShieldCheck, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import type { EmployeeInvitationAccess } from '@/lib/auth/invitation-management'
import type { InvitationLifecycleStatus } from '@/lib/auth/invitation-lifecycle'
import type { InvitationPurpose } from '@/lib/auth/invitation-rules'
import type { Locale } from '@/lib/i18n/config'

export interface EmployeeInvitationAccessLabels {
  title: string
  description: string
  status: string
  recipient: string
  purpose: string
  preboarding: string
  employeeActivation: string
  notActivated: string
  invited: string
  active: string
  expired: string
  revoked: string
  noEmail: string
  expires: string
  send: string
  resend: string
  revoke: string
  working: string
  actionFailed: string
  actionDone: string
}

function statusLabel(status: InvitationLifecycleStatus, labels: EmployeeInvitationAccessLabels): string {
  return {
    NOT_ACTIVATED: labels.notActivated,
    INVITED: labels.invited,
    ACTIVE: labels.active,
    EXPIRED: labels.expired,
    REVOKED: labels.revoked,
  }[status]
}

function statusTone(status: InvitationLifecycleStatus): BadgeTone {
  if (status === 'ACTIVE') return 'success'
  if (status === 'INVITED') return 'info'
  if (status === 'EXPIRED') return 'warning'
  if (status === 'REVOKED') return 'danger'
  return 'neutral'
}

function purposeLabel(purpose: InvitationPurpose, labels: EmployeeInvitationAccessLabels): string {
  return purpose === 'PREBOARDING_EMPLOYEE' ? labels.preboarding : labels.employeeActivation
}

function dateLabel(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', { dateStyle: 'medium' }).format(new Date(value))
}

export function EmployeeInvitationAccess({
  access,
  locale,
  managementRoleId,
  labels,
}: {
  access: EmployeeInvitationAccess
  locale: Locale
  managementRoleId: string
  labels: EmployeeInvitationAccessLabels
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function runAction(action: 'send' | 'resend' | 'revoke'): Promise<void> {
    if (busy) return
    setBusy(true)
    setMessage(null)
    try {
      const response = action === 'send'
        ? await fetch('/api/invitations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: access.recipientEmail,
            emailKind: 'PRIVATE',
            purpose: access.invitationPurpose,
            employeeId: access.employeeId,
            administrationId: null,
            managementRoleId,
            scopeType: 'TENANT',
          }),
        })
        : await fetch(`/api/invitations/${access.invitationId}/${action}`, { method: 'POST' })
      if (!response.ok) throw new Error('INVITATION_ACTION_FAILED')
      setMessage(labels.actionDone)
      router.refresh()
    } catch {
      setMessage(labels.actionFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Surface className="mt-6 space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-accent text-accent-foreground"><ShieldCheck aria-hidden="true" className="size-5" /></span>
          <div className="min-w-0"><h2 className="font-semibold">{labels.title}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.description}</p></div>
        </div>
        <Badge tone={statusTone(access.status)}>{statusLabel(access.status, labels)}</Badge>
      </div>
      <dl className="grid gap-4 text-sm sm:grid-cols-3">
        <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-[.1em] text-muted-foreground">{labels.recipient}</dt><dd className="mt-1 flex min-w-0 items-center gap-2 break-words"><Mail aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />{access.recipientEmail ?? labels.noEmail}</dd></div>
        <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-[.1em] text-muted-foreground">{labels.purpose}</dt><dd className="mt-1">{purposeLabel(access.invitationPurpose, labels)}</dd></div>
        <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-[.1em] text-muted-foreground">{labels.status}</dt><dd className="mt-1">{statusLabel(access.status, labels)}</dd></div>
      </dl>
      {access.invitationExpiresAt ? <p className="text-sm text-muted-foreground">{labels.expires.replace('{date}', dateLabel(access.invitationExpiresAt, locale))}</p> : null}
      <div className="flex flex-wrap gap-2">
        {access.canSend ? <Button disabled={busy || access.recipientEmail === null} loading={busy} onClick={() => void runAction('send')} size="sm" type="button"><Send aria-hidden="true" />{labels.send}</Button> : null}
        {access.canResend && access.invitationId ? <Button disabled={busy} loading={busy} onClick={() => void runAction('resend')} size="sm" type="button" variant="secondary"><RefreshCw aria-hidden="true" />{labels.resend}</Button> : null}
        {access.status === 'INVITED' && access.invitationId ? <Button disabled={busy} onClick={() => void runAction('revoke')} size="sm" type="button" variant="ghost"><X aria-hidden="true" />{labels.revoke}</Button> : null}
      </div>
      {message ? <p aria-live="polite" className="text-sm text-muted-foreground">{message}</p> : null}
    </Surface>
  )
}
