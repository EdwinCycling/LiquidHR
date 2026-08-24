# R4 Journey Management Overview / Detail

## Scope

- Branch: `work/r4-journey-detail`
- Baseline: `1471aa224e2318b0c216d95e16b2ba1c4cd3ec64` (`origin/main`)
- Worktree: `C:\Users\Edwin\Documents\Apps\LiquidHR.codex-worktrees\r4-journey-detail`
- Local port: `3150`
- Test prefix: `R4-JNY-DETAIL`
- Owned: `/journeys/[id]/overview` and management-only overview actions/services/tests.
- Explicitly untouched: Steps, Participants, participant detail, templates and activation wizard routes/components.

## Delivered

The management route is now the central overview cockpit. HR management navigation links to `/journeys/{id}/overview`, while the existing `/journeys/{id}` entry point redirects management viewers there and preserves the actor-safe participant projection for viewers without `journey:read`.

The overview presents the existing runtime contract only:

- journey and employee metadata, anchor date, status, version, employment link and topic count;
- topic progress and percentage;
- phase/moment/topic timeline with scheduled/available dates and overdue required-topic attention;
- attention summary, participants/team and replacement history;
- lifecycle actions derived from the existing legal transitions only: pause, resume, complete and cancel;
- participant replacement through the existing endpoint, with searchable Foundation select controls and reason input.

No new schema, migration, permission, lifecycle transition or delete contract was introduced. No isolated Journey was created because existing TEST Journeys safely covered the positive and negative acceptance matrix.

## Changed files

- `apps/hr-suite/app/(dashboard)/journeys/[journeyId]/overview/page.tsx`
- `apps/hr-suite/app/(dashboard)/journeys/[journeyId]/page.tsx`
- `apps/hr-suite/app/(dashboard)/journeys/page.tsx`
- `apps/hr-suite/components/journeys/journey-management-overview.tsx`
- `apps/hr-suite/components/journeys/journey-detail-actions.tsx`
- `apps/hr-suite/lib/journeys/management-overview.ts`
- `apps/hr-suite/lib/journeys/management-overview.test.ts`
- `apps/hr-suite/lib/journeys/labels.ts`
- `apps/hr-suite/messages/nl/journeys.json`
- `apps/hr-suite/messages/en/journeys.json`

## Acceptance evidence

### Management positive

Authenticated TEST HR Admin opened existing Journey `e60f48f2-e2de-45db-8992-4d51d26820fd` and received the management cockpit. The rendered overview showed Sophie De Vries / DEMO-002, `ACTIVE`, version 5 after cleanup, 2 topics, 0/2 progress, a next-moment empty state and one overdue required topic.

The existing lifecycle contract was exercised and restored:

1. `POST /api/journeys/{id}/transition` `{ expectedVersion: 3, action: "PAUSE" }` → HTTP 200; overview readback showed `PAUSED`, version 4.
2. `POST /api/journeys/{id}/transition` `{ expectedVersion: 4, action: "RESUME" }` → HTTP 200; overview readback showed `ACTIVE`, version 5.

The Journey was not cancelled or otherwise left with test residue. The visible action set matched the readback status: pause/complete/cancel while active, resume/complete/cancel while paused.

### Actor-safe negatives

- TEST Manager opening the same management API received HTTP 403 with the existing insufficient-permission response. The route rendered only the authenticated shell and did not expose management controls.
- TEST Employee Noah opened the existing Journey `041c69df-daab-4e2e-a9db-3dc28f532a0f` and received the existing actor-safe participant overview (`JOUW JOURNEY`, timeline, topic details and team). No management status or replacement actions were exposed.

### Invalid and nonexistent IDs

- `GET /api/journeys/not-a-valid-id` → HTTP 400, `{ "error": "JOURNEY_ID_INVALID" }`.
- `GET /api/journeys/00000000-0000-4000-8000-000000000000` → HTTP 404, `{ "error": "JOURNEY_NOT_FOUND", "issues": [] }`.

### Browser/layout/console

- HR management overview visually checked at desktop viewport 1440×900; metadata, progress, timeline, attention and action columns rendered without clipping.
- HR management overview visually checked at 390×844; measured `innerWidth=390`, `scrollWidth=390`, `overflowX=false`.
- Browser `errors` output was empty. Browser console contained only React DevTools informational messages; no console errors were observed.
- Dev server emitted the existing Next.js development warning for cross-origin dev resources when using `127.0.0.1`; this is local tooling noise and not a browser console error from the Journey page.

## Verification

- TypeScript: `npm.cmd run type-check --workspace @liquid-hr/hr-suite` — GREEN.
- i18n: `npm.cmd run check:i18n --workspace @liquid-hr/hr-suite` — GREEN, 33 namespaces with equal NL/EN keys.
- Targeted Journey tests — GREEN, 3 files / 6 tests.
- Full suite: `npm.cmd run test --workspace @liquid-hr/hr-suite` — GREEN, 235 files / 901 tests.
- ESLint: `npm.cmd run lint --workspace @liquid-hr/hr-suite` — 0 errors, 8 pre-existing warnings outside this slice.
- Targeted changed-file ESLint — GREEN.
- `git diff --check` — no whitespace errors.

## Database, remote and integration notes

- No migration was added or applied; no remote schema or production configuration was changed.
- Existing Journey runtime, API, RLS and lifecycle contracts were reused.
- The central Foundation and existing journey label/message contracts were reused; NL and EN Journey keys remain symmetric.
- The parent journey route and list link now converge management viewers on the overview route. Integration should preserve that redirect and the actor-safe fallback branch.
- Local branch only; no push, merge or deployment performed.

## Residuals

- The full lint gate retains the repository's existing 8 warnings in employee/foundation/dropdown files; there are no new errors from this slice.
- Steps, Participants and participant-detail scope remains unchanged and requires no follow-up from this slice.
