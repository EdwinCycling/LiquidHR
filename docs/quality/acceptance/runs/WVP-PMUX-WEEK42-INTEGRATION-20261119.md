# WVP week-42 joint integration — 2026-11-19

**Verdict: local code integration PASS** on source commit e90bd178842554e84838657811442068aad2be9a. WVP candidate 0f3e82e00a15ac35ffaa3734a50dceae8436c993 was fast-forwarded into the existing joint integration branch from its exact parent 69d29bbe80a5791cf31c1d4966347f756cd10130. No new branch or worktree was created.

## Contract resolution

The detailed UWV employer handbook states that the 42-week term is 294 calendar days and is not extended when its last day falls on a weekend or generally recognized public holiday. The 42-week statutory deadline therefore remains the first calendar day after 42 complete weeks: effective clock start + 294 days. The preparation signal remains exactly 14 calendar days before that date. The PMUX step deadline is local midnight after that same inclusive date in the HR group's time zone. See the [UWV employer handbook on sickness reporting](https://www.uwv.nl/assets-kai/files/5815d7a2-4f28-4f92-b6ca-8c5c8f69e2ce/ziekteaangifte-door-werkgever.pdf) and [UWV guidance on aggregating sickness periods](https://www.uwv.nl/nl/ziek/ziekteperiodes-optellen).

The application projection and PMUX materializer now use the canonical effective clock, including recovery gaps. The migration replaces only the WVP PMUX deadline trigger function for new week-42 steps. It does not backfill, update or delete existing process steps, work items, snapshots or audit rows. The trigger function keeps SECURITY DEFINER with an empty search path and no EXECUTE grant to public, anon or authenticated.

## Verification

| Check | Result |
|---|---|
| Candidate WVP tests plus new PMUX migration contract tests | PASS — 25/25 |
| Combined workspace regression | PASS — HR Suite 4,257; Payroll calendar 2; Control 11; Payroll rules 65; total 4,335 PASS / 8 SKIP |
| TypeScript | PASS — tsc --noEmit |
| ESLint | PASS — changed WVP source and contract test |
| NL/EN i18n | PASS — 43 namespaces, matching keys |
| Production build | PASS — exact source SHA e90bd178842554e84838657811442068aad2be9a; Next.js compile and type phase, 359 static pages, bundle checks and function trace gate completed |
| Diff check | PASS — scoped code commit; documentation-only closeout follows |
| Focused calendar cases | PASS — weekday, Saturday, Sunday, Christmas Day, and effective clock after a recovery gap |
| Migration snapshot/security contract | PASS — existing step remains unchanged; direct anon/authenticated EXECUTE is denied |

The full suite emitted Happy DOM console warnings for synthetic blob URLs in PAYFULL cases, but all listed suites completed successfully. The production build used the existing tool installation. The protected next-env.d.ts hash was unchanged; generated Focus build output was restored byte-for-byte after the build.

## Separate gates

The new forward-only migration is present as code at apps/hr-suite/supabase/migrations/20261119120000_wvp_week42_pmux_deadline_contract.sql. **It was not applied to Core TEST. Separate explicit GO is required before that write.** The earlier WVP02 SEC01 and WVP05 migrations were not rerun; their earlier Core TEST evidence was reused.

Live HR Admin, Manager and Employee acceptance, including negative API/scope/RLS checks, remains **NOT RUN / OPEN** pending the joint TEST release and its persona window. No individual WVP deployment, Vercel deployment, database write, push, PR or merge to main occurred in this run. The full joint release remains separate.

The existing Payroll work, both stashes, WVP01 note, and protected local next-env.d.ts remain intact.