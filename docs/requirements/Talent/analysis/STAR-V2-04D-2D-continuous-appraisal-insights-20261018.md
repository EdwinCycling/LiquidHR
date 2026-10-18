# STAR-V2-04D-2D — Continuous Appraisal Insights

Status: **LOCAL DONE** (2026-10-18)

## Scope and source contract

The read-only report extends the existing Talent Insights Star Performers route with the active `appraisal` insight. It reuses `listContinuousAppraisalItemsForEmployees` and the existing server-derived HR Admin/Manager scope. No new table, RPC, permission, migration or workflow was added.

Only existing `MEETING_SUMMARY` and `AGREEMENT` metadata is aggregated. `ACTION` items remain owned by Development/POP reporting and are excluded here so appraisal and POP actions cannot be double-counted. Titles and existing source links are retained; notes, comments and attachments are never projected.

The report uses unique authorized employees as the denominator. A non-cancelled/non-archived `MEETING_SUMMARY` is a registered conversation; `DONE` is completed, other recognized states remain registered, and an unrecognized source status is shown as incomplete. Agreements use the existing open states (`PLANNED`, `OPEN`, `WAITING`, `ACTIVE`); `due_on < as_of` is overdue, a null deadline is counted separately, and `next_meeting_on` is the only follow-up date source.

## Acceptance boundary

Live TEST data on 2026-10-18 contained 35 HR Admin-scope employees, one registered/planned meeting summary, two open agreements and no completed or overdue agreement. The Manager direct team contained six employees and two open agreements. The missing live status variation was not filled; isolated pure fixtures cover completed, unknown/incomplete, no-conversation, overdue, no-deadline, upcoming/overdue follow-up and POP-action exclusion.

The central `/insights` catalog exposes the report under **Talent & Ontwikkeling**. Browser acceptance used the local app at `http://localhost:3013` because the standard Playwright Chrome path remained Crashpad-blocked. HR Admin and Manager saw only their authorized population; Employee was denied at the direct report URL and the export returned the existing generic permission denial without report data. See [acceptance evidence](../../../quality/acceptance/runs/STAR-V2-04D-2D-LOCAL-20261018.md).
