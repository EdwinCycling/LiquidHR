import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest'
import { createMessage, encrypt, generateKey, readKey } from 'openpgp'
import { createHash } from 'node:crypto'

const mocks = vi.hoisted(() => ({ context: vi.fn(), permission: vi.fn() }))
vi.mock('@/lib/auth/permissions', () => ({ AuthorizationError: class AuthorizationError extends Error {}, requireAuthContext: mocks.context, requirePermissionInContext: mocks.permission }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
import { readFiscalProvenance } from './payroll-fiscal-provenance.server'

const scope = { tenantId: 'tenant', hrGroupId: 'group', administrationId: 'admin' }
const target = { id: 'profile', employee_id: 'employee' }
const context = { userId: 'actor', employeeId: 'employee', ...scope, activeRoles: ['EMPLOYEE'] }
const original = process.env.PAYROLL_PROVENANCE_PGP_PRIVATE_KEY
let ciphertext: string
let publicKeyText: string
let publicFingerprint: string

describe('server-only fiscal provenance', () => {
  beforeAll(async () => {
    const keys = await generateKey({ type: 'rsa', rsaBits: 2048, userIDs: [{ name: 'synthetic' }], format: 'armored' })
    process.env.PAYROLL_PROVENANCE_PGP_PRIVATE_KEY = keys.privateKey
    publicKeyText = keys.publicKey
    const publicKey = await readKey({ armoredKey: keys.publicKey })
    publicFingerprint = createHash('sha256').update(publicKey.write()).digest('hex')
    const data = await encrypt({ message: await createMessage({ text: JSON.stringify({ profileId: target.id, actorUserId: context.userId, ...scope, employeeId: target.employee_id, sourceReference: 'fixture', confirmedByUserId: 'confirmer' }) }), encryptionKeys: publicKey, format: 'binary' })
    ciphertext = Buffer.from(data).toString('base64')
  }, 30000)
  afterAll(() => { if (original === undefined) delete process.env.PAYROLL_PROVENANCE_PGP_PRIVATE_KEY; else process.env.PAYROLL_PROVENANCE_PGP_PRIVATE_KEY = original })
  beforeEach(() => { vi.clearAllMocks(); mocks.context.mockResolvedValue(context); mocks.permission.mockResolvedValue(context) })
  const client = (rows: unknown[]) => ({ rpc: vi.fn(async (name: string) => ({ data: name === 'sec101_provenance_key_fingerprint' ? publicFingerprint : rows, error: null })) })
  it('authenticates, binds scope and decrypts the actor-bound payload on the server', async () => {
    const db = client([{ profile_id: target.id, encrypted_payload: ciphertext }])
    const result = await readFiscalProvenance(db as never, scope, [target])
    expect(result).toEqual([{ id: target.id, employee_id: target.employee_id, source_reference: 'fixture', confirmed_by_user_id: 'confirmer' }])
    expect(mocks.permission).toHaveBeenCalledWith(db, context, 'salary:read', 'employee')
  })
  it.each(['tenantId', 'hrGroupId', 'administrationId', 'userId'])('denies mismatched %s', async (key) => {
    mocks.context.mockResolvedValue({ ...context, [key]: key === 'userId' ? null : 'other' })
    const db = client([{ profile_id: target.id, encrypted_payload: ciphertext }])
    await expect(readFiscalProvenance(db as never, scope, [target])).rejects.toThrow()
    expect(db.rpc).not.toHaveBeenCalled()
  })
  it('denies another employee for a Manager and missing or substituted records', async () => {
    mocks.context.mockResolvedValue({ ...context, activeRoles: ['DIRECT_MANAGER'] })
    const db = client([{ profile_id: target.id, encrypted_payload: ciphertext }])
    await expect(readFiscalProvenance(db as never, scope, [{ ...target, employee_id: 'other' }])).rejects.toThrow()
    await expect(readFiscalProvenance(client([]) as never, scope, [target])).rejects.toThrow()
    await expect(readFiscalProvenance(client([{ profile_id: 'other', encrypted_payload: ciphertext }]) as never, scope, [target])).rejects.toThrow()
    await expect(readFiscalProvenance(db as never, scope, [target, target])).rejects.toThrow()
  })
  it('fails before database access when the authenticated session has expired', async () => {
    mocks.context.mockRejectedValue(new Error('expired'))
    const db = client([{ profile_id: target.id, encrypted_payload: ciphertext }])
    await expect(readFiscalProvenance(db as never, scope, [target])).rejects.toThrow('expired')
    expect(db.rpc).not.toHaveBeenCalled()
  })
  it('rejects ciphertext issued to a different authenticated actor', async () => {
    mocks.context.mockResolvedValue({ ...context, userId: 'another-actor' })
    await expect(readFiscalProvenance(client([{ profile_id: target.id, encrypted_payload: ciphertext }]) as never, scope, [target])).rejects.toThrow('Payroll-bronmetadata ongeldig.')
  })
  it('fails closed when the server key is unavailable', async () => {
    const saved = process.env.PAYROLL_PROVENANCE_PGP_PRIVATE_KEY
    delete process.env.PAYROLL_PROVENANCE_PGP_PRIVATE_KEY
    try {
      await expect(readFiscalProvenance(client([{ profile_id: target.id, encrypted_payload: ciphertext }]) as never, scope, [target])).rejects.toThrow('PAYROLL_PROVENANCE_PGP_PRIVATE_KEY_MISSING')
    } finally { process.env.PAYROLL_PROVENANCE_PGP_PRIVATE_KEY = saved }
  })
  it('fails closed when the server key does not match the database public key', async () => {
    const saved = process.env.PAYROLL_PROVENANCE_PGP_PRIVATE_KEY
    const unrelated = await generateKey({ type: 'rsa', rsaBits: 2048, userIDs: [{ name: 'unrelated-synthetic' }], format: 'armored' })
    process.env.PAYROLL_PROVENANCE_PGP_PRIVATE_KEY = unrelated.privateKey
    try {
      await expect(readFiscalProvenance(client([{ profile_id: target.id, encrypted_payload: ciphertext }]) as never, scope, [target])).rejects.toThrow('PAYROLL_PROVENANCE_KEY_MISMATCH')
    } finally { process.env.PAYROLL_PROVENANCE_PGP_PRIVATE_KEY = saved }
  }, 30000)
  it('fails closed when the database has no registered public key', async () => {
    const db = { rpc: vi.fn(async () => ({ data: null, error: null })) }
    await expect(readFiscalProvenance(db as never, scope, [target])).rejects.toThrow('PAYROLL_PROVENANCE_KEY_MISMATCH')
    expect(db.rpc).toHaveBeenCalledTimes(1)
  })
  it('splits 51 profile IDs into bounded encrypted requests without truncation', async () => {
    const publicKey = await readKey({ armoredKey: publicKeyText })
    const profiles = Array.from({ length: 51 }, (_, index) => ({ id: `profile-${index}`, employee_id: 'employee' }))
    const encrypted = await Promise.all(profiles.map(async (profile) => {
      const payload = { profileId: profile.id, actorUserId: context.userId, ...scope, employeeId: profile.employee_id, sourceReference: 'fixture', confirmedByUserId: 'confirmer' }
      const data = await encrypt({ message: await createMessage({ text: JSON.stringify(payload) }), encryptionKeys: publicKey, format: 'binary' })
      return { profile_id: profile.id, encrypted_payload: Buffer.from(data).toString('base64') }
    }))
    const db = { rpc: vi.fn(async (name: string, args?: { p_ids: string[] }) => ({ data: name === 'sec101_provenance_key_fingerprint' ? publicFingerprint : encrypted.filter((row) => args?.p_ids.includes(row.profile_id)), error: null })) }
    expect(await readFiscalProvenance(db as never, scope, profiles)).toHaveLength(51)
    expect(db.rpc.mock.calls.slice(1).map((call) => call[1]?.p_ids.length)).toEqual([50, 1])
  }, 30000)
})
