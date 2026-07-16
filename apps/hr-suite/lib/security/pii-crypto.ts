import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const VERSION = 'v1'
const ALGORITHM = 'aes-256-gcm'

function getEncryptionKey(): Buffer {
  const encoded = process.env.EMPLOYEE_PII_ENCRYPTION_KEY
  if (!encoded) throw new Error('PII_ENCRYPTION_KEY_MISSING')
  const key = Buffer.from(encoded, 'base64')
  if (key.length !== 32) throw new Error('PII_ENCRYPTION_KEY_INVALID')
  return key
}

function decodeCanonicalBase64Url(value: string): Buffer {
  const decoded = Buffer.from(value, 'base64url')
  if (decoded.toString('base64url') !== value) throw new Error('FORMAT')
  return decoded
}

export function encryptPii(plaintext: string, tenantId: string): string {
  if (!tenantId.trim()) throw new Error('TENANT_ID_REQUIRED')
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv)
  cipher.setAAD(Buffer.from(tenantId, 'utf8'))
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join(':')
}

export function decryptPii(ciphertext: string, tenantId: string): string {
  try {
    const [version, ivValue, tagValue, encryptedValue, extra] = ciphertext.split(':')
    if (version !== VERSION || !ivValue || !tagValue || !encryptedValue || extra) throw new Error('FORMAT')
    const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), decodeCanonicalBase64Url(ivValue))
    decipher.setAAD(Buffer.from(tenantId, 'utf8'))
    decipher.setAuthTag(decodeCanonicalBase64Url(tagValue))
    return Buffer.concat([
      decipher.update(decodeCanonicalBase64Url(encryptedValue)),
      decipher.final(),
    ]).toString('utf8')
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('PII_ENCRYPTION_KEY_')) throw error
    throw new Error('PII_DECRYPT_FAILED')
  }
}
