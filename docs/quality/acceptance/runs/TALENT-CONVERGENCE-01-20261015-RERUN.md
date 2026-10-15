# TALENT-CONVERGENCE-01 — TEST acceptance rerun — 2026-10-15

**Verdict: LOCAL MAIN INTEGRATED / ENGINEERING GREEN / CONTINUOUS APPRAISAL TEST ACCEPTED / 9-GRID V2 HOLD**

This supplement updates the evidence in the initial [combined closeout](TALENT-CONVERGENCE-01-20261015-FINAL.md). That historical report remains unchanged. No GitHub push, PR merge, Vercel deployment, release, or hosted-production claim was made.

## Provenance and Supabase TEST

- Local main before this evidence update was HEAD 498f8ba6e17b340e48bc64eae5b073e6e651b62f. The integrated product-code commit remains 44ab1d8bbb8ba601557c3aec41cd9627fc7a57c5.
- A fresh read-only check confirmed project wnpfloqpjvaacobppbpk, LiquidHR, eu-west-3, ACTIVE_HEALTHY, Postgres 17.6.1.141. The previous known head 20261015125424 was rechecked before writes. The current remote head is 20261015182721; 558 migrations are registered.
- Official Supabase migrations now registered in order:
  - 20261015163728 talent_review_ux_v2_modes_and_audit
  - 20261015163934 continuous_appraisal_status_soft_delete_grants
  - 20261015182210 fix_talent_review_assignment_progress_trigger_permissions
  - 20261015182721 fix_talent_review_score_submission_transition
- The two defect repairs use the official migration connector and have local source files on main. Their SHA-256 values are ED8629DA2D18C2B93AD1EA89C60CDD05F8AD667A768969662A571838D8C2D18A and 09BB6CB486F56D87AC2419A72440681C6A2DE28059AC9137A367B1AB5D7EF455. There was no direct SQL mutation or migration-history rewrite.

## Reproduced TEST faults and repair evidence

1. Initial 9-grid score save returned HTTP 400 with PostgreSQL SQLSTATE 42501: the assignment-progress trigger attempted an assignment update under the authenticated caller. Migration 20261015182210 makes that internal trigger SECURITY DEFINER with an empty search_path and revokes direct execution from public, anon, and authenticated. A subsequent score save returned HTTP 200.
2. Initial team submission failed in validate_talent_review_score while the submit RPC changed score status. Migration 20261015182721 preserves validation and permits the expected DRAFT-to-SUBMITTED update only in the same transaction as the authenticated assignment submission. The subsequent submit returned HTTP 200.

No Invalid or expired requestState error recurred.

## 9-grid V2 browser and TEST data

The HR Admin Maya, Manager Yara, and Employee Noah test personas were used through the existing application role/context switcher. No persona, password, role, or permission was created or changed.

- A new isolated HYBRID campaign TALENT-FINAL-01-HYBRID-20261015 was created through the normal UI. Manager Yara placed all 6 direct-team members by UI cell selection into six distinct cells and submitted. HR Admin could read the submitted team and saw the scores read-only.
- HR Admin returned Yara's submitted assignment through the campaign UI with a required reason. Yara saw the reason, edited one placement and note, and resubmitted. Return, score correction, and resubmission returned HTTP 200; the HR view showed the revised result.
- Read-only TEST readback confirms the synthetic campaign remains ACTIVE with 6 scores; one assignment is SUBMITTED and two other manager assignments remain NOT_STARTED. No incomplete teams were fabricated or closed.
- The existing T01R-20260927-001 Manager Only campaign remained unchanged. HR Admin saw the read-only “other review role” state. Employee Noah's HR campaign workspace request was denied server-side with HTTP 403; /my-appraisal loaded Noah's own timeline.
- Current aggregate table counts are campaigns/assignments/members/scores 5/11/42/21, versus the pre-run baseline 4/8/31/15. The delta is exactly the one isolated campaign, three assignments, eleven members, and six scores created for this run. Existing campaigns and assessments were not changed.

Full 9-grid V2 acceptance remains **HOLD**. TEST has no HR_ONLY campaign, so the live Manager-hidden/HR-writable mode was not exercised. HR-side score entry/submission in HR_ONLY or HYBRID, close/reopen lifecycle, and the complete results/accessibility matrix (drag/drop, keyboard, reduced motion, light/dark, and all target viewports) remain open. The local mode contract tests and RLS predicates cover the role rules, but do not replace the missing persona/browser evidence. See TALENT-9GRID-V2-TEST-021 in [AA-OPEN](../../AA/AA-OPEN.md).

## Continuous Appraisal V2 browser and TEST data

The local TEST browser acceptance now covers all three available personas and empty/populated timelines.

- Manager Yara saw both populated and empty states across all six type tabs. Each tab's add action preselected the matching type: Notitie, Actie, Afspraak, Feedback, Doel, and Gesprekssamenvatting.
- Through the normal UI, Yara created the isolated TALENT-FINAL-01 Appraisal actie, transitioned it to DONE, and soft-deleted it. The POST, PATCH, and DELETE application routes returned 201, 200, and 200. Read-only database verification found the row still present with status DONE, version 3, and deleted_at set; audit_logs contains CREATE, STATUS_TRANSITION, and SOFT_DELETE events. No physical delete occurred.
- HR Admin Maya read both an empty employee timeline and a populated Jaap Dijk timeline. Employee Noah loaded his own populated timeline, created a self-owned Notitie through the UI (HTTP 201), and the Employee type picker did not offer Feedback.
- Appraisal totals changed from the previously verified 32/6/2 items/comments/attachments to 34/6/2. The two additional items are the named synthetic action and employee note. Existing records remain; the soft-deleted action remains auditable.

TALENT-APPRAISAL-V2-TEST-020 is now **CLOSED — TEST PERSONA / BUSINESS-FLOW ACCEPTED**. This is local-main and Supabase TEST evidence only, not a hosted release. The product requirements' V2 soft-delete rule is maker-scoped and auditable; the Appraisal item table has no effective DELETE or TRUNCATE for authenticated, and anon remains denied. Relevant tables retain RLS; status and soft-delete RPC execution is authenticated-only and was checked against its internal scope logic.

## Engineering evidence and limits

Engineering gates remain tied to product-code SHA 44ab1d8bbb8ba601557c3aec41cd9627fc7a57c5: full hr-suite 632 test files passed, 4 skipped; 3,066 tests passed, 8 skipped; TypeScript, production Webpack build, changed-area ESLint, i18n parity, and focused talent tests passed. Full ESLint still reports the pre-existing unrelated prefer-const issue at apps/hr-suite/lib/document-generation/distribution-read-service.test.ts:47 and existing warnings. No application source changed during the database trigger repairs; the repair migrations were verified with live browser transactions.

One transient browser diagnostic appeared while switching Employee into the denied Workforce route: Performance.measure reported a negative timestamp for WorkforceContinuousAppraisalPage. The employee self timeline loaded normally afterward. This diagnostic was not reproduced on the successful appraisal flow and is not claimed fixed.

The local DEV server remains available at 127.0.0.1:3015. Two feature worktree folders remained non-empty after one non-force cleanup attempt and were left intact: C:\Users\Edwin\.codex\worktrees\talent-9grid-ux-v2\LiquidHR and C:\Users\Edwin\.codex\worktrees\continuous-appraisal-v2\LiquidHR. No force cleanup was attempted.