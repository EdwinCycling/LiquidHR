# LiquidHR Acceptance Library V2

Canonical repository-owned source of truth for repeatable LiquidHR acceptance runs. Execution evidence remains under `.artifacts`; it is not moved here.

## Baseline and boundaries

- Release `1.20260920.1`; exact baseline main SHA `874098d9c0675d17774ad027c7a8b4fbadb37c39`.
- Canonical DEV project `wnpfloqpjvaacobppbpk`.
- Every run starts from the exact approved SHA in an isolated `work/acceptance-<run-id>-YYYYMMDD` branch/worktree.
- No Production access, force-push, merge main, deploy, secrets or direct business-row fabrication.
- Separate worktrees do not isolate a shared DEV database; parallel execution requires independent domain state and fixtures.

## Catalog

| ID | Scope | Status | Mode | Next action |
|---|---|---|---|---|
| A01 | Focus + Absence + Leave | DONE / GREEN | SOLO | Regression baseline |
| GJ01 | Onboarding / Preboarding | PARTIAL / EXTERNAL_BLOCKER | SOLO | Rerun authenticated Employee leg after DEV mail recovery |
| GJ02 | Documents / Studio / Signing | GREEN | SOLO | DOC02 follow-up |
| GJ03 | Actual Work / Hours | GREEN | ISOLATED_FIXTURE | AW02 follow-up |
| T01/F01/F02/F03/S01/T02/R01/P01/F04/F05/I01 | Product acceptance | READY | Per spec | Execute by wave |
| GJ01R | Authenticated preboarding completion | WAITING_FOR_DEV_MAIL | SOLO | Rerun only the unproven leg |
| DOC02 | Template rendering | READY | ISOLATED_FIXTURE | Execute after GJ02 |
| AW02 | Actual Work rules | READY | ISOLATED_FIXTURE | Execute after GJ03 |
| AI01/PAY01 | AI / Payroll | LATER | — | Separate scope |

## Run specifications

- [T01](runs/T01-survey-personality-9grid.md) · [F01](runs/F01-settings.md) · [F02](runs/F02-navigation-help.md) · [F03](runs/F03-workforce-employment.md)
- [S01](runs/S01-authorization-torture.md) · [T02](runs/T02-talent-development.md) · [R01](runs/R01-recruitment.md) · [P01](runs/P01-process-automation.md)
- [F04](runs/F04-dashboard-widgets.md) · [F05](runs/F05-ui-foundations.md) · [I01](runs/I01-i18n-localization.md)
- [GJ01R](runs/GJ01R-preboarding-auth.md) · [DOC02](runs/DOC02-template-rendering.md) · [AW02](runs/AW02-actual-work-rules.md)

Every runnable spec links to [HARNESS-V2.md](HARNESS-V2.md) and [REPORTING-STANDARD.md](REPORTING-STANDARD.md).

## Recommended waves

1. Preflight, mail/auth dependency checks and authorized DEV fixture reconciliation.
2. F02, F05 and I01 when read-mostly and independent.
3. T01, T02, R01, DOC02 and AW02 with unique fixtures/run keys.
4. F01, F03, S01, P01, F04 and GJ01R sequentially.
5. Finish each run with persistence, negative, responsive, quality-gate and remote-SHA evidence.

See [RUN-LOG.md](RUN-LOG.md) for historical results.
