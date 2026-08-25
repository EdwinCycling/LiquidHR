# R4 Recruitment Vacancy Pipeline — handoff

Datum: 2026-08-24
Baseline: `1471aa224e2318b0c216d95e16b2ba1c4cd3ec64`
Branch: `work/r4-recruitment-pipeline`
Worktree: `C:\Users\Edwin\Documents\Apps\LiquidHR.codex-worktrees\r4-recruitment-pipeline`
Scope: `/recruitment/vacancies/[vacancyId]/candidates`, `RecruitmentVacancyPipeline`, direct application/stage service and tests.

## Status

- IMPLEMENTED: vacancy-scoped pipeline read model, zero-count stages, stage/terminal columns, filter, responsive mobile list, mutation status handling and i18n.
- TEST MIGRATIONS APPLIED: only the canonical application migration and corrected archive migration were applied to TEST project `wnpfloqpjvaacobppbpk`, recorded remotely as `20260825140121` and `20260825140137`. The duplicate pipeline migration remains absent.
- ACCEPTANCE GREEN: isolated vacancy `2634799b-2ce0-42ad-9c1e-3643b5cb24c2` with three synthetic manual applications using `@example.invalid` passed create, pipeline GET, legal move, fresh readback, duplicate contract and archive flow.
- PRODUCT FIXES: manual application form now retains the form target across the async request before reset; pipeline application list items now have stable React keys. Both were required by real acceptance and are covered by the final gates.
- CLEANUP: vacancy and its single publication are `ARCHIVED`; `archived_at` is non-null and returned slug is `vacancy-2634799b`. The supported product contract has no destructive vacancy/application delete path, so application and candidate IDs remain as documented residual TEST records.
- PERSONAS: HR Admin proved positive CRUD; Manager and Employee both received the existing `403 {"error":"Je hebt onvoldoende rechten voor deze actie."}` boundary. Anonymous received `401`; out-of-scope received `404 RECRUITMENT_VACANCY_NOT_FOUND`.
- RELEASE: no push, merge, deploy or app-version bump. No email, SMS or interview invitation was sent.

## Implementatie

- `listRecruitmentVacancyPipeline` returns the vacancy, all existing stages including zero-count stages, and anonymized application cards in tenant/HR-group scope.
- `/api/recruitment/vacancies/[vacancyId]/applications` now uses the candidate-read permission and returns backward-compatible `data` plus `stages` and `vacancy` metadata with `Cache-Control: no-store`.
- `RecruitmentVacancyPipeline` uses Foundation primitives, active-stage filtering, terminal outcome columns, wrapping cards, mobile vertical representation, and response-aware `409`/`422` mutation feedback before `router.refresh()`.
- Manual application submission captures the form element before awaiting the API response, preventing the browser `currentTarget` null failure after a successful `201`.
- Pipeline application cards expose stable React keys, keeping the populated pipeline console-clean.
- The pipeline trusts the canonical Applicant Detail application migration `20260824172115_recruitment_application_normalized_email_fix.sql` after integration; its duplicate `20260824183000_guided_recruitment_manual_application_ambiguity_fix.sql` is intentionally absent. `20260824183100_guided_recruitment_archive_draft_fix.sql` supports cleanup of an empty DRAFT vacancy and returns its effective slug on insert.
- Added direct application/stage service and migration contract tests; NL/EN recruitment keys remain symmetric.

## Verificatie

| Gate / scenario | Resultaat |
| --- | --- |
| Targeted recruitment tests | GREEN, 16 files / 48 tests |
| Full Vitest suite | GREEN, 235 files / 905 tests |
| Strict TypeScript | GREEN |
| `check:i18n` | GREEN, 33 namespaces with equal NL/EN keys |
| ESLint | exit 0, 8 pre-existing warnings, 0 errors |
| Webpack production build | GREEN; compile, TypeScript and static generation `224/224` |
| Manual application create | `201`; candidate/application IDs returned; event/readback present; normalized email lowercased |
| Pipeline API GET, own vacancy | `200`; four existing stages returned, counts `2/1/0/0`, plus terminal zero columns |
| Stage mutation | `200`; `TEST-RECRUITMENT-Nieuw` → existing `TEST-RECRUITMENT-Telefonisch`; fresh readback version `2` |
| Invalid transition | `422 {"code":"RECRUITMENT_STAGE_INVALID"}` |
| Duplicate contract | `201` with `possibleDuplicate: true`; normalized email and candidate `possible_duplicate` confirm existing behavior |
| Pipeline UI desktop `1440x900` | GREEN; moved card visible after refresh, no horizontal overflow, fresh console 0 errors/0 warnings |
| Pipeline UI `390x844` | GREEN; mobile vertical list, no forced kanban overflow, no horizontal overflow, fresh console 0 errors/0 warnings |
| Unauthenticated pipeline API | `401 {"error":"Je bent niet ingelogd."}` |
| Authenticated out-of-scope pipeline API | `404 {"code":"RECRUITMENT_VACANCY_NOT_FOUND"}` |
| Anonymous pipeline API | `401 {"error":"Je bent niet ingelogd."}` |
| Manager/Employee pipeline API | both `403 {"error":"Je hebt onvoldoende rechten voor deze actie."}` |
| Authenticated out-of-scope pipeline API | `404 {"code":"RECRUITMENT_VACANCY_NOT_FOUND"}` |
| Archive cleanup | `200`; vacancy/publication `ARCHIVED`, returned slug non-null, `archived_at` non-null, publication count `1` |
| Supabase advisors | Read-only run completed; existing project-wide findings, no remote changes |

The standard Turbopack build failed only on the known worktree `node_modules` junction; the required Webpack build is GREEN.

## Vervolg

1. Review and integrate this branch; no push, merge, deploy or production migration was performed by this task.
2. Residual TEST application/candidate IDs are retained because cleanup was limited to the supported archive contract; remove them only through a separately approved supported contract if one is introduced.
