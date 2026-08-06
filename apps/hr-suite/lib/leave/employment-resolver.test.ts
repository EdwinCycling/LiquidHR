import { describe, expect, it } from 'vitest'
import { selectEmploymentCandidate } from './employment-resolver'

describe('selectEmploymentCandidate', () => {
  const candidates = [{ id: 'employment-1' }, { id: 'employment-2' }] as const

  it('kiest automatisch wanneer er exact één kandidaat is', () => {
    const candidate = candidates.slice(0, 1)
    expect(selectEmploymentCandidate(candidate, new Set())).toEqual(candidate[0])
  })

  it('kiest de enige kandidaat die door de managercontext wordt bepaald', () => {
    expect(selectEmploymentCandidate(candidates, new Set(['employment-2']))).toEqual(candidates[1])
  })

  it('laat de keuze open bij geen of meerdere manager-matches', () => {
    expect(selectEmploymentCandidate(candidates, new Set())).toBeNull()
    expect(selectEmploymentCandidate(candidates, new Set(['employment-1', 'employment-2']))).toBeNull()
  })
})
