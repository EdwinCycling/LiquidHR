# R4 Recruitment Overview — handoff

## Scope

- Branch: `work/r4-recruitment-overview`
- Worktree: `C:\Users\Edwin\Documents\Apps\LiquidHR.codex-worktrees\r4-recruitment-overview`
- Baseline: `1471aa224e2318b0c216d95e16b2ba1c4cd3ec64`
- Owned surface: `/recruitment`, `RecruitmentOverviewDashboard`, overview-only service/tests
- Test prefix: `R4-REC-OV`
- No push, merge, deployment, version bump, remote write or migration apply.

## Root cause and implementation

The previous page used inline legacy layout classes, calculated only three local vacancy metrics, showed `Nieuwe vacature` unconditionally, and had no permission-aware aggregate insights, explicit loading failure state or structured drilldown hierarchy.

The route now keeps the existing module and `requireAnyPermission` contract and delegates presentation to `RecruitmentOverviewDashboard`. The dashboard uses the existing `PageShell`, `PageHeader`, `SectionHeader`, `Surface`, `Badge`, `EmptyState` and button contracts. It provides:

- a compact aggregate summary using only existing vacancy data and the existing aggregate-only analytics RPC;
- vacancy rows with status, application counts, pipeline outcome context and links to the existing vacancy/pipeline detail route;
- links to existing assigned-application and recruitment-settings surfaces when the current permission contract allows them;
- permission-aware create visibility (`recruitment-vacancy:write`);
- candidate analytics only when `recruitment-candidate:read` is present;
- read-only, no-candidate-access, analytics-error, load-error and zero-vacancy states;
- responsive Foundation composition without decorative gradients, shadows, hover lift or nested card styling.

`overview-service.ts` validates the shape returned by the existing aggregate RPC and combines it with `listRecruitmentVacancies`. No candidate names, ranking, match score or new metric is introduced.

## Changed files

- `apps/hr-suite/app/(dashboard)/recruitment/page.tsx`
- `apps/hr-suite/components/recruitment/recruitment-overview-dashboard.tsx`
- `apps/hr-suite/components/recruitment/recruitment-overview-dashboard.test.tsx`
- `apps/hr-suite/lib/recruitment/overview-service.ts`
- `apps/hr-suite/lib/recruitment/overview-service.test.ts`
- `apps/hr-suite/messages/nl/recruitment.json`
- `apps/hr-suite/messages/en/recruitment.json`
- `docs/delivery/parallel/2026-08-24-r4-recruitment-overview.md`

No generic Foundation, navigation, vacancy, candidate, pipeline, report, detail, API, schema, RLS, permission definition or app-version file was changed.

## Permission and persona evidence

- The positive candidate is the existing HR fixture because the route accepts the existing vacancy/candidate/assessment/settings permission union and the aggregate analytics RPC requires `recruitment-candidate:read`.
- HR fixture `hradmin.fixture@liquidhr.test`: authenticated `/recruitment` rendered the real Planeten recruitment data and `GET /api/recruitment/vacancies` returned `200`.
- Manager fixture `manager.fixture@liquidhr.test`: `/recruitment` redirected to `/geen-toegang`; `GET /api/recruitment/vacancies` returned `403 Forbidden`.
- Employee fixture `employee.fixture@liquidhr.test`: `/recruitment` redirected to `/geen-toegang`; `GET /api/recruitment/vacancies` returned `403 Forbidden`.
- No permissions or RLS policies were broadened to make a fixture pass.

## Runtime acceptance

- Authenticated HR route: GREEN; real fixture showed 3 vacancies, 1 open vacancy, 3 active applications and 0 new applications in the aggregate summary.
- Drilldown: `Open pipeline: TEST-RECRUITMENT-Product Designer` opened `/recruitment/vacancies/a2000000-0000-4000-8000-000000000001`; the existing pipeline rendered its applications and stages.
- Desktop: authenticated route rendered at `1440x900`; document `scrollWidth` was `1440`.
- Mobile: authenticated route rendered at `390x844`; document `scrollWidth` was `390`; no horizontal page overflow.
- Browser console on the owned route: 0 errors. The final dev session emitted 4 Next CSS-preload warnings; none referenced Recruitment code.
- Zero/no-results: empty-state branch covered by `recruitment-overview-dashboard.test.tsx`; the live canonical fixture intentionally contains vacancies, so no live record was deleted or altered to manufacture an empty state.
- Mutation lifecycle: N/A. This overview introduces no mutation UI or test data.
- Screenshots were captured in the ignored `.playwright-cli` runtime folder at desktop and 390px during acceptance.

## Test data and cleanup

- Prefix reserved: `R4-REC-OV`.
- No records were created, changed, archived, deleted or externally notified.
- Residual test record IDs: none.
- Canonical `.env.local` was copied into the worktree for runtime only and is not tracked.

## Gates

- Targeted tests: 2 files, 3 tests passed.
- Full hr-suite: 236 test files, 902 tests passed.
- Strict TypeScript: passed.
- `check:i18n`: passed, 33 NL/EN namespaces in parity.
- Targeted ESLint: passed.
- Full ESLint: 0 errors, 8 existing warnings outside this slice.
- `git diff --check`: passed.
- Production build: not run; excluded by the parallel-slice contract.
- Browser/server: Webpack dev server on port `3141`; server stopped after acceptance.

## Migration and integration notes

- Migration: `NONE`.
- No remote Supabase action was needed or performed.
- Shared files touched: only the existing Recruitment NL/EN message namespaces; both keysets were updated symmetrically.
- Integration should include the route, dashboard component, overview service/tests, the two Recruitment message files and this handoff. Do not integrate generated `next-env.d.ts`, local `.env.local`, node_modules junctions or Playwright runtime artifacts.
