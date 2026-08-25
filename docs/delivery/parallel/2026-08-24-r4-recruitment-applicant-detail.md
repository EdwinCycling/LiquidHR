# R4 Recruitment Applicant Detail

Status: `NEEDS TEST MIGRATION APPROVAL`

Branch: `work/r4-recruitment-applicant-detail`

Worktree: `C:\Users\Edwin\Documents\Apps\LiquidHR.codex-worktrees\r4-recruitment-applicant-detail`

Port: `3145`

Test prefix: `R4-REC-APP`

## Scope

- Added `/recruitment/vacancies/[vacancyId]/candidates/[applicantId]` and its authenticated GET API.
- Added `RecruitmentCandidateDetail` as a compact Foundation workspace with overview, interviews, assessments and history tabs.
- Reused existing application actions only: stage/reopen, reject, hire and guided interview creation.
- Displayed existing application data: contact details, motivation, answers, clean documents, terminal reason/note, stage/source, other applications and events.
- No notes mutation, combined score, mail, SMS, offer dispatch or calendar invite was added.
- Added dirty-close protection to stage, reject, hire and guided-interview forms; action responses capture HTTP status before `router.refresh()`.

## Root cause and migration

The supported manual application contract was exercised with an own vacancy and synthetic applicant. Vacancy creation returned `201` and readback returned `200`, but applicant creation returned `500` with `RECRUITMENT_OPERATION_FAILED`. Server evidence identified the existing remote function failure:

`column reference "normalized_email" is ambiguous`

The canonical forward migration `apps/hr-suite/supabase/migrations/20260825140121_recruitment_application_normalized_email_fix.sql` qualifies the normalized-email variable in `create_recruitment_application`. It is already registered on TEST under this canonical timestamp; no migration was applied in this integration run. The own applicant transaction rolled back; no own application or candidate ID exists.

Required next step: apply and verify this migration in the approved test database, then rerun applicant creation and all positive applicant-action/readback checks. This task must remain `NEEDS TEST MIGRATION APPROVAL` until that happens.

## Test data and cleanup

- Own vacancy: `c2676498-2424-44bd-91db-93deff71f7b8`
- Own vacancy name used the `R4-REC-APP` prefix and intentionally long title/location text.
- Own application list readback: `200`, count `0`.
- Cleanup: supported publication lifecycle `OPEN` returned `200`, followed by `ARCHIVED` returned `200`; vacancy readback returned `200` with vacancy `ARCHIVED`, publication `ARCHIVED`, application count `0`.
- No demo application was mutated. Existing `TEST-RECRUITMENT` data was used read-only for rendering checks.

## Acceptance evidence

- HR nested applicant API readback on an existing demo application: `200`; invalid IDs: `400 RECRUITMENT_APPLICANT_DETAIL_INPUT_INVALID`; missing and vacancy-mismatched application: `404 RECRUITMENT_APPLICATION_NOT_FOUND`.
- HR invalid-input checks using a non-existent application ID: stage `400`, reject `400`, hire `400`, guided interview `400 RECRUITMENT_INTERVIEW_INPUT_INVALID`.
- Manager negative persona: nested read masked as `404`; stage mutation denied as `403`.
- Employee negative persona: nested read masked as `404`; reject mutation denied as `403`.
- Fresh HR browser route readback: rendered the nested detail page with console `0` errors and `0` warnings.
- Desktop `1440x900`: no horizontal overflow (`scrollWidth=1440`).
- Mobile `390x844`: no horizontal overflow (`scrollWidth=390`).
- Dirty rejection flow showed the unsaved-changes confirmation and discarded the text without submitting a mutation.
- Initial stale HMR state emitted a missing-key error after a translation edit; a clean server restart rendered the final route successfully and produced the clean console evidence above.

## Verification

- Full Vitest suite: `236` files, `902` tests passed.
- TypeScript: passed.
- i18n parity: `33` namespaces with matching NL/EN keys.
- Targeted ESLint: passed without warnings.
- Full ESLint: passed with 8 existing warnings outside this slice.
- Webpack production build: passed (`next build --webpack`).
- Devserver stopped after browser verification.
- No remote migration, push, merge, deploy or version bump performed.

## Open handoff

After migration approval and test-database verification, recreate the own applicant with the `R4-REC-APP` name/email contract, capture the real `201` response and application/candidate IDs, then run positive stage/reopen, reject, guided interview and hire-contract checks with status-before-navigation, readback, UI readback and final candidate/application/vacancy cleanup.
