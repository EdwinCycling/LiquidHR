import { describe, expect, it } from 'vitest'
import { selectStudioTrialTransition, studioRpcErrorCode, validateStudioTrialFieldValues } from './studio-service'
import { createTrainingRequestExampleDraft } from './studio-draft-factories'

describe('write-free Processproef route evaluation', () => {
  const draft = createTrainingRequestExampleDraft({ key: 'opleiding-aanvragen', title: { nl: 'Opleidingsaanvraag', en: 'Training request' }, description: { nl: 'Aanvraag en beoordeling.', en: 'Request and review.' } })
  const condition = { operator: 'greaterThan' as const, left: { kind: 'FIELD' as const, fieldKey: 'training-expected-cost' }, right: { kind: 'LITERAL' as const, value: 1000 } }
  const yes = { ...draft.transitions[0]!, toStepKey: 'hr-processing', condition }
  const otherwise = { ...draft.transitions[0]!, key: 'request-submit-otherwise', toStepKey: 'manager-review', condition: { operator: 'not' as const, condition } }

  it('chooses the extra HR route only above the strict EUR 1,000 threshold, including empty values', () => {
    const routes = [yes, otherwise]
    expect(selectStudioTrialTransition(routes, { 'training-expected-cost': 750 }, {}).matches.map((route) => route.key)).toEqual([otherwise.key])
    expect(selectStudioTrialTransition(routes, { 'training-expected-cost': 1000 }, {}).matches.map((route) => route.key)).toEqual([otherwise.key])
    expect(selectStudioTrialTransition(routes, { 'training-expected-cost': 1250 }, {}).matches.map((route) => route.key)).toEqual([yes.key])
    expect(selectStudioTrialTransition(routes, { 'training-expected-cost': null }, {}).matches.map((route) => route.key)).toEqual([otherwise.key])
    expect(selectStudioTrialTransition(routes, { 'training-expected-cost': 750 }, {}).matches[0]?.toStepKey).toBe('manager-review')
    expect(selectStudioTrialTransition(routes, { 'training-expected-cost': 1000 }, {}).matches[0]?.toStepKey).toBe('manager-review')
    expect(selectStudioTrialTransition(routes, { 'training-expected-cost': 1250 }, {}).matches[0]?.toStepKey).toBe('hr-processing')
    expect(selectStudioTrialTransition(routes, { 'training-expected-cost': null }, {}).matches[0]?.toStepKey).toBe('manager-review')
  })

  it('rejects unknown fields and trial values with the wrong form-field type', () => {
    expect(validateStudioTrialFieldValues(draft, { 'training-expected-cost': '750' })[0]?.code).toBe('CONDITION_FIELD_TYPE_INVALID')
    expect(validateStudioTrialFieldValues(draft, { 'removed-field': 750 })[0]?.code).toBe('CONDITION_FIELD_UNKNOWN')
  })
})
describe('Studio RPC error mapping', () => {
  it('maps Postgres serialization conflicts to the Studio revision conflict contract', () => {
    expect(studioRpcErrorCode({ code: '40001', message: 'could not serialize access due to concurrent update' })).toBe('PROCESS_DEFINITION_DRAFT_CONFLICT')
  })

  it('preserves explicit RPC business codes', () => {
    expect(studioRpcErrorCode({ code: 'P0001', message: 'PROCESS_DEFINITION_NOT_FOUND' })).toBe('PROCESS_DEFINITION_NOT_FOUND')
  })
})
