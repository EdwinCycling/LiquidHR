# Roadmap 2 — Company Documents / HR Operations

Date: 2026-08-22
Worktree: `.codex-worktrees/r2-company-documents`
Branch: `work/r2-company-documents`
Baseline: `abfa0bbb7db628f588faa3d4818a4f4663f27b46`
Local port: `3103`

## Scope

Company Documents only. The existing API routes, service, private `company-documents` storage bucket, file rules, metadata schema, permissions, RLS and `DocumentViewer` contract remain unchanged. No central Foundation files, central delivery/status documents, schema, remote Supabase action, merge, push or deployment were changed.

## Foundation v1.2 decision

- Collection: `EntityList`, because document identity and file metadata are more useful than a comparison table.
- Create: `FormDrawer` with fixed actions, saving state and dirty-form protection.
- Row actions: `ActionMenu`; view and download are contextual actions, delete is destructive and opens `ConfirmDialog`.
- Surfaces: `PageShell`, `PageHeader`, `EntityList` and semantic Foundation surfaces; no local button, form-field or heavy card pattern.
- Responsive contract: metadata wraps below the title and row actions remain reachable at 390×844; normal page scroll is preserved.
- Permission contract: read remains service/API enforced; write and delete capabilities are checked separately server-side and only their matching UI actions are rendered.

FOUNDATION_GAP: none. All required v1.2 primitives and patterns already exist and are reused.

## Verification handoff

Local technical gates:

- `npm.cmd test --workspace @liquid-hr/hr-suite -- company-document-library.test.tsx foundation-v1-2.test.tsx`: GREEN, 2 test files / 13 tests.
- `npm.cmd run type-check --workspace @liquid-hr/hr-suite`: GREEN.
- `npm.cmd run check:i18n --workspace @liquid-hr/hr-suite`: GREEN, 33 equal NL/EN namespaces.
- targeted ESLint for the changed page/component/test: GREEN, exit 0.
- `git diff --check`: GREEN. Git emitted only existing LF/CRLF normalization warnings.

Authenticated acceptance is `BLOCKED BY ENVIRONMENT` in this execution context. The exact worktree has no `apps/hr-suite/.env.local`; the parent/worktree locations and process environment also have no Supabase URL/key or canonical fixture-password values. The exact app did start on port 3103, but HTTP sanity returned:

| Request | Evidence |
|---|---:|
| `GET /login` | 500 |
| `GET /company-documents` | 500 |
| `GET /api/company-documents` | 500 |

Playwright opened `http://localhost:3103/login` and received 500. The runtime error was the missing Supabase project URL/key in `proxy.ts`; the browser reported 3 errors and 0 warnings, including the same runtime error and a favicon 404. The Company Documents route did not render, so no authenticated desktop/390×844 flow, Default/LinkedHR comparison, real CRUD, negative persona, unique `R2-COMPANY-DOC-<runid>` record, HTTP POST/DELETE evidence or storage cleanup can be claimed. No test record or storage object was created, so there is nothing to clean up.

Final local commit SHA: reported in the handoff response after the commit is finalized.

## Acceptance retry — 2026-08-22

Step 0 was blocked before authentication: the required canonical source `C:\Users\Edwin\Documents\Apps\LiquidHR\apps\hr-suite\.env.local` does not exist. `Copy-Item -Force` was attempted exactly for that source and the exact worktree target; the command reported the missing source and `target-exists=False`. Only `.env.example` is present in the canonical source directory. No env content was read, logged or committed. The fixture-auth preflight, server restart, HTTP/browser acceptance, persona checks, responsive/theme checks and CRUD cleanup were not run because the mandatory environment preflight could not be completed. No remote or test-data mutation occurred.

## Acceptance retry — 2026-08-22 — environment restored

The canonical nested source `C:\Users\Edwin\Documents\Apps\LiquidHR\apps\hr-suite\.env.local` was present. It was copied with `Copy-Item -Force` to the exact worktree target and `Test-Path` returned `True`; no env content or secret was logged. The canonical fixture-auth preflight completed with exit 0 and only the three approved TEST fixtures were involved. The exact worktree restarted on port 3103 and reported `.env.local` loaded.

Real browser/API evidence used named Playwright session `r2company`; no mocks were used:

| Persona / flow | Evidence |
|---|---|
| TEST HR Admin | `POST /api/company-documents` `201 Created`; refreshed Company Documents page `200`; title `R2-COMPANY-DOC-20260822-1752-6F2C` remained visible after refresh; TXT content rendered in the existing viewer iframe; `GET /api/company-documents/<id>/download` `307 Temporary Redirect` to the existing signed-storage download flow. |
| TEST Manager | Company Documents page/read `200`; upload and delete controls absent; real browser `POST /api/company-documents` `403`, real browser `DELETE /api/company-documents/<id>` `403`; existing document remained readable. |
| TEST Employee | Company Documents page/read `200`; upload and delete controls absent; real browser `GET /api/company-documents` `200` with the temporary record visible; real browser `POST /api/company-documents` `403`, real browser `DELETE /api/company-documents/<id>` `403`; existing document remained readable. |

The HR Admin create/view/download path is GREEN. The delete path remains BLOCKED by the TEST database contract: the original service masked the RLS failure as `404`; a scoped service correction now pre-reads the visible row and reports the actual failed soft-delete as `500`, with diagnostic response code `42501` confirmed during retry. The repository migration contains the expected group-scoped policy, but this acceptance run is not authorized to apply or repair remote schema/RLS. No generic Foundation component, API contract, storage rule, file rule, permission definition or remote schema was changed.

Responsive/theme evidence:

- Default/Liquid Navy: authenticated Company Documents at `1440x900` and `390x844`; `document.documentElement.dataset.theme=liquid-navy`; `scrollWidth === clientWidth` (`1440/1440` and `390/390`).
- LinkedHR: authenticated Company Documents at `1440x900` and `390x844`; `data-theme=linkedhr`; `scrollWidth === clientWidth` (`1440/1440` and `390/390`). The final 390 check also used TEST HR Admin and showed the write-capable `Document toevoegen` action.
- Final fresh Company Documents console inspection returned 0 errors and 0 warnings. Earlier failed delete attempts produced only the expected client fetch errors associated with the RLS blocker; no unrelated runtime console error was observed.

Cleanup: the controlled temporary TXT file was removed from the local temp directory. Negative-persona probes created no records or storage objects because they returned `403`. The HR Admin record/storage object could not be cleaned through the existing soft-delete contract because the TEST RLS rejection prevented deletion; no direct/manual remote cleanup was performed. The remaining remote test record is explicitly part of the blocker evidence.
