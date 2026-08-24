# R4 Recruitment Vacancy Report

## Scope

- Branch: `work/r4-recruitment-report`
- Baseline: `origin/main` / `1471aa224e2318b0c216d95e16b2ba1c4cd3ec64`
- Worktree: `C:\Users\Edwin\Documents\Apps\LiquidHR.codex-worktrees\r4-recruitment-report`
- Local port: `3147`
- Owned route: `/recruitment/vacancies/[vacancyId]/report`

## Delivered

- Added `RecruitmentVacancyReport` with Foundation controls, responsive metric cards, status/source breakdowns, URL-state filters, loading/error state, empty state, and no-results state.
- Added a direct vacancy-scoped report service and API route. The query is tenant- and HR-group-scoped, excludes anonymized applications, supports inclusive date range, status, pipeline stage, and source filters, and limits the result set to 5000 rows.
- Terminal outcomes are authoritative for hired/rejected metrics; active pipeline stages are used only for non-terminal applications. Conversion rate is unavailable when there are no applications.
- Added direct service tests for source-data metrics, filter semantics, query validation, and explicit no-results behavior.
- Added matching Dutch and English translation keys.
- No database migration or remote database write was needed.

## Permissions and privacy

The page and API require the Recruitment module and `recruitment-candidate:read`. The authenticated HR fixture received the report; Manager and Employee fixtures received `403` from the API and were redirected to `/geen-toegang` in the UI. Anonymous API access received `401`. Responses were JSON and marked `no-store`.

## Acceptance evidence

- Existing synthetic vacancy `TEST-RECRUITMENT-Product Designer` (`a2000000-0000-4000-8000-000000000001`) was used read-only; no R4 fixture rows were created, so no cleanup was required.
- HR API response: `200 application/json`; metrics were `3 total`, `2 active`, `0 hired`, `1 rejected`, conversion `0%`.
- Rendered HR values matched the API metrics and breakdowns exactly.
- No-results date filter returned `200`, all counters `0`, and conversion `null` / `Niet beschikbaar` in the rendered UI.
- Desktop `1440x900` and mobile `390x844` both rendered without horizontal overflow. Large labels and filter controls remained usable.
- Report-page browser console had zero errors.
- Recruitment export endpoint did not exist; no export was added for this task.

## Verification

- Targeted service tests: `4/4` passed.
- Full hr-suite tests: `235` files and `903` tests passed.
- Strict TypeScript check: passed.
- i18n check: passed; 33 namespaces remained key-equivalent.
- Full lint: passed with 8 pre-existing warnings outside this slice and no errors.
- `git diff --check`: passed.
- Webpack development server served the authenticated report route on port `3147`.

## Integration notes

The slice is self-contained in the recruitment report route, API, service, component, tests, and recruitment translation namespaces. No shared Foundation component or central delivery document was changed. The generated `apps/hr-suite/next-env.d.ts` change was restored before handoff. No push, merge, deploy, migration, or remote write was performed.

Status: GREEN for local integration review.
