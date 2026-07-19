import { describe, expect, it } from 'vitest'
import {
  starPerformerAssessmentSchema,
  starPerformerQuerySchema,
  starPerformerTagCreateSchema,
} from './schemas'

describe('star performer query schema', () => {
  it('accepteert geldige filters', () => {
    expect(starPerformerQuerySchema.parse({
      level: 'job-group',
      q: 'support',
      minStars: '4',
    })).toMatchObject({
      level: 'job-group',
      q: 'support',
      minStars: '4',
    })
  })
})

describe('star performer tag schema', () => {
  it('trimt en valideert tagnamen', () => {
    expect(starPerformerTagCreateSchema.parse({ name: ' ERP ' }).name).toBe('ERP')
  })
})

describe('star performer assessment schema', () => {
  it('vereist precies een scope', () => {
    expect(() => starPerformerAssessmentSchema.parse({
      employeeId: '11111111-1111-1111-8111-111111111111',
      criticalityLevel: 5,
      tagIds: [],
    })).toThrowError(/STAR_PERFORMER_SCOPE_INVALID/)
  })

  it('accepteert een functiebinding', () => {
    expect(starPerformerAssessmentSchema.parse({
      employeeId: '11111111-1111-1111-8111-111111111111',
      jobId: '22222222-2222-2222-8222-222222222222',
      criticalityLevel: 4,
      tagIds: ['33333333-3333-3333-8333-333333333333'],
    })).toMatchObject({
      criticalityLevel: 4,
      tagIds: ['33333333-3333-3333-8333-333333333333'],
    })
  })
})
