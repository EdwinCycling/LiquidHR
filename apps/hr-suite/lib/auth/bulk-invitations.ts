import {
  InvitationError,
  type CreateInvitationInput,
  type InvitationErrorCode,
} from '@/lib/auth/invitation-rules'
import { createEmployeeInvitation } from '@/lib/auth/employee-invitations'
import { requirePermission } from '@/lib/auth/permissions'
import { createInvitation } from '@/lib/auth/invitations'

export type BulkInvitationInput = Omit<CreateInvitationInput, 'origin'>

export interface BulkInvitationResult {
  email: string | null
  employeeId?: string
  ok: boolean
  invitationId?: string
  expiresAt?: string
  errorCode?: InvitationErrorCode | 'UNKNOWN'
}

export interface BulkInvitationSummary {
  total: number
  succeeded: number
  failed: number
  results: BulkInvitationResult[]
}

export async function createBulkInvitations(
  inputs: readonly BulkInvitationInput[],
  origin: string,
): Promise<BulkInvitationSummary> {
  await requirePermission('user:invite')

  const results: BulkInvitationResult[] = []
  for (const input of inputs) {
    try {
      const invitation = await createInvitation({ ...input, origin })
      results.push({ email: input.email, ok: true, invitationId: invitation.id, expiresAt: invitation.expiresAt })
    } catch (error) {
      results.push({
        email: input.email,
        ok: false,
        errorCode: error instanceof InvitationError ? error.code : 'UNKNOWN',
      })
    }
  }

  return {
    total: results.length,
    succeeded: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    results,
  }
}

export async function createBulkEmployeeInvitations(
  employeeIds: readonly string[],
  origin: string,
): Promise<BulkInvitationSummary> {
  const results: BulkInvitationResult[] = []
  for (const employeeId of employeeIds) {
    try {
      const invitation = await createEmployeeInvitation(employeeId, origin)
      results.push({ email: invitation.email, employeeId, ok: true, invitationId: invitation.id, expiresAt: invitation.expiresAt })
    } catch (error) {
      results.push({
        email: null,
        employeeId,
        ok: false,
        errorCode: error instanceof InvitationError ? error.code : 'UNKNOWN',
      })
    }
  }

  return {
    total: results.length,
    succeeded: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    results,
  }
}
