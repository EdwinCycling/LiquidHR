import type { XmlElement } from './secure-xml'
import { getChild } from './secure-xml'

export class XmlProfileError extends Error {
  constructor(
    readonly code: 'MALFORMED_VALUE' | 'SOURCE_CONTRACT_UNSUPPORTED' | 'IDENTIFIER_PROTECTION_REQUIRED',
    message: string,
    readonly path?: string,
  ) {
    super(message)
    this.name = 'XmlProfileError'
  }
}
export function requireChild(element: XmlElement, localName: string, namespaceUri: string): XmlElement {
  const child = getChild(element, localName)
  if (!child) throw new XmlProfileError('SOURCE_CONTRACT_UNSUPPORTED', `Verplicht element ontbreekt: ${localName}`, element.sourcePath)
  if (child.namespaceUri !== namespaceUri) throw new XmlProfileError('SOURCE_CONTRACT_UNSUPPORTED', `Element gebruikt een onverwachte namespace: ${localName}`, child.sourcePath)
  return child
}

export function optionalChild(element: XmlElement, localName: string, namespaceUri: string): XmlElement | undefined {
  const child = getChild(element, localName)
  if (!child) return undefined
  if (child.namespaceUri !== namespaceUri) throw new XmlProfileError('SOURCE_CONTRACT_UNSUPPORTED', `Element gebruikt een onverwachte namespace: ${localName}`, child.sourcePath)
  return child
}

export function textValue(element: XmlElement, field: string, options: { minLength?: number; maxLength?: number } = {}): string {
  const value = element.text.trim()
  const minLength = options.minLength ?? 1
  const maxLength = options.maxLength ?? 200
  if (value.length < minLength || value.length > maxLength) {
    throw new XmlProfileError('MALFORMED_VALUE', `Ongeldige waarde voor ${field}`, element.sourcePath)
  }
  return value
}

export function optionalText(element: XmlElement | undefined, field: string, maxLength = 200): string | undefined {
  if (!element) return undefined
  const value = element.text.trim()
  if (!value) return undefined
  if (value.length > maxLength) throw new XmlProfileError('MALFORMED_VALUE', `Ongeldige waarde voor ${field}`, element.sourcePath)
  return value
}

export function dateValue(element: XmlElement, field: string): string {
  const value = textValue(element, field, { maxLength: 10 })
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) throw new XmlProfileError('MALFORMED_VALUE', `Ongeldige datum voor ${field}`, element.sourcePath)
  const [year, month, day] = value.split('-').map(Number)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth) {
    throw new XmlProfileError('MALFORMED_VALUE', `Ongeldige datum voor ${field}`, element.sourcePath)
  }
  return value
}

export function optionalDate(element: XmlElement | undefined, field: string): string | undefined {
  return element ? dateValue(element, field) : undefined
}

export function integerValue(element: XmlElement, field: string, min: number, max: number): number {
  const value = textValue(element, field, { maxLength: 10 })
  if (!/^\d+$/u.test(value)) throw new XmlProfileError('MALFORMED_VALUE', `Ongeldig getal voor ${field}`, element.sourcePath)
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new XmlProfileError('MALFORMED_VALUE', `Ongeldig getal voor ${field}`, element.sourcePath)
  return parsed
}

export function optionalInteger(element: XmlElement | undefined, field: string, min: number, max: number): number | undefined {
  return element ? integerValue(element, field, min, max) : undefined
}

export function requiredLoonaangifteTaxNumber(element: XmlElement): string {
  const value = textValue(element, 'LhNr', { maxLength: 12 })
  if (!/^(?:[1-9]\d\d|\d[1-9]\d|\d\d[1-9])\d{6}L(?:[1-9]\d|\d[1-9])$/u.test(value)) {
    throw new XmlProfileError('MALFORMED_VALUE', 'Ongeldig loonheffingennummer', element.sourcePath)
  }
  return value
}

export function protectedBsnValue(element: XmlElement | undefined, protect: (bsn: string) => string): string | undefined {
  if (!element) return undefined
  const bsn = textValue(element, 'SofiNr', { maxLength: 9 })
  if (!/^(?:[1-9]\d\d|\d[1-9]\d|\d\d[1-9])\d{6}$/u.test(bsn)) {
    throw new XmlProfileError('MALFORMED_VALUE', 'Ongeldig burgerservicenummer', element.sourcePath)
  }
  const fingerprint = protect(bsn)
  if (!/^[0-9a-f]{64}$/iu.test(fingerprint)) {
    throw new XmlProfileError('IDENTIFIER_PROTECTION_REQUIRED', 'Server-side BSN-bescherming retourneerde geen geldige fingerprint', element.sourcePath)
  }
  return fingerprint.toLowerCase()
}
