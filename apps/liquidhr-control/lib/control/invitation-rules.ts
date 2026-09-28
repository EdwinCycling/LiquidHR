export class InvitationError extends Error {
  constructor(readonly code: 'INVITATION_CREATE_FAILED', readonly status: 400) {
    super(code)
  }
}
