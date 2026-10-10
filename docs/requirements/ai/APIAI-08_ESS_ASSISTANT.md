# APIAI-08 — ESS Assistant: Leave & Personal Reminders

Status: **IMPLEMENTED LOCALLY — HOSTED TEST ACCEPTANCE OPEN**. Source baseline: ONE VERSION `783999044de83c902e63fefb3587fdbbf99d4de3`. Branch: `work/apiai-08-ess-assistant-20261009`. Local implementation and regression gates pass. The additive TEST migration is awaiting explicit approval after the remote DDL call was blocked by auto-review; deployment and hosted MCP acceptance have not run. See [the APIAI-08 acceptance record](../../quality/acceptance/runs/APIAI-08-20261009.md).

## User value / ChatGPT conversations

Employee, using the same authorized LiquidHR Workforce MCP identity:
1. “Wat is mijn verlofsaldo?” — actual balances by leave type, unit, as-of date, expiring buckets if authoritative.
2. “Wanneer is mijn volgende vakantie?” — first future approved absence; dates, leave type, status, no invented holidays.
3. “Welke verlofaanvragen heb ik lopen?” — bounded chronological list of own requests, including pending/status.
4. “Ik wil volgende vrijdag vrij.” — date clarification if necessary, canonical leave preview showing leave type, scheduled hours, available balance, new balance/status; **no write without explicit server-verifiable user confirmation**; canonical leave workflow; readback.
5. “Wat zijn mijn reminders?” — list upcoming/pending own reminders with title, due timestamp with timezone, status.
6. “Herinner me maandag om mijn POP bij te werken.” — canonical personal reminder; confirmation; idempotent create; readback.

Retain existing Development Plans, Development Gaps, Skills and Competencies unchanged. For future APIAI-09 (not built here): manager leave approval, team, notes and Talent.

## Non-negotiable shared architecture

One Workforce catalog/dispatcher, same canonical LiquidHR services, no duplicated AI or MCP business logic, no parallel auth model.
- Current catalog: `apps/hr-suite/lib/workforce-tools/{catalog,contracts,employee-tools,registry}.ts`.
- Remote MCP: `apps/hr-suite/lib/workforce-tools/mcp/{chatgpt-metadata,remote-auth,remote-dispatch}.ts`; `apps/hr-suite/app/mcp/route.ts`.
- Existing controlled actions: `apps/hr-suite/lib/controlled-actions/service.ts` (Talent-only at baseline).
- Domain leave: `lib/leave/{overview-service,request-service,workflow-service,ledger-service,employment-resolver,schemas}.ts`; leave catalog/RPCs and `start_leave_request_workflow`.
- Reminders: `lib/reminders/{reminder-service,schemas}.ts`, including `listMyReminders`, `createPersonalReminder`. There is also `lib/ai/personal-reminders.ts` (HeRa adapter); reuse its domain service rather than duplicating.
- Existing delegated remote MCP `registry.ts` contains a four-tool read-only allowlist. Extend it **only** with reviewed new Employee SELF reads through bearer-bound RLS; no cookie-only server client or service-role HR data read.
- Keep OAuth PKCE, resource binding, registered-client allowlist, consent, audit and rate limiting. No casual changes to working APIAI-07.

## ESS READ catalog

Prefer stable IDs consistent with existing `employee.talent.*.read` naming:
- `employee.leave.balance.read`
- `employee.leave.next.read`
- `employee.leave.requests.read`
- `employee.reminders.read`

All `audience=EMPLOYEE`, `scope=SELF`, explicit existing self permission(s) and module gates. Employee/tenant/hr-group/administration derived server side; never accept tenant, user or employee IDs from model. For bearer/RLS, add dependency injection to existing canonical read services or a thin RLS-safe domain adapter; do not let `createClient()` cookie accidentally substitute for OAuth user.

Leave balance must reflect authoritative ledger/accrual/approved allocations and user-selected employment when multiple. Don't sum arbitrary sample buckets or double-subtract; return an `asOf` date, leave type, units/hours, totals with exact precision and any `sourceTruncated` flag. Next vacation = upcoming approved leave, not pending; calculate from canonical request/overview service, include hours and date range. Pending request list includes `PENDING`, `CHANGES_REQUESTED`, optionally other statuses, with bounded outputs/pagination, no cross scope.

Reminders read uses canonical `listMyReminders`; bound output, private to same actor, dates with timezone, mark overdue correctly based on explicit now; preserve existing completion semantics.

Do not claim leave or reminders are visible via ChatGPT until hosted real tool call succeeds.

## ESS WRITE controlled actions

Add only:
- `employee.leave.request.create`
- `employee.reminder.create`

Integrate with the existing APIAI-06 lifecycle: Prepare → Preview → Confirm → Execute → Readback (plus Cancel). The baseline controlled-action type is Talent-specific; safely generalize as needed without regressing existing Talent actions.

