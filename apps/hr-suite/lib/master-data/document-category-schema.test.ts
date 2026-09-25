import { describe, expect, it } from 'vitest'
import { createDocumentCategorySchema, updateDocumentCategorySchema } from './document-category-schema'

describe('document category schema', () => {
  it('preserves a lowercase D01 code and defaults salary access off', () => {
    expect(createDocumentCategorySchema.parse({ code: 'd01_general_d01_20260924', name: 'D01 Algemeen' })).toMatchObject({
      code: 'd01_general_d01_20260924',
      requiresSalaryPermission: false,
    })
  })

  it('normalizes form-uppercased codes before the database uniqueness check', () => {
    expect(createDocumentCategorySchema.parse({ code: 'D01_GENERAL_D01-20260924', name: 'D01 Algemeen' }).code).toBe('d01_general_d01-20260924')
  })

  it('accepts a valid category with salary access enabled', () => {
    expect(createDocumentCategorySchema.parse({ code: 'd01_salary_d01_20260924', name: 'D01 Vertrouwelijk', requiresSalaryPermission: true }).requiresSalaryPermission).toBe(true)
  })

  it.each([
    { code: '', name: 'Blank code' },
    { code: 'd', name: 'Too short' },
    { code: 'bad code', name: 'Whitespace' },
    { code: 'D01_OK', name: '   ' },
    { code: 'D01_OK', name: 'No', requiresSalaryPermission: 'yes' },
  ])('rejects invalid create input %j', (input) => {
    expect(createDocumentCategorySchema.safeParse(input).success).toBe(false)
  })

  it('requires at least one valid update field', () => {
    expect(updateDocumentCategorySchema.safeParse({}).success).toBe(false)
    expect(updateDocumentCategorySchema.safeParse({ requiresSalaryPermission: true }).success).toBe(true)
  })
})
