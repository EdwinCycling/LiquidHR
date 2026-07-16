import { describe, expect, it } from 'vitest'
import { customFieldDefinitionSchema, customFieldValuesSchema } from './schemas'

describe('vrije velden validatie', () => {
  it('accepteert een volledige definitie', () => {
    const parsed = customFieldDefinitionSchema.safeParse({
      key: 'shirt_size', labelNl: 'Shirtmaat', labelEn: 'Shirt size',
      fieldType: 'SELECT', isRequired: true, hrAccess: 'WRITE',
      managerAccess: 'READ', employeeSelfAccess: 'WRITE', sortOrder: 10,
      options: [{ value: 'M', labelNl: 'Middel', labelEn: 'Medium', sortOrder: 1 }],
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.showInOrganizationChartFilter).toBe(false)
  })

  it('weigert een onveilige technische sleutel', () => {
    expect(customFieldDefinitionSchema.safeParse({
      key: 'Shirt maat', labelNl: 'Shirtmaat', labelEn: 'Shirt size', fieldType: 'TEXT',
    }).success).toBe(false)
  })

  it('accepteert uitsluitend JSON-compatibele waarden', () => {
    expect(customFieldValuesSchema.safeParse({ shirt_size: 'M', first_aid: true }).success).toBe(true)
    expect(customFieldValuesSchema.safeParse([]).success).toBe(false)
  })
})
