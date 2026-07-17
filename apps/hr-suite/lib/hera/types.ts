export type HeRaAudience = 'EMPLOYEE' | 'MANAGER' | 'HR'
export type HeRaLocale = 'nl' | 'en'
export type HeRaTone = 'FRIENDLY' | 'BUSINESS' | 'DIRECT'
export type HeRaDetailLevel = 'COMPACT' | 'BALANCED' | 'EXTENDED'
export type HeRaSeniorityLevel = 'BASIC' | 'EXPERIENCED' | 'EXPERT'
export type HeRaMemoryCategory = 'PREFERENCE' | 'WORKING_CONTEXT'

export interface HeRaMemoryItem {
  id: string
  category: HeRaMemoryCategory
  content: string
}

export interface HeRaUserContext {
  locale: HeRaLocale
  timeZone: string
  tone: HeRaTone
  detailLevel: HeRaDetailLevel
  seniorityLevel: HeRaSeniorityLevel
  memory: HeRaMemoryItem[]
}

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
