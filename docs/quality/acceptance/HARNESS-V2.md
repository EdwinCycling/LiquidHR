# Acceptance Harness V2

This harness is mandatory for every runnable specification in this library. It is an acceptance protocol, not a substitute for product requirements or a permission to change Production.

## Baseline and isolation

Record the exact approved `origin/main` SHA before work. Start one branch/worktree from that SHA using `work/acceptance-<run-id>-YYYYMMDD`. Record branch, worktree, local HEAD and remote HEAD. Never test from an older local main or another worktree.

The canonical DEV Supabase project is `wnpfloqpjvaacobppbpk`. Production must be explicitly excluded from every tool, CLI and browser configuration. Separate Git worktrees do not isolate a shared DEV database, Auth project, Storage bucket or test fixtures; parallel runs are allowed only when domain state and fixture identities are independent.

## Personas and role matrix

Use canonical fixtures where available: owner `edwin@editsolutions.nl`, HR Admin `hradmin.fixture@liquidhr.test`, Manager `manager.fixture@liquidhr.test`, Employee `employee.fixture@liquidhr.test`, known Yara `DEMO-028`, Noah `DEMO-035` and Manager-out-of-scope `DEMO-001`.

Every run records a role matrix for:

| Persona | Required assertion |
|---|---|
| HR ADMIN | Intended tenant, HR-group and administration scope; configuration and lifecycle authority only where contracted |
| MANAGER IN SCOPE | Direct-team data and actions only |
| MANAGER OUT OF SCOPE | No cross-team, cross-group or private data |
| EMPLOYEE SELF | Own records and self-service actions only |
| OTHER EMPLOYEE | No colleague/private data, mutation or existence leak |

## State machine

Every run progresses in order:

`PRECHECK → FIXTURE_READY → MUTATION → PERSISTENCE_READBACK → AUTHENTICATED_BROWSER → NEGATIVE_CHECKS → RESPONSIVE_CHECKS → QUALITY_GATE → COMMIT → PUSH`

A later state cannot be marked GREEN when an earlier required state is unproven.

## Classifications

Use one primary classification for each finding: `GREEN`, `PRODUCT_FAILURE`, `FIXTURE_DRIFT`, `HARNESS_FRICTION`, `EXTERNAL_BLOCKER`, `PRODUCT_DECISION` or `SECURITY_STOP`.

An isolated `EXTERNAL_BLOCKER` does not stop independent scenarios. `SECURITY_STOP`, destructive risk, data-loss risk, Production requirement or ambiguous authorization stops the affected run and, when shared state could be unsafe, the complete run.

## Preflight checklist

Before any business write record:

- release/baseline SHA, branch, worktree and unique redacted run ID;
- DEV project ref and explicit Production exclusion;
- authenticated personas, tenant, HR group, administration and manager graph;
- canonical permissions and tenant overrides;
- fixture completeness and existing business rows that could collide;
- Auth, mail delivery, Storage, document generation, signing and provider dependencies;
- local migration filenames, local migration tests and recorded DEV migration history;
- module/configuration state and feature gates;
- intended mutation, rollback/restore plan and evidence location.

Test external mail delivery before repeated invitations or creating bootstrap identities. Do not create direct Auth-to-business links or fabricate business ownership.

## Functional surface inventory

Before exercising a domain, inventory the implemented surface:

- route and page;
- API route, server action and RPC;
- configuration and feature/module gates;
- lifecycle states and legal transitions;
- permissions, role overrides and tenant/group scope;
- list/detail and empty/first-use states;
- projections, read models and downstream consumers;
- audit/history, revisions and events;
- responsive/mobile entry points.

## Functional-completeness gate

For each materially implemented capability, cover as applicable:

`create/configure → validation → persisted readback → edit/update → lifecycle transitions → editability rules → empty state → first-use → duplicate/idempotency → refresh/relogin → close/archive/delete → error paths → server-side authorization → mobile usability`.

If a point is not implemented, record `PRODUCT_DECISION` or `NOT IMPLEMENTED`; do not invent behavior.

## Mutation and evidence protocol

Assign a unique run ID such as `F01-20260922-001`. For every mutation capture before and after:

- row counts and stable identifiers;
- actor and subject;
- event/audit entries;
- revision numbers and deltas;
- downstream projections, totals and read models;
- UI result and direct API/RPC result.

Check refresh, relogin, double click, repeated submit, same-key replay and retry semantics. Never blindly repeat a non-idempotent ledger, financial, invitation, signing or identity mutation. Use one bounded retry only after a concrete, documented fix.

## Authorization and negative checks

A valid fail-closed result may be HTTP `403` or `404`. For every denial assert all of the following where applicable:

- no sensitive data or existence detail leaked;
- no business row changed;
- no revision or event changed;
- no false-success audit was written;
- no cross-tenant, cross-group or subject substitution succeeded.

Use UI, direct route, API ID substitution and RPC probes. Test the role matrix, not only the happy-path persona.

## Browser harness

Canonical base URL is `http://localhost:3000`. Prefer `domcontentloaded`, explicit headings, stable `data-testid` selectors for critical acceptance actions, API readiness and bounded polling. Avoid broad networkidle because Next HMR/WebSockets can keep it open. Classify ordinary runner, timing or CDP friction as `HARNESS_FRICTION` after bounded recovery.

## Migration safety

Immediately after every DEV migration apply, read back the migration history and compare the local filename-derived version and name with the recorded DEV version and name. If metadata is suspicious, compare normalized SQL and relevant schema objects before any correction. Never rerun migration SQL merely to repair metadata. Never apply or repair Production migrations.

After schema changes run advisors and regenerate database types. Compare advisor output with a captured baseline and report only new/changed findings as run findings; existing project-wide findings remain explicitly separate.

## Generated-file and secret hygiene

Protect `.env.local`, secrets, tokens, next-env.d.ts and unrelated generated files. Never print, stage, copy, commit or expose their values. Keep execution evidence under `.artifacts/<run-id-or-run-name>/`; do not move temporary evidence into the durable library.

## Defect loop

For an ordinary in-scope defect use the complete loop:

`reproduce → persistence proof → root cause → smallest canonical fix → regression → rerun → downstream verification`.

The fix must preserve canonical domain ownership, RLS, server authorization and tenant boundaries. Continue independent scenarios after an isolated failure. Stop for `SECURITY_STOP`, destructive/data-loss risk, Production access or architectural ambiguity that could corrupt canonical data.

## Quality gate and closure

Normal order is: migration contract and metadata readback, targeted changed-module tests, strict TypeScript, ESLint, i18n parity, authenticated browser checks, DEV readback, full Vitest, production build, `git diff --check`, explicit staging, commit, push and remote SHA verification. Documentation-only changes must say so and must not run acceptance journeys.
