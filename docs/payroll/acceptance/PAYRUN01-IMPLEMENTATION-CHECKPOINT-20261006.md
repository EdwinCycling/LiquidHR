# PAYRUN01 implementation checkpoint — 2026-10-06

## Decision

`LOCAL PAYRUN01: NO-GO` — implementation code and focused tests are present, but neither persona has an end-to-end persisted October result. Jan is correctly blocked on an unverified PFZW monthly allocation/rounding rule. Lisa has a bounded test arrangement and an independent calculation vector, but the isolated worktree cannot connect to Supabase, so no payroll period, source snapshot, run, lifecycle event, or artifact was created or read back.

`RELEASE: NO-GO` — no Preview evidence, no push/merge/deployment authorization, and the local branch remains uncommitted. `ENV-PREVIEW-010` stays open.

## Candidate and changes

- Worktree: `Integration-PAY-CONVERGE-20261004`
- Branch: `integration/pay-converge-20261004`
- HEAD: `95b2abc2b69a3c2518be4431d1d4a40463b65cf3`
- Commit: none; PAYRUN01 changes are uncommitted.
- No push, merge, version bump, deployment, Core mutation, identity provisioning, payment, or declaration submission occurred.

The implementation adds an administration-scoped Payroll Lab salary-processing page and actions; Core-to-Payroll source projection; versioned TEST arrangement/configuration, composition, and opening cumulative snapshots; the generic NL-2026 runner; persisted runs, results, controls, traces and lifecycle; finalization immutability; and finalized-result technical JSON and TEST-only PDF artifacts with scoped download routes. Both artifacts use persisted result values and are generated only after finalization. The UI exposes review/finalize and both artifacts only after lifecycle readback. No separate payroll calculation engine was added.

## TEST persona assignments

### Jan — Kinderopvang

The documented TEST assignment selects Pedagogisch professional, scale 6, synthetic salary step 20, 32/36 hours, and effective date 2026-09-01. The official 2026-09-01 full-time table amount is €3,425/month. The exact synthetic proration is €27,400/9 (€3,044.444…); €3,044.44 is only the cent display until the engine/oracle comparison establishes the applicable payroll rounding. The assignment is recorded in [PAYRUN01-JAN-TEST-PERSONA-20261005.md](PAYRUN01-JAN-TEST-PERSONA-20261005.md).

The rule composition fails closed with `PFZW_2026_MONTHLY_PRORATION_AND_ROUNDING_UNVERIFIED`. Official sources establish the annual 2026 basis/rates and part-time factor, but the reviewed material does not establish the October monthly cents allocation for this new-hire scenario. The current PFZW reading also leaves a transition ambiguity between the prior-year EJU basis and the CAO's 8% 2026 EJU. No Jan gross-to-net or pension amount is presented as calculated.

### Lisa — TEST-only company arrangement

The configured contrast case is `TEST-ONLY LIQUIDHR DEMO COMPANY ARRANGEMENT`: €5,500 gross/month, 40/40 hours, no CAO scale, pension explicitly disabled, and 8% holiday reserve. Its opening balance through 2026-09 is explicitly synthetic: €49,500 gross and €3,960 holiday reserve, not reconstructed payroll.

The independent oracle keeps the tax-credit case explicit. Its test vector is €5,500 gross, €5,499 table wage, €1,577.17 wage-tax withholding, and €3,922.83 wage less withholding. The package-level result vector also asserts €0 employee/employer pension, €1,233.10 synthetic employer insurance cost, €440 holiday reserve, €0 year-end reserve, €7,173.10 total employer cost, and post-October cumulatives of €55,000 gross / €4,400 holiday reserve. All controls pass in that pure package test. These are unit/oracle vectors only; no amount is an October database result or approved wage statement.

## Data and database evidence

