'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { DataTableShell } from '@/components/patterns/data-table-shell'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import type { LeaveCatalog } from '@/lib/leave/leave-service'
import type { AccrualRuleEditorLabels } from './accrual-rule-editor'
import { LeaveAccrualRuleDialog, type LeaveAccrualRuleDialogLabels } from './leave-accrual-rule-dialog'
import { currentRulesForProfile, type LeaveAccrualRule } from './leave-rule-presentation'
import { LeaveRuleSummary, type LeaveRuleSummaryLabels } from './leave-rule-summary'

type Labels = {
  title: string
  description: string
  add: string
  edit: string
  setDefault: string
  archive: string
  name: string
  descriptionField: string
  status: string
  default: string
  rules: string
  sets: string
  assignments: string
  active: string
  inactive: string
  empty: string
  emptyDescription: string
  noDefault: string
  noDefaultAction: string
  formCreate: string
  formEdit: string
  activeLabel: string
  defaultLabel: string
  defaultHelp: string
  save: string
  cancel: string
  saving: string
  failed: string
  defaultConfirmTitle: string
  defaultConfirm: string
  archiveConfirmTitle: string
  archiveConfirm: string
  archiveBlocked: string
  ruleSectionTitle: string
  addRule: string
  addRuleEmpty: string
  editRule: string
  emptyRules: string
  explainTitle: string
  explainDirect: string
  explainSet: string
  explainDefault: string
  explainNote: string
  defaultBadge: string
  ruleDialog: LeaveAccrualRuleDialogLabels
  ruleEditor: AccrualRuleEditorLabels
  ruleSummary: LeaveRuleSummaryLabels
}

type Draft = { id?: string; name: string; description: string; active: boolean; groupDefault: boolean }
type RuleEditorState = { profileId: string; leaveTypeId?: string; ruleId?: string }

