# NMBRS-01 — Final Convergence Acceptance — 2026-10-11

## 1. Executive Summary

**Verdict: LOCAL QUALITY GREEN; LIMITED SYNTHETIC TEST RELEASE AUTHORIZED; hosted release checks pending.** Selective Nmbrs P0/P1 code is based directly on verified `origin/main` `7bc40b46ce18af2a63e2a73d7a0fcfa7a660f865`. Code candidate `ceb7df9c973920b382af9ed8d02037c09cc373bd` includes the minimal migration-contract newline fix and the one-time version bump to `1.20261011.2`. At this quality-gate checkpoint, no push, PR, merge, deployment, or remote database write had occurred.

Post-merge closeout: PR #19 was merged at 2026-10-11 17:33Z as main SHA `deba6c0d5489bbe1ab15a77e1f60169661121816`; the local `main` ref, `origin/main`, and GitHub `main` now match. As of 17:43Z no automatic Vercel deployment existed for that SHA; the latest READY deployment remained on older SHA `c90275c5775a276d5ccd62f563b44372ee78ae11`. Hosted smoke was not run against the old deployment, and the required hosted closeout remains OPEN.

The migration text-contract failure was caused by CRLF in the unchanged checked-out SQL compared with an LF assertion. The test now normalizes line endings before evaluating the same contract; no security assertion or migration history changed. The complete applicable local gates are green. Isolated Preview, real Nmbrs OAuth, and live company-discovery/binding acceptance remain OPEN under the explicit AA-REL §8 limited TEST decision.

## 2. Coverage

- Integrated the provider-neutral payroll contract, Nmbrs OAuth/API adapter, encrypted server-only credentials, private RPC client, connection health, company discovery, administration bindings, disconnect lifecycle, guarded routes, settings UI, and NL/EN strings.
- Enabled the existing `PAYROLL` module as an opt-in feature within Payroll Lab. The existing Payroll Professional route and settings page remain byte-identical to current main; the sidebar has one Payroll Lab entry.
- Employee synchronization, matching, and apply actions remain out of scope. CONTROL02 and official Loonaangifte XML import remain cancelled.
- No P0/P1 migration was copied because current main already contains equivalent contracts; no generated database types were changed.

## 3. Role Matrix

| Role/permission | Evidence | Result |
|---|---|---|
| `payroll:read` | Mocked service gate and tenant/HR-group scoping | GREEN in unit tests; hosted persona acceptance OPEN |
| `payroll:manage` | Mocked binding scope, foreign administration rejection, and API route contracts | GREEN in unit tests; hosted persona acceptance OPEN |
| Manager, Employee, anonymous | No authenticated browser or hosted matrix was run | OPEN |

## 4. Functional Results

OAuth initiation and callback state handling, credential-envelope encryption, provider token rotation/revocation contracts, service authorization/scope, company-binding idempotency/audit, Payroll module activation, and Payroll Lab navigation passed local tests. Company discovery and binding were not exercised against a real provider or hosted database.

| ID | Area | What broke | Why | Fix | Regression | Result |
|---|---|---|---|---|---|---|
| NMBRS-F01 | OAuth routes | Cross-origin initiation and request-host redirect were not sufficiently constrained | Route boundary tests did not cover forged origin/host inputs | Same-origin initiation check, browser-bound HttpOnly state cookie, and relative callback redirect | OAuth route tests in the final 61-file suite | GREEN locally |
| NMBRS-F02 | Provider credentials | Refresh rotation and failed revocation needed fail-closed handling and a visible outcome | Previous checks did not exercise omitted rotated token or surfaced revocation failure | Reject missing rotated refresh token; report revocation result in UI | Provider/encryption tests and production client-boundary scan | GREEN locally |
| NMBRS-F03 | Company bindings | Repeat-bind and audit contracts lacked direct service assertions | Existing tests focused on permissions and isolation | Added tests that repeated binds do not write again and successful binds audit scoped identifiers | Payroll service authorization tests | GREEN locally |
| NMBRS-F04 | Payroll settings route | Early integration work overlapped the existing Payroll Professional settings route | Legacy and current UI used the same route path | Restored the main version byte-for-byte; Nmbrs UI lives under Payroll Lab | Route build and Git blob comparison against `origin/main` | GREEN locally |

