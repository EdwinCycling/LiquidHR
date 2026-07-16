import { SUPPORTED_LOCALES, type Locale } from './config'

export type MessageTree = {
  readonly [key: string]: string | MessageTree
}

export type TranslationValues = Readonly<Record<string, string | number>>
export type Translator = (key: string, values?: TranslationValues) => string

export function isLocale(value: string): value is Locale {
  return SUPPORTED_LOCALES.some((locale) => locale === value)
}

function readMessage(messages: MessageTree, key: string): string | undefined {
  let current: string | MessageTree = messages

  for (const part of key.split('.')) {
    if (typeof current === 'string') return undefined
    const next: string | MessageTree | undefined = current[part]
    if (next === undefined) return undefined
    current = next
  }

  return typeof current === 'string' ? current : undefined
}

export function createTranslator(messages: MessageTree): Translator {
  return (key, values = {}) => {
    const message = readMessage(messages, key)
    if (message === undefined) throw new Error(`I18N_MESSAGE_MISSING:${key}`)

    return message.replace(/\{([a-zA-Z0-9_]+)\}/g, (placeholder, name: string) => {
      const replacement = values[name]
      return replacement === undefined ? placeholder : String(replacement)
    })
  }
}
