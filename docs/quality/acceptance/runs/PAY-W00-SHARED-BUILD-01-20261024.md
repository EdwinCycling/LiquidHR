# PAY-W00-SHARED-BUILD-01 — shared production-build diagnosis — 2026-10-24

**Result: PARTIAL / reported failure not reproduced.** The exact `/_global-error` / `OuterLayoutRouter` `useContext` exception was not reproduced in a clean, locked install on the verified `origin/main` baseline. Both the canonical Next.js build and an explicit Webpack build completed. No source or dependency fix is justified by this evidence; the historical failure’s trigger remains unresolved and its gate stays OPEN until verified in the failing environment.

## Scope and baseline

- Repository: `EdwinCycling/LiquidHR`.
- Baseline: `630df89c84bc2be4774072d387ecb5dc7df10f91`.
- Verified `origin/main` with `git ls-remote`; the local branch started at the same SHA.
- Branch: `work/pay-w00-shared-build-01-20261024`.
- Runtime: Node `24.22.1`; existing `package-lock.json`; clean checkout before install/build.
- Lockfile blob at baseline and successful Vercel ancestor `1c4eb3d1bfe75d8145b87484125fcfcb6605aacf`: `cdd20c601e5956b419b96d7a346b36ba5b1ce14b`.

## Findings

### React, Next.js, and route context

- Locked `@liquid-hr/hr-suite` dependencies resolve to Next `16.4.2`, React `19.2.9`, React DOM `19.2.9`, and Scheduler `0.27.0`.
- HR Suite resolves Next from `apps/hr-suite/node_modules/next`; React and React DOM resolve once from the repository root `node_modules`. The Control workspace resolves the same React and React DOM instances. `npm ls --workspace @liquid-hr/hr-suite --depth=0` showed a single React installation.
- There is no source `app/global-error.tsx`. The root layout is a Server Component that loads user preferences/translations and renders the document shell; it has no React hooks or client provider imports. The dashboard layout is also server-rendered and does not call React hooks.
- The production manifest maps `/_global-error/page` to Next-generated `app/_global-error/page.js`. The installed `layout-router.js` SHA-256 is `7887177c4d5c69911df9f24dbca2306cb8f4e193d3495165a5341a30a6899a4c`, matching the baseline/feature comparison recorded by W02a.
- The baseline and Vercel ancestor have identical package lock, HR Suite package manifest, Next config, root layout, and dashboard layout. The W02a diff against baseline changes no package manifest, lockfile, Next config, root layout, or dashboard layout.

### Build configuration comparison

- The canonical app script runs `next build` without a bundler flag, followed by the existing Payroll bundle and function-trace checks.
- The successful GitHub Actions run `39912915111` used Ubuntu 24.04, Node 24, and `npm ci`. It resolved Next `16.4.2`, React/React DOM `19.2.9`, then built both workspaces successfully; Next generated `337/337` and `12/12` pages.
- The successful Vercel deployment `dpl_EoR4bf4pjsuJA53aRwQ1nDfcME8K` is READY at source `1c4eb3d1bfe75d8145b87484125fcfcb6605aacf`, an ancestor of the baseline. It ran the same HR Suite build command and completed in five minutes. Vercel used `npm install`; its build settings were read only.
- W02a’s acceptance report records the same failure on baseline and feature HEAD when invoking a Webpack build. That failure did not reproduce in this clean checkout with the same lockfile, Next/React versions, and Node 24 runtime, either with the canonical build or `next build --webpack`.

## Verification

- `npm ci` — PASS, 570 packages installed from the existing lockfile. npm reported eight audit findings; no automatic audit fix or dependency update was performed.
- `npm run build --workspace @liquid-hr/hr-suite` with `CI=true` and `NEXT_TELEMETRY_DISABLED=1` — PASS. Next `16.4.2` used Turbopack; TypeScript completed; all `339/339` pages generated; Payroll client-boundary self-test/scan, function-trace preparation/size check, and provenance generation passed.
- Root `npm run build` — PASS for both Next.js workspaces. HR Suite generated `339/339` pages and completed its Payroll postbuild checks; Control generated `12/12` pages. Exit code `0`.
- Direct `next build --webpack` from `apps/hr-suite` — PASS. Compilation, TypeScript, all `339/339` page generation, and build tracing completed without the reported exception.
- `npm run type-check --workspace @liquid-hr/hr-suite` — PASS (`tsc --noEmit`).
- `apps/hr-suite/next-env.d.ts` stayed byte-identical (SHA-256 `1b59d4c6b83807db275d43f3cf2cc8e9323f465fab764eea091cc5becd5bad37`). The build-generated `focus-widget-resource.ts` output was restored to the original baseline after verification.
- The first sandboxed install/build attempts hit Windows `EPERM` creating required npm workspace symlinks and a Next junction under `.next`. Repeating those operations outside the restricted filesystem sandbox succeeded. This is a local sandbox-permission issue, distinct from the reported `useContext` failure.

## Root cause, change, and W02a

The reported failure’s concrete trigger is **not established**: it did not reproduce in this controlled run, and the stack location alone does not explain why the framework’s React binding was null in the earlier run. No Payroll code, layout/error source, Next configuration, or dependency was changed. This follows the requirement to fix only a proven cause.

The W02a branch was inspected read-only at `0dd06ea04ca06909ba35246af06b9bd246c6501f`; it was not built, checked out, or modified. Its changes are limited to Payroll source/tests, the employment page, and W02a’s documentation. There is no source fix to cherry-pick. W02a may run the canonical app build, but its own gate must stay OPEN until that branch records a successful build. The failure recorded in its report remains unverified here.

A similar upstream Next.js report describes `OuterLayoutRouter` and `useContext` failing on generated `/_global-error`, but that issue was closed for lacking a public reproduction; it is context, not proof of this repository’s root cause: [vercel/next.js issue #95705](https://github.com/vercel/next.js/issues/95705).

## Remaining risk

- The prior `/_global-error` failure is still an OPEN, environment-specific report. The current baseline build passes locally; the successful Linux Actions and Vercel references are successful builds at earlier app code (Vercel source is an ancestor), not a new hosted build of this branch.
- No current-branch CI rerun, deployment, merge, push, or W02a rebuild was performed. No database or remote configuration was changed.
- No source repair cycles were needed because the failure was not reproduced; the final commit below contains this evidence report only.
