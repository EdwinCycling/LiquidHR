import assert from 'node:assert/strict'
import test from 'node:test'
import {
  compareContexts,
  isActiveAdministrationContextConsistent,
  parseAccessibleAdministrationIds,
  safeContextConfiguration,
} from './local-test-acceptance-context.mjs'

const expected = {
  tenantId: 'tenant-fixture',
  hrGroupId: 'group-fixture',
  administrationId: 'administration-fixture',
}

test('accepts the employee administration explicitly selected in the approved TEST context', () => {
  assert.deepEqual(
    compareContexts(expected, expected),
    [],
  )
})

test('rejects a different administration for an employee', () => {
  assert.deepEqual(
    compareContexts({ ...expected, administrationId: 'unexpected-admin' }, expected),
    ['administrationId'],
  )
})

test('rejects a missing administration when the accepted context specifies one', () => {
  assert.deepEqual(
    compareContexts({ tenantId: expected.tenantId, hrGroupId: expected.hrGroupId, administrationId: null }, expected),
    ['administrationId'],
  )
})

test('requires null when an explicitly nullable context field is strict', () => {
  assert.deepEqual(
    compareContexts({ ...expected, administrationId: 'administration-fixture' }, { ...expected, administrationId: null }, ['administrationId']),
    ['administrationId'],
  )
})

test('leaves unspecified context fields optional', () => {
  assert.deepEqual(
    compareContexts({ tenantId: 'tenant-fixture', hrGroupId: 'group-fixture', administrationId: 'admin' }, { tenantId: null, hrGroupId: null, administrationId: null }),
    [],
  )
})

test('accepts an active administration present in the server-authorized context', () => {
  assert.equal(isActiveAdministrationContextConsistent({
    administrationId: 'administration-fixture',
    accessibleAdministrationIds: ['administration-fixture'],
  }), true)
})

test('accepts no active administration only when the server returns no accessible administrations', () => {
  assert.equal(isActiveAdministrationContextConsistent({
    administrationId: null,
    accessibleAdministrationIds: [],
  }), true)
  assert.equal(isActiveAdministrationContextConsistent({
    administrationId: null,
    accessibleAdministrationIds: ['administration-fixture'],
  }), false)
})

test('rejects an active administration outside the server-authorized context', () => {
  assert.equal(isActiveAdministrationContextConsistent({
    administrationId: 'other-administration',
    accessibleAdministrationIds: ['administration-fixture'],
  }), false)
})

test('fails closed when the server administration list is missing or malformed', () => {
  assert.equal(parseAccessibleAdministrationIds(undefined), null)
  assert.equal(parseAccessibleAdministrationIds([{ name: 'missing id' }]), null)
  assert.equal(isActiveAdministrationContextConsistent({ administrationId: null }), false)
})

test('accepts only an explicit, well-formed empty or populated server administration list', () => {
  assert.deepEqual(parseAccessibleAdministrationIds([]), [])
  assert.deepEqual(parseAccessibleAdministrationIds([{ id: 'administration-fixture' }]), ['administration-fixture'])
})

test('fails closed for empty, whitespace-only, or padded administration identifiers', () => {
  assert.equal(parseAccessibleAdministrationIds([{ id: '' }]), null)
  assert.equal(parseAccessibleAdministrationIds([{ id: '   ' }]), null)
  assert.equal(parseAccessibleAdministrationIds([{ id: ' administration-fixture ' }]), null)
  assert.equal(isActiveAdministrationContextConsistent({
    administrationId: '',
    accessibleAdministrationIds: [''],
  }), false)
  assert.equal(isActiveAdministrationContextConsistent({
    administrationId: 'administration-fixture',
    accessibleAdministrationIds: [''],
  }), false)
})

test('reports only configured-state booleans for expected context', () => {
  const expected = { tenantId: 'private-tenant-fixture', hrGroupId: 'private-group-fixture' }
  const summary = safeContextConfiguration(expected)
  assert.deepEqual(summary, { tenantConfigured: true, hrGroupConfigured: true })
  assert.equal(JSON.stringify(summary).includes(expected.tenantId), false)
  assert.equal(JSON.stringify(summary).includes(expected.hrGroupId), false)
})
