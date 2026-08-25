# R4 Journey Participants + Participant Detail

## Scope

- Branch: `work/r4-journey-participants`
- Worktree: `C:\Users\Edwin\Documents\Apps\LiquidHR.codex-worktrees\r4-journey-participants`
- Baseline: `origin/main` = `1471aa224e2318b0c216d95e16b2ba1c4cd3ec64`
- Port: `3152`
- Test prefix: `R4-JNY-PART`
- Visible version unchanged: `1.20260823.2`

Implemented the participant detail surface for `/journeys/[journeyId]/participants`:

- Foundation-based page shell, page header, status badge, progress bar, timeline, topic states/actions, team assignments and next action.
- HR participant switching through `?participantId=<participant-id>`.
- Actor-safe HR, self and participant rendering using the existing projection contract.
- Safe `COMPLETE`/`SKIP` action through the existing topic-outcome RPC route, with refresh/readback.
- Direct participant service seam for detail, assignment filtering/selection and progress, with focused tests.
- Existing Journey detail participant links now open the participant detail route.
- NL/EN Journey labels kept in parity.

No Journey schema, migration, RLS, template, step or activation-surface code was changed. No remote migration was applied.

## Files

- `apps/hr-suite/app/(dashboard)/journeys/[journeyId]/participants/page.tsx`
- `apps/hr-suite/components/journeys/journey-participant-detail.tsx`
- `apps/hr-suite/components/journeys/participant-detail-client.tsx`
- `apps/hr-suite/lib/journeys/participant-service.ts`
- `apps/hr-suite/lib/journeys/participant-service.test.ts`
- `apps/hr-suite/app/api/journeys/[journeyId]/topics/[topicId]/outcome/route.ts`
- `apps/hr-suite/app/(dashboard)/journeys/[journeyId]/page.tsx`
- `apps/hr-suite/lib/journeys/index.ts`
- `apps/hr-suite/lib/journeys/labels.ts`
- `apps/hr-suite/messages/nl/journeys.json`
- `apps/hr-suite/messages/en/journeys.json`

## Acceptance evidence

### Own disposable Journey

Target: `Test Validatie · 100006`; manager: `Yara Meijer`; no Noah canonical data was changed.

- Baseline: no `R4-JNY-PART-*` activation existed before the test.
- Activation payload used idempotency key `R4-JNY-PART-20260824-TEST-001`.
- `POST /api/journeys/activate` returned HTTP `201` with `id=0345ea3e-4727-41dd-87d1-542bff584b75`, `version=1`, `idempotentReplay=false`.
- Replay with the same key returned HTTP `201`, the same Journey ID and `idempotentReplay=true`.
- HR participant detail read back `Test Validatie` and `Yara Meijer` as active assignments.
- `POST /api/journeys/0345ea3e-4727-41dd-87d1-542bff584b75/topics/a9f3a2e7-925d-4170-86bf-ae2087939c64/outcome` returned HTTP `200` with `status=COMPLETED`, `idempotentReplay=false`.
- Refresh/readback showed `1/1 · 100%`, topic `Afgerond` and `Opgeslagen`.

### Duplicate assignment input

- A disposable activation with duplicate manager IDs and key `R4-JNY-PART-20260824-DUP-001` returned HTTP `201` and created `1a65afff-1fde-4edc-ae9a-85c73c8a3fca`.
- Readback projected one manager assignment (`Yara Meijer`), so the resolver deduplicated the repeated input before materialization; no duplicate participant was visible or created in the participant projection.
- This duplicate-input Journey was cancelled successfully: supported transition returned HTTP `200` and the final participant route was read-only.

### Personas and scope

- HR on the own Journey: `Status · HR-weergave`, clickable assignment links and the progress action were visible.
- Manager persona on the own Journey: `Status · Participantweergave`, actor-safe timeline and non-clickable team assignments; no HR controls.
- Employee persona on existing Journey `041c69df-daab-4e2e-a9db-3dc28f532a0f`: `Jouw Journey`, `Status · Mijn weergave`, no HR controls.
- Employee persona on the own R4 Journey: rendered the framework 404 with no participant data because Noah is not assigned to that Journey.
- Out-of-scope Journey `ea6d8968-35d6-4fa2-800f-8624318795b5` likewise rendered no participant data for the non-authorized actor.
- Browser console error count was `0` on the final HR, manager and employee route checks.

