# TALENT-CONTINUOUS-APPRAISAL-UX-V2 — 2026-10-14

**Status: LOCAL ENGINEERING GREEN / TEST AND HOSTED ACCEPTANCE HOLD.**

## Scope

The original V2 work and its tab/status addendum are one candidate. This isolated branch is based on verified `origin/main` SHA `0708d25190562e43a96417ba406648fd04207266`. The exact working-tree candidate has no commit SHA.

Implemented:

- Persistent category-specific create buttons for Notes, Actions, Agreements, Feedback, Goals and Meeting reports. Each category uses the same preselected create drawer from empty and populated states; All opens the item chooser. Feedback stays capability-gated.
- Versioned server status transitions for eligible Actions, Agreements and Goals. `DONE` and distinct `NOT_RELEVANT` are audited, filterable statuses. Current managers retain transition ability within their authorized scope after handover; self-service stays within the employee's own scope.
- Confirmed soft delete records `deleted_at` and `deleted_by_user_id`, hides the item from ordinary reads and counts, and writes a distinct audit action. Only the maker or assigned owner can delete an eligible non-system item within the existing historical boundary. No physical-delete route or grant is added.
- Shared keyboard-operable row menu with success, warning and destructive semantic colors; title-bearing confirmation; live success/error/conflict feedback; complete NL/EN labels.

## Local evidence

- Appraisal-focused suite: **46 tests passed / 5 files passed**. The table-driven interaction matrix covers all six categories with empty and populated lists, plus feedback capability, status changes, delete confirmation, version conflict, locked items and attachment retry.
- Full hr-suite: **3,062 tests passed, 8 skipped / 632 files passed, 4 skipped**, using `vitest run --maxWorkers=4`. The default-worker run hit timeouts in unrelated Chromium PDF tests under worker contention; the remaining PDF case passed alone in 1.48 seconds, and the bounded full run passed without code changes to those renderers.
- TypeScript typecheck, targeted ESLint, and NL/EN parity passed (43 namespaces).
- Local production build passed: TypeScript, 323/323 static pages, payroll client-boundary checks, 5 renderer traces and trace-size validation. The new `/api/continuous-appraisal/items/[itemId]/status` route is present.
- The local build provenance tool records the worktree's base commit because this candidate is uncommitted. It is not an exact-candidate release SHA or deployment proof.

## Acceptance still open

- Migration [20261014120000_continuous_appraisal_status_and_soft_delete.sql](../../../../apps/hr-suite/supabase/migrations/20261014120000_continuous_appraisal_status_and_soft_delete.sql) is prepared locally only. It has **not** been applied to shared TEST. The migration contract SQL has not been executed, and TEST advisors/database types have not been generated against the new schema.
- No Appraisal-specific end-to-end spec or e2e package script exists in the checked app; no authenticated browser acceptance was performed. Real RLS behavior, manager/self/HR scope, handover, audit rows, race conflicts and normal-read soft-delete filtering remain to be confirmed against TEST after migration approval.
- No GitHub push, merge, Vercel deployment, or separate release was performed. The parallel 9-grid wave was not changed.

**Next gate:** obtain approval to apply the exact local migration to shared Supabase TEST. Then run the migration contract, applicable Supabase advisors and database-type verification, followed by authenticated manager, employee and HR browser acceptance. V2 is not full acceptance GREEN until those gates pass.