- Core TEST source data was read-only. No Core record, IncomeRelationship, contract, or identity was changed or created.
- The user-authorized DDL migration `20261005100100_payrun01_individual_payroll` was applied only to Payroll Lab TEST project `jhgeriucbkfarxiudzfy`. Readback lists it as migration version `20261006055549`; the migration adds the PAYRUN01 versioned tables, lifecycle/artifact constraints, guards, and service-role access.
- No business data was inserted through SQL. The pre-run October 2026 PayrollPeriod lookup was empty, and no later app write could occur because the local app lacked its Supabase configuration. October period creation, source snapshots, arrangement/config rows, opening balances, calculation runs/results, controls, lifecycle events, and artifacts therefore remain unverified and absent from this checkpoint.
- The Core project received no migration. The Payroll Lab migration list and post-migration security/performance advisors were checked. No new PAYRUN01 function was reported with an exposed mutable search path. The project still reports existing mutable-search-path findings and the existing `public.rls_auto_enable()` SECURITY DEFINER exposure to `anon`/`authenticated`; the two PAYRUN01 indexes are unused because no run has exercised them.

## Local verification

| Check | Result |
| --- | --- |
| HR Suite focused suites | 16 files, 117 tests passed; includes PDF bytes, stored-result artifact service, scoped download route, and finalized-only gating |
| Post-review artifact UI regression | 2 files, 13 tests passed; message now requires readback of the specifically requested JSON or PDF artifact |
| Payroll engine / NL-2026 / PFZW suites | 3 files, 44 tests passed |
| Changed-file ESLint | passed; UI slice and PAYRUN01 service files checked |
| NL/EN translation parity | passed, 41 namespaces |
| `git diff --check` | passed |
| HR Suite strict typecheck | blocked by `components/payroll/component-library-entry-detail.tsx:76:57`, outside this PAYRUN01 diff |
| Production build and local production smoke | not rerun in this continuation |

A read-only review found that JSON and PDF generation shared an `event=artifact` redirect, allowing one artifact's existing readback to validate the other action's success message. The actions now preserve the requested artifact type in the redirect, and the page confirms that exact type before showing success. The same review found no concrete authorization/scope or GET-mutation issue.

The untracked `.tmp-payrun01` scratch directories were preserved. Next.js-generated `next-env.d.ts` drift was restored.

## Browser and environment

No browser login is needed yet. The existing Chrome `localhost:3000` tab belongs to a separate active worktree and was left untouched. The PAYRUN01 worktree has no `apps/hr-suite/.env.local`, and its process does not have `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, or `SUPABASE_SERVICE_ROLE_KEY`. The local `localhost:3001/payroll-lab/salarisverwerking` request therefore hit the Next.js runtime error that a Supabase URL/key is required, before any sign-in or Payroll Lab flow. The dev server was stopped after recording the blocker. No credentials were requested, read, copied, or logged.

## Remaining AA-OPEN items

1. Restore the worktree's local Supabase configuration through the normal secure setup; then exercise the real HR Admin flow and persist/read back the October period, source/input versions, Lisa run, controls, review/finalization, and JSON artifact. Ask for browser sign-in only if the restored local app does not reuse the existing authorized session.
2. Establish the official PFZW October proration and cent-rounding rule for Jan before enabling the calculation; retain `PAY-RULE-002` until exact monetary oracle comparison is source-backed.
3. Verify the stored/downloaded PDF path in the local app. Its profile has explicit synthetic TEST names, written-contract state, contract type, and minimum-wage inputs; the document is prominently marked TEST ONLY and is not legal evidence about the Core employment contract. Current Core employment data has no linked contract document or written/signed status. The official [Belastingdienst Handboek Loonheffingen 2026](https://download.belastingdienst.nl/belastingdienst/docs/handboek-loonheffingen-lh0221t61fd.pdf) and [Rijksoverheid payslip requirements](https://www.rijksoverheid.nl/vraag-en-antwoord/arbeidsovereenkomst-en-cao/wat-staat-er-op-mijn-loonstrook) remain the field checklist for any non-test payslip.
4. Keep `SEC-PAY-001` open until the authorized environment provides a valid cross-administration restricted Admin identity for a real negative test. Do not provision an arbitrary identity.
5. Resolve the unrelated strict TypeScript error at `components/payroll/component-library-entry-detail.tsx:76:57` or obtain fresh evidence that the exact candidate typechecks.
6. Keep `ENV-PREVIEW-010` open; Preview/release remains blocked by the user's no-push/no-deploy boundary.

Downstream payment and Loonaangifte are outside PAYRUN01; neither was executed. Their readiness is not represented by the calculation status.
