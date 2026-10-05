# ONE VERSION — Payroll TEST release — 2026-10-02

**Status after owner evidence reconciliation (2026-10-03): ONE VERSION TEST RELEASED; hosted acceptance GREEN.** The PAYLAB00–04 merge and TEST deployment completed at `main` SHA `6349d02538351cd01fc51f298c6e6fa0ba88006c`. GitHub deployment `6815434828` succeeded for that SHA; Vercel `liquidhr` deployment `dpl_63efkfC6BXosA9m1dQy7GjZ4Gho5` is READY with the same SHA, app version `1.20261002.1`, and canonical TEST alias. The release owner recorded hosted acceptance in evidence commit `238a285e0d976b508230d6ac900c4e606e2d89e9` on `integration/payroll-foundation-20261002`. That later owner evidence supersedes the earlier pre-acceptance checkpoint. The bounded CONTROL02 review checked the XSD/runtime/browser evidence but does not close the original independent review of the complete ONE VERSION release evidence; that separate review remains **PENDING**. The launcher/security review and hosted product acceptance are separately GREEN. No new release was made.

## Scope and baselines

- Accepted integration branch: `integration/payroll-foundation-20261002`.
- Accepted integration HEAD: `3ff38bdc4b145dbf1080cf8f0a7f4abd41c2eb96`.
- Fetched `origin/main` release baseline: `cb73260ff0cd83d19fa29e44c9f0b93749fb10af`.
- Selected app version: `1.20261002.1` (one release bump).
- Scope: release the already accepted PAYLAB00–04 integration and document the reusable local TEST/Preview procedure. No new Payroll feature, CAO implementation, migration, authentication/configuration change, or worktree cleanup.
- Payroll-specific browser, historical hash, trace, component, fork, authorization and 390 px evidence: [`PAYLAB-FOUNDATION-INTEGRATION-20261002.md`](../../../payroll/acceptance/PAYLAB-FOUNDATION-INTEGRATION-20261002.md).

## Historical browser incident

The earlier React #441 / digest `4058759727@E394` matched the sanitized server error `PGRST303: JWT issued at future`. The historical NL-2026 route then passed direct load and client navigation on desktop and 390 px, with the expected trace and PAYLAB03/PAYLAB04 hashes. No application defect or fix was demonstrated. Do not reopen this investigation unless the error recurs; if it does, check clock synchronization first.

## Release checks

- HR full suite: **512 files passed; 2,110 tests passed; 3 skipped** (`--maxWorkers=4`).
- Control suite: **2 files passed; 11 tests passed**.
- App version focused test: **2/2 passed**.
- Payroll server-only boundary focused test: **5/5 passed**; the same test passed in the bounded full HR suite. The earlier unconstrained workspace run timed out this source scan at 20 seconds; no timeout or test change was needed.
- All workspace typechecks: **passed**.
- Workspace lint: **0 errors, 7 warnings** in existing test files.
- HR NL/EN i18n: **41 matching namespaces**.
- Runtime launcher PowerShell parser and Development preflight: **passed**, central TEST fields present (values hidden), workspace dependencies valid, port 3010 free; no server started.
- Runtime launcher safety review: initial LUNA MAX review found two P1 and two P2 preflight gaps; these were corrected by restricting runtime URLs to the approved Core and Payroll TEST hosts, requiring the exact supported publishable-key name and lowercase Payroll flag, and binding production build provenance to the current commit plus `NEXT_PUBLIC_*` fingerprint. Independent follow-up found one additional P1: Next.js could load an untracked `.env*` sidecar after preflight. The launcher now rejects every root/app `.env*` entry except `apps/hr-suite/.env.example` and the separately verified central `.env.local` link. LUNA MAX re-review confirmed the guard and central hardlink check; **no remaining P1/P2 findings**.
- Post-review launcher checks: PowerShell parser passed; synthetic config checks accepted the canonical TEST endpoints and rejected a non-TEST endpoint, anon-key-only config and uppercase Payroll flag. An empty `apps/hr-suite/.env.production.local` negative control was rejected before build/start, then removed. Development preflight passed against the central TEST config; values remained hidden, dependencies passed, port 3010 was free, and no server started.
- Production preflight/build provenance: the earlier isolated build passed at `7716d7f96fb853d9fa2a4811d3893de238c6fa22`. Final app candidate `17b0485736f4e108a0dec96c77a877c30ab80568` then passed the isolated production build, TypeScript, all 308 static pages, Payroll client-boundary scan and production preflight. The generated provenance binds that exact commit and the approved central TEST public-config fingerprint; values remain hidden. The `:3011` process was left untouched.
- Local production browser smoke on `:3012`: authenticated Test HR Admin selected the existing default TEST context. Dashboard → Payroll Lab → Dashboard → Payroll Lab passed repeatedly; Payroll Lab showed exactly the Berekeningen and Salariscomponenten tiles. The existing M0 run and current M0 run (9 trace steps) opened under `GC-NL-001`; historical/current NL-2026 runs and traces opened under `CC-NL-2026-001`. The visible source/input/result hashes matched the recorded PAYLAB03/PAYLAB04 values. The catalog showed 24 SYSTEM entries and two existing customer-owned drafts; an existing `Netto loon` fork reopened. RegisteredRule `NL_WAGE_TAX` had no edit action, its copy button was disabled, and the page stated that it was not copyable. No new run or component draft was created.
- Mobile and browser assets: the candidate login rendered at exactly 390×844 with normal styling, two loaded stylesheets, no horizontal overflow, and no browser console errors. All observed CSS/font requests returned HTTP 200. The protected dashboard returned 307 to login anonymously. Earlier authenticated Payroll navigation/component checks used the in-app browser viewport; the release owner later accepted hosted `iPhone 16 · 393 × 852` screenshots in evidence commit `238a285e0d976b508230d6ac900c4e606e2d89e9`, in line with the selected mobile preset. Final LUNA MAX review of the complete release evidence is still **PENDING** during the current independent review. Before the successful Test HR Admin login, two `Invalid Refresh Token: Refresh Token Not Found` messages were recorded. After the correct login, no `PGRST303`, React #441, or corresponding server error occurred during acceptance.
- `git diff --check`: **passed**.
- Final isolated production build and exact-commit preflight: **PASSED** at app candidate `17b0485736f4e108a0dec96c77a877c30ab80568`.

