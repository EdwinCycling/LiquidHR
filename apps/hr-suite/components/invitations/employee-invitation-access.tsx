'use client'

import { Eye, Mail, RefreshCw, Send, ShieldCheck, Trash2, UnlockKeyhole, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
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
  blocked: string
  noEmail: string
  notEligible: string
  employmentRequired: string
  expires: string
  send: string
  resend: string
  revoke: string
  working: string
  actionFailed: string
  actionDone: string
  cancel: string
  blockConfirmTitle: string
  blockConfirmDescription: string
  lastLogin: string
  neverLoggedIn: string
  block: string
  unblock: string
  preview: string
  previewFailed: string
}

function statusLabel(status: InvitationLifecycleStatus, labels: EmployeeInvitationAccessLabels): string {
  return {
    NOT_ACTIVATED: labels.notActivated,
    INVITED: labels.invited,
    ACTIVE: labels.active,
    EXPIRED: labels.expired,
    REVOKED: labels.revoked,
    BLOCKED: labels.blocked,
  }[status]
}

function statusTone(status: InvitationLifecycleStatus): BadgeTone {
  if (status === 'ACTIVE') return 'success'
  if (status === 'INVITED') return 'info'
  if (status === 'EXPIRED') return 'warning'
  if (status === 'REVOKED') return 'danger'
  if (status === 'BLOCKED') return 'danger'
  return 'neutral'
}

function purposeLabel(purpose: InvitationPurpose | null, eligible: boolean, labels: EmployeeInvitationAccessLabels): string {
  if (!eligible || purpose === null) return labels.notEligible
  return purpose === 'PREBOARDING_EMPLOYEE' ? labels.preboarding : labels.employeeActivation
}

function dateLabel(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', { dateStyle: 'medium' }).format(new Date(value))
}

export function EmployeeInvitationAccess({
  access,
  locale,
  labels,
}: {
  access: EmployeeInvitationAccess
  locale: Locale
  labels: EmployeeInvitationAccessLabels
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [blockOpen, setBlockOpen] = useState(false)

  async function runAction(action: 'send' | 'resend' | 'revoke' | 'block' | 'unblock' | 'preview'): Promise<void> {
    if (busy) return
    setBusy(true)
    setMessage(null)
    try {
      if (action === 'preview') {
        const response = await fetch('/api/focus/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeId: access.employeeId }),
        })
        if (!response.ok) throw new Error('PREVIEW_ACTION_FAILED')
        const previewWindow = window.open(`/focus/preview/${access.employeeId}`, '_blank', 'noopener,noreferrer')
        if (!previewWindow) throw new Error('PREVIEW_ACTION_FAILED')
        setMessage(labels.actionDone)
        return
      }
      const response = action === 'send'
        ? await fetch('/api/invitations/employee', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeId: access.employeeId,
          }),
        })
        : action === 'block' || action === 'unblock'
          ? await fetch(`/api/employees/${access.employeeId}/ess-access`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: action === 'block' ? 'BLOCKED' : 'ACTIVE' }) })
          : await fetch(`/api/invitations/${access.invitationId}/${action}`, { method: 'POST' })
      if (!response.ok) throw new Error('INVITATION_ACTION_FAILED')
      setMessage(labels.actionDone)
      if (action === 'block') setBlockOpen(false)
      router.refresh()
    } catch {
      setMessage(action === 'preview' ? labels.previewFailed : labels.actionFailed)
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
      <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-[.1em] text-muted-foreground">{labels.recipient}</dt><dd className="mt-1 flex min-w-0 items-start gap-2"><Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 break-all">{access.recipientEmail ?? labels.noEmail}</span></dd></div>
        <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-[.1em] text-muted-foreground">{labels.purpose}</dt><dd className="mt-1 break-words">{purposeLabel(access.invitationPurpose, access.invitationEligibility === 'ELIGIBLE', labels)}</dd></div>
        <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-[.1em] text-muted-foreground">{labels.status}</dt><dd className="mt-1">{statusLabel(access.status, labels)}</dd></div>
        <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-[.1em] text-muted-foreground">{labels.lastLogin}</dt><dd className="mt-1">{access.lastLoginAt ? dateLabel(access.lastLoginAt, locale) : labels.neverLoggedIn}</dd></div>
      </dl>
      {access.invitationEligibility !== 'ELIGIBLE' ? <p className="text-sm text-warning">{labels.employmentRequired}</p> : null}
      {access.invitationExpiresAt ? <p className="text-sm text-muted-foreground">{labels.expires.replace('{date}', dateLabel(access.invitationExpiresAt, locale))}</p> : null}
      <div className="flex flex-wrap gap-2">
        {access.canSend ? <Button disabled={busy || access.recipientEmail === null} loading={busy} onClick={() => void runAction('send')} size="sm" type="button"><Send aria-hidden="true" />{labels.send}</Button> : null}
        {access.canResend && access.invitationId ? <Button disabled={busy} loading={busy} onClick={() => void runAction('resend')} size="sm" type="button" variant="secondary"><RefreshCw aria-hidden="true" />{labels.resend}</Button> : null}
        {access.status === 'INVITED' && access.invitationId ? <Button disabled={busy} onClick={() => void runAction('revoke')} size="sm" type="button" variant="ghost"><X aria-hidden="true" />{labels.revoke}</Button> : null}
        {access.canBlock ? <IconButton aria-busy={busy || undefined} disabled={busy} label={labels.block} onClick={() => setBlockOpen(true)} size="sm" title={labels.block} variant="ghost" className="border border-border/70 text-destructive hover:bg-destructive-surface hover:text-destructive"><Trash2 aria-hidden="true" /></IconButton> : null}
        {access.canUnblock ? <Button disabled={busy} onClick={() => void runAction('unblock')} size="sm" type="button" variant="secondary"><UnlockKeyhole aria-hidden="true" />{labels.unblock}</Button> : null}
        {access.canPreview ? <Button disabled={busy} onClick={() => void runAction('preview')} size="sm" type="button" variant="ghost"><Eye aria-hidden="true" />{labels.preview}</Button> : null}
      </div>
      {message ? <p aria-live="polite" className="text-sm text-muted-foreground">{message}</p> : null}
      <ConfirmDialog cancelLabel={labels.cancel} confirmLabel={labels.block} description={labels.blockConfirmDescription} destructive onConfirm={() => runAction('block')} onOpenChange={setBlockOpen} open={blockOpen} pending={busy} title={labels.blockConfirmTitle} />
    </Surface>
  )
}
