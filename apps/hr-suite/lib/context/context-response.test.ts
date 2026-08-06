import { describe, expect, it } from 'vitest'
import { ADMINISTRATION_SWITCH_SUCCESS_PATH, HR_GROUP_SWITCH_SUCCESS_PATH, type ActiveContext } from './administration-context'
import {
  ContextSelectionError,
  parseAdministrationSelection,
  parseHrGroupSelection,
  validateAdministrationSelection,
  validateHrGroupSelection,
} from './context-response'

const groupA = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  tenantId: '11111111-1111-4111-8111-111111111111',
  code: 'A',
  name: 'Groep A',
  description: null,
  administrations: [
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', code: 'A1', name: 'A1' },
    { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', code: 'A2', name: 'A2' },
  ],
}

const context: ActiveContext = {
  tenant: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Liquid HR Demo Holding',
    slug: 'liquid-hr-demo-holding',
    administrationMode: 'SEPARATE',
    sharingMode: 'FULLY_ISOLATED',
  },
  hrGroups: [groupA],
  activeHrGroup: groupA,
  administrationsInActiveHrGroup: groupA.administrations,
  activeAdministration: groupA.administrations[0],
}

describe('HR-groepcontext valideren', () => {
  it('stuurt na een contextwissel naar de startpagina', () => {
    expect(HR_GROUP_SWITCH_SUCCESS_PATH).toBe('/dashboard/start')
    expect(ADMINISTRATION_SWITCH_SUCCESS_PATH).toBe('/dashboard/start')
  })

  it('accepteert uitsluitend UUID-bodies voor contextkeuzes', () => {
    expect(parseHrGroupSelection({ hrGroupId: groupA.id })).toEqual({ hrGroupId: groupA.id })
    expect(parseAdministrationSelection({ administrationId: groupA.administrations[1].id })).toEqual({ administrationId: groupA.administrations[1].id })
    expect(() => parseHrGroupSelection({ hrGroupId: 'geen-uuid' })).toThrow(ContextSelectionError)
    expect(() => parseAdministrationSelection({ administrationId: 'geen-uuid' })).toThrow(ContextSelectionError)
  })

  it('weigert een groep of administratie buiten de actieve whitelist', () => {
    expect(() => validateHrGroupSelection(context, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd')).toThrow('Je hebt geen toegang tot deze HR-groep.')
    expect(() => validateAdministrationSelection(context, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd')).toThrow('Je hebt geen toegang tot deze administratie binnen de actieve HR-groep.')
  })

  it('valideert administratie alleen binnen de actieve groep', () => {
    expect(validateAdministrationSelection(context, groupA.administrations[1].id).id).toBe(groupA.administrations[1].id)
  })
})
