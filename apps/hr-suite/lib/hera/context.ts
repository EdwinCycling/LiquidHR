import type { HeRaContextMessage } from './types'

interface BuildModelContextInput {
  summary: string | null
  messages: HeRaContextMessage[]
  maxCharacters: number
}

function formatMessage(message: HeRaContextMessage): string {
  return `${message.role}: ${message.content.trim()}`
}

export function buildModelContext({ summary, messages, maxCharacters }: BuildModelContextInput): string {
  const boundedBudget = Math.max(1, maxCharacters)
  const sections: string[] = []
  let remaining = boundedBudget

  if (summary?.trim()) {
    const prefix = 'Samenvatting: '
    const available = Math.max(0, remaining - prefix.length)
    const boundedSummary = summary.trim().slice(0, available)
    const section = `${prefix}${boundedSummary}`
    sections.push(section)
    remaining -= section.length
  }

  for (const message of [...messages].reverse()) {
    if (remaining <= 0) break
    const formatted = formatMessage(message)
    const separator = sections.length > 0 ? '\n' : ''
    if (formatted.length + separator.length <= remaining) {
      sections.push(`${separator}${formatted}`)
      remaining -= formatted.length + separator.length
    }
  }

  return sections.reverse().join('').slice(0, boundedBudget)
}

export function isMemoryCandidate(content: string): boolean {
  return extractMemoryProposal(content) !== null
}

export interface HeRaMemoryProposal {
  operation: 'CREATE'
  category: 'PREFERENCE'
  content: string
}

function capitalize(value: string): string {
  return value.length === 0 ? value : `${value[0].toLocaleUpperCase('nl-NL')}${value.slice(1)}`
}

export function extractMemoryProposal(content: string): HeRaMemoryProposal | null {
  const trimmed = content.trim()
  const normalized = trimmed.toLocaleLowerCase('nl-NL')
  const prefixes = ['ik geef de voorkeur aan ', 'onthoud dat ', 'onthoud ']
  const prefix = prefixes.find((candidate) => normalized.startsWith(candidate))
  if (!prefix) return null
  const preference = capitalize(trimmed.slice(prefix.length).trim())
  if (preference.length === 0 || preference.length > 1_000) return null
  return { operation: 'CREATE', category: 'PREFERENCE', content: preference }
}
