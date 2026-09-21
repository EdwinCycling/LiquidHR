# Acceptance Harness V2

## Baseline, personas and state

Record exact `origin/main` SHA, branch and worktree. Use `work/acceptance-<run-id>-YYYYMMDD`. DEV project: `wnpfloqpjvaacobppbpk`. Personas: owner `edwin@editsolutions.nl`, HR `hradmin.fixture@liquidhr.test`, Manager `manager.fixture@liquidhr.test`, Employee `employee.fixture@liquidhr.test`; known Yara `DEMO-028`, Noah `DEMO-035`, and `DEMO-001` manager out-of-scope. Never evidence secrets, cookies or tokens.

State machine: `PRECHECK → FIXTURE_READY → MUTATION → PERSISTENCE_READBACK → AUTHENTICATED_BROWSER → NEGATIVE_CHECKS → RESPONSIVE_CHECKS → QUALITY_GATE → COMMIT → PUSH`.

Classifications: `GREEN`, `PRODUCT_FAILURE`, `FIXTURE_DRIFT`, `HARNESS_FRICTION`, `EXTERNAL_BLOCKER`, `PRODUCT_DECISION`, `SECURITY_STOP`.

## Preflight and fixtures

Before business writes verify baseline, worktree, project ref, Production exclusion, personas/auth, permissions, fixture completeness, existing rows, Auth/mail/storage/document-generation/signing/providers, migration history and module configuration. Test mail delivery before repeated invitations or bootstrap identities.

Repair only pre-authorized canonical DEV-only role/fixture drift: capability already exists in the global role, tenant override merely omits it, correction is DEV-only, and no cross-tenant or Production authorization broadens. Use normal invitation/activation and domain services; never fabricate direct auth links or ownership.

## Mutations, security and browser

Record actor, subject, event, revision and downstream state before/after every mutation. Check refresh, double click, repeated submit, same key and retry; never blindly repeat non-idempotent ledger/financial mutations. Use a unique redacted run ID such as `F01-20260922-001`.

Use `http://localhost:3000`, `domcontentloaded`, explicit headings, stable `data-testid`, API readiness and bounded polling. Avoid broad `networkidle` with Next HMR/WebSockets. A valid fail-closed result can be 403 or 404. Assert no leak, business mutation, revision/event change or sensitive existence detail.

## Golden Journey lessons

GJ01 requires deterministic mail delivery preflight before invitations or identities; Auth 502 is an external blocker. GJ02 proves batch → item → snapshot → dossier → signing persistence and employee-only signing. GJ03 uses canonical Actual Work service/RPC/RLS; Employee self-write is own-row only and period, schedule, leave-overlap and type rules remain server-enforced.

## Migrations, contract and continuation

Verify DEV migration filename/version/name and normalized SQL when metadata is suspicious; never rerun merely to repair metadata or migrate Production. Requirements and approved decisions precede existing code; undefined behavior is `PRODUCT_DECISION`.

Defect loop: reproduce → persisted-state proof → root cause → smallest canonical fix → regression → rerun → downstream proof → continue. Stop only for destructive/data-loss risk, security ambiguity, Production requirement or unavailable external credentials without authorized recovery.

## Evidence and gates

Store evidence under `.artifacts/<run-id-or-run-name>/`; keep this library durable and secret-free. Protect `.env.local`, `next-env.d.ts` and generated state. After schema changes run advisors and regenerate types; compare new findings with baseline. Normal gates: migration contract, targeted tests, typecheck, lint, i18n, browser, DEV readback, full Vitest, build, diff check, commit, push and remote SHA. Documentation-only changes run documentation checks only and do not run acceptance journeys.
