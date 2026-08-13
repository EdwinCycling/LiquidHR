export type RecruitmentErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503

export class RecruitmentError extends Error {
  constructor(readonly code: string, readonly status: RecruitmentErrorStatus) {
    super(code)
    this.name = 'RecruitmentError'
  }
}

const DATABASE_ERROR_STATUS: Readonly<Record<string, RecruitmentErrorStatus>> = {
  RECRUITMENT_APPLICATION_NOT_FOUND: 404,
  RECRUITMENT_PUBLICATION_NOT_OPEN: 404,
  RECRUITMENT_FORBIDDEN: 403,
  RECRUITMENT_PUBLIC_PROOF_INVALID: 403,
  RECRUITMENT_PUBLIC_PROOF_REQUIRED: 403,
  RECRUITMENT_APPLICATION_TERMINAL: 409,
  RECRUITMENT_APPLICATION_NOT_TERMINAL: 409,
  RECRUITMENT_VERSION_CONFLICT: 409,
  RECRUITMENT_PIPELINE_EMPTY: 409,
  RECRUITMENT_IDEMPOTENCY_REQUIRED: 422,
  RECRUITMENT_STAGE_INVALID: 422,
  RECRUITMENT_OUTCOME_INVALID: 422,
  RECRUITMENT_PUBLIC_INPUT_INVALID: 422,
}

export function recruitmentDatabaseError(error: { readonly message: string }): RecruitmentError {
  const code = Object.keys(DATABASE_ERROR_STATUS).find((candidate) => error.message.includes(candidate))
  return code
    ? new RecruitmentError(code, DATABASE_ERROR_STATUS[code] ?? 500)
    : new RecruitmentError('RECRUITMENT_OPERATION_FAILED', 500)
}
