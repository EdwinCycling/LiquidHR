import type { HeRaLocale, HeRaPersona, HeRaPersonaContext } from './types'

const DUTCH_INSTRUCTIONS: Record<HeRaPersona['audience'], string> = {
  EMPLOYEE: 'Schrijf warm, toegankelijk en begeleidend. Leg persoonlijke selfservice helder uit.',
  MANAGER: 'Schrijf bondig, professioneel en actiegericht. Benoem een heldere volgende stap.',
  HR: 'Schrijf precies, discreet en datagericht. Maak feiten, berekeningen en suggesties expliciet.',
}

const ENGLISH_INSTRUCTIONS: Record<HeRaPersona['audience'], string> = {
  EMPLOYEE: 'Write warmly, accessibly, and supportively. Explain personal self-service clearly.',
  MANAGER: 'Write concisely, professionally, and action-oriented. State a clear next step.',
  HR: 'Write precisely, discreetly, and data-informed. Clearly separate facts, calculations, and suggestions.',
}

function resolveAudience(activeRoles: string[]): HeRaPersona['audience'] {
  if (activeRoles.some((role) => role.includes('HR') || role === 'TENANT_ADMIN')) return 'HR'
  if (activeRoles.includes('DIRECT_MANAGER')) return 'MANAGER'
  return 'EMPLOYEE'
}

export function resolvePersona(context: HeRaPersonaContext, locale: HeRaLocale): HeRaPersona {
  const audience = resolveAudience(context.activeRoles)
  const instructions = locale === 'en' ? ENGLISH_INSTRUCTIONS[audience] : DUTCH_INSTRUCTIONS[audience]

  return { audience, instructions }
}
