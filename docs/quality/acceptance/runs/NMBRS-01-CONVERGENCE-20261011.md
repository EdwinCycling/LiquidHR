# NMBRS-01 — Final Convergence Acceptance — 2026-10-11

## 1. Executive Summary

**Verdict: PARTIAL; main merge and legacy retirement are HOLD.** The selective Nmbrs P0/P1 implementation is committed and locally verified on candidate `work/NMBRS-01-20261011` at `a49c5130470146c6bcdf4bfbe95d7db7ced7d5f9`, based directly on verified `origin/main` `7bc40b46ce18af2a63e2a73d7a0fcfa7a660f865`. The current main SHA is unchanged. No PR, push, merge, deployment, or remote database write was made.

The local integration and build are useful, but mandatory isolated Preview and real Nmbrs callback acceptance remain open. The full non-live regression set also retains one unrelated baseline text-contract failure. The candidate is not ready for merge or legacy cleanup.

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
| Non-live Payroll/Payroll Lab regression | 61 files; 383/384 tests passed. One unchanged baseline failure is detailed under NOT FIXED. |
| Strict TypeScript | PASS (`tsc --noEmit`) |
| ESLint | PASS, zero errors; seven existing warnings in untouched Payroll import/Payrun files |
| NL/EN i18n | PASS; 43 namespaces have matching keys |
| Production build | PASS on exact candidate SHA with Next.js Webpack build; 323 static pages generated |
| Client boundary | PASS; negative control and 666-browser-asset scan |
| Build provenance | PASS; `.next` provenance records candidate SHA `a49c5130470146c6bcdf4bfbe95d7db7ced7d5f9` without runtime values |
| Diff/framework drift | PASS; `git diff --check` clean and `next-env.d.ts` matches main |

The default Turbopack build could not create a junction under the restricted Windows run. The production build completed with `next build --webpack`; no project configuration was changed to work around the junction restriction.

## 9. Fixed During Run

- **NMBRS-F01 — OAuth request boundary.** Module/route: Nmbrs authorize and callback. Persona: mocked `payroll:manage` route harness; no live identity. Symptom: cross-origin initiation and untrusted host-derived redirect were not rejected. Classification: security. Root cause: request metadata could influence the return path and initiation had no same-origin gate. Previous tests missed it because route tests did not exercise forged origin/host inputs. Change/fix: enforce same-origin initiation, bind state to an HttpOnly browser cookie, use a relative callback redirect, and set no-store/no-referrer headers. Files: Nmbrs authorize/callback routes and payroll service; migrations: none. DEV data/config changed: no. Regression/retest: route tests passed in the final suite. Downstream rechecked: provider tests, build, and client-boundary scan. Security/privacy impact: prevents cross-origin state creation and host-controlled redirect. Behavior: preserves intended OAuth flow. Commit: `a49c5130470146c6bcdf4bfbe95d7db7ced7d5f9`. Lesson: request host headers are not redirect authority.
- **NMBRS-F02 — Credential lifecycle.** Module: Nmbrs provider/service and integration action UI. Persona: mocked provider/service tests; no live identity. Symptom: an omitted rotated refresh token could leave an unusable credential accepted, and remote revocation failure was not visible in the UI. Classification: credential lifecycle and error handling. Root cause: missing explicit failure branch and response interpretation. Previous tests missed the omitted-token and wrapped-revocation cases. Change/fix: fail closed if rotation is absent, restore connection error state on failed OAuth operations, record safe audit outcomes, and surface failed revocation. Files: provider client, payroll service, Payroll actions; migrations: none. DEV data/config changed: no. Regression/retest: provider, callback, and component tests passed in the final suite. Downstream rechecked: production build and client-boundary scan. Security/privacy impact: avoids reusing a single-use refresh token and does not expose token material. Behavior: preserves intended provider lifecycle. Commit: `a49c5130470146c6bcdf4bfbe95d7db7ced7d5f9`. Lesson: test token-rotation and remote-revocation failure paths explicitly.
- **NMBRS-F03 — Binding idempotency/audit coverage.** Module: company binding service. Persona: fixture service harness. Symptom: repeated bind and audit payload behavior lacked direct assertions. Classification: test-coverage gap. Root cause: prior service tests covered access and scope but not repeated success/audit. Previous tests missed the gap because they stopped at rejection paths. Change/fix: added assertions for no second write on repeat bind and tenant/HR-group/actor-scoped audit data on creation. Files: payroll service authorization test; migrations: none. DEV data/config changed: no. Regression/retest: both new cases pass and are included in the final 61-file suite. Downstream rechecked: Payroll regression set. Security/privacy impact: preserves isolation and auditable lifecycle without recording credentials. Behavior: locks in intended idempotency/audit contracts. Commit: `a49c5130470146c6bcdf4bfbe95d7db7ced7d5f9`. Lesson: assert write counts and audit scope on successful lifecycle operations.
- **NMBRS-F04 — Existing settings route preservation.** Module/route: Payroll Professional settings. Persona: existing app users. Symptom: the initial integration work overlapped the existing settings route. Classification: integration collision. Root cause: both surfaces targeted the same path. Previous tests missed it because they did not compare route content against current main. Change/fix: restored the existing page exactly and placed Nmbrs settings under `/payroll-lab/integrations`. Files: Payroll Lab integration page; no changes remain to the existing settings page; migrations: none. DEV data/config changed: no. Regression/retest: production route build passed and Git blob matches `origin/main`. Downstream rechecked: route manifest and Payroll Lab tests. Security/privacy impact: none. Behavior: preserves the existing Payroll Professional UX. Commit: `a49c5130470146c6bcdf4bfbe95d7db7ced7d5f9`. Lesson: verify modern shared routes before integrating legacy surfaces.