**Never expose direct one-call CREATE from model text.** The model's `confirmed: true` or a fabricated confirmation phrase is not sufficient. Require a user-confirmation step the backend can verify and bind to authenticated user, draft, immutable preview hash, nonce/version, expiration, authorized context, idempotency key, conversation/channel and scopes. A model cannot forge the trusted consent signal. If ChatGPT's current MCP UI cannot provide a sufficiently trustworthy human-confirmation primitive, expose only READ + PREPARE/PREVIEW in hosted MCP and keep Execute closed until a user-verifiable confirmation mechanism exists. Explicitly state partial acceptance instead of silently auto-executing. Any write tools require distinct allowlist/OAuth scope, independent limiter and write-audit, and TEST-only feature flag OFF by default.

Leave:
- Reuse `getLeaveRequestPreview` and `startLeaveRequestWorkflow`/canonical confirm/workflow functions (not direct table inserts). Resolve employment, leave type, work schedule, request mode/hours, holiday rules, leave balances using established logic; detect stale preview, overlap, invalid time range and insufficient balance according to current engine.
- Immutable preview: employee-self, leave type, start/end, time mode, requested hours, before/after balance, approver/workflow status if available.
- Execute only after server-verifiable confirmation, return request/work item IDs and actual status via readback; same idempotency key cannot produce two requests.
- If multiple employments/leave profiles ambiguous, ask user to select from the existing authorized options; do not pick arbitrary values.

Personal reminder:
- Reuse `personalReminderCreateSchema` and `createPersonalReminder`; never write a reminder for a different user. Validate local date, time/timezone, DST ambiguous/nonexistent times; ask clarification when reminder date or time underspecified. Full title, description, remindAt shown in preview; server-confirmed action creates exactly one reminder; readback from own reminder list/record.
- Do not confuse personal reminders with HR/manager-targeted reminder workflows.

HeRa and internal BFF can use same catalog and actions; do not route internal HeRa through external MCP. Keep modules/permissions consistent across surfaces.

## Authorization, security and operating conditions

- Only synthetic TEST employee fixture `employee.fixture@liquidhr.test` for initial acceptance. Manager/HR Admin and anonymous bearer must be unable to invoke Employee-self tool even with forged employeeId or context.
- No new unrelated privileges/RLS expansion, no service-role HR reads, no secret logs. Do not mutate remote DB/schema without explicit review of new migrations and forward-only contract/readback/advisors; source-only changes first when feasible.
- Respect existing protected `.env.local`, official runtime launcher; no Docker; no subagents.
- Explicit kill switches: preserve APIAI-07 READ MCP; new writes separately disabled on failure. Preserve rollback deployment.
- Four existing Talent tool outputs and app installation in ChatGPT must remain functional; ChatGPT plugin manifests/schema re-discovery may be required after added tools.

## Current fixture baseline (synthetic TEST, validate before hosted)

Earlier readback: Employee: 9 goals, 4 gaps (real tool call), 2 released SKILL records, competencies, 96h leave balance from demo buckets, future APPROVED leave 2026-10-22 through 2026-10-23, 2 personal reminders; Manager 2 personal reminders, active direct manager link. The number of competencies in ChatGPT is 3; do not hardcode fixture counts to tests. Fixture data was added directly to TEST, not necessarily reproducible from Git; provide an idempotent fixture seed or documentation and avoid mutating unrelated tenants.

## Deliverables and gates

- Implement real code, not documentation-only; add focused tests, negative auth/RLS tests, contract fixtures, i18n NL/EN.
- Regression: targeted ESS, leave engine/workflow, personal reminders, APIAI-06 controlled actions, APIAI-07 remote auth/MCP, HeRa; full HR suite, strict TS, changed files ESLint, i18n, official production build, Payroll client-boundary scan.
- Perform local authenticated Employee read E2E with exact code SHA, a real canonical TEST workflow for leave create if user-confirmation/DB semantics proven, reminder create and duplicate execute denial. Validate Employee->Manager/HRAdmin/logout stale context negatives.
- Deploy only after green gates using shared TEST alias, preserve rollback and existing OAuth plugin. Audit and limiter readback for all new calls. Hosted ChatGPT acceptance for each read; writes remain disabled unless an explicit user confirmation mechanism and hosted proof exist.
- Produce one Draft PR to `main` on this single branch, exact tested source SHA, clean worktree or documented unrelated scratch, no automatic merge without explicit user request.
- Keep APIAI-09 MSS and notes out of this wave; follow it once ESS converged.

## Suggested execution order (single agent with broad autonomy)

1. Recheck current main and TEST baseline, read AGENTS/AA rules and source/service contracts.
2. Implement all four Employee READ tools with auth/RLS tests first, validating against existing synthetic data.
3. Generalize Controlled Actions and add reminder/leave prepare/preview/confirm/execute/readback across same dispatcher. If trusted cross-host confirmation unavailable, stop WRITE activation but continue READ implementation and full tests.
4. Run all tests/build, fix-and-retest until green; two manually performed independent review passes by same agent (not subagents).
5. Push one existing feature branch and Draft PR; hosted TEST deployment/positive reads; report precise remaining write gates.
