# GJ01 — Onboarding / Preboarding

## Verdict

**GJ01 BLOCKED** for the complete authenticated employee acceptance gate.

The canonical HR journey flow, DEV persistence, manager resolution, Focus preview and responsive route checks are green. The remaining block is DEV Auth mail delivery: after one bounded fixture recovery, the canonical invitation endpoint still returned HTTP `502` and revoked the pending invitation. No service-role browser session, direct `auth_user_id` link, invitation-token bypass or role/permission broadening was used.

## Baseline and scope

- Branch: `work/post-release-golden-journeys-20260920`
- Release baseline: `1.20260920.1`
- Baseline/main commit: `874098d9c0675d17774ad027c7a8b4fbadb37c39`
- DEV Supabase project: `wnpfloqpjvaacobppbpk`
- Tenant/group: De Sterren / Planeten
- Target employee: `Test test100` (`a6ef0ba0-440b-4b3d-8bf5-f7ef07f7baa5`)
- Future employment: `3ae243ae-8c2d-4047-96df-b995ab4907ed`, starts `2026-10-01`

## Canonical flow and readback

1. The existing HR employee/employment UI flow created the future employment and returned HTTP `201`.
2. The normal HR Journey wizard selected `Test test100`, the published preboarding template `Stap 3 preboarding controle` (`df5ee0e7-acbb-496c-94d4-af7ebd5c5b2d`), and the employment start-date anchor.
3. The wizard initially surfaced the missing required manager. HR resolved that role through the visible manual-choice control to Yara Meijer (`DEMO-028`), then reran team resolution.
4. Activation completed through the UI and returned journey `7da29334-5979-4a75-b39c-4434021e36e6`.
5. Read-only DEV readback confirmed:
   - `status = PLANNED`
   - `anchor_date = 2026-10-01`
   - employee participant: `TARGET_EMPLOYEE`, `ASSIGNED`
   - manager participant: `MANUAL`, `ASSIGNED`, resolution note `Handmatig bevestigd door HR`

## Bounded authenticated-fixture recovery

The invitation wizard initially reported `Geen privé-e-mailadres` for the future employee. HR corrected that single DEV fixture field through the normal employee personal-data UI; no role, permission, tenant, group or employment authorization changed. The canonical employee invitation button then reached `POST /api/invitations/employee`, but DEV Supabase Auth mail delivery returned HTTP `502` and the application revoked the pending invitation.

Per the continuation instruction, exactly one controlled DEV Auth identity was then created with the existing server-side fixture-auth bootstrap. The identity was not linked to the employee. A single retry through the normal HR invitation button again returned HTTP `502`; read-only DEV evidence is `2` invitation rows, both `REVOKED`, `1` Auth identity, and `0` employee Auth links. Logging in with that identity through the normal browser login correctly ended at `/geen-toegang`; all tested Focus/Journey paths remained denied or redirected. This proves the account is not being used as a service-role or direct-link bypass.

## Product fix included in this slice

`POST /api/focus/preview` now validates employee identifiers with the existing PostgreSQL-compatible `databaseUuid` schema instead of the stricter RFC-only `z.uuid()` validator. This fixes legitimate deterministic DEV fixture identifiers without broadening authorization or changing RLS. A focused route regression test covers the accepted database UUID form.

## Acceptance evidence

The responsive probe captured both 1440×1000 and 390×844 for the relevant HR, manager and employee routes. The HR preview API returned `201`; the preview routes returned `200` at both sizes.

The preboarding preview showed the safe pre-start contract for `Test test100`:

- start date `1 oktober 2026` and countdown;
- onboarding only, with profile, documents and signing surface;
- no Leave, Actual Work, manager or colleague surface exposed;
- journey `Stap 3 preboarding controle`, `Gepland`, `0 van 1 afgerond`.

Evidence files:

- `gj01-activation-preview-1440x1000.png`
- `gj01-activation-result-1440x1000.png`
- `responsive-probe.json`
- `auth-bootstrap-negative.json`
- `../documents/`, `../actual-work/` contain the combined responsive route captures generated during the same DEV probe.

## Checks

- GJ01 focused Vitest: **32 files / 118 tests passed**
- `type-check`: **passed**
- `lint`: **passed**
- `check:i18n`: **passed** — 39 namespaces with matching NL/EN keys
- `git diff --check`: **passed**; only the repository’s normal line-ending warning was reported

## Blocking boundary

The authenticated employee leg cannot be completed because the canonical invitation/activation flow cannot deliver its Auth invitation in this DEV project. The bounded fixture correction and one server-side Auth bootstrap recovery did not resolve the external mail-delivery failure. The employee remains unlinked (`auth_user_id` is null), so the HR preview is evidence for the server-derived safe surface, not proof of a real employee session. GJ02 and GJ03 continue independently under the overnight orchestration rule.
