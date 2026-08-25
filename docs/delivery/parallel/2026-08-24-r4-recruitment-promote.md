# R4 Recruitment Promote — handoff

## Scope

- Branch: `work/r4-recruitment-promote`
- Baseline: `origin/main` / `1471aa224e2318b0c216d95e16b2ba1c4cd3ec64`
- Owned route: `/recruitment/vacancies/[vacancyId]/promote`
- Owned API: `PATCH /api/recruitment/vacancies/[vacancyId]/publication`
- Test prefix: `R4-REC-PROMO`
- No migration, remote schema apply, version bump, merge, push or deployment.

## Contract and implementation

The promote route requires the `RECRUITMENT` module and `recruitment-vacancy:publish`. The existing vacancy detail page now shows the promote link only when that permission is present. The publication RPC and existing RLS scope remain authoritative; the route does not broaden candidate, manager or employee access.

The promote screen now has a Foundation-based preview, a guarded internal configuration area and a separate external-publication action area. Preview and form configuration use `Surface`, `SectionHeader`, `TextInput`, `DropdownSelect`, `Button` and `ConfirmDialog`; the public action buttons require explicit confirmation. An already open publication is read-only for configuration so saving cannot silently alter public content.

The API now validates the complete publication payload and slug. An `OPEN` publication may initialize a non-archived vacancy; `CLOSED`/`ARCHIVED` updates require an existing publication; an archived vacancy cannot be reopened. The service returns `422` instead of allowing the existing database invariant to surface as a `500` when a draft has no publication.

Root cause found during acceptance: the existing SQL insert path created a `CLOSED` or `ARCHIVED` publication without `closed_at`/`archived_at`, violating the existing publication check constraint. No migration was authorized, so this slice fails closed at the API/UI boundary and records the gap for a future schema-approved change.

## Changed files

- `apps/hr-suite/app/(dashboard)/recruitment/vacancies/[vacancyId]/promote/page.tsx`
- `apps/hr-suite/app/(dashboard)/recruitment/vacancies/[vacancyId]/page.tsx`
- `apps/hr-suite/components/recruitment/publication-panel.tsx`
- `apps/hr-suite/app/api/recruitment/vacancies/[vacancyId]/publication/route.ts`
- `apps/hr-suite/app/api/recruitment/vacancies/[vacancyId]/publication/route.test.ts`
- `apps/hr-suite/lib/recruitment/vacancy-service.ts`
- `apps/hr-suite/lib/recruitment/vacancy-service.test.ts`
- `apps/hr-suite/messages/nl/recruitment.json`
- `apps/hr-suite/messages/en/recruitment.json`
- this handoff

## Real HTTP acceptance

Fixture login succeeded in memory for HR, Manager and Employee. HR baseline `GET /api/recruitment/vacancies` was `200` with zero matching prefix records. Creating `R4-REC-PROMO-20260824-1925` was `201`; detail readback was `200` with `DRAFT`; the promote page was `200` and rendered the promote title, preview and internal settings.

Captured negatives: malformed publication input `400 RECRUITMENT_PUBLICATION_INPUT_INVALID`; unknown vacancy `404 RECRUITMENT_VACANCY_NOT_FOUND`; Manager `403`; Employee `403`; anonymous request `401`. After cleanup, valid `CLOSED` and `OPEN` requests against the archived test vacancy both returned `422 RECRUITMENT_VACANCY_STATUS_INVALID`.

The first internal configuration attempt on the draft returned the pre-fix `500 RECRUITMENT_OPERATION_FAILED`; it exposed the existing SQL check-constraint mismatch above. No publication existed after that failed call. During the bounded cleanup fallback, the own test vacancy was briefly opened in-product, then `CLOSED 200` and `ARCHIVED 200` succeeded. Final readback was `vacancyStatus=ARCHIVED`, `publicationStatus=ARCHIVED`. No jobboard, social post, email, SMS or third-party webhook was executed. The in-product `OPEN` was not a third-party side effect, but it is recorded here for complete evidence.

Internal configuration save on an existing publication was not independently GREEN-proven: the own vacancy started as a draft with no publication, and creating the first publication requires the external `OPEN` action. The final UI therefore disables save until an existing publication exists and returns `422` at the service boundary for the unsafe initial `CLOSED`/`ARCHIVED` path.

## Browser and responsive evidence

`/login` on port `3148` returned `200` and the login accessibility snapshot rendered. Agent-browser then failed with `CDP response channel closed` after one fresh isolated retry. Authenticated desktop and `390x844` browser interaction, console and overflow evidence are therefore `NOT EXECUTED — TOOLING LIMITATION`; no product code was changed to work around the browser tool.

## Gates

- Targeted recruitment tests: `2` files, `8` tests — GREEN.
- Full hr-suite run before the final boundary guard: `235` files, `904` tests — GREEN, single worker.
- TypeScript: GREEN after final boundary guard.
- i18n parity: GREEN, `33` equal NL/EN namespaces.
- Changed-file ESLint: GREEN.
- Full ESLint was attempted; the first run caught and fixed the new JSX-in-try/catch errors, while the subsequent full run was interrupted after prolonged machine-wide Node contention. Existing-file warnings are unrelated; final changed-file lint is GREEN.
- `git diff --check`: GREEN.
- Migration: `NONE` / `NEEDS TEST MIGRATION APPROVAL` only if the future fix should repair the SQL insert invariant rather than keep the fail-closed boundary.

## Integration notes

No shared Foundation, navigation, status, or version files were changed. The central integration task should re-run authenticated desktop/390 browser evidence and decide separately whether the SQL invariant merits a future migration. No residual test records remain for prefix `R4-REC-PROMO`; the final test vacancy/publication IDs were `f57f6ac6-2498-4c9f-9b26-4d89e9b87bf1` and `0a22113e-762f-4da0-af82-463d6ea56d19`, both archived.
