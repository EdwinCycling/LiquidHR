# Focus DEV acceptance — 2026-09-20

## Scope

- DEV Supabase project: `wnpfloqpjvaacobppbpk`.
- Existing DEV demo tenant only: `liquid-hr-demo-holding` / `Planeten`.
- Target employee: Noah Hendriks / `DEMO-035`.
- Production, global role definitions and service-role bypasses were not changed.
- The local `apps/hr-suite/.env.local` and the pre-existing user document
  `docs/delivery/SUPABASE_MIGRATION_RECONCILIATION_20260919.md` were not staged.

## Act-as alignment and remote readback

The canonical tenant-specific `TENANT_ADMIN` role now receives the already
existing `focus:act-as-employee` permission through
`20260920170000_grant_focus_act_as_demo_tenant_admin.sql`. The migration is
tenant-slug scoped and idempotent; the global `TENANT_ADMIN` role was not
modified.

Act-as audit persistence was enabled with the existing audit contract through
`20260920171000_allow_focus_act_as_audit_events.sql` and the narrow
authenticated INSERT grant in `20260920172000_grant_focus_act_as_audit_insert.sql`.
The policy requires the authenticated actor, the target employee, START/STOP,
`FOCUS_ESS`, an expiry number and the canonical capability/HR-group check.

Remote readback confirms:

- Global `TENANT_ADMIN`: capability present.
- DEV demo-tenant `TENANT_ADMIN`: capability present.
- DEV demo-tenant `EMPLOYEE` and `DIRECT_MANAGER`: zero capability rows.
- `audit_logs`: exactly two target-tenant `focus_act_as_session` rows after the
  positive flow: one START and one STOP for Noah, both attributed to the HR
  fixture actor.
- Authenticated INSERT on `public.audit_logs`: present.

## Authenticated persona acceptance

| Persona | Action | Result |
| --- | --- | --- |
| Test HR Admin / tenant `TENANT_ADMIN` | Start Act-as for Noah | PASS — HTTP 200, Focus banner showed `NAMENS MEDEWERKER`, employee-only navigation and stop control |
| Test HR Admin / tenant `TENANT_ADMIN` | Stop Act-as | PASS — HTTP 200, returned to normal HR Admin context; START/STOP audit readback present |
| Test Manager / `DIRECT_MANAGER` | Direct Act-as POST for Noah | PASS — HTTP 403, localized authorization error, no audit mutation |
| Test Employee / `EMPLOYEE` | Direct Act-as POST for Noah | PASS — HTTP 403, localized authorization error, no audit mutation |

The regression coverage is in:

- `apps/hr-suite/lib/focus/act-as-token.test.ts`: HR Admin/TENANT_ADMIN
  positive capability and Employee/Manager/persona-negative checks.
- `apps/hr-suite/supabase/migrations/20260920170000_grant_focus_act_as_demo_tenant_admin.contract.test.ts`.
- `apps/hr-suite/supabase/migrations/20260920171000_allow_focus_act_as_audit_events.contract.test.ts`.
- `apps/hr-suite/supabase/migrations/20260920172000_grant_focus_act_as_audit_insert.contract.test.ts`.

## Profile and self-service acceptance

The Employee profile editor changed Noah's first name to a temporary QA value,
read back the saved state, and restored `Noah` through the same UI. The final
profile readback showed `Noah Hendriks` and `Opgeslagen.`. The editor remains
limited to the existing employee PATCH seam and does not expose address, bank,
statutory or login fields.

## Responsive evidence

The authenticated Employee matrix used a real local Webpack server on port
3001, viewport `390x844`, and no fetch mocks. The following routes all reported
`scrollWidth = 390` and `overflowX = false`:

- `/focus`
- `/focus/profiel`
- `/focus/verlof`
- `/focus/aanvragen`
- `/focus/team`

Screenshots in this directory include the Act-as desktop/mobile states, the
restored profile desktop/mobile states, and the Employee home, leave, requests
and team mobile states, alongside the existing absence and Leave acceptance
evidence.

## Existing DEV fixture boundaries

- The one permitted manager-direct sickness attempt for Noah returned
  `409 ABSENCE_OVERLAP` because his existing recovery window runs through
  `2026-10-18`; it produced no new case. This is state-gated, not an
  authorization failure, and was not retried.
- The Manager Home vacation card could not be positively exercised because the
  current Yara direct-team fixture has no approved `VACATION` allocation. The
  existing approved request is a different family/past record; no synthetic
  fixture was invented.
- Browser acceptance used the Playwright CLI after the existing CDP
  agent-browser path returned `CDP response channel closed`. No token or
  credential value is stored in this evidence.

## Technical gates

- Focus/Act-as and adjacent targeted tests: green.
- Full HR-suite Vitest: `432/432` files, `1698/1698` tests, with
  `--testTimeout=30000`.
- Strict TypeScript: green.
- ESLint: green.
- i18n parity: `39` equal NL/EN namespaces.
- Next/Webpack production build: `296/296` static pages.
- `git diff --check`: exit 0; Git reported only normal LF/CRLF conversion
  notices.
- Supabase type generation and security/performance advisors were run against
  DEV. Advisors retain existing project-wide findings; the new audit policy is
  visible in the expected multiple-permissive-policy notice and is not treated
  as a hidden green claim.

The remaining gates are the explicit final main integration and Production
release gate. No main merge, Production migration or Production deployment is
part of this DEV acceptance.