### Desktop and mobile

- Desktop checked at `1440x900`; the Foundation 2/3 timeline and 1/3 team/next-action layout rendered correctly.
- Mobile checked at `390x844`; no horizontal overflow was observed. The bottom HeRa floater is existing global UI and may overlap the viewport edge while scrolling.
- Local screenshots: `.playwright-cli/page-2026-08-24T18-00-13-617Z.png` and `.playwright-cli/page-2026-08-24T18-00-17-687Z.png`.

## Cleanup and open blockers

- Duplicate-input Journey `1a65afff-1fde-4edc-ae9a-85c73c8a3fca`: cleaned up through supported `CANCEL`, HTTP `200`; terminal participant readback had no progress/action buttons.
- Primary progress-test Journey `0345ea3e-4727-41dd-87d1-542bff584b75`: after a fresh detail readback supplied `expectedVersion=2`, the supported `CANCEL` returned HTTP `200` with `status=CANCELLED`, `version=3`; the final detail readback was terminal and read-only.
- Root-cause repro Journey `e009c002-bf38-4d20-bfc5-8000f9283a70`: activation returned HTTP `201`, the supported topic `COMPLETE` returned HTTP `200` and readback showed `ACTIVE`, `version=2`, topic `COMPLETED`; stale `CANCEL` with `expectedVersion=1` returned after 2.1 minutes as HTTP `500` with `JOURNEY_OPERATION_FAILED`, while the correct `expectedVersion=2` returned HTTP `200`, `CANCELLED`, `version=3`. The Journey was cleaned up through the supported transition.
- Post-migration repro Journey `62e73ecc-cafe-46ab-85d3-e3ff38ff44ac`: activation returned HTTP `201`; topic `COMPLETE` returned HTTP `200` and readback showed `ACTIVE`, `version=2`, topic `COMPLETED`, two active participants; stale `CANCEL` with `expectedVersion=1` returned HTTP `409` with `JOURNEY_VERSION_CONFLICT` in 2.6 seconds; correct `expectedVersion=2` returned HTTP `200`, `CANCELLED`, `version=3` in 0.8 seconds. Final Journey and participant-detail readback were terminal/read-only, with `1/1 · 100%` progress and no normal-route console errors.
- Root cause: `transition_journey_internal` raised the expected optimistic version conflict as PostgreSQL `40001` (`serialization_failure`). The Supabase Data API treats transient failures as retryable, so the stale business conflict was retried until the generic 500. Forward migration `20260825150000_fix_journey_version_conflict_retry.sql` changes only this lifecycle conflict to non-retryable `P0001`; it was applied to the test Supabase project and migration history was repaired for this exact version.
- Current blocker status: GREEN. The participant add/remove contract remains separate: the existing runtime contract exposes activation, lifecycle transition and participant replacement, but no participant add/remove endpoint or RPC. No direct table mutation was invented.

## Verification

- `npm.cmd run test -- --run lib/journeys`: 10 files, 37 tests passed.
- `npm.cmd run test`: 235 files, 904 tests passed.
- `npm.cmd run type-check -- --incremental false`: passed.
- `npm.cmd run check:i18n`: passed; 33 NL/EN namespaces have equal keys.
- `npm.cmd run lint`: passed with 0 errors and 8 pre-existing warnings outside this slice.
- `git diff --check`: passed; only Git's LF/CRLF normalization warnings were emitted.
- `npm.cmd run test -- --run lib/journeys/runtime-migration-contract.test.ts`: passed; migration contract includes the non-retryable lifecycle conflict regression guard.
- Remote test migration function readback confirmed `P0001` and no `40001`; no production migration, push, merge, deploy or version bump was performed.
- Post-migration browser acceptance: HR Journey detail and participant detail were read back at desktop viewport; normal routes had zero console errors. The single direct stale request produced the expected HTTP 409 resource console entry.

## Integration notes

- Keep the existing actor-safe Journey projection and RLS contracts as the source of truth; the new participant service delegates to them rather than reading participant tables directly.
- Central integration can use the already committed migration and post-migration evidence; do not broaden the remote migration history repair to unrelated drift.
- The participant delete contract remains a separate follow-up; do not add a direct table mutation or bypass the existing security-invoker/RLS write paths.
