import { describe, expect, it } from 'vitest'
import { userMessageSchema } from './schemas'

describe('userMessageSchema', () => {
  it('accepteert een niet-leeg begrensd gebruikersbericht', () => {
    expect(userMessageSchema.safeParse({ content: 'Help mij met mijn uren' }).success).toBe(true)
  })

  it('weigert een leeg of te lang gebruikersbericht', () => {
    expect(userMessageSchema.safeParse({ content: '   ' }).success).toBe(false)
    expect(userMessageSchema.safeParse({ content: 'x'.repeat(8_001) }).success).toBe(false)
  })
})
