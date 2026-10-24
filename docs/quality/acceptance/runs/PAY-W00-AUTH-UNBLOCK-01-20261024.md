# PAY-W00-AUTH-UNBLOCK-01 — hosted Payroll auth readiness — 2026-10-24

**Verdict: PARTIAL — the regular hosted sign-in entry is available, but authenticated hosted acceptance is not yet proven.** No account-management change is justified by the evidence. W01 reads and W03 performance measurements remain OPEN until existing authorized identities have normal hosted sessions.

## Scope and baseline

- Repository: `EdwinCycling/LiquidHR`.
- Live `origin/main`: `630df89c84bc2be4774072d387ecb5dc7df10f91`.
- Read-only Vercel metadata confirms deployment `dpl_EoR4bf4pjsuJA53aRwQ1nDfcME8K` is READY on target `production` (the existing synthetic TEST channel), source SHA `1c4eb3d1bfe75d8145b87484125fcfcb6605aacf`, with the tested alias `liquid-hr-hr-suite.vercel.app` attached.
- Safe work branch: `work/pay-w00-shared-build-01-20261024`; it already contains the two PAY-W00 build-evidence commits `5e23e63f` and `1d559f4d` above that baseline. This turn did not touch the R2 feature branch.
- No push, merge, deployment, migration, database write, user/invitation/grant change, calculation, finalization, or PDF change was performed.

## Evidence

### Normal hosted sign-in

Unauthenticated requests to the regular hosted alias `https://liquid-hr-hr-suite.vercel.app` used no cookies and did not follow redirects:

| Route | Result |
| --- | --- |
| `/login` | HTTP 200; standard email/password form and Google sign-in option are rendered; invitation-only notice is present; no Test Auth/role-switch UI marker was found. |
| `/payroll/runs` | HTTP 307 to `/login`. |
| `/api/context` | HTTP 401. |
| `/api/employees` | HTTP 401. |

This proves the regular login entry and anonymous protection, not a successful password or Google authentication. The Google provider's end-to-end availability was not tested. The available browser inventory contained no LiquidHR hosted tab. Reading the separate Chrome app window failed with `Computer Use app approval timed out`; no login form was automated and no credentials or cookies were read or entered.

### Existing TEST personas and scope evidence

The canonical persona catalog records an existing HR Admin with `TENANT_ADMIN` in De Sterren holding, one active tenant-wide access row, three active HR groups, five selectable administrations, and zero active grants to other tenants. Its boundary excludes platform rights. Three existing Employee personas are recorded as linked, with `self:salary:read`, authenticated self-read, and employment/administration binding confirmed in the Jupiter context. These entries are catalog and prior local handoff evidence; they are not a current hosted-session readback. Therefore the actual hosted actor, selected HR group/administration, and Employee self-scope remain unverified in this turn.

### Local configuration metadata

The protected canonical file at `C:\Users\Edwin\Documents\Apps\LiquidHR\apps\hr-suite\.env.local` and `%LOCALAPPDATA%\LiquidHR\TestRuntime\.env.local` both exist as hard links. `fsutil hardlink list` from the canonical source reported two links and included the central TestRuntime path. The current isolated worktree has no `apps/hr-suite/.env.local`; its existing starter requires the central file and only validates a worktree-local file when one exists. No link was missing at the canonical/central pair, so nothing was restored. Configuration contents were not read. The local launcher and local Test Auth were not started.

## Acceptance status

| Check | Status |
| --- | --- |
| Regular hosted login entry and anonymous route protection | PASS |
| Existing identities and role/scope records | Catalog/local evidence only; hosted readback OPEN |
| W01 Payroll run-list reads | NOT RUN — no authenticated HR Admin session |
| W03 run-list measurements, at least three times | NOT RUN |
| W03 complete-workplace measurements, at least three times | NOT RUN |
| Functional completeness during W01/W03 | NOT CHECKED — no authenticated session |
| Existing FINALIZED data and PDFs | NOT accessed or changed |

## Single next action

Edwin should have the existing authorized HR Admin and Employee account holders open the ordinary hosted `/login` flow and sign in with each account's existing configured method; then make those authenticated browser sessions available for the acceptance run. Do not share passwords or cookies. The current evidence supports no invite, new Auth user, password reset, role change, or grant. Once sessions are available, read back the real actor and scope, complete W01, then measure both the run list and full workplace at least three times and check that all expected rows and workbench sections are present.
