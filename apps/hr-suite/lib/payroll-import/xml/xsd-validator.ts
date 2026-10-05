import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { XmlDocument, XmlValidateError, XsdValidator, ParseOption } from 'libxml2-wasm'
import { LOONAANGIFTE_2026_XSD_SHA256 } from './xsd-constants'

const SAFE_PARSE_OPTIONS = ParseOption.XML_PARSE_NONET
  | ParseOption.XML_PARSE_NO_XXE
  | ParseOption.XML_PARSE_NO_SYS_CATALOG
  | ParseOption.XML_PARSE_NOERROR
  | ParseOption.XML_PARSE_NOWARNING

export type OfficialXsdValidation = 'VALIDATED' | 'INVALID' | 'UNAVAILABLE'

let cachedValidator: XsdValidator | null | undefined

type ValidatorFactory = (schema: XmlDocument) => XsdValidator

export function createOfficialLoonaangifte2026Validator(
  schemaBytes: Uint8Array | null,
  validatorFactory: ValidatorFactory = (schema) => XsdValidator.fromDoc(schema),
): XsdValidator | null {
  if (!schemaBytes) return null

  const actualHash = createHash('sha256').update(schemaBytes).digest('hex').toUpperCase()
  if (actualHash !== LOONAANGIFTE_2026_XSD_SHA256) return null

  let schemaDocument: XmlDocument | undefined
  try {
    schemaDocument = XmlDocument.fromBuffer(schemaBytes, { option: SAFE_PARSE_OPTIONS })
    return validatorFactory(schemaDocument)
  } catch {
    return null
  } finally {
    schemaDocument?.dispose()
  }
}

function getValidator(): XsdValidator | null {
  if (cachedValidator !== undefined) return cachedValidator

  let schemaBytes: Buffer
  try {
    schemaBytes = readFileSync(new URL('./schemas/Loonaangifte2026v2.0.xsd', import.meta.url))
  } catch {
    cachedValidator = null
    return null
  }

  cachedValidator = createOfficialLoonaangifte2026Validator(schemaBytes)
  return cachedValidator
}

export function validateOfficialLoonaangifte2026(bytes: Uint8Array): OfficialXsdValidation {
  const validator = getValidator()
  if (!validator) return 'UNAVAILABLE'

  let document: XmlDocument | undefined
  try {
    document = XmlDocument.fromBuffer(bytes, { option: SAFE_PARSE_OPTIONS })
    validator.validate(document)
    return 'VALIDATED'
  } catch (error) {
    return error instanceof XmlValidateError ? 'INVALID' : 'UNAVAILABLE'
  } finally {
    document?.dispose()
  }
}
