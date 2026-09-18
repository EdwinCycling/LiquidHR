import type { FocusActionKey } from '@/lib/focus/service'

export const focusPreviewSectionByAction: Record<FocusActionKey, string> = {
  journey: 'onboarding',
  profile: 'profiel',
  documents: 'documenten',
  leave: 'verlof',
  requests: 'aanvragen',
  work: 'werk',
  team: 'team',
}

export const focusActionByPreviewSection: Record<string, FocusActionKey> = {
  onboarding: 'journey',
  profiel: 'profile',
  documenten: 'documents',
  verlof: 'leave',
  aanvragen: 'requests',
  werk: 'work',
  team: 'team',
}

export function focusPreviewHref(employeeId: string, action?: FocusActionKey): string {
  const baseHref = `/focus/preview/${employeeId}`
  return action ? `${baseHref}?section=${focusPreviewSectionByAction[action]}` : baseHref
}
