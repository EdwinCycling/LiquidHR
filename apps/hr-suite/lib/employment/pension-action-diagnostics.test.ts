import { describe, expect, it } from 'vitest'
import { pensionArrangementActionDiagnostic, pensionArrangementSuccessorFailure } from './pension-action-diagnostics'

describe('pensionArrangementActionDiagnostic', () => {
  it('keeps a safe pension error code and its correlation id', () => {
    expect(pensionArrangementActionDiagnostic(
      'PENSION_ARRANGEMENT_PREDECESSOR_ALREADY_SUPERSEDED',
      '11111111-1111-4111-8111-111111111111',
    )).toEqual({
      sourceCategory: 'PENSION_ARRANGEMENT_SUCCESSOR',
      errorCode: 'PENSION_ARRANGEMENT_PREDECESSOR_ALREADY_SUPERSEDED',
      correlationId: '11111111-1111-4111-8111-111111111111',
    })
  })

  it('replaces non-code error text with a safe fallback', () => {
    expect(pensionArrangementActionDiagnostic(
      'database failure: private row contents',
      '22222222-2222-4222-8222-222222222222',
    )).toMatchObject({
      sourceCategory: 'PENSION_ARRANGEMENT_SUCCESSOR',
      errorCode: 'PENSION_ARRANGEMENT_SUCCESSOR_WRITE_FAILED',
      correlationId: '22222222-2222-4222-8222-222222222222',
    })
  })

  it('maps a known period constraint to its safe field-level code', () => {
    expect(pensionArrangementSuccessorFailure({
      code: '23514',
      message: 'new row violates check constraint "pension_arrangement_versions_effective_dates_chk"',
    })).toEqual({ errorCode: 'PENSION_ARRANGEMENT_SUCCESSOR_EFFECTIVE_PERIOD_INVALID', status: 400 })
  })

  it('classifies a unique predecessor conflict without exposing the database message', () => {
    expect(pensionArrangementSuccessorFailure({
      code: '23505',
      message: 'duplicate key violates unique constraint "pension_arrangement_versions_successor_key"',
    })).toEqual({ errorCode: 'PENSION_ARRANGEMENT_PREDECESSOR_ALREADY_SUPERSEDED', status: 409 })
  })

  it('classifies a missing RPC as unavailable instead of a blocked user input', () => {
    expect(pensionArrangementSuccessorFailure({
      code: 'PGRST202',
      message: 'function metadata unavailable',
    })).toEqual({ errorCode: 'PENSION_ARRANGEMENT_SUCCESSOR_FUNCTION_UNAVAILABLE', status: 500 })
  })

  it('keeps unknown database failures generic and non-blocking', () => {
    expect(pensionArrangementSuccessorFailure({
      code: 'XX000',
      message: 'private row contents',
    })).toEqual({ errorCode: 'PENSION_ARRANGEMENT_SUCCESSOR_WRITE_FAILED', status: 500 })
  })

  it('does not forward unknown PENSION tokens from database errors to the UI', () => {
    expect(pensionArrangementSuccessorFailure({
      code: 'XX000',
      message: 'PENSION_PRIVATE_ROW_VALUE',
    })).toEqual({ errorCode: 'PENSION_ARRANGEMENT_SUCCESSOR_WRITE_FAILED', status: 500 })
  })
})
