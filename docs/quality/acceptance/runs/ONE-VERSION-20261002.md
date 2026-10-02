# ONE VERSION — Payroll TEST release — 2026-10-02

**Status: RELEASE IN PROGRESS.** The accepted PAYLAB00–04 integration is MERGE-READY. Final GitHub merge, Vercel deployment provenance and hosted smoke are recorded below when complete.

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
- Runtime launcher safety review: initial LUNA MAX review found two P1 and two P2 preflight gaps; these were corrected by restricting runtime URLs to the approved Core and Payroll TEST hosts, requiring the exact supported publishable-key name and lowercase Payroll flag, and binding production build provenance to the current commit plus `NEXT_PUBLIC_*` fingerprint. Independent follow-up found one additional P1: Next.js could load an untracked `.env*` sidecar after preflight. The launcher now rejects every root/app `.env*` entry except `apps/hr-suite/.env.example` and the separately verified central `.env.local` link. Final independent re-review is **PENDING**.
- Post-review launcher checks: PowerShell parser passed; synthetic config checks accepted the canonical TEST endpoints and rejected a non-TEST endpoint, anon-key-only config and uppercase Payroll flag. An empty `apps/hr-suite/.env.production.local` negative control was rejected before build/start, then removed. Development preflight passed against the central TEST config; values remained hidden, dependencies passed, port 3010 was free, and no server started.
- Production preflight/build provenance: the isolated build, typecheck, all 308 static pages, Payroll client-boundary scan and production preflight passed at candidate `7716d7f96fb853d9fa2a4811d3893de238c6fa22`. The later `.env*` guard/report amendment changes that commit, so the final-candidate build and exact commit/runtime provenance check remain **PENDING**. Browser runtime smoke and final independent re-review are also **PENDING**. The existing process on port 3011 remains untouched.
- `git diff --check`: **passed**.
- Final isolated production build: **PENDING**.

## Local TEST and Vercel Preview process

The reusable launcher and procedure are documented in [`TEST_RUNTIME_AND_VERCEL_PREVIEW.md`](../../../delivery/TEST_RUNTIME_AND_VERCEL_PREVIEW.md) and exposed through EdwinHelp. Local TEST runtime reads only the existing central `%LOCALAPPDATA%\LiquidHR\TestRuntime\.env.local` into a child process; configuration values are not copied, displayed or committed. The script does not install dependencies, build, or stop existing processes.

The Vercel Preview flow uses Preview-scoped configuration and separate synthetic Core/Payroll backends, browser acceptance on an immutable deployment commit, then reviewed merge to `main` and verification of the resulting shared TEST deployment. Preview setup is not a blocker for this already accepted release. One-time setup Edwin must perform before Preview acceptance is required on a future PR:

1. Provision separate isolated synthetic Core and Payroll Preview backends.
2. Set the required variable names in the Vercel `liquidhr` **Preview** environment to those backends, without copying local/TEST/Production values.
3. Allowlist the required Preview OAuth callback URLs and use an approved synthetic Test HR Admin identity; keep Test Auth fail-closed outside local development.
4. Confirm Preview deployment metadata exposes the immutable Git commit SHA.

## GitHub, Vercel and hosted TEST proof

- Pull request: **PENDING**.
- Final `main` commit: **PENDING**.
- Vercel `liquidhr` deployment ID/status/commit and alias: **PENDING**.
- Hosted smoke (`/login`, authenticated HR, Payroll Lab, desktop/mobile): **PENDING**.
- Shared TEST data/database: existing Payroll Lab migration/readbacks are unchanged; this release applies no migration and performs no database write.
- Separate CONVERGENCE01 release security/persona acceptance remains **OPEN** and is not reclassified by this TEST release.
- Existing branches and worktrees, including Nmbrs work, remain untouched; no cleanup was performed.
