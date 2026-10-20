# PAYROLL-SOURCE-FIX-01 — recovery manifest

Status: **PARTIAL — source failure identified as PostgREST pool timeout in sampled telemetry; Frits-specific first dependency and November CONCEPT run remain unverified.**

Worktree: `PAYQA-01-20261018`, branch `work/PAYQA-01-20261018`, starting HEAD `22a193e42a8b05b1c3b149eb8cbea2029d765222`. This is local TEST/code evidence only. No merge, push, deployment, Payroll Lab write, or FINALIZED-run change was made.

## Request path and failure boundary

`Payroll → Salarisverwerking` calls `runPayrun01Action` → `runPayrun01Payroll` → `buildPayrun01Scenario.createSnapshot` → `LiquidHrPayrollSourceProvider.getPayrollSourceSnapshot`.

The provider currently emits `PAYROLL_SOURCE_DATA_UNAVAILABLE` for three different conditions: the employment-list read, the concurrent employment-timeline/actual-work reads, and source-snapshot schema validation. Before this change, all three erased the read phase and safe database error code. The provider emitted no application-level correlation ID to tie telemetry to a Payroll source attempt.

Read-only Core Supabase edge telemetry sampled for **2026-10-19 19:25–19:40 UTC** reported PostgREST `PGRST003` / HTTP 504 while waiting for an internal pool connection. Timeouts appeared across employment, salary, labor-condition, IKV, tax-profile, pension-arrangement/version, and actual-work reads. The matching PostgreSQL error-log query returned no rows. The observed error is a PostgREST pool-acquisition timeout; it is not evidence of an RLS denial or SQL constraint failure. It also does not rule out separate missing or invalid source data. The sampled events cannot be correlated to Frits, so they do not prove which request or query failed first for him.

## Source checks and limits

- Scope is server-derived: Payroll source reads require the authenticated tenant, HR group, administration, employee and period to match; employments must be confirmed, undeleted, and period-effective. Frits’s live authorization and employment rows were not readable in this run.
- The Core projection selects `employment_salaries` CAO basis, structure, scale, step, code, labels, amounts and effective dates. The existing unit suite covers the supplied Kinderopvang scale/step and €2,819.00 / €1,879.33 values. A new local regression case also verifies a 1 November effective date and an empty November actual-work projection. These are test fixtures, not a readback of Frits’s stored row.
- Published CAO version and scale/step linkage, employer registration, IKV, fiscal profile, pension participation and effective PFZW mapping were not verified against Core records. The PGRST003 telemetry prevents distinguishing absent data from a read outage for those records.
- No Sunday hours were imported. A November calculation was not submitted to Payroll Lab because the authorized runtime was unavailable; this attempt created no run, so duplicate/readback verification was not performed.

## Safe diagnostics added

Source failures now emit only `sourceCategory`, an allowlisted PostgREST/SQLSTATE code (or `SOURCE_READ_FAILED`), and a generated correlation ID. Source projection reads preserve safe table-category and database-code metadata. Snapshot-schema failures include only the schema field path and a fixed error code. Raw messages, record identifiers, employee identifiers, names, and source values are excluded; the UI-facing error remains generic.

## Verification

- Targeted Payroll source, CAO-BENCH02 service/UI, actual-work and tax-profile suites: **51 tests passed**.
- TypeScript `tsc --noEmit`: **passed**.
- Changed-area ESLint: **passed**, with one pre-existing unused-import warning for `PayrollSetupRepository` in the source provider.
- `git diff --check`: **passed**.
- The three rule-package tests could not be run with the app Vitest config: it found no files outside the app root. A second package-root attempt loaded a parent `vite.config.ts` outside this workspace and failed before tests on unresolved Vite imports / sandbox `EPERM`; no package test result is claimed.
- Browser acceptance was unavailable: the existing Chrome tab could not attach because the CDP focus-emulation command timed out. The central local TEST runtime config was absent. No config or credentials were read, copied, created or changed.

## Mercurius administration choice — separately recorded

There is no name-based Mercurius exclusion in Payroll. The general administration selector is built from active administrations in an accessible HR group: the actor needs tenant scope or an explicit administration grant; employee/manager-only actors also need an employment-derived administration assignment. Payroll then resolves capability for the currently selected server context. The current actor’s grants, group membership, Mercurius active row and Payroll capability could not be read through the available session, so the exact false selector condition is **not established**. No permission was broadened. The normal administrator action is to inspect those four conditions in the authorized administration UI and correct only the missing/inactive source if confirmed.

## Next recovery step

Use the existing authorized HR Admin browser session and supported TEST runtime. Read the target employment and its effective Core links through the normal UI, retry once after the PostgREST pool is healthy, and capture the new correlation ID. If that read identifies missing source data, enter only source-backed values through the normal UI. Then run exactly one November 2026 CONCEPT, read back all requested employee/employer amounts and employer costs, confirm one run, and stop before finalization. Keep the Mercurius selector result separate from Jupiter’s calculation.