## 5. Negative/Security Results

- Local tests cover cross-origin OAuth initiation rejection, callback state-cookie matching and replay protection, permission/module gates, tenant and HR-group filters, foreign administration rejection, and not-found behavior without mutation for an out-of-scope binding.
- The credential envelope rejects missing configuration and tampered ciphertext. The provider fails closed when refresh-token rotation is omitted. The adapter uses only company metadata endpoints; no employee/employment sync endpoint was added.
- No secrets, tokens, credential rows, or `.env.local` values were read or committed. No live OAuth or hosted security assertion is claimed.

## 6. Mobile/Responsive Results

No browser or responsive acceptance was run. The isolated Preview gate was unavailable, so desktop and mobile rendering remain OPEN.

## 7. Data/DB Readback

- Read-only TEST lineage/schema/RLS preflight found the P0/P1 provider objects already present and equivalent to current main contracts. No remote migration, SQL write, or database mutation was performed.
- Credential contents were not read. Preview backend isolation was not established; the protected Supabase URL value was not decrypted or inspected.
- There are no new SQL migration files or generated type changes in the candidate.

## 8. Quality Gates

| Gate | Result |
|---|---|
| Focused migration contract | 15/15 tests PASS after CRLF-to-LF normalization in the test reader; all security assertions remain unchanged |
| Non-live Payroll/Payroll Lab regression | PASS on code SHA `8668e36332618e5b3735d57c8afeaacff641ef5c`; 65 files, 438/438 tests |
| Complete non-live HR suite | PASS on code SHA `8668e36332618e5b3735d57c8afeaacff641ef5c`; 612 files passed, 1 suite skipped; 2,884 tests passed, 5 skipped; three `.live.test.ts` files excluded |
| Strict TypeScript | PASS on final versioned SHA `ceb7df9c973920b382af9ed8d02037c09cc373bd` (`tsc --noEmit`) |
| ESLint | PASS on final versioned SHA, zero errors; seven existing warnings in untouched Payroll import/Payrun files |
| NL/EN i18n | PASS on final versioned SHA; 43 namespaces have matching keys |
| Production build | PASS on exact versioned candidate SHA `ceb7df9c973920b382af9ed8d02037c09cc373bd` with Next.js Webpack; 323 static pages generated |
| Client boundary | PASS; negative control and scan of 666 browser assets |
| Build provenance | PASS; `.next` provenance records exact candidate SHA and build ID `VlpsZI4OOaphJeeiCkhZN`, without runtime values |
| Diff/framework drift | PASS; `git diff --check` clean; `next-env.d.ts` matches `origin/main`; no SQL migration or generated database type changed |

The default Turbopack build could not create a junction under the restricted Windows run. The production build completed with `next build --webpack`; no project configuration was changed to work around the junction restriction.

## 9. Fixed During Run

