'use client'

import { useActionState, useEffect, useId, useRef } from 'react'
import { createPlatformHrGroup, updatePlatformHrGroup, type ControlActionState } from '@/lib/control/actions'
import type { HrGroup } from '@/lib/control/schemas'
import { getDictionary } from '@/lib/i18n/dictionary'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/patterns/form-field'
import { SidePanel } from '@/components/ui/side-panel'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'

const initialState: ControlActionState = { code: 'idle' }

export type HrGroupPanelState =
  | { kind: 'create'; tenantId: string }
  | { kind: 'edit'; tenantId: string; group: HrGroup }

export function HrGroupFormPanel({ panel, onClose, onSaved }: {
  panel: HrGroupPanelState
  onClose: () => void
  onSaved: (kind: HrGroupPanelState['kind']) => void
}) {
  const labels = getDictionary().tenant
  const action = panel.kind === 'edit' ? updatePlatformHrGroup : createPlatformHrGroup
  const [state, formAction, pending] = useActionState(action, initialState)
  const formId = useId()
  const handledSuccess = useRef(false)

  useEffect(() => {
    if (state.code === 'success' && !handledSuccess.current) {
      handledSuccess.current = true
      onSaved(panel.kind)
    }
  }, [onSaved, panel.kind, state.code])

  const isEdit = panel.kind === 'edit'
  const title = isEdit ? labels.hrGroupEditPanelTitle : labels.hrGroupCreatePanelTitle
  const description = isEdit ? labels.hrGroupEditPanelHint : labels.hrGroupCreatePanelHint

  return (
    <SidePanel
      closeLabel={labels.hrGroupClosePanel}
      description={description}
      footer={(
        <>
          <Button onClick={onClose} type="button" variant="secondary">{labels.hrGroupCancel}</Button>
          <Button form={formId} loading={pending} type="submit">
            {pending ? labels.hrGroupSaving : isEdit ? labels.hrGroupSave : labels.hrGroupCreate}
          </Button>
        </>
      )}
      onClose={onClose}
      title={title}
    >
      <form action={formAction} className="space-y-5" id={formId}>
        <input name="tenantId" type="hidden" value={panel.tenantId} />
        {isEdit ? <input name="hrGroupId" type="hidden" value={panel.group.id} /> : null}
        {isEdit ? (
          <FormField label={labels.hrGroupCode}>
            <div className="rounded-[var(--radius-control)] border border-border bg-surface-subtle px-3 py-2.5 text-sm font-medium">{panel.group.code}</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{labels.hrGroupCodeImmutableHint}</p>
          </FormField>
        ) : (
          <FormField label={labels.hrGroupCode}>
            <TextInput autoComplete="off" maxLength={80} name="code" required />
          </FormField>
        )}
        <FormField label={labels.hrGroupName}>
          <TextInput autoComplete="off" defaultValue={isEdit ? panel.group.name : undefined} maxLength={160} name="name" required />
        </FormField>
        <FormField label={labels.hrGroupDescription}>
          <Textarea defaultValue={isEdit ? panel.group.description ?? '' : undefined} maxLength={1000} name="description" rows={4} />
        </FormField>
        {state.code === 'invalid' ? <p className="rounded-[var(--radius-control)] bg-destructive-subtle px-4 py-3 text-sm text-destructive" role="alert">{isEdit ? labels.hrGroupUpdateInvalid : labels.hrGroupInvalid}</p> : null}
        {state.code === 'failed' ? <p className="rounded-[var(--radius-control)] bg-destructive-subtle px-4 py-3 text-sm text-destructive" role="alert">{isEdit ? labels.hrGroupUpdateFailed : labels.hrGroupFailed}</p> : null}
      </form>
    </SidePanel>
  )
}