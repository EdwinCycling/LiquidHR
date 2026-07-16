import { describe, expect, it } from 'vitest'
import { loginSchema, safeNextPath } from '@/lib/auth/login-rules'

describe('loginSchema', () => {
  it('accepteert een geldig e-mailadres en wachtwoord', () => {
    expect(loginSchema.safeParse({
      email: 'edwin@editsolutions.nl',
      password: 'een-lang-wachtwoord',
      next: '/departments',
    }).success).toBe(true)
  })

  it('weigert een leeg wachtwoord', () => {
    expect(loginSchema.safeParse({
      email: 'edwin@editsolutions.nl',
      password: '',
      next: '/departments',
    }).success).toBe(false)
  })
})

describe('safeNextPath', () => {
  it.each([
    ['/departments', '/departments'],
    ['/invite/accept?invitation=abc', '/invite/accept?invitation=abc'],
    ['https://kwaad.example', '/departments'],
    ['//kwaad.example', '/departments'],
    ['/\\kwaad.example', '/departments'],
    [null, '/departments'],
  ])('normaliseert %s naar %s', (value, expected) => {
    expect(safeNextPath(value)).toBe(expected)
  })
})
