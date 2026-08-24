# R4 Recruitment Global Candidate Index

## Delivery

- Branch: `work/r4-recruitment-candidates`
- Baseline: `origin/main` / `1471aa224e2318b0c216d95e16b2ba1c4cd3ec64`
- Worktree: `C:\Users\Edwin\Documents\Apps\LiquidHR.codex-worktrees\r4-recruitment-candidates`
- Status: `GREEN` for the owned candidate-index slice
- Applicant Detail: unchanged

## Scope and implementation

The previously missing `/recruitment/candidates` surface is implemented as a read-only, server-rendered candidate index. `candidate-service.ts` validates and normalizes URL state, reads tenant/HR-group scoped candidates, applications, vacancies, and pipeline stages through the existing Supabase client, and derives paged rows without introducing candidate merge/dedupe logic.

The index preserves Candidate versus Application semantics: one candidate can show multiple application contexts, while status filtering is per application and never becomes a global candidate status. Existing `possible_duplicate` data is shown as a human-review signal. Search covers candidate contact fields and vacancy/stage context; status, vacancy, stage, sorting, paging, clear filters, no-results, and safe application drilldown are URL-driven.

The UI uses Foundation `PageShell`, `PageHeader`, `CollectionToolbar`, `FilterBar`, `DataTableShell`, `CollectionPagination`, `Surface`, `EmptyState`, `Badge`, `TextInput`, and `DropdownSelect`. Desktop uses a table and mobile uses a readable list strategy. Native links, buttons, labeled controls, and focus-visible Foundation behavior cover the keyboard/focus basics.

## Security and data lifecycle

- Server guard: `RECRUITMENT` module plus `recruitment-candidate:read` permission.
- Existing scoped Supabase reads/RLS remain authoritative; no schema, migration, policy, grant, or remote database change was made.
- No synthetic candidates/applications were created. Existing read-only `TEST-RECRUITMENT-*` fixture records were used; cleanup is therefore not applicable and no residual test data was introduced.
- No candidate merge, automatic dedupe, fit score, or Applicant Detail change was added.

## Acceptance evidence

- HR fixture: index rendered with HTTP 200; exact search for `TEST-RECRUITMENT-Noor` returned Noor and the duplicate signal.
- Combined search plus `ACTIVE` filter retained URL state and returned Ada and Noor; browser reload retained the same state and results.
- No-results query `R4-REC-CAND-NOT-FOUND` rendered the localized no-results state and clear-filters action.
- Application drilldown opened existing `/recruitment/applications/a5000000-0000-4000-8000-000000000001` with candidate, vacancy, and stage context.
- HR desktop viewport: `1440x900`, document width `1440`, no horizontal overflow.
- HR mobile viewport: `390x844`, mobile list rendered, document width `390`, no horizontal overflow. One Tab landed on the named `Open navigatie` button.
- Final browser console check: 0 errors.
- Manager and Employee fixture logins succeeded, but both fixtures were not linked to a customer environment; `/recruitment/candidates` rendered the existing `/geen-toegang` boundary with the no-customer message. This is negative access evidence, not a full tenant-scoped Manager/Employee acceptance run.
- The first dev-browser pass exposed a missing localized application-count key; the key was corrected before the final browser run. Final route renders and console checks were clean.

## Verification

- Candidate service tests: 4 passed.
- Full hr-suite tests: 235 files passed, 903 tests passed.
- Strict TypeScript: passed with `tsc --noEmit --incremental false`.
- i18n: passed; 33 namespaces have equal NL/EN keys.
- ESLint: 0 errors, 8 pre-existing warnings outside this slice.
- `git diff --check`: passed.
- Dev server on port 3146: stopped after browser acceptance.
- Production build, remote migration, deployment, merge, and push: not run; none was authorized for this slice.

## Handoff

Changed files are limited to the owned route, candidate service/tests, candidate index component, this parallel handoff, and the NL/EN recruitment message additions. No central delivery context, implementation status, UX status, or acceptance matrix was changed. Integration can review the new route/service against current Foundation and recruitment contracts; production build and release evidence remain integration/release scope.
