# Process Automation lifecycle acceptance

Datum: 2026-08-22
Branch: `work/debt-process-lifecycle`
Worktree: `.codex-worktrees/debt-process-lifecycle`
Baseline: `abfa0bbb7db628f588faa3d4818a4f4663f27b46`
Lokale server: `http://localhost:3107`
Omgeving: LiquidHR TEST, tenant/HR-groep `Planeten`, TEST HR Admin

## Testrecord

- Display name: `R2-PROCESS-20260822-123111`
- Technical key: `r2-process-20260822-123111`
- Definition ID: `82a35935-98a5-41d7-b2ae-1a1aef41ece9`
- Final lifecycle state: `RETIRED`
- Retire reason: `R2-PROCESS-20260822-123111 retired after lifecycle acceptance`
- Publish changelog: `R2-PROCESS-20260822-123111 publish acceptance`

## Lifecycle evidence

| Stap | API/evidence | Result |
| --- | --- | --- |
| Create draft | `POST /api/process-automation/studio` | `201`; exact technical key zichtbaar in catalog |
| Readback draft | `GET /api/process-automation/studio/{definitionId}` | `200`; `DRAFT`, revision 1, 0 versions |
| Edit draft | `POST /api/process-automation/studio/{definitionId}/draft` | `200`; title changed to the R2 display name, revision 2 |
| Readback edited draft | `GET /api/process-automation/studio/{definitionId}` | `200`; NL title and key persisted, revision 2 |
| Publish required changelog | `POST /api/process-automation/studio/{definitionId}/publish` | `200`; exactly one published version, version 1 |
| Changelog readback | published `definition_json.publishChangelog` | Exact publish changelog persisted |
| Published/catalog readback | `GET /api/process-automation/studio/{definitionId}` and `GET /api/process-automation/studio` | Both `200`; catalog shows `PUBLISHED`, version 1 |
| Startability/process trial | `POST /api/process-automation/studio/{definitionId}/trial` | `200`; no runtime instance, task, or domain mutation created |
| Retire required reason | `POST /api/process-automation/studio/{definitionId}/retire` | Empty/overlong reason rejected with `400`; input remained in dialog. Valid reason returned `200` |
| History/version readback | `GET /api/process-automation/studio/{definitionId}` | `200`; `RETIRED`, one immutable version retained, version 1 and publish changelog readable |
| Catalog retired readback | `GET /api/process-automation/studio` | `200`; exact key/title visible with `RETIRED` |
| Delete/cleanup | No delete route or product delete contract exists for process definitions | No delete performed; the retired record is intentionally left recognizable for acceptance inspection |

The process trial returned an expected TEST-fixture warning: `target-manager` was `BLOCKING` because the selected department has multiple active `DIRECT_MANAGER` role holders. The trial still returned `200` and explicitly confirmed that no runtime or domain mutation was created. This is fixture data, not a process-code change.

## Interaction evidence

- Dirty create flow: cancel from the new-process wizard opened the discard confirmation; continuing editing preserved the entered values.
- Browser back/close: dirty create state triggered the browser `beforeunload` contract and dismissing the dialog kept the wizard open.
- Create double-submit: only one create mutation was persisted (`201`); catalog count increased once and the definition ID is unique.
- Publish double-submit/pending: the confirmation action was exercised with a delayed real API request; the final readback contains exactly one version, so no duplicate publish mutation was persisted.
- API-error input retention: an overlong retire reason produced real HTTP `400`; the dialog remained visible and preserved all 2,027 input characters.
- Required fields: empty publish changelog and empty retire reason left the confirmation actions disabled.
- Desktop: viewport `1280x720`, document/body width `1280`, no horizontal overflow. The temporary screenshot was local-only and is not retained in the commit.
- Mobile: viewport `390x844`, document/body width `390`, no horizontal overflow. The temporary screenshot was local-only and is not retained in the commit.
- Negative persona: TEST Manager was switched in through the canonical role switch. Process catalog API returned `403`; direct process route ended at `/geen-toegang`. A fresh browser context reported 0 console errors.
- Console: the intentional HTTP `400` validation probe emitted the expected browser resource error in that probe context. The final fresh negative-persona browser context had 0 errors and 3 warnings; no relevant product console error remained.

## Scope and delivery

- Canonical `fixtures:talent-auth` preflight was rerun in TEST and updated only `hr-admin`, `manager`, and `employee`.
- No production action, migration, schema write, push, merge, deploy, or central status-document change was performed.
- No process-specific product bug was found. The trial warning is caused by existing TEST role-fixture ambiguity and does not create a runtime mutation.
- The handoff is intentionally isolated under `docs/delivery/parallel/`; central status documents were not changed.
