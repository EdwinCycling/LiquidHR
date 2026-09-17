'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Mail, RefreshCw, Search, Send, ShieldCheck, UserPlus, X } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import type { InvitationCandidate, InvitationListItem } from '@/lib/auth/invitation-management'
import type { BulkInvitationSummary } from '@/lib/auth/bulk-invitations'
import type { InvitationLifecycleStatus } from '@/lib/auth/invitation-lifecycle'
import type { Locale } from '@/lib/i18n/config'

export interface InvitationWizardLabels {
  stepsLabel: string
  stepSelect: string
  stepReview: string
  stepResult: string
  search: string
  searchPlaceholder: string
  statusFilter: string
  allStatuses: string
  selectAll: string
  clearAll: string
  selectedCount: string
  noCandidates: string
  noEmail: string
  alreadyActive: string
  notActivated: string
  invited: string
  expired: string
  revoked: string
  continue: string
  reviewTitle: string
  reviewDescription: string
  recipient: string
  purpose: string
  preboarding: string
  employeeActivation: string
  language: string
  languageDutch: string
  languageEnglish: string
  mailPreviewTitle: string
  mailPreviewDescription: string
  mailPreviewSubject: string
  mailPreviewBody: string
  mailPreviewSecurityNote: string
  editableIntroductionDeferred: string
  fixedSecurity: string
  send: string
  sending: string
  back: string
  resultTitle: string
  sent: string
  notSent: string
  resultSuccess: string
  resultFailed: string
  restart: string
  existingTitle: string
  existingEmpty: string
  expires: string
  resend: string
  revoke: string
  working: string
  actionFailed: string
  actionDone: string
  mailPreview: Record<'nl' | 'en', MailPreviewCopy>
}

interface InvitationWizardProps {
  candidates: readonly InvitationCandidate[]
  invitations: readonly InvitationListItem[]
  managementRoleId: string
  labels: InvitationWizardLabels
  locale: Locale
}

interface MailPreviewCopy {
  subject: string
  body: string
}

type WizardStep = 1 | 2 | 3

const statusOrder: InvitationLifecycleStatus[] = ['NOT_ACTIVATED', 'INVITED', 'EXPIRED', 'REVOKED', 'ACTIVE']

