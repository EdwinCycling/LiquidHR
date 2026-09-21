import { basename } from 'node:path'
import { describe, expect, it } from 'vitest'

export type RemoteMigrationIdentity = {
  version: string
  name: string
}

export function parseMigrationIdentity(filename: string): RemoteMigrationIdentity {
  const match = /^([0-9]{14})_(.+)\.sql$/.exec(basename(filename))
  if (!match) {
    throw new Error(`Invalid migration filename: ${filename}`)
  }

  return { version: match[1], name: match[2] }
}

export function assertMigrationIdentity(
  localFilename: string,
  remote: RemoteMigrationIdentity,
): void {
  const local = parseMigrationIdentity(localFilename)
  if (local.version !== remote.version || local.name !== remote.name) {
    throw new Error(
      `Migration metadata mismatch: local ${local.version}_${local.name} != remote ${remote.version}_${remote.name}`,
    )
  }
}

describe('DEV migration metadata identity guard', () => {
  const localFilename = '20260921100000_actual_work_employee_self_service.sql'

  it('derives the remote comparison identity from the canonical filename', () => {
    expect(parseMigrationIdentity(localFilename)).toEqual({
      version: '20260921100000',
      name: 'actual_work_employee_self_service',
    })
  })

  it('accepts matching recorded DEV metadata', () => {
    expect(() =>
      assertMigrationIdentity(localFilename, {
        version: '20260921100000',
        name: 'actual_work_employee_self_service',
      }),
    ).not.toThrow()
  })

  it('rejects the historical version drift found during GJ03 closure', () => {
    expect(() =>
      assertMigrationIdentity(localFilename, {
        version: '20260921092305',
        name: 'actual_work_employee_self_service',
      }),
    ).toThrow('Migration metadata mismatch')
  })
})
