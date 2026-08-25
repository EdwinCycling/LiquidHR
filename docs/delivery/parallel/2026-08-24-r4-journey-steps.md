# R4 Journey Steps — handoff

## Scope and contract

- Branch: `work/r4-journey-steps`
- Worktree: `C:\Users\Edwin\Documents\Apps\LiquidHR.codex-worktrees\r4-journey-steps`
- Local port: `3151`
- Test prefix: `R4-JNY-STEPS`
- Owned surface: `/journeys/[journeyId]/steps` and the direct Journey step/moment/topic runtime components and services.
- Baseline: `origin/main` at `1471aa224e2318b0c216d95e16b2ba1c4cd3ec64`.

## Inventory before implementation

The published fixture template `Stap 3 preboarding controle · v1` resolves to one active moment and one required `INFORMATION` topic. The existing runtime mutation contract exposes `COMPLETE`, `SKIP`, and `CHECK_IN`; this surface previously offered no dedicated steps route. The new UI exposes only the existing `COMPLETE` and `SKIP` actions. `CHECK_IN` remains intentionally out of scope because it is not an existing action offered by this runtime surface and its contract requires a note. No update, reorder, or template-designer behavior was added.

## Implementation

- Added the server route `/journeys/[journeyId]/steps` with permission-aware management and participant rendering.
- Replaced the participant detail implementation with the shared Journey Steps runtime surface; the existing participant deep-link remains intact.
- Reused LiquidHR Foundation `PageShell`, `PageHeader`, `DetailColumns`, `Surface`, `SectionHeader`, `InfoList`, `Badge`, `Button`, `ConfirmDialog`, and `EmptyState` primitives/compositions.
- Added moment/topic grouping, localized title/body copy, topic type, required/optional state, action URL, availability, status, progress, participants, and next-action presentation.
- Kept mutation writes on the existing `POST /api/journeys/[journeyId]/topics/[topicId]/outcome` route. Actions are shown only for `ACTIVE` journeys, `PENDING` topics, and moments with `available_on <= today`; terminal and unavailable topics are read-only.
- Added explicit confirmation for irreversible `SKIP`, double-submit protection, localized failure state, and `router.refresh()` readback after successful writes.
- Added focused availability/progress and component mutation tests. No migration, RLS, API-route, permission, or database change was needed.

## Files changed

- `apps/hr-suite/app/(dashboard)/journeys/[journeyId]/page.tsx`
- `apps/hr-suite/app/(dashboard)/journeys/[journeyId]/steps/page.tsx`
- `apps/hr-suite/components/journeys/journey-participant-detail.tsx`
- `apps/hr-suite/components/journeys/journey-steps.test.tsx`
- `apps/hr-suite/components/journeys/journey-steps.tsx`
- `apps/hr-suite/lib/journeys/labels.ts`
- `apps/hr-suite/lib/journeys/runtime-repository.ts`
- `apps/hr-suite/lib/journeys/runtime-service.ts`
- `apps/hr-suite/lib/journeys/steps.test.ts`
- `apps/hr-suite/lib/journeys/steps.ts`
- `apps/hr-suite/messages/en/journeys.json`
- `apps/hr-suite/messages/nl/journeys.json`
- this handoff document.

## Real runtime evidence

All browser evidence used the local server on port `3151`, the existing fixture contract, and the HR group `Planeten`.

### COMPLETE

- Created Journey `4f4d44da-cef6-4ca7-934f-a76fb5f3ab99` for `Noah Hendriks · DEMO-035` through the existing Journey activation wizard. Activation request: `POST /api/journeys/activate` → `201 Created`; the UI redirected to the concrete Journey detail.
- HR steps route: `POST /api/journeys/4f4d44da-cef6-4ca7-934f-a76fb5f3ab99/topics/4cea407e-b723-42ea-a854-1d399b9d77e2/outcome` → `200 OK`.
- Request body: `{"outcomeType":"COMPLETE"}`.
- Response: `{"data":{"topicId":"4cea407e-b723-42ea-a854-1d399b9d77e2","status":"COMPLETED","outcomeId":"5534d040-afc1-496a-a6f1-463f71452368","idempotentReplay":false}}`.
- Refreshed HR UI showed `Afgerond`, `Opgeslagen`, and `1/1 · 100%`; the action buttons disappeared, proving terminal read-only behavior.