function statusLabel(status: InvitationLifecycleStatus, labels: InvitationWizardLabels): string {
  return {
    NOT_ACTIVATED: labels.notActivated,
    INVITED: labels.invited,
    EXPIRED: labels.expired,
    ACTIVE: labels.alreadyActive,
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

function dateLabel(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', { dateStyle: 'medium' }).format(new Date(value))
}

function candidateLanguage(candidate: InvitationCandidate): 'nl' | 'en' {
  return candidate.language.toLowerCase().startsWith('en') ? 'en' : 'nl'
}

function failureLabel(code: string | undefined, labels: InvitationWizardLabels): string {
  if (!code) return labels.actionFailed
  const normalized = code.toLowerCase().replaceAll('_', ' ')
  return labels.resultFailed.replace('{code}', normalized)
}

export function InvitationWizard({ candidates, invitations: initialInvitations, managementRoleId, labels, locale }: InvitationWizardProps) {
  const [step, setStep] = useState<WizardStep>(1)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'ALL' | InvitationLifecycleStatus>('ALL')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState<BulkInvitationSummary | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const filteredCandidates = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return candidates.filter((candidate) => {
      const matchesQuery = !normalizedQuery || `${candidate.name} ${candidate.email ?? ''}`.toLocaleLowerCase().includes(normalizedQuery)
      return matchesQuery && (status === 'ALL' || candidate.status === status)
    })
  }, [candidates, query, status])

  const selectedCandidates = candidates.filter((candidate) => selected.has(candidate.id))
  const selectableCandidates = filteredCandidates.filter((candidate) => candidate.status !== 'ACTIVE' && candidate.email)
  const selectedByLanguage = useMemo(() => {
    const groups = new Map<'nl' | 'en', InvitationCandidate[]>()
    for (const candidate of selectedCandidates) {
      const language = candidateLanguage(candidate)
      groups.set(language, [...(groups.get(language) ?? []), candidate])
    }
    return groups
  }, [selectedCandidates])

  function toggleCandidate(candidate: InvitationCandidate): void {
    if (candidate.status === 'ACTIVE' || !candidate.email) return
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(candidate.id)) next.delete(candidate.id)
      else next.add(candidate.id)
      return next
    })
  }

  function selectAll(): void {
    setSelected((current) => {
      const next = new Set(current)
      for (const candidate of selectableCandidates) next.add(candidate.id)
      return next
    })
  }

  async function sendInvitations(): Promise<void> {
    setBusy(true)
    setActionMessage(null)
    try {
      const response = await fetch('/api/invitations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selectedCandidates.flatMap((candidate) => candidate.email ? [{
            email: candidate.email,
            emailKind: 'PRIVATE',
            purpose: candidate.invitationPurpose,
            employeeId: candidate.id,
            administrationId: null,
            managementRoleId,
            scopeType: 'TENANT',
          }] : []),
        }),
      })
      const payload = await response.json() as { data?: BulkInvitationSummary; error?: { code?: string } }
      if (!response.ok || !payload.data) throw new Error(payload.error?.code ?? 'UNKNOWN')
      setSummary(payload.data)
      setStep(3)
    } catch {
      setActionMessage(labels.actionFailed)
    } finally {
      setBusy(false)
    }
  }

  async function invitationAction(id: string, action: 'resend' | 'revoke'): Promise<void> {
    setBusy(true)
    setActionMessage(null)
    try {
      const response = await fetch(`/api/invitations/${id}/${action}`, { method: 'POST' })
      if (!response.ok) throw new Error('action')
      setActionMessage(labels.actionDone)
      window.location.reload()
    } catch {
      setActionMessage(labels.actionFailed)
    } finally {
      setBusy(false)
    }
  }

  function restart(): void {
    setSelected(new Set())
    setSummary(null)
    setActionMessage(null)
    setStep(1)
  }

  return (
    <div className="space-y-6">
      <div aria-label={labels.stepsLabel} className="grid gap-2 sm:grid-cols-3">
        {[1, 2, 3].map((item) => <div className={`flex items-center gap-2 rounded-[var(--radius-control)] border px-3 py-2 text-sm ${step === item ? 'border-primary bg-accent text-accent-foreground' : 'border-border-subtle text-muted-foreground'}`} key={item}><span className="grid size-6 place-items-center rounded-full bg-surface-raised text-xs font-semibold">{item}</span><span>{item === 1 ? labels.stepSelect : item === 2 ? labels.stepReview : labels.stepResult}</span></div>)}
      </div>

      {step === 1 ? <Surface className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-sm font-medium" htmlFor="invitation-search">{labels.search}<TextInput id="invitation-search" leadingIcon={<Search />} onChange={(event) => setQuery(event.target.value)} placeholder={labels.searchPlaceholder} value={query} /></label>
          <label className="text-sm font-medium" htmlFor="invitation-status">{labels.statusFilter}<select className="mt-1 min-h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-focus sm:w-52" id="invitation-status" onChange={(event) => setStatus(event.target.value as 'ALL' | InvitationLifecycleStatus)} value={status}><option value="ALL">{labels.allStatuses}</option>{statusOrder.map((item) => <option key={item} value={item}>{statusLabel(item, labels)}</option>)}</select></label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4"><span className="text-sm text-muted-foreground">{labels.selectedCount.replace('{count}', String(selected.size))}</span><div className="flex flex-wrap gap-2"><Button onClick={selectAll} size="sm" type="button" variant="secondary"><Check aria-hidden="true" />{labels.selectAll}</Button><Button onClick={() => setSelected(new Set())} size="sm" type="button" variant="ghost"><X aria-hidden="true" />{labels.clearAll}</Button></div></div>
        {filteredCandidates.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{labels.noCandidates}</p> : <ul className="divide-y divide-border-subtle">{filteredCandidates.map((candidate) => {
          const disabled = candidate.status === 'ACTIVE' || !candidate.email
          return <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0" key={candidate.id}><input aria-label={candidate.name} checked={selected.has(candidate.id)} className="mt-1 size-4 accent-primary" disabled={disabled} onChange={() => toggleCandidate(candidate)} type="checkbox" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-medium text-foreground">{candidate.name}</span><Badge tone={statusTone(candidate.status)}>{statusLabel(candidate.status, labels)}</Badge></div><p className="mt-1 truncate text-sm text-muted-foreground">{candidate.email ?? labels.noEmail}</p></div></li>
        })}</ul>}
        <div className="flex justify-end"><Button disabled={selected.size === 0} onClick={() => setStep(2)} type="button">{labels.continue}<ChevronRight aria-hidden="true" /></Button></div>
      </Surface> : null}

      {step === 2 ? <Surface className="space-y-5 p-4 sm:p-6">
        <div><h2 className="text-lg font-semibold">{labels.reviewTitle}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.reviewDescription}</p></div>
        <div className="space-y-5">
          {Array.from(selectedByLanguage.entries()).map(([language, group]) => <section className="space-y-3" key={language}>
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{labels.language}: {language === 'en' ? labels.languageEnglish : labels.languageDutch}</h3><Badge tone="neutral">{group.length}</Badge></div>
            {group.map((candidate) => <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border-subtle p-3" key={candidate.id}><div className="flex min-w-0 items-center gap-3"><UserPlus aria-hidden="true" className="size-5 shrink-0 text-primary" /><div className="min-w-0"><p className="truncate font-medium">{candidate.name}</p><p className="truncate text-sm text-muted-foreground">{candidate.email}</p></div></div><Badge tone="info">{candidate.invitationPurpose === 'PREBOARDING_EMPLOYEE' ? labels.preboarding : labels.employeeActivation}</Badge></div>)}
          </section>)}
        </div>
        {Array.from(selectedByLanguage.entries()).map(([language, group]) => {
          const copy: MailPreviewCopy = labels.mailPreview[language]
          const representative = group[0]
          return <Surface className="space-y-3 p-4" key={`mail-preview-${language}`} variant="subtle">
            <div className="flex items-start gap-3"><Mail aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" /><div><h3 className="font-semibold">{labels.mailPreviewTitle} · {language === 'en' ? labels.languageEnglish : labels.languageDutch}</h3><p className="mt-1 text-sm text-muted-foreground">{labels.mailPreviewDescription}</p></div></div>
            <dl className="space-y-2 text-sm"><div><dt className="text-xs font-semibold uppercase tracking-[.1em] text-muted-foreground">{labels.recipient}</dt><dd className="mt-1 break-words">{group.map((candidate) => candidate.email).join(', ')}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-[.1em] text-muted-foreground">{labels.mailPreviewSubject}</dt><dd className="mt-1 font-medium">{copy.subject}</dd></div></dl>
            <p aria-label={labels.mailPreviewBody} className="whitespace-pre-wrap rounded-[var(--radius-control)] border border-border-subtle bg-surface p-3 text-sm text-foreground">{copy.body.replace('{name}', representative.name)}</p>
            <p className="text-xs text-muted-foreground">{labels.mailPreviewSecurityNote}</p>
            <p className="text-xs text-muted-foreground">{labels.editableIntroductionDeferred}</p>
          </Surface>
        })}
        <div className="flex items-start gap-3 rounded-[var(--radius-control)] border border-info-border bg-info-surface p-3 text-sm text-info"><ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" /><span>{labels.fixedSecurity}</span></div>
        <div className="flex flex-wrap justify-between gap-2"><Button onClick={() => setStep(1)} type="button" variant="secondary"><ChevronLeft aria-hidden="true" />{labels.back}</Button><Button disabled={busy} loading={busy} onClick={() => void sendInvitations()} type="button"><Send aria-hidden="true" />{busy ? labels.sending : labels.send}</Button></div>
      </Surface> : null}

      {step === 3 && summary ? <Surface className="space-y-5 p-4 sm:p-6"><div><h2 className="text-lg font-semibold">{labels.resultTitle}</h2><div className="mt-2 flex flex-wrap gap-2"><Badge tone="success">{labels.sent}: {summary.succeeded}</Badge><Badge tone={summary.failed ? 'warning' : 'neutral'}>{labels.notSent}: {summary.failed}</Badge></div></div><ul className="divide-y divide-border-subtle">{summary.results.map((result) => <li className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0" key={`${result.email}-${result.invitationId ?? result.errorCode ?? 'failed'}`}><span className="flex min-w-0 items-center gap-2 text-sm"><Mail aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /><span className="truncate">{result.email}</span></span>{result.ok ? <span className="text-sm text-success">{labels.resultSuccess}</span> : <span className="text-sm text-destructive">{failureLabel(result.errorCode, labels)}</span>}</li>)}</ul><Button onClick={restart} type="button" variant="secondary"><RefreshCw aria-hidden="true" />{labels.restart}</Button></Surface> : null}

      {actionMessage ? <p aria-live="polite" className="text-sm text-muted-foreground">{actionMessage}</p> : null}

      <Surface className="space-y-4 p-4 sm:p-6"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{labels.existingTitle}</h2><Badge tone="neutral">{initialInvitations.length}</Badge></div>{initialInvitations.length === 0 ? <p className="text-sm text-muted-foreground">{labels.existingEmpty}</p> : <ul className="divide-y divide-border-subtle">{initialInvitations.map((invitation) => <li className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between" key={invitation.id}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="truncate font-medium">{invitation.email}</span><Badge tone={statusTone(invitation.status)}>{statusLabel(invitation.status, labels)}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{labels.expires.replace('{date}', dateLabel(invitation.expiresAt, locale))}</p></div><div className="flex flex-wrap gap-2">{invitation.canResend ? <Button disabled={busy} onClick={() => void invitationAction(invitation.id, 'resend')} size="sm" type="button" variant="secondary"><RefreshCw aria-hidden="true" />{labels.resend}</Button> : null}{invitation.status === 'INVITED' ? <Button disabled={busy} onClick={() => void invitationAction(invitation.id, 'revoke')} size="sm" type="button" variant="ghost"><X aria-hidden="true" />{labels.revoke}</Button> : null}</div></li>)}</ul>}</Surface>
    </div>
  )
}
