export type HeRaAudience = 'EMPLOYEE' | 'MANAGER' | 'HR'
export type HeRaLocale = 'nl' | 'en'

export interface HeRaPersona {
  audience: HeRaAudience
  instructions: string
}

export interface HeRaPersonaContext {
  activeRoles: string[]
  permissions: string[]
}

export interface HeRaContextMessage {
  role: 'USER' | 'ASSISTANT' | 'TOOL'
  content: string
}
