'use server'

import { redirect } from 'next/navigation'
import { AuthenticationError, AuthorizationError } from '@/lib/auth/permissions'
import { ContextAuthenticationError } from '@/lib/context/server-context'
import { ContextAccessError } from '@/lib/context/administration-context'
import {
  copySystemComponent,
  previewComponentDraft,
  saveComponentDraft,
  validateComponentDraft,
} from '@/lib/payroll/component-library'
import type { ComponentEditorPayload } from '@/lib/payroll/component-editor-contract'

export async function copySystemComponentAction(formData: FormData): Promise<never> {
  let destination = '/payroll-components?error=copy-failed'
  try {
    // Reject additional fields rather than allowing client-owned scope/definition overrides.
    const fields = Array.from(formData.keys()).filter(key => !key.startsWith('$ACTION_'))
    const catalogKey = formData.get('catalogKey')
    if (fields.length === 1 && fields[0] === 'catalogKey' && typeof catalogKey === 'string' && catalogKey.length <= 300) {
      const draft = await copySystemComponent(catalogKey)
      if (/^[0-9a-f-]{36}$/i.test(draft.id)) {
        destination = `/payroll-components?component=${encodeURIComponent(`draft::${draft.id}`)}&ownership=customer&edit=1&copied=1`
      }
    }
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof ContextAuthenticationError) destination = '/login'
    else if (error instanceof AuthorizationError || error instanceof ContextAccessError) destination = '/geen-toegang'
    // Errors intentionally contain no database or definition payload in the redirect.
  }
  redirect(destination)
}

export async function validateComponentDraftAction(payload: ComponentEditorPayload) {
  try {
    return await validateComponentDraft(payload)
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof ContextAuthenticationError) redirect('/login')
    if (error instanceof AuthorizationError || error instanceof ContextAccessError) redirect('/geen-toegang')
    return { valid: false, issues: ['COMPONENT_EDITOR_ACTION_FAILED'] }
  }
}

export async function previewComponentDraftAction(payload: ComponentEditorPayload) {
  try {
    return await previewComponentDraft(payload)
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof ContextAuthenticationError) redirect('/login')
    if (error instanceof AuthorizationError || error instanceof ContextAccessError) redirect('/geen-toegang')
    return { valid: false, issues: ['COMPONENT_EDITOR_ACTION_FAILED'] }
  }
}

export async function saveComponentDraftAction(payload: ComponentEditorPayload) {
  try {
    return await saveComponentDraft(payload)
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof ContextAuthenticationError) redirect('/login')
    if (error instanceof AuthorizationError || error instanceof ContextAccessError) redirect('/geen-toegang')
    return { ok: false as const, issues: ['COMPONENT_EDITOR_SAVE_FAILED'] }
  }
}
