import 'server-only'

import { decrypt, readMessage, readPrivateKey } from 'openpgp'
import { createHash } from 'node:crypto'
import { AuthorizationError, requireAuthContext, requirePermissionInContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

type RequestClient = Awaited<ReturnType<typeof createClient>>
type Scope = { readonly tenantId: string; readonly hrGroupId: string; readonly administrationId: string }
type Target = { readonly id: string; readonly employee_id: string }

/** Ontsleutelt uitsluitend metadata die de database aan de huidige actor heeft gebonden. */
export async function readFiscalProvenance(db: RequestClient, scope: Scope, profiles: readonly Target[]) {
  if (profiles.length === 0) return []
  if (new Set(profiles.map((p) => p.id)).size !== profiles.length) throw new AuthorizationError('Ongeldige Payroll-bronscope.')
  const context = await requireAuthContext(db)
  if (!context.userId || context.tenantId !== scope.tenantId || context.hrGroupId !== scope.hrGroupId
    || context.administrationId !== scope.administrationId) throw new AuthorizationError('Payroll-bronscope ontbreekt.')
  const isAdmin = context.activeRoles.some((role) => role === 'TENANT_ADMIN' || role === 'HR_ADMIN')
  for (const employeeId of new Set(profiles.map((profile) => profile.employee_id))) {
    if (context.employeeId !== employeeId && !isAdmin) throw new AuthorizationError('Payroll-brontoegang ontbreekt.')
    await requirePermissionInContext(db, context, 'salary:read', employeeId)
  }
  const armoredKey = process.env.PAYROLL_PROVENANCE_PGP_PRIVATE_KEY
  if (!armoredKey) throw new Error('PAYROLL_PROVENANCE_PGP_PRIVATE_KEY_MISSING')
  let privateKey: Awaited<ReturnType<typeof readPrivateKey>>
  try {
    privateKey = await readPrivateKey({ armoredKey })
    if (!privateKey.isDecrypted()) throw new Error('encrypted')
  } catch { throw new Error('PAYROLL_PROVENANCE_PGP_PRIVATE_KEY_INVALID') }
  const keyCheck = await db.rpc('sec101_provenance_key_fingerprint')
  const fingerprint = createHash('sha256').update(privateKey.toPublic().write()).digest('hex')
  if (keyCheck.error || !keyCheck.data || keyCheck.data !== fingerprint) throw new Error('PAYROLL_PROVENANCE_KEY_MISMATCH')
  const byId = new Map(profiles.map((profile) => [profile.id, profile.employee_id]))
  const result: { id: string; employee_id: string; source_reference: string; confirmed_by_user_id: string }[] = []
  for (let start = 0; start < profiles.length; start += 50) {
    const ids = profiles.slice(start, start + 50).map((profile) => profile.id)
    const { data, error } = await db.rpc('sec101_profile_metadata', { p_ids: ids })
    if (error || !data || data.length !== ids.length) throw new AuthorizationError('Payroll-bronmetadata ontbreekt.')
    const seen = new Set<string>()
    for (const row of data) {
      if (!ids.includes(row.profile_id) || seen.has(row.profile_id) || typeof row.encrypted_payload !== 'string'
        || row.encrypted_payload.length > 16384) throw new AuthorizationError('Payroll-bronmetadata ongeldig.')
      seen.add(row.profile_id)
      let value: unknown
      try {
        const message = await readMessage({ binaryMessage: Buffer.from(row.encrypted_payload, 'base64') })
        const decrypted = await decrypt({ message, decryptionKeys: privateKey, format: 'utf8' })
        value = JSON.parse(decrypted.data)
      } catch { throw new AuthorizationError('Payroll-bronmetadata ongeldig.') }
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AuthorizationError('Payroll-bronmetadata ongeldig.')
      const payload = value as Record<string, unknown>
      if (payload.profileId !== row.profile_id || payload.actorUserId !== context.userId || payload.tenantId !== scope.tenantId
        || payload.hrGroupId !== scope.hrGroupId || payload.administrationId !== scope.administrationId
        || payload.employeeId !== byId.get(row.profile_id) || typeof payload.sourceReference !== 'string'
        || typeof payload.confirmedByUserId !== 'string') throw new AuthorizationError('Payroll-bronmetadata ongeldig.')
      result.push({ id: row.profile_id, employee_id: String(payload.employeeId), source_reference: payload.sourceReference, confirmed_by_user_id: payload.confirmedByUserId })
    }
  }
  return result
}