## Local TEST and Vercel Preview process

The reusable launcher and procedure are documented in [`TEST_RUNTIME_AND_VERCEL_PREVIEW.md`](../../../delivery/TEST_RUNTIME_AND_VERCEL_PREVIEW.md) and exposed through EdwinHelp. Local TEST runtime reads only the existing central `%LOCALAPPDATA%\LiquidHR\TestRuntime\.env.local` into a child process; configuration values are not copied, displayed or committed. The script does not install dependencies, build, or stop existing processes.

The Vercel Preview flow uses Preview-scoped configuration and separate synthetic Core/Payroll backends, browser acceptance on an immutable deployment commit, then reviewed merge to `main` and verification of the resulting shared TEST deployment. Preview setup is not a blocker for this already accepted release. One-time setup Edwin must perform before Preview acceptance is required on a future PR:

1. Provision separate isolated synthetic Core and Payroll Preview backends.
2. Set the required variable names in the Vercel `liquidhr` **Preview** environment to those backends, without copying local/TEST/Production values.
3. Allowlist the required Preview OAuth callback URLs and use an approved synthetic Test HR Admin identity; keep Test Auth fail-closed outside local development.
4. Confirm Preview deployment metadata exposes the immutable Git commit SHA.

## GitHub, Vercel and hosted TEST proof

- Pull request: **N/A for the controlled redeployment of existing GitHub `main`**.
- Final `main` commit: `6349d02538351cd01fc51f298c6e6fa0ba88006c` (merge commit `Merge ONE VERSION PAYLAB00–04 TEST release`).
- GitHub deployment: `6815434828`, **success**, attached to the final `main` SHA.
- Vercel `liquidhr`: `dpl_63efkfC6BXosA9m1dQy7GjZ4Gho5`, **READY**, same SHA, app version `1.20261002.1`, canonical alias `https://liquid-hr-hr-suite.vercel.app/`.
- Hosted acceptance: recorded by the release owner in evidence commit `238a285e0d976b508230d6ac900c4e606e2d89e9` on `integration/payroll-foundation-20261002`; canonical desktop acceptance and user-supplied iPhone 16 393×852 mobile acceptance are documented there. This CONTROL02 task did not repeat the hosted run.
- Final independent review of the complete release evidence: **PENDING**; the bounded CONTROL02 follow-up does not cover the complete release packet. Earlier launcher/security review and release-owner hosted acceptance are separate completed gates.
- Shared TEST data/database: existing Payroll Lab migration/readbacks are unchanged; this release applies no migration and performs no database write.
- Separate CONVERGENCE01 release security/persona acceptance remains **OPEN** and is not reclassified by this TEST release.
- Existing branches and worktrees, including Nmbrs work, remain untouched; no cleanup was performed.
