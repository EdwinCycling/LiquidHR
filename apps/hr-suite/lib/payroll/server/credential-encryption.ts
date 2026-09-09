import 'server-only'

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ENVELOPE_VERSION = 'v1'
const KEY_BYTES = 32
const IV_BYTES = 12

export class PayrollCredentialError extends Error {
  readonly status = 500

  constructor(public readonly code: 'PAYROLL_CREDENTIAL_ENCRYPTION_KEY_MISSING' | 'PAYROLL_CREDENTIAL_ENCRYPTION_KEY_INVALID' | 'PAYROLL_CREDENTIAL_CIPHERTEXT_INVALID') {
    super(code)
    this.name = 'PayrollCredentialError'
  }
}

function decodeKey(value: string): Buffer {
  if (/^[0-9a-f]{64}$/i.test(value)) return Buffer.from(value, 'hex')
  try {
    const decoded = Buffer.from(value, 'base64url')
    if (decoded.length === KEY_BYTES) return decoded
  } catch {
    // The normalized error below deliberately does not include the value.
  }
  throw new PayrollCredentialError('PAYROLL_CREDENTIAL_ENCRYPTION_KEY_INVALID')
}

function encryptionKey(): Buffer {
  const value = process.env.PAYROLL_CREDENTIAL_ENCRYPTION_KEY
  if (!value) throw new PayrollCredentialError('PAYROLL_CREDENTIAL_ENCRYPTION_KEY_MISSING')
  const key = decodeKey(value)
  if (key.length !== KEY_BYTES) throw new PayrollCredentialError('PAYROLL_CREDENTIAL_ENCRYPTION_KEY_INVALID')
  return key
}

export function assertPayrollCredentialEncryptionConfigured(): void {
  encryptionKey()
}

function encode(value: Buffer): string {
  return value.toString('base64url')
}

function decode(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new PayrollCredentialError('PAYROLL_CREDENTIAL_CIPHERTEXT_INVALID')
  return Buffer.from(value, 'base64url')
}

export function encryptPayrollCredential(plaintext: string): string {
  if (plaintext.length === 0) throw new PayrollCredentialError('PAYROLL_CREDENTIAL_CIPHERTEXT_INVALID')
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return [ENVELOPE_VERSION, encode(iv), encode(cipher.getAuthTag()), encode(encrypted)].join('.')
}

export function decryptPayrollCredential(envelope: string): string {
  const parts = envelope.split('.')
  if (parts.length !== 4 || parts[0] !== ENVELOPE_VERSION) throw new PayrollCredentialError('PAYROLL_CREDENTIAL_CIPHERTEXT_INVALID')
  const [, encodedIv, encodedTag, encodedCiphertext] = parts
  try {
    const iv = decode(encodedIv)
    const tag = decode(encodedTag)
    const ciphertext = decode(encodedCiphertext)
    if (iv.length !== IV_BYTES || tag.length !== 16 || ciphertext.length === 0) throw new Error('invalid envelope')
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  } catch (error) {
    if (error instanceof PayrollCredentialError) throw error
    throw new PayrollCredentialError('PAYROLL_CREDENTIAL_CIPHERTEXT_INVALID')
  }
}
