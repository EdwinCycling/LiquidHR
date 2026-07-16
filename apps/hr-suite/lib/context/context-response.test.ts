import { describe, expect, it } from 'vitest'
import type { ActiveContext } from './administration-context'
import {
  ContextSelectionError,
  parseAdministrationSelection,
  validateAdministrationSelection,
} from './context-response'

const context: ActiveContext = {
  tenant: {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: 'Liquid HR Demo Holding',
    slug: 'liquid-hr-demo-holding',
    administrationMode: 'SEPARATE',
    sharingMode: 'FULLY_ISOLATED',
  },
  administration: {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    code: 'HOLDING',
    name: 'Holding',
  },
  administrations: [
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', code: 'HOLDING', name: 'Holding' },
    { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', code: 'SERVICES', name: 'Services' },
  ],
}

describe('administratiecontext valideren', () => {
  it('accepteert uitsluitend een UUID-body', () => {
    expect(parseAdministrationSelection({
      administrationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    })).toEqual({ administrationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' })

    expect(parseAdministrationSelection({
      administrationId: '8483abc9-f275-c80b-5a23-fedc54ce9f0a',
    })).toEqual({ administrationId: '8483abc9-f275-c80b-5a23-fedc54ce9f0a' })

    expect(parseAdministrationSelection({
      administrationId: '6ebc1932-8af5-0bf3-ae5e-05bb7b1bfb1f',
    })).toEqual({ administrationId: '6ebc1932-8af5-0bf3-ae5e-05bb7b1bfb1f' })

    expect(() => parseAdministrationSelection({ administrationId: 'geen-uuid' })).toThrow(
      ContextSelectionError,
    )
  })

  it('weigert een administratie buiten de toegestane opties', () => {
    expect(() => validateAdministrationSelection(
      context,
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    )).toThrow('Je hebt geen toegang tot deze administratie.')
  })

  it('weigert een algemene contextwissel voor een gecombineerde tenant', () => {
    expect(() => validateAdministrationSelection(
      { ...context, tenant: { ...context.tenant, administrationMode: 'COMBINED' } },
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    )).toThrow('Deze klantomgeving werkt als één gecombineerde administratie.')
  })
})
