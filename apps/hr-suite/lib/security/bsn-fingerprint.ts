import { createHmac } from 'node:crypto'

export function normalizeBsn(value: string): string {
  const normalized = value.replace(/[\s-]/g, '')
  if (!/^\d{9}$/.test(normalized)) throw new Error('BSN_INVALID')

  const digits = [...normalized].map(Number)
  const checksum = digits.slice(0, 8).reduce((sum, digit, index) => sum + digit * (9 - index), 0)
  if ((checksum - digits[8]) % 11 !== 0) throw new Error('BSN_INVALID')

  return normalized
}

export function createBsnFingerprint(tenantId: string, bsn: string, key: string): string {
  if (!tenantId.trim()) throw new Error('TENANT_ID_REQUIRED')
  if (key.length < 32) throw new Error('BSN_HASH_KEY_INVALID')

  return createHmac('sha256', key)
    .update(`${tenantId}:${normalizeBsn(bsn)}`)
    .digest('hex')
}