### SKIP

- Created second Journey `a1462cec-3f6d-48ef-b7c4-5a6e4b82c659` for the same fixture target through the same existing wizard.
- The steps UI required the confirmation dialog before writing.
- HR steps route: `POST /api/journeys/a1462cec-3f6d-48ef-b7c4-5a6e4b82c659/topics/25a0fd1e-fee1-4d4f-94dc-f4c223dba9b7/outcome` → `200 OK`.
- Request body: `{"outcomeType":"SKIP"}`.
- Response: `{"data":{"topicId":"25a0fd1e-fee1-4d4f-94dc-f4c223dba9b7","status":"SKIPPED","outcomeId":"3bd583ce-811e-426e-910f-f92c69417d26","idempotentReplay":false}}`.
- Refreshed HR UI showed `Overgeslagen`; the mutation actions disappeared. The existing database projection counts only `COMPLETED` topics in progress, so this contract correctly remained `0/1` after SKIP and had no next action.

### Participant and cleanup

- In separate browser session `r4-employee`, `employee.fixture` opened the first Journey steps route and read the same employee-scoped topic/team state. After COMPLETE, no action was offered because the topic was terminal. The participant view remained status/readback-only after HR cleanup, consistent with terminal lifecycle semantics.
- First cleanup: `POST /api/journeys/4f4d44da-cef6-4ca7-934f-a76fb5f3ab99/transition` with `{"expectedVersion":2,"action":"CANCEL"}` → `200 OK`; response status `CANCELLED`, version `3`; HR detail readback showed `Geannuleerd`.
- Second cleanup: `POST /api/journeys/a1462cec-3f6d-48ef-b7c4-5a6e4b82c659/transition` with `{"expectedVersion":2,"action":"CANCEL"}` → `200 OK`; response status `CANCELLED`, version `3`; HR detail readback showed `Geannuleerd`.
- Cleanup used the supported Journey lifecycle; no delete, reset, seed, or direct database write was used.

## Viewport and console checks

- Desktop `1440×900`: screenshot captured; `scrollWidth=1440`, `bodyScrollWidth=1440`; console had zero errors and zero warnings apart from normal React/HMR informational messages.
- Mobile `390×844`: screenshot captured; `scrollWidth=390`, `bodyScrollWidth=390`; the responsive navigation and full steps surface rendered without horizontal overflow.

## Verification

- Targeted TypeScript check: passed using an external temporary `tsBuildInfoFile` because the worktree-generated default file is protected by the junction setup.
- `check:i18n`: passed, `33 namespaces met gelijke NL/EN-sleutels`.
- Full `npm.cmd run lint`: passed with 8 existing warnings in unrelated employee/Foundation/dropdown files and 0 errors; targeted ESLint for all changed TypeScript/TSX files also passed.
- Focused Journey tests and new Steps tests: passed before the full-suite run.
- Full `npm.cmd test`: passed, `236` test files and `904` tests.
- `git diff --check`: passed.

## Integration and residual notes

- No Supabase migration was added or applied; generated database types were not required because no schema changed.
- No shared Foundation primitive or generic pattern was changed. The new route and runtime surface reuse the existing Foundation contracts.
- The existing `CHECK_IN` API outcome remains intentionally unexposed here because it was not offered by the inventoried UI and requires note-entry behavior. Adding it would be a separate runtime contract decision.
- The central integration task should run its normal merge-base review and production build after integrating this branch. This slice does not push, merge, deploy, or alter `main`.