- **NMBRS-F01 — OAuth request boundary.** Module/route: Nmbrs authorize and callback. Persona: mocked `payroll:manage` route harness; no live identity. Symptom: cross-origin initiation and untrusted host-derived redirect were not rejected. Classification: security. Root cause: request metadata could influence the return path and initiation had no same-origin gate. Previous tests missed it because route tests did not exercise forged origin/host inputs. Change/fix: enforce same-origin initiation, bind state to an HttpOnly browser cookie, use a relative callback redirect, and set no-store/no-referrer headers. Files: Nmbrs authorize/callback routes and payroll service; migrations: none. DEV data/config changed: no. Regression/retest: route tests passed in the final suite. Downstream rechecked: provider tests, build, and client-boundary scan. Security/privacy impact: prevents cross-origin state creation and host-controlled redirect. Behavior: preserves intended OAuth flow. Commit: `a49c5130470146c6bcdf4bfbe95d7db7ced7d5f9`. Lesson: request host headers are not redirect authority.
- **NMBRS-F02 — Credential lifecycle.** Module: Nmbrs provider/service and integration action UI. Persona: mocked provider/service tests; no live identity. Symptom: an omitted rotated refresh token could leave an unusable credential accepted, and remote revocation failure was not visible in the UI. Classification: credential lifecycle and error handling. Root cause: missing explicit failure branch and response interpretation. Previous tests missed the omitted-token and wrapped-revocation cases. Change/fix: fail closed if rotation is absent, restore connection error state on failed OAuth operations, record safe audit outcomes, and surface failed revocation. Files: provider client, payroll service, Payroll actions; migrations: none. DEV data/config changed: no. Regression/retest: provider, callback, and component tests passed in the final suite. Downstream rechecked: production build and client-boundary scan. Security/privacy impact: avoids reusing a single-use refresh token and does not expose token material. Behavior: preserves intended provider lifecycle. Commit: `a49c5130470146c6bcdf4bfbe95d7db7ced7d5f9`. Lesson: test token-rotation and remote-revocation failure paths explicitly.
- **NMBRS-F03 — Binding idempotency/audit coverage.** Module: company binding service. Persona: fixture service harness. Symptom: repeated bind and audit payload behavior lacked direct assertions. Classification: test-coverage gap. Root cause: prior service tests covered access and scope but not repeated success/audit. Previous tests missed the gap because they stopped at rejection paths. Change/fix: added assertions for no second write on repeat bind and tenant/HR-group/actor-scoped audit data on creation. Files: payroll service authorization test; migrations: none. DEV data/config changed: no. Regression/retest: both new cases pass in the final 65-file Payroll/Payroll Lab suite. Downstream rechecked: Payroll regression set. Security/privacy impact: preserves isolation and auditable lifecycle without recording credentials. Behavior: locks in intended idempotency/audit contracts. Commit: `a49c5130470146c6bcdf4bfbe95d7db7ced7d5f9`. Lesson: assert write counts and audit scope on successful lifecycle operations.
- **NMBRS-F04 — Existing settings route preservation.** Module/route: Payroll Professional settings. Persona: existing app users. Symptom: the initial integration work overlapped the existing settings route. Classification: integration collision. Root cause: both surfaces targeted the same path. Previous tests missed it because they did not compare route content against current main. Change/fix: restored the existing page exactly and placed Nmbrs settings under `/payroll-lab/integrations`. Files: Payroll Lab integration page; no changes remain to the existing settings page; migrations: none. DEV data/config changed: no. Regression/retest: production route build passed and Git blob matches `origin/main`. Downstream rechecked: route manifest and Payroll Lab tests. Security/privacy impact: none. Behavior: preserves the existing Payroll Professional UX. Commit: `a49c5130470146c6bcdf4bfbe95d7db7ced7d5f9`. Lesson: verify modern shared routes before integrating legacy surfaces.

## 10. OPEN ENVIRONMENT EVIDENCE AND LIMITED RELEASE DECISION

### AA-REL §8 limited TEST release-decision matrix