export function LeaveProfileManagementPanel({ catalog, labels }: { catalog: LeaveCatalog; labels: Labels }) {
  const router = useRouter()
  const activeDefault = catalog.profiles.find((profile) => profile.is_active && profile.is_group_default)
  const [showInactive, setShowInactive] = useState(false)
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'failed'>('idle')
  const [draft, setDraft] = useState<Draft>({ name: '', description: '', active: true, groupDefault: !activeDefault })
  const [initialDraft, setInitialDraft] = useState<Draft>(draft)
  const [confirm, setConfirm] = useState<{ kind: 'default' | 'archive'; id: string } | null>(null)
  const [ruleEditor, setRuleEditor] = useState<RuleEditorState | null>(null)
  const profileSetCounts = useMemo(() => { const counts = new Map<string, number>(); for (const row of catalog.employeeSets) counts.set(row.leave_profile_id, (counts.get(row.leave_profile_id) ?? 0) + (row.is_active ? 1 : 0)); return counts }, [catalog.employeeSets])
  const profileAssignmentCounts = useMemo(() => { const counts = new Map<string, number>(); for (const row of catalog.employmentLeaveProfiles) counts.set(row.leave_profile_id, (counts.get(row.leave_profile_id) ?? 0) + 1); return counts }, [catalog.employmentLeaveProfiles])
  const rows = catalog.profiles.filter((profile) => showInactive || profile.is_active)

  function openCreate(): void { const next = { name: '', description: '', active: true, groupDefault: !activeDefault }; setDraft(next); setInitialDraft(next); setStatus('idle'); setOpen(true) }
  function openEdit(profile: LeaveCatalog['profiles'][number]): void { const next = { id: profile.id, name: profile.name, description: profile.description ?? '', active: profile.is_active, groupDefault: profile.is_group_default }; setDraft(next); setInitialDraft(next); setStatus('idle'); setOpen(true) }
  function close(): void { setOpen(false); setStatus('idle') }
  function openAddRule(profileId: string): void { setRuleEditor({ profileId }) }
  function openEditRule(profileId: string, rule: LeaveAccrualRule): void { setRuleEditor({ profileId, leaveTypeId: rule.leave_type_id, ruleId: rule.id }) }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!draft.name.trim()) { setStatus('failed'); return }
    setStatus('saving')
    try {
      const response = await fetch('/api/leave/catalog', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: draft.id ? 'UPDATE_PROFILE' : 'PROFILE', ...(draft.id ? { id: draft.id } : {}), name: draft.name.trim(), description: draft.description.trim() || null, isActive: draft.active, isGroupDefault: draft.groupDefault }) })
      if (!response.ok) throw new Error('LEAVE_PROFILE_SAVE_FAILED')
      close(); router.refresh()
    } catch { setStatus('failed') }
  }

  async function confirmAction(): Promise<void> {
    if (!confirm) return
    const action = confirm.kind === 'default' ? { action: 'SET_GROUP_DEFAULT', id: confirm.id } : { action: 'ARCHIVE_PROFILE', id: confirm.id }
    try { const response = await fetch('/api/leave/catalog', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(action) }); if (!response.ok) throw new Error('LEAVE_PROFILE_ACTION_FAILED'); setConfirm(null); router.refresh() } catch { setStatus('failed'); setConfirm(null) }
  }

  return <section className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-semibold">{labels.title}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.description}</p></div><Button onClick={openCreate} type="button">{labels.add}</Button></div>
    {!activeDefault ? <Surface className="flex flex-col gap-3 border-warning/50 bg-warning/5 p-4 sm:flex-row sm:items-center sm:justify-between" role="alert"><p className="text-sm">{labels.noDefault}</p>{catalog.profiles.find((profile) => profile.is_active) ? <Button onClick={() => setConfirm({ kind: 'default', id: catalog.profiles.find((profile) => profile.is_active)?.id ?? '' })} size="sm" type="button" variant="secondary">{labels.noDefaultAction}</Button> : null}</Surface> : null}
    {rows.length === 0 ? <EmptyState description={labels.emptyDescription} title={labels.empty} /> : <DataTableShell caption={labels.title}><thead className="bg-muted/40 text-xs uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-5 py-3">{labels.name}</th><th className="px-5 py-3">{labels.status}</th><th className="px-5 py-3">{labels.rules}</th><th className="px-5 py-3">{labels.sets}</th><th className="px-5 py-3">{labels.assignments}</th><th className="px-5 py-3" /></tr></thead><tbody className="divide-y divide-border-subtle">{rows.map((profile) => { const rules = currentRulesForProfile(catalog, profile.id); const setCount = profileSetCounts.get(profile.id) ?? 0; const assignmentCount = profileAssignmentCounts.get(profile.id) ?? 0; return <tr className={profile.is_active ? '' : 'opacity-60'} key={profile.id}><td className="px-5 py-4 align-top"><div className="font-semibold">{profile.name}</div><div className="mt-1 text-xs text-muted-foreground">{profile.description ?? '—'}</div>{profile.is_group_default ? <Badge className="mt-2" tone="info">{labels.defaultBadge}</Badge> : null}</td><td className="px-5 py-4 align-top"><Badge tone={profile.is_active ? 'success' : 'neutral'}>{profile.is_active ? labels.active : labels.inactive}</Badge></td><td className="min-w-[22rem] px-5 py-4 align-top"><div className="font-semibold text-foreground">{labels.ruleSectionTitle}</div>{rules.length === 0 ? <div className="mt-3 space-y-3"><p className="text-sm text-muted-foreground">{labels.emptyRules}</p><Button disabled={!profile.is_active} onClick={() => openAddRule(profile.id)} size="sm" type="button"><Plus aria-hidden="true" />{labels.addRuleEmpty}</Button></div> : <><div className="mt-3 space-y-3">{rules.map((rule) => { const leaveType = catalog.leaveTypes.find((type) => type.id === rule.leave_type_id); return leaveType ? <div className="rounded-[var(--radius-control)] border border-border-subtle bg-surface-raised p-3" key={rule.id}><div className="flex items-start justify-between gap-3"><LeaveRuleSummary labels={labels.ruleSummary} leaveType={leaveType} rule={rule} /><Button onClick={() => openEditRule(profile.id, rule)} size="sm" type="button" variant="secondary">{labels.editRule}</Button></div></div> : null })}</div><Button className="mt-3" disabled={!profile.is_active} onClick={() => openAddRule(profile.id)} size="sm" type="button"><Plus aria-hidden="true" />{labels.addRule}</Button></>}</td><td className="px-5 py-4 align-top">{setCount}</td><td className="px-5 py-4 align-top">{assignmentCount}</td><td className="px-5 py-4 align-top"><div className="flex flex-wrap justify-end gap-2"><Button onClick={() => openEdit(profile)} size="sm" type="button" variant="secondary">{labels.edit}</Button>{profile.is_active && !profile.is_group_default ? <Button onClick={() => setConfirm({ kind: 'default', id: profile.id })} size="sm" type="button" variant="secondary">{labels.setDefault}</Button> : null}<Button disabled={profile.is_group_default || setCount > 0 || !profile.is_active} onClick={() => setConfirm({ kind: 'archive', id: profile.id })} size="sm" type="button" variant="danger">{labels.archive}</Button></div>{profile.is_group_default || setCount > 0 ? <p className="mt-2 max-w-xs text-right text-xs text-muted-foreground">{labels.archiveBlocked}</p> : null}</td></tr> })}</tbody></DataTableShell>}
    <Checkbox checked={showInactive} label={labels.inactive} onChange={(event) => setShowInactive(event.target.checked)} />
    <Surface className="p-5"><h3 className="font-semibold">{labels.explainTitle}</h3><ol className="mt-3 space-y-2 text-sm"><li>{labels.explainDirect}</li><li>{labels.explainSet}</li><li>{labels.explainDefault}</li></ol><p className="mt-3 text-sm text-muted-foreground">{labels.explainNote}</p></Surface>
    <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.cancel} description={labels.description} dirty={JSON.stringify(draft) !== JSON.stringify(initialDraft)} dirtyProtection={{ description: labels.failed, discardLabel: labels.cancel, keepEditingLabel: labels.cancel, title: labels.cancel }} onDiscard={close} onOpenChange={(nextOpen) => { if (!nextOpen && JSON.stringify(draft) === JSON.stringify(initialDraft)) close() }} onSubmit={(event) => void save(event)} open={open} saveLabel={labels.save} saving={status === 'saving'} title={draft.id ? labels.formEdit : labels.formCreate}><FormField control={<TextInput maxLength={160} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} required value={draft.name} />} label={labels.name} required /><FormField control={<Textarea maxLength={500} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} value={draft.description} />} label={labels.descriptionField} /><Checkbox checked={draft.active} label={labels.activeLabel} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))} /><Checkbox checked={draft.groupDefault} disabled={Boolean(activeDefault && activeDefault.id !== draft.id)} label={labels.defaultLabel} onChange={(event) => setDraft((current) => ({ ...current, groupDefault: event.target.checked }))} /><p className="text-xs text-muted-foreground">{labels.defaultHelp}</p>{status === 'failed' ? <p className="text-sm text-destructive" role="alert">{labels.failed}</p> : null}</FormDrawer>
    <LeaveAccrualRuleDialog catalog={catalog} initialLeaveTypeId={ruleEditor?.leaveTypeId} initialProfileId={ruleEditor?.profileId} key={ruleEditor ? `${ruleEditor.profileId}-${ruleEditor.leaveTypeId ?? 'new'}-${ruleEditor.ruleId ?? 'add'}` : 'closed'} labels={labels.ruleDialog} onOpenChange={(nextOpen) => { if (!nextOpen) setRuleEditor(null) }} onSaved={() => { setRuleEditor(null); router.refresh() }} open={ruleEditor !== null} ruleEditorLabels={labels.ruleEditor} ruleId={ruleEditor?.ruleId} selectLeaveType={Boolean(ruleEditor && !ruleEditor.ruleId)} />
    <ConfirmDialog cancelLabel={labels.cancel} confirmLabel={confirm?.kind === 'archive' ? labels.archive : labels.setDefault} description={confirm?.kind === 'archive' ? labels.archiveConfirm : labels.defaultConfirm} onConfirm={() => void confirmAction()} onOpenChange={(nextOpen) => { if (!nextOpen) setConfirm(null) }} open={confirm !== null} title={confirm?.kind === 'archive' ? labels.archiveConfirmTitle : labels.defaultConfirmTitle} destructive={confirm?.kind === 'archive'} />
  </section>
}
