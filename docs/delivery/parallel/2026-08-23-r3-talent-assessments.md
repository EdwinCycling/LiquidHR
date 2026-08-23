# R3 — Talent Assessments

## Scope en baseline

- Baseline: `7ef5e39dae8995eafbefcd8f2c0d9eb950c75e21`
- Branch: `work/r3-talent-assessments`
- Worktree: `.codex-worktrees/r3-talent-assessments`
- Lokale poort: `3122`
- Scope: assessments-workspace, assessment-service/schema/API/tests en assessment-i18n.
- Niet gewijzigd: comparison, goals, team, reports, role-explorer, generieke Foundation, centrale docs en versie.

## Opgeleverd

- Cyclusoverzicht met expliciete empty, read-only en feedback states.
- Create cycle met eerste vraag/item, daarna add/edit item zolang de cyclus `DRAFT` is.
- Foundation v1.2 interaction surfaces: `Surface`, `FormDrawer`, `FormField`, `ConfirmDialog`, `DropdownSelect`, `EmptyState`, canonieke `Checkbox` en bestaande inputprimitives.
- Lifecycle-confirmations voor open, close, archive, lock, finalize en reopen waar het bestaande contract dit ondersteunt.
- Participantselectie met HR/admin- of manager-scope; self-assessment houdt participants leeg.
- Save draft, submit, locked/finalized read-only, private manager note, refresh/readback en pending/double-submit guard.
- Dirty-state bescherming bij cyclus-, participant- en drawerwissels plus `beforeunload`.
- Striktere servicevalidatie voor cyclusvenster, item-eigenaarschap, required antwoorden, scorelimieten, response-id en statusovergangen.
- Assessment item API: `POST /api/talent/assessments/[cycleId]/items` en `PATCH /api/talent/assessments/items/[itemId]`.
- Admin-mode wordt expliciet via query doorgegeven zodat refresh na create niet naar manager-scope terugvalt.
- Lege assessmentlijsten roepen geen team-capabilitymatrix meer aan. Participantselectie leest alleen actieve employee-organizations en medewerkers binnen de assessmentscope.
- Minimale lokale migration `20260823124115_align_talent_assessment_role_overrides.sql` vult assessmentrechten aan op bestaande tenant-specifieke role overrides.
- TEST-migration `fix_talent_assessment_audit` herstelt de assessment-audit naar het bestaande `audit_logs`-contract: geen ongeldige `change_set_id` en alleen toegestane audit-acties.
- SQL-contracttest controleert nu ook tenant-specifieke assessmentpermission-links.

## Acceptance matrix

| Onderdeel | Status | Bewijs / beperking |
|---|---|---|
| Canonical env-precheck | GREEN | Canonical `apps/hr-suite/.env.local` naar deze worktree gekopieerd; fixture-auth uitgevoerd zonder secret-output. |
| Lokale runtime | GREEN | Next/Webpack draaide op `http://localhost:3122`; server is na acceptance gestopt. |
| Anonymous API negative | GREEN | `GET /api/talent/assessments` → `401`. |
| Anonymous page negative | GREEN | Beschermde assessmentspagina’s → `307` naar login. |
| Manager assessment read | GREEN | Echte Manager-sessie: `GET /workforce/talent/assessments` → `200`; `GET /api/talent/assessments?mode=manager` → `200`; lege state rendert zonder runtime overlay. |
| Employee self read | GREEN | Echte Employee-sessie: `/my-talent/assessments` → `200`; `GET /api/talent/assessments?mode=self` → `200` met lege workspace. |
| Employee manager negative | GREEN | Echte Employee-sessie eindigt op `/geen-toegang` voor `/workforce/talent/assessments`. |
| Manager admin negative | GREEN | Echte Manager-sessie eindigt op `/geen-toegang` voor `/settings/talent/assessments`. |
| HR admin admin access | GREEN (TEST) | Na TEST-apply van `align_talent_assessment_role_overrides`: echte HR Admin-session opent `/settings/talent/assessments`; contracttest meldt geen ontbrekende tenant-role permission-links. |
| Echte CRUD / lifecycle | GREEN (TEST) | `R3-ASSESS-20260823-1547`: create/open, item readback, Manager draft save/readback, submit, HR reopen, opnieuw submit, lock, finalize, close en archive. App API: response save `201`, response commands `200`, cycle transitions `200`; refresh/readback `GET` `200`. |
| Tijdelijke data | GREEN | De tijdelijke cyclus is via de bestaande UI gearchiveerd. Eindstatus remote: cycle `ARCHIVED`, response `FINALIZED`, 1 answer en 1 private manager note. |
| Desktop + 390x844 | GREEN / PARTIAL | Manager empty state gecontroleerd op desktop en 390x844 in Default/Liquid Navy; LinkedHR gecontroleerd op 390x844. |
| Default + LinkedHR | GREEN / PARTIAL | Default/Liquid Navy en LinkedHR beide echt geopend; Manager-voorkeur na test teruggezet naar oorspronkelijke Liquid Navy. |
| Console/runtime | GREEN AFTER FIX | LinkedHR legde eerst een bestaande assessmentservice-bug bloot (`TALENT_TEAM_CAPABILITY_READ_FAILED` op lege lijst); na de in-scope correctie rendert de lege state zonder fout-overlay. |

## Gates

- `npm.cmd run type-check` — GREEN.
- `npx.cmd vitest run lib/talent/assessment-schemas.test.ts` — GREEN, 5 tests.
- `npm.cmd run check:i18n` — GREEN, 33 namespaces met gelijke NL/EN-sleutels.
- Gerichte ESLint op assessment-workspace, service, schema, tests, route en drie pagina’s — GREEN.
- `git diff --check` — GREEN; alleen gebruikelijke LF/CRLF-waarschuwingen.
- Remote TEST schema apply — GREEN; `align_talent_assessment_role_overrides` en `fix_talent_assessment_audit` toegepast.
- Remote assessment-contracttest — GREEN; security- en performance-advisor hadden geen assessment-relevante meldingen.
- Productiebuild niet uitgevoerd; geen remote apply buiten TEST.

## Handoff

1. De TEST-schema apply en lifecycle-retest zijn afgerond; productie/andere omgevingen zijn niet toegepast.
2. Voer geen push, merge of deploy uit vanuit deze branch.
