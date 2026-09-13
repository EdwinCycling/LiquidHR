'use client'

import { useMemo, useState } from 'react'
import { AccrualRuleEditor, type AccrualRuleEditorLabels } from './accrual-rule-editor'
import { profileHasCurrentRule } from './leave-rule-presentation'
import type { LeaveCatalog } from '@/lib/leave/leave-service'
import { Dialog } from '@/components/ui/dialog'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { FormField } from '@/components/patterns/form-field'

export type LeaveAccrualRuleDialogLabels = {
  addTitle: string
  editTitle: string
  addDescription: string
  editDescription: string
  profileLabel: string
  profilePlaceholder: string
  profileHelp: string
  typeLabel: string
  typePlaceholder: string
  typeHelp: string
  noProfiles: string
  noTypes: string
  alreadyLinked: string
  closeLabel: string
}

type Props = {
  catalog: LeaveCatalog
  labels: LeaveAccrualRuleDialogLabels
  ruleEditorLabels: AccrualRuleEditorLabels
  open: boolean
  onOpenChange: (open: boolean) => void
  initialProfileId?: string
  initialLeaveTypeId?: string
  ruleId?: string
  selectProfile?: boolean
  selectLeaveType?: boolean
  onSaved?: () => void
}

export function LeaveAccrualRuleDialog({ catalog, initialLeaveTypeId, initialProfileId, labels, onOpenChange, onSaved, open, ruleEditorLabels, ruleId, selectLeaveType = false, selectProfile = false }: Props) {
  const [profileId, setProfileId] = useState(initialProfileId ?? '')
  const [leaveTypeId, setLeaveTypeId] = useState(initialLeaveTypeId ?? '')
  const editing = Boolean(ruleId)

  const activeProfiles = useMemo(() => catalog.profiles.filter((profile) => profile.is_active), [catalog.profiles])
  const activeLeaveTypes = useMemo(() => catalog.leaveTypes.filter((type) => type.is_active), [catalog.leaveTypes])
  const availableLeaveTypes = useMemo(
    () => activeLeaveTypes.filter((type) => !profileId || !profileHasCurrentRule(catalog, profileId, type.id)),
    [activeLeaveTypes, catalog, profileId],
  )
  const selectedLeaveType = catalog.leaveTypes.find((type) => type.id === leaveTypeId)
  const alreadyLinked = !editing && Boolean(profileId && leaveTypeId && profileHasCurrentRule(catalog, profileId, leaveTypeId))
  const canEdit = Boolean(profileId && leaveTypeId) && !alreadyLinked

  function handleSaved(): void {
    onSaved?.()
    onOpenChange(false)
  }

  return <Dialog closeLabel={labels.closeLabel} description={editing ? labels.editDescription : labels.addDescription} onOpenChange={onOpenChange} open={open} panelClassName="max-w-4xl" title={editing ? labels.editTitle : labels.addTitle}>
    <div className="space-y-5">
      {selectProfile ? <FormField control={<DropdownSelect aria-label={labels.profileLabel} emptyLabel={labels.noProfiles} onChange={(event) => setProfileId(event.target.value)} placeholder={labels.profilePlaceholder} searchable searchPlaceholder={labels.profilePlaceholder} value={profileId}>{activeProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</DropdownSelect>} description={labels.profileHelp} label={labels.profileLabel} required /> : null}
      {selectLeaveType ? <FormField control={<DropdownSelect aria-label={labels.typeLabel} emptyLabel={labels.noTypes} onChange={(event) => setLeaveTypeId(event.target.value)} placeholder={labels.typePlaceholder} searchable searchPlaceholder={labels.typePlaceholder} value={leaveTypeId}>{availableLeaveTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</DropdownSelect>} description={labels.typeHelp} label={labels.typeLabel} required /> : null}
      {!canEdit ? <p className="rounded-[var(--radius-control)] border border-dashed border-border p-4 text-sm text-muted-foreground">{alreadyLinked ? labels.alreadyLinked : selectProfile && activeProfiles.length === 0 ? labels.noProfiles : selectLeaveType && availableLeaveTypes.length === 0 ? labels.noTypes : selectProfile ? labels.profilePlaceholder : labels.typePlaceholder}</p> : null}
      {canEdit ? <AccrualRuleEditor catalog={catalog} initialProfileId={profileId} key={`${profileId}-${leaveTypeId}-${ruleId ?? 'new'}`} labels={ruleEditorLabels} leaveTypeId={selectedLeaveType?.id} onCancel={() => onOpenChange(false)} onSaved={handleSaved} ruleId={ruleId} /> : null}
    </div>
  </Dialog>
}
