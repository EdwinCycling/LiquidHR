# PAYCOMP-EDIT-01 — controlled synthetic TEST acceptance

Date: 2026-10-12
Classification: CONTROLLED / Payroll
App version: `1.20261012.3`
Feature code SHA tested: `625eabcc93992f71beb6f143341bb15adf9b8c1c`
Release SHA: `5c539b11b6ed478fc03152fa5b1f4a09591d05d2`

## Scope and persisted records

The authenticated server context resolved the active Payroll Lab administration and checked Payroll Admin/Tenant Admin access, `salary:write`, the Payroll feature flag, and administration scope. Browser input supplied only a catalog key; the normal server actions and component draft services performed all writes and readbacks. `NL_NET_PAY` was confirmed forkable under the existing contract. No schema change or historical version mutation occurred.

Exactly three append-only synthetic DRAFT records were created:

| Record | Version | Draft record ID |
| --- | --- | --- |
| `NL_NET_PAY` CUSTOMER_FORK | v1 | `11c5be9d-9d8b-444f-ac05-b36bd38186b5` |
| Edited `NL_NET_PAY` CUSTOMER_FORK | v2 | `58dd8ad7-4d8d-4fdf-8468-07b68d46e0f0` |
| `PAYCOMP acceptance custom` CUSTOMER_CUSTOM | v1 | `81ff235d-666b-43fb-b0fc-842280afd6a8` |

## Editor acceptance

- The saved v1, v2, and custom v1 were reopened from the component library. Fork history displayed v1 and v2; v2 reopened with the edited formula `((NL_REGULAR_WAGE.grossSalary - NL_WAGE_TAX.wageTax) + MONEY(1.00))`.
- Formula validation and preview passed. CUSTOMER_FORK v2 returned `643.92`, with a calculation trace and all four NL 2026 controls passing.
- CUSTOMER_CUSTOM used `MONEY(100.00) + parameter.bonus` with bonus `5.00`; preview returned `105.00`, with a trace and all four NL 2026 controls passing.
- Original SYSTEM definition remained unchanged. DRAFTs remain outside regular payroll calculations.
- Browser acceptance used the existing route `http://localhost:3010/payroll-components` as the authenticated Payroll Admin. Scope was resolved server-side.

## Gates

- PAYCOMP editor Vitest set: 11 files / 61 tests passed.
- NL 2026 rules Vitest set: 3 files / 31 tests passed.
- Final full hr-suite: **OPEN / incomplete**. A run with `--maxWorkers=2` and a unique repository-local temp directory emitted the Vitest startup header but no collected test names or results within four minutes. It was interrupted; this is not a pass. The bounded result is indexed as `PAYCOMP-EDIT-01-TEST-018` in `AA-OPEN.md`.
- Strict TypeScript: passed.
- ESLint on changed runtime/test files: passed.
- i18n: passed, 43 NL/EN namespaces with equal keys.
- CRLF-aware `git diff --check`: passed.
- Official Production build: passed on feature code SHA `625eabcc93992f71beb6f143341bb15adf9b8c1c` and exact release SHA `5c539b11b6ed478fc03152fa5b1f4a09591d05d2`; final build generated 323 pages, Payroll client-boundary scan passed, and build provenance names the exact release SHA.

## TEST deployment and hosted smoke

- Automatic Vercel Git deployment `dpl_9Su59wRcQ4PtPwqW8tWjcKXnmj5K`: `READY`, `source=git`, `target=production`, `meta.githubCommitRef=main`, exact SHA `5c539b11b6ed478fc03152fa5b1f4a09591d05d2`.
- Canonical alias: `liquid-hr-hr-suite.vercel.app` (also `liquidhr-git-main-edwinitsolutions.vercel.app`).
- Hosted safety smoke: `/login` 200; `/dashboard/start` 307 to login; `/api/context` and `/api/employees` 401; Test Auth UI not visible; POST `/api/auth/test-login` and `/api/auth/test-role-switch` 404; `/api/test-capture` and `/api/control-plane` 404.
- The automatic branch Preview `dpl_6GiFZkgikdo1goPoKvHckqwCymTq` was not used for acceptance because Preview isolation remains unproven (`ENV-PREVIEW-010`). The direct TEST release does not claim Preview or full acceptance GREEN.

## Release decision

This is a limited synthetic TEST release under `AA-REL.md` §8, not full acceptance GREEN. Targeted Payroll tests, server-side scope, save/readback, browser acceptance, typecheck, lint, i18n, production build, exact-SHA deployment, and hosted safety smoke passed. The PAYCOMP-specific open evidence is the final full hr-suite run above; Preview isolation remains a separate existing environment open.