## 10. ENVIRONMENT-GATED

The `liquidhr` Vercel project has Preview-scoped environment entries, but the read-only metadata check found no Preview entry for `PAYROLL_CREDENTIAL_ENCRYPTION_KEY` or `NMBRS_REDIRECT_URI`. Other required names were present; values were not decrypted. The Preview Supabase URL could not be compared to the shared TEST project without inspecting a protected value, so isolation remains unproven. No Preview deployment, runtime call, or browser session was made. Historical Nmbrs consent-host HTTP 502 remains external evidence; real OAuth callback acceptance is OPEN.

Required next action: provide a properly isolated Preview backend with reconciled schema and the missing Preview-scoped configuration, then complete a real consent/callback browser run after the provider consent host is available. Any remote schema application requires separate authorization. A limited TEST release with OPEN acceptance requires a separate informed AA-REL §8 decision.

## 11. PRODUCT DECISIONS

- Keep Nmbrs as an opt-in integration within the existing Payroll Lab and module catalog.
- Keep Payroll Professional routes and Payroll history intact; no second payroll engine or duplicate sidebar entry.
- Keep employee synchronization, matching, apply actions, P2, CONTROL02, and official XML import out of this slice.
- Preserve existing main migration lineage; no migration reconciliation write is authorized by this task.

## 12. NOT FIXED

- **Preview acceptance:** open because the Preview encryption key and callback URI are missing and backend isolation is unproven. Configure the isolated Preview backend and verify it without using the shared TEST backend as a substitute.
- **Real Nmbrs OAuth:** open because the consent-host 502 is external and no live callback was completed. Re-run after provider availability and Preview redirect registration.
- **Baseline migration contract test:** one assertion expects the `ALTER FUNCTION ... SET search_path` text on a single line, while the unchanged main migration uses a line break. Both the migration and test match `origin/main`; no unrelated repair was made.
- **Main release/legacy retirement:** no PR, push, merge, post-merge deployment check, or cleanup occurred because the mandatory gates remain open. Keep the legacy branch/worktree and its unique local commit until successful integration is proven.

## 13. LESSONS/PATTERNS

- Bind OAuth state to both the server-side one-time state record and the initiating browser cookie.
- Keep provider credentials server-only and fail closed when a provider omits rotated credentials.
- A Preview target is not sufficient evidence until its backend is proven isolated and all required configuration is present.
- Release provenance follows the exact tested candidate SHA; docs and runtime evidence must remain separate.

## 14. Commits/Remote Head

- Original and current `main`/`origin/main`/GitHub `main`: `7bc40b46ce18af2a63e2a73d7a0fcfa7a660f865`; local branch ref is 0 ahead/behind. No local main worktree is mounted.
- Candidate code commit: `a49c5130470146c6bcdf4bfbe95d7db7ced7d5f9`, based on that main SHA; local only, unpushed.
- The latest observed READY Vercel production-target deployment is `dpl_5F5rFrmcXZ7PT1hp2ACWSiV8FBVV` on prior SHA `c90275c5775a276d5ccd62f563b44372ee78ae11`. No candidate or current-main deployment is claimed.
- Legacy `work/payroll-p0-p1` remains at `4f99b04eab6cc7a79fd86048ccad1cd3dafc3cbe`, clean, 13 commits ahead of the main merge base, and one local documentation commit ahead of its remote. It has no uncommitted changes. Its unique changes remain preserved; local and remote branches/worktree were not removed.
- No PR, push, merge, deployment, or Production change was made. App version remains `1.20261011.1`; AA-REL forbids a feature-branch version bump before acceptance gates are GREEN.

## 15. Final Verdict

**PARTIAL — HOLD / NO-GO for main merge and legacy retirement.** The selective implementation is locally committed, tested, and built on `a49c5130`; the full exact-candidate gate is not GREEN because isolated Preview and real OAuth acceptance are open and one unchanged baseline contract test fails. Resume release work only after the Preview/backend/configuration prerequisites and provider callback are available. Do not delete the legacy source branch or worktree before then.
