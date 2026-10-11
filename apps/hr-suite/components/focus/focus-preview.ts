import type { FocusActionKey } from '@/lib/focus/service'

export const focusPreviewSectionByAction = {
  journey: 'onboarding',
  profile: 'profiel',
  documents: 'documenten',
  leave: 'verlof',
  requests: 'aanvragen',
  work: 'werk',
  team: 'team',
} satisfies Partial<Record<FocusActionKey, string>>

export type FocusPreviewActionKey = keyof typeof focusPreviewSectionByAction

export function isFocusPreviewActionKey(action: FocusActionKey): action is FocusPreviewActionKey {
  return Object.hasOwn(focusPreviewSectionByAction, action)
}

export const focusActionByPreviewSection: Record<string, FocusPreviewActionKey> = {
  onboarding: 'journey',
  profiel: 'profile',
  documenten: 'documents',
  verlof: 'leave',
  aanvragen: 'requests',
  werk: 'work',
  team: 'team',
}

export function focusPreviewHref(employeeId: string, action?: FocusPreviewActionKey): string {
  const baseHref = `/focus/preview/${employeeId}`
  const section = action ? focusPreviewSectionByAction[action] : undefined
  return section ? `${baseHref}?section=${section}` : baseHref
}
