# PAY-SECURITY-LIVE-FINAL — TEST security closeout

- Datum: 2026-10-23
- Repository/branch: `EdwinCycling/LiquidHR`, `integration/PAYROLL-MERGE-20261022`
- Basis: `d30d84812f9e8c90900bd3f876f88d4355476638`
- Scope: direct TEST logins, existing Payroll HTTP routes, targeted authorization fixes and regressions. No merge, deployment, payroll run, employee/history change or production operation.
- Code provenance: the authorization fix and this report are committed together on the branch; the full SHA is the PR #36 head containing this report.

## Result

| Gate | Result | Evidence |
| --- | --- | --- |
| Manager LIVE | **PASS** | The existing `manager.fixture@liquidhr.test` account authenticated through the normal `/login` flow. Its active manager context returned only six in-scope team members, including an allowed employee. `GET /api/employees?scope=all` could not widen the server-derived scope. A prior probe on the same account returned 90 employees and included an out-of-scope employee; this reproduced the leak before the fix. |
| Foreign tenant LIVE | **PASS** | The TEST HR Admin authenticated normally in the existing `CONTROL01 Test BV` context. Its own administration context and six employees loaded. Existing De Sterren employee, salary, run and PDF identifiers produced no cross-tenant data. Its own `/payroll/runs` page returned zero run links, so no positive own-tenant run-detail target existed. |
| Payroll/PDF authorization regression | **PASS** | Focused route/service/page tests: 49/49. Full HR Suite: 712 files passed, 4 skipped; 3,490 tests passed, 8 skipped, 0 failed. TypeScript, targeted ESLint and `git diff --check` passed. |

## Masked live HTTP evidence

All requests used normal session cookies obtained by direct sign-in. No mock, forced JWT claim, owner-switch, SQL query or service-role bypass was used for these HTTP probes. IDs below are redacted as placeholders.

| Actor / request | HTTP | Data check |
| --- | ---: | --- |
| Manager `GET /api/employees?scope=all` | 200 | Six rows; allowed team member present; known out-of-scope employee absent. |
| Manager `GET /api/employees/{in-scope employee}` | 200 | Allowed record returned. |
| Manager `GET /api/employees/{out-of-scope employee}` and `/salary` | 404 / 404 | No employee or salary fields returned. |
| Manager `GET /payroll/runs/{unauthorized run}` | 200 | Only a generic streamed not-found shell; no run or employee identifier/data. The existing `loading.tsx` stream starts before `notFound()`, so HTTP remains 200. |
| Manager `GET /api/payroll/runs/{unauthorized run}/artifact/PAYSLIP_PDF` and `/payslip-preview` | 403 / 403 | Generic 40-byte JSON errors; zero PDF bytes. |
| Foreign HR Admin `GET /api/context`, own administration selection, `GET /api/employees` | 200 / 200 / 200 | Context stayed in `CONTROL01 Test BV`; own administration accepted; six own-tenant employees only. |
| Foreign HR Admin direct De Sterren employee detail, salary and swapped employee ID | 404 / 404 / 404 | No employee or salary data. |
| Foreign HR Admin direct De Sterren run page | 200 | Generic streamed not-found shell only; no run or employee identifiers/data. |
| Foreign HR Admin De Sterren PDF and preview endpoints (including supplied foreign administration ID) | 403 / 403 | Generic 40-byte JSON errors; zero PDF bytes. |
| Foreign HR Admin POST administration-context with De Sterren administration ID | 403 | Generic permission error; selected context remained the CONTROL01 administration. |

The previous Manager list probe exposed 90 rows, including one employee outside the permitted team. The fix derives list scope from the existing authenticated server context: a `DIRECT_MANAGER` without `TENANT_ADMIN` is always passed to the existing `listEmployeesOverview` service with `team`, regardless of a caller-supplied `scope=all`. HR Admin retains the existing `all` scope. Regression tests cover both cases.

The run detail page now converts the existing `AuthorizationError` into the existing `notFound()` UI. It does not add a permission model; the tested streamed response contains no protected fields. Artifact and preview APIs continue to fail closed before returning bytes.

## Test identities and exact TEST rights

### Existing Manager

- Account: `manager.fixture@liquidhr.test` (pre-existing; not created or modified).
- Authentication: direct password login through the supported `/login` route.
- Effective scope observed: existing De Sterren / Planeten / Jupiter manager context; server-derived `DIRECT_MANAGER` team scope returned six employees. The role/grants were not altered.
- A client-supplied `scope=all` did not expand the result.

### Foreign TEST HR Admin created for this acceptance

- Account: `payroll.foreign-admin@liquidhr.test`.
- Auth user ID: `91ad0e24-a1aa-4ab4-b752-f59c641ed505`.
- Grant ID: `007844af-3778-4e5e-a65b-bbfa11ec1d19`.
- Existing tenant: `control01-test-bv` (`CONTROL01 Test BV`).
- Exact grant: existing HR Admin role code `TENANT_ADMIN`, scope type `ADMINISTRATION`, limited to the existing `Hoofdadministratie` HR group (`ba130060-b581-4bd8-ab9d-4bd85404e681`) and `Hoofdadministratie` administration (`a1df13b2-7f04-44b5-b024-bc80c81702f7`). The existing trigger created exactly one active matching `user_hr_group_access` mirror row.
- No De Sterren grant and no other tenant grant. Existing users and grants were not changed.
- Provisioning: official Supabase Auth Admin `createUser` API, then the existing `user_access` REST resource for the one scoped grant. No direct `auth.users` SQL insert.
- Password: generated uniquely with a cryptographic source and stored only in ACL-protected `%LOCALAPPDATA%\LiquidHR\TestRuntime\payroll-test-personas.env` under `PAYROLL_TEST_FOREIGN_ADMIN_PASSWORD`; it is intentionally absent from this report, Git, logs and PR text. The email is stored beside it under `PAYROLL_TEST_FOREIGN_ADMIN_EMAIL`.

### Safe revoke and cleanup plan

When these acceptance identities are retired, revoke only grant `007844af-3778-4e5e-a65b-bbfa11ec1d19` for auth user `91ad0e24-a1aa-4ab4-b752-f59c641ed505` through the supported access-management API, conditioned on the exact user, tenant and administration. Read back that it is inactive and its group-access mirror is inactive. Then delete only this Auth user through the official Supabase Auth Admin API and verify deletion. Finally remove only the two `PAYROLL_TEST_FOREIGN_ADMIN_*` entries from the ACL-protected local persona config and verify the file ACL remains restricted. If grant revocation cannot be verified, do not delete or re-grant; keep the acceptance blocked and escalate. No cleanup was run in this task.

## Scope boundary

No payroll run, PDF artifact, employee record, historical payroll data, tenant, existing account or existing grant was created, changed or deleted. No deployment or merge occurred. The existing CI workflow is configured to run the Linux build on pushes to this integration branch; final exact-HEAD build evidence is tracked in PR #36 checks.
