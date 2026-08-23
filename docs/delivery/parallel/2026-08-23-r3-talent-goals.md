# R3 Talent Goals + Check-ins — handoff

Datum: 2026-08-23
Baseline: `7ef5e39dae8995eafbefcd8f2c0d9eb950c75e21`
Branch: `work/r3-talent-goals`
Worktree: `.codex-worktrees/r3-talent-goals`
Scope: `/workforce/talent/goals`, `TalentGoalWorkspace`, `TalentGoalCheckIns`, goal-service/API/schema/tests en doel-i18n.

## Status

- IMPLEMENTED: manager/HR goal flow met create, read/refresh, edit, activate, progress, check-ins, follow-up/due date, complete check-in, complete/cancel/archive en readback.
- PRODUCT FLOW GREEN: de authenticated Goals-flow is bewezen tegen het huidige TEST-schema en is onafhankelijk van de verwijderde schema-hardeningmigration.
- LOCALLY VERIFIED: TypeScript, tests, i18n, lint, diff-check en Webpack production build.
- AUTHENTICATED BROWSER/API VERIFIED: manager, employee en HR fixture-persona's; positieve en negatieve permission-paden; desktop en 390x844 in Default en LinkedHR.
- REMOTE MIGRATION: geen schemawijziging uitgevoerd of toegestaan. De onbewezen hardeningmigration is uit deze featurebranch verwijderd.
- RELEASE: geen push, merge, deploy of version bump uitgevoerd.

## Implementatie

- Foundation-gebaseerde lijst/workspace met search, statusfilter, statusbadges, expliciete employee- en capability-identiteit, FormDrawer/FormActions, dirty protection en pending/double-submit bescherming.
- Check-in-weergave en acties voor reflection, observation en follow-up, inclusief due date, complete-status en history/readback.
- API uitgebreid met single-goal GET, duidelijke 400/403/409/500-mappings, UUID/body-validatie, optimistic version conflicts en terminal/status-transition checks.
- Check-ins accepteren alleen geldige follow-up-data op follow-up entries, nieuwe check-ins alleen op ACTIVE goals en terminale check-ins/goals blijven server-side vergrendeld volgens contract.
- Goal-list maakt capability-catalogus opt-in en laadt voor bestaande goals alleen gerefereerde capability-identiteit; dit voorkomt dat een brede capability-query de manager-workspace blokkeert.
- Alleen minimale `goal...`/`checkIn...`-sleutels toegevoegd in NL en EN. Geen generic Foundation of central docs gewijzigd.

## DEFERRED SECURITY HARDENING — aparte debt

De volgende punten zijn tijdens migration review gevonden en bewust niet in deze featurebranch opgelost:

- P1: terminale goals moeten open check-ins locken.
- P2: `completed_at` en `archived_at` moeten server-controlled timestamps zijn.
- P2: manager/HR update-policy en `author_user_id`-immutability moeten op één contract worden gebracht.
- P2: `SECURITY DEFINER` met `search_path = public, pg_temp` vraagt een aparte public-schema/search-path hardening review.

De verwijderde migration `20260823121852_harden_talent_goals_product_flow.sql` en de uitsluitend daarbij horende incomplete SQL-contracttest zijn geen onderdeel van de bewezen productflow.

## Verificatie

| Gate / scenario | Resultaat |
| --- | --- |
| `npm run type-check --workspace @liquid-hr/hr-suite` | GREEN |
| Vitest volledige suite | 221 test files, 860 tests passed |
| `check:i18n` | GREEN, 33 namespaces met gelijke NL/EN-sleutels |
| ESLint | exit 0, 8 bestaande warnings buiten deze scope, 0 errors |
| `git diff --check` | GREEN |
| `npm run build --workspace @liquid-hr/hr-suite -- --webpack` | GREEN, compile/TypeScript/static generation 224/224 |
| Authenticated manager flow | HTTP 201 create, 200 edit/activate/progress/check-in/complete, 200 readback; archive door manager 403 |
| Authenticated employee flow | eigen goal/check-in HTTP 200/201; niet-toegestane observation 403; manager-workspace 403 |
| Authenticated HR flow | goals zichtbaar en archive HTTP 200 met ARCHIVED readback; R3-testdata gearchiveerd |
| Negative concurrency/terminal | stale goal update 409 `TALENT_GOAL_VERSION_CONFLICT`; terminal check-in update 409 `TALENT_CHECKIN_STATUS_LOCKED` |
| UI readback | manager check-in history toonde gewijzigde observation, follow-up action, due date en afgeronde statussen |
| Mobile/theme | 390x844, Default en LinkedHR, geen horizontale overflow; dirty-close protection bevestigd |

De standaard Turbopack-build bleef geblokkeerd door de bekende worktree/package-resolutie. De repository-build is daarom met de bestaande Webpack-route geverifieerd; die is GREEN.

## Cleanup en vervolg

Alle aangemaakte `R3-GOAL-*`-records zijn via de toegestane HR-flow gearchiveerd en opnieuw gelezen. Er is geen delete-contract gebruikt.

Voor vervolgacceptatie blijft de bestaande Goals-flow tegen het huidige TEST-schema leidend. De vier security-hardeningpunten krijgen een aparte migration-review en een nieuwe forward migration; daarvoor is in deze branch geen oplossing of remote apply uitgevoerd.
