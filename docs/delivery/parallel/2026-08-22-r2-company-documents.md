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
