# R4 Recruitment Vacancy Pipeline — handoff

Datum: 2026-08-24
Baseline: `1471aa224e2318b0c216d95e16b2ba1c4cd3ec64`
Branch: `work/r4-recruitment-pipeline`
Worktree: `C:\Users\Edwin\Documents\Apps\LiquidHR.codex-worktrees\r4-recruitment-pipeline`
Scope: `/recruitment/vacancies/[vacancyId]/candidates`, `RecruitmentVacancyPipeline`, direct application/stage service and tests.

## Status

- IMPLEMENTED: vacancy-scoped pipeline read model, zero-count stages, stage/terminal columns, filter, responsive mobile list, mutation status handling and i18n.
- LOCALLY VERIFIED: targeted recruitment tests `12/12`, full Vitest suite `234 files / 903 tests`, strict TypeScript, i18n, ESLint exit 0, `git diff --check`, Webpack production build.
- AUTHENTICATED BROWSER/API PARTIAL: own vacancy pipeline GET returned `200` with four existing stages at `applicationCount: 0`; desktop and `390x844` rendered without product console errors. Unauthenticated API returned `401`; authenticated out-of-scope vacancy returned `404 RECRUITMENT_VACANCY_NOT_FOUND`.
- OPEN / NEEDS TEST MIGRATION APPROVAL: the baseline remote direct-application RPC returns `500 RECRUITMENT_OPERATION_FAILED` because `normalized_email` is ambiguous. A local forward migration fixes this; remote migration apply was not authorized.
- OPEN / CLEANUP BLOCKED: the baseline remote archive RPC returns `500 RECRUITMENT_OPERATION_FAILED` when archiving a DRAFT without a publication because `archived_at` is not set on the insert path. A local forward migration fixes this; the own empty DRAFT vacancy remains until that migration is applied and cleanup is rerun.
- NOT PROVEN: real application creation, legal stage move, fresh mutation readback, UI stage refresh with an application, and Manager/Employee persona negatives. The role-switch endpoint returned `403 TEST_ROLE_SWITCH_FORBIDDEN`; no external fixture application was mutated.
- RELEASE: no push, merge, deploy or app-version bump. No email, SMS or interview invitation was sent.

## Implementatie

- `listRecruitmentVacancyPipeline` returns the vacancy, all existing stages including zero-count stages, and anonymized application cards in tenant/HR-group scope.
- `/api/recruitment/vacancies/[vacancyId]/applications` now uses the candidate-read permission and returns backward-compatible `data` plus `stages` and `vacancy` metadata with `Cache-Control: no-store`.
- `RecruitmentVacancyPipeline` uses Foundation primitives, active-stage filtering, terminal outcome columns, wrapping cards, mobile vertical representation, and response-aware `409`/`422` mutation feedback before `router.refresh()`.
- Added `20260824183000_guided_recruitment_manual_application_ambiguity_fix.sql` for the direct application RPC and `20260824183100_guided_recruitment_archive_draft_fix.sql` for supported cleanup of an empty DRAFT vacancy.
- Added direct application/stage service and migration contract tests; NL/EN recruitment keys remain symmetric.

## Verificatie

| Gate / scenario | Resultaat |
| --- | --- |
| Targeted recruitment tests | GREEN, 2 files / 12 tests |
| Full Vitest suite | GREEN, 234 files / 903 tests |
| Strict TypeScript | GREEN |
| `check:i18n` | GREEN, 33 namespaces with equal NL/EN keys |
| ESLint | exit 0, 8 pre-existing warnings, 0 errors |
| Webpack production build | GREEN; compile, TypeScript and static generation `224/224` |
| Pipeline API GET, own vacancy | `200`; four existing stages and all four zero-count columns returned |
| Pipeline UI desktop | GREEN; existing stages visible, zero counts preserved |
| Pipeline UI `390x844` | GREEN; mobile vertical empty state, no forced kanban overflow |
| Unauthenticated pipeline API | `401 {"error":"Je bent niet ingelogd."}` |
| Authenticated out-of-scope pipeline API | `404 {"code":"RECRUITMENT_VACANCY_NOT_FOUND"}` |
| Manual application POST | BLOCKED by remote baseline RPC ambiguity; `500 {"code":"RECRUITMENT_OPERATION_FAILED"}` |
| Archive cleanup | BLOCKED by remote baseline DRAFT publication check; `500 {"code":"RECRUITMENT_OPERATION_FAILED"}` |
| Supabase advisors | Read-only run completed; existing project-wide findings, no remote changes |

The standard Turbopack build failed only on the known worktree `node_modules` junction; the required Webpack build is GREEN.

## Vervolg

1. Apply the two forward migrations through the approved TEST database workflow.
2. Repeat isolated browser acceptance with two `example.invalid` applications: POST `201`, pipeline GET/readback, legal next-stage transition, invalid transition `422`, UI refresh, filters and mobile populated cards.
3. Archive the own vacancy through the supported publication contract and verify no `R4-REC-PIPE` records remain.
4. Only then mark the slice GREEN for integration; this branch has not been pushed or merged.
