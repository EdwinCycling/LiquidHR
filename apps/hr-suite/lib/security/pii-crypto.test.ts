import { afterEach, describe, expect, it } from 'vitest'
import { decryptPii, encryptPii } from './pii-crypto'

const originalKey = process.env.EMPLOYEE_PII_ENCRYPTION_KEY

afterEach(() => {
  if (originalKey === undefined) delete process.env.EMPLOYEE_PII_ENCRYPTION_KEY
  else process.env.EMPLOYEE_PII_ENCRYPTION_KEY = originalKey
})

describe('PII-encryptie', () => {
  it('versleutelt en ontsleutelt binnen dezelfde tenant', () => {
    process.env.EMPLOYEE_PII_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')
    const ciphertext = encryptPii('111222333', 'tenant-een')
    expect(ciphertext).not.toContain('111222333')
    expect(decryptPii(ciphertext, 'tenant-een')).toBe('111222333')
  })

  it('weigert ontsleutelen vanuit een andere tenant of na manipulatie', () => {
    process.env.EMPLOYEE_PII_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64')
    const ciphertext = encryptPii('111222333', 'tenant-een')
    expect(() => decryptPii(ciphertext, 'tenant-twee')).toThrow('PII_DECRYPT_FAILED')
    expect(() => decryptPii(`${ciphertext}x`, 'tenant-een')).toThrow('PII_DECRYPT_FAILED')
  })

  it('vereist exact 32 bytes sleutelmateriaal', () => {
    process.env.EMPLOYEE_PII_ENCRYPTION_KEY = Buffer.from('te-kort').toString('base64')
    expect(() => encryptPii('waarde', 'tenant-een')).toThrow('PII_ENCRYPTION_KEY_INVALID')
  })
})
