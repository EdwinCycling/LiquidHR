import { describe, expect, it } from 'vitest'
import { presentManagerApproval } from './leave-approval-presentation'

const nl = { yes: 'Ja', no: 'Nee', notConfigured: 'Niet ingericht' }
const en = { yes: 'Yes', no: 'No', notConfigured: 'Not configured' }

describe('leave approval presentation', () => {
  it('renders explicit Dutch boolean values from the leave type read model', () => {
    expect(presentManagerApproval(true, nl)).toBe('Ja')
    expect(presentManagerApproval(false, nl)).toBe('Nee')
  })

  it('keeps unset approval distinct from an explicit false value in English', () => {
    expect(presentManagerApproval(null, en)).toBe('Not configured')
    expect(presentManagerApproval(undefined, en)).toBe('Not configured')
    expect(presentManagerApproval(false, en)).toBe('No')
  })
})
