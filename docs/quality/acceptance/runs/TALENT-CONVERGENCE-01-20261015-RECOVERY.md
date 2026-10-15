# TALENT-CONVERGENCE-01 — recovery follow-up — 2026-10-15

**Verdict: LOCAL MAIN INTEGRATED / ENGINEERING GREEN / SUPABASE TEST FLOWS ACCEPTED / 9-GRID V2 FULL ACCEPTANCE HOLD**

This follow-up records work after the [TEST acceptance rerun](TALENT-CONVERGENCE-01-20261015-RERUN.md). The earlier rerun and original closeout remain unchanged as historical evidence. No GitHub push, PR, deployment, hosted release, or Production claim was made.

## Identity and migration state

- A fresh official Supabase connector read returned project wnpfloqpjvaacobppbpk, LiquidHR, region eu-west-3, status ACTIVE_HEALTHY, PostgreSQL 17.6.1.141.
- The previously reported head 20261015125424 was rechecked before migration work. Current history has 558 registrations and ends at 20261015182721.
- Registered in order: 20261015163728_talent_review_ux_v2_modes_and_audit, 20261015163934_continuous_appraisal_status_soft_delete_grants, 20261015182210_fix_talent_review_assignment_progress_trigger_permissions, and 20261015182721_fix_talent_review_score_submission_transition.
- The migration history is forward-only. No direct SQL write or migration-history rewrite was used. Invalid or expired requestState did not recur after refreshing the official MCP session.

## Current TEST data and database contracts

Read-only connector readback found these row counts:

| Tables | Rows |
| --- | ---: |
| talent_review_campaigns / assignments / assignment_members / scores | 6 / 14 / 53 / 37 |
| continuous_appraisal_items / item_comments / attachments | 34 / 6 / 2 |

RLS is enabled on the four 9-grid tables and the three Continuous Appraisal tables. The post-migration grant and routine-contract checks, including authenticated no-effective-DELETE/TRUNCATE on appraisal items and restricted routine execution, are recorded in the earlier [rerun](TALENT-CONVERGENCE-01-20261015-RERUN.md).

The two new synthetic campaigns were checked through read-only SQL after their UI lifecycle:

| Campaign | Mode | State | Assignments | Members | Scores | Submitted |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| TALENT-FINAL-01-HYBRID-20261015 | HYBRID | CLOSED | 3 | 11 | 11 | 3 |
| TALENT-FINAL-02-HR-ONLY-20261015 | HR_ONLY | CLOSED | 3 | 11 | 11 | 3 |

Both retain all expected TEST history. No existing review campaign or assessment was deleted.

## Browser verification and product fixes

- In HYBRID, all three teams reached 11/11 placement and submitted. The campaign was closed, reopened with a reason, all three assignments were resubmitted through the UI, and it was closed again.
- In HR_ONLY, all three teams reached 11/11 placement and submitted; the campaign closed through the UI with HTTP 200. The Manager direct route returned a normal 404. HR entry and submission succeeded through the normal application UI. An HR Admin self-score attempt remained denied; no permission or policy was bypassed.
- A selected team's grid previously counted scores from other assignments. GridCell now filters scores to members in the selected assignment, with a regression test. The 9-grid page also maps the expected scoped TalentReviewError 404 to Next.js notFound() rather than rendering a runtime error.
- Continuous Appraisal evidence from the earlier rerun remains valid: all six type tabs and preselection; Manager create/status/soft-delete with audit and retained row; HR read; Employee self-timeline/create. No physical deletion occurred.

## Engineering gates and remaining acceptance

Final checks ran against product fix commit 3816b81d1ab3942eeef86649ed4a9aaa22380ea1 on local main.

- Full hr-suite: 632 test files passed, 4 skipped; 3,067 tests passed, 8 skipped.
- TypeScript, targeted ESLint, focused talent workspace tests (6 passed), and git diff --check passed.
- npm run build stopped before compilation with a Turbopack internal error: Symlink node_modules could not be resolved: the symlink target leaves the filesystem root or its parent directory could not be resolved. Get-Item showed apps/hr-suite/node_modules as a directory with no link target. The supported npx next build --webpack production build passed, including TypeScript and all 323 static pages. The client-boundary scan (675 browser assets), function-trace preparation (5 renderer routes), trace-size check, and provenance write passed.
- Repository-wide ESLint was not rerun; the earlier rerun records its unrelated existing prefer-const failure at lib/document-generation/distribution-read-service.test.ts:47. No visible text or translation module changed, so check:i18n was not needed.
- Full 9-grid acceptance remains HOLD for the results view and complete drag/drop, keyboard, reduced-motion, light/dark theme, and target-viewport matrix. This does not negate the completed database or core browser lifecycle evidence.

Local main was updated only. origin/main readback was 0708d25190562e43a96417ba406648fd04207266. The primary dirty worktree and the protected payroll worktree were untouched. Two older talent feature-worktree folders remained non-empty after a prior safe cleanup attempt; they were preserved and not force-removed.