| Gate or decision | Status | Evidence / limit |
|---|---|---|
| Mandatory local security and quality gates | GREEN for the approved scope | Full non-live HR suite and Payroll regressions passed on code SHA `8668e36332618e5b3735d57c8afeaacff641ef5c`; strict TypeScript, ESLint, i18n, production build, client-boundary scan, and provenance passed on final product candidate `ceb7df9c973920b382af9ed8d02037c09cc373bd`. No critical vulnerability or required migration mismatch was found in applicable checks. SEC-01 hosted persona/security acceptance remains separately OPEN in AA-OPEN. |
| Migration/schema compatibility | GREEN for this code scope | No new migration or generated type change; migration SQL and applied history were not changed. No remote schema or business-data write was made. |
| Isolated Preview and Preview configuration | OPEN, accepted only for this limited TEST release | Isolated Preview backend and Preview-scoped settings are unproven. Vercel automatically created Preview `dpl_GRTVKK9zTCN2dvo4uAMtRDExdyPU` from PR #22 head `a5dfca90d6151f2cf3d609ac633026a450ecc847`; it was not tested. No secrets or Preview settings were changed. |
| Real Nmbrs OAuth | OPEN, accepted for this limited release | External consent host previously returned HTTP 502; no successful live OAuth callback. This closeout did not retry OAuth. |
| Live company discovery and binding | OPEN, accepted for this limited release | No real-provider or hosted company-discovery/binding end-to-end proof. |
| Limited TEST scope | AUTHORIZED | Release is only in the existing synthetic TEST installation. It does not authorize real customer access, live payroll operations, external payroll writes, employee synchronization, or broader Preview use. No such operation was performed. |
| Hosted main deployment and safety smoke | GREEN | Git deployment `dpl_BVuywDYacYZk2DXn9ZNkgVRgkvkp` is READY from source `git`, branch `main`, exact SHA `58dc758c950b4e6da45c43a1692f45eb0fc019e9`; Vercel target `production` is the existing synthetic TEST channel. Aliases include `liquid-hr-hr-suite.vercel.app` and `liquidhr-git-main-edwinitsolutions.vercel.app`. Anonymous `/login` loaded without Test Auth; anonymous `/payroll-lab` and `/payroll-lab/integrations` redirected to login; `GET /api/context` and `/api/employees` returned 401; Test Auth and role-switch POST endpoints returned 404; no debug/capture route exists in the current app route tree. In an existing authorized HR browser session, Payroll Lab and the Nmbrs UI loaded, with zero credential inputs and zero console errors. |

The mandatory gates for this limited synthetic TEST release are complete. The remaining Preview, OAuth, company-discovery/binding, and SEC-01 hosted persona/security items remain explicitly OPEN; this is not full ACCEPTANCE GREEN. Any remote schema application requires separate authorization.

## 11. PRODUCT DECISIONS

- Keep Nmbrs as an opt-in integration within the existing Payroll Lab and module catalog.
- Keep Payroll Professional routes and Payroll history intact; no second payroll engine or duplicate sidebar entry.
- Keep employee synchronization, matching, apply actions, P2, CONTROL02, and official XML import out of this slice.
- Preserve existing main migration lineage; no migration reconciliation write is authorized by this task.

## 12. NOT FIXED

- **Preview acceptance:** OPEN by approved exception for this limited synthetic TEST release. Configure and verify an isolated Preview backend and Preview-scoped configuration before normal Preview acceptance. The PR #22 Preview was automatically created and remains untested.
- **Real Nmbrs OAuth:** OPEN because the consent-host 502 is external and no live callback was completed. Re-run after provider availability and redirect registration.
- **Live company discovery/binding:** OPEN; no real-provider or hosted end-to-end evidence exists.
- **Migration contract test:** FIXED in `8668e36332618e5b3735d57c8afeaacff641ef5c`; the reader normalizes CRLF to LF while preserving the `ALTER FUNCTION ... SET search_path` and REVOKE assertions. Migration SQL and applied history are unchanged.
- **Hosted release checks:** CLOSED for this limited TEST release. Root cause was global `git.deploymentEnabled: false`; PR #22 restored the main Git trigger and produced the exact READY deployment above. No manual deployment was started.
- **Legacy cleanup:** the 607-line P2 readiness document is preserved on main through PR #21 with a historical warning; its body matches the legacy source content. The protected worktree is clean, but `apps/hr-suite/.env.local` is present and must not be deleted; 13 branch commits are also not in or patch-equivalent to `origin/main`. Preserve the worktree and branch; no force cleanup.

## 13. LESSONS/PATTERNS

- Bind OAuth state to both the server-side one-time state record and the initiating browser cookie.
- Keep provider credentials server-only and fail closed when a provider omits rotated credentials.
- A Preview target is not sufficient evidence until its backend is proven isolated and all required configuration is present.
- Release provenance follows the exact tested candidate SHA; docs and runtime evidence must remain separate.

## 14. Commits/Remote Head

- PR #19 merged selected code to `deba6c0d5489bbe1ab15a77e1f60169661121816`; docs-only PR #20 advanced main to `fae79d8ef1d3d186ff254c0f1032f4b9674bc2dd`; P2 documentation PR #21 added the historical document; Vercel Git-config PR #22 advanced release main to `58dc758c950b4e6da45c43a1692f45eb0fc019e9`. At deployment verification, local `main` and `origin/main` both resolved to the release SHA; the deployment was built from that exact Git SHA. This AA closeout is docs-only and follows the deployed release.
- Selective integration commit: `a49c5130470146c6bcdf4bfbe95d7db7ced7d5f9`; migration test-only fix: `8668e36332618e5b3735d57c8afeaacff641ef5c`; versioned candidate SHA: `ceb7df9c973920b382af9ed8d02037c09cc373bd`, version `1.20261011.2`.
- Product candidate `ceb7df9c973920b382af9ed8d02037c09cc373bd` passed the recorded full local quality gate. Vercel's READY Git deployment build succeeded on release SHA `58dc758c950b4e6da45c43a1692f45eb0fc019e9`, ID `dpl_BVuywDYacYZk2DXn9ZNkgVRgkvkp`, aliases `liquid-hr-hr-suite.vercel.app` and `liquidhr-git-main-edwinitsolutions.vercel.app`. The original failures were caused by global `git.deploymentEnabled: false`; PR #20 was also eligible for the root/dependency skip, while PR #19 changed files under `apps/hr-suite`.
- Legacy `work/payroll-p0-p1` is at `4f99b04eab6cc7a79fd86048ccad1cd3dafc3cbe`, one commit ahead of its remote legacy branch. The worktree is clean; its unique 607-line P2 document is present on main via PR #21 and matches exactly after removing the added historical warning. Relative to `origin/main`, however, 13 legacy commits are neither reachable nor patch-equivalent. Protected `apps/hr-suite/.env.local` is present in the worktree. The worktree and branch were therefore retained; no forced cleanup.
- No manual deployment, remote schema write, remote business-data write, employee sync, or live OAuth retry occurred. Hosted safety smoke is complete. The AA-REL §8 limited synthetic TEST release is explicitly authorized; Preview isolation, real OAuth, live company discovery/binding, and SEC-01 hosted persona/security acceptance remain OPEN.

## 15. Final Verdict

**TEST RELEASED — LIMITED / NMBRS OAUTH ACCEPTANCE OPEN.** Product candidate `ceb7df9c973920b382af9ed8d02037c09cc373bd` passed the recorded full non-live HR/Payroll suite, TypeScript, ESLint, i18n, build, client-boundary scan, and provenance. Git-triggered deployment `dpl_BVuywDYacYZk2DXn9ZNkgVRgkvkp` is READY on exact main/release SHA `58dc758c950b4e6da45c43a1692f45eb0fc019e9`; hosted anonymous and authenticated safety smoke passed. This is limited to the existing synthetic TEST installation, not full acceptance. Preview isolation/configuration, external Nmbrs OAuth (consent host HTTP 502), live company discovery/binding, and SEC-01 hosted persona/security evidence remain OPEN. The P2 readiness document is preserved on main with a historical warning. The protected legacy worktree/branch remain because `.env.local` is present and 13 commits are not in or patch-equivalent to main; cleanup is not ready.
