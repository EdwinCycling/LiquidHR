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

## SECURITY HARDENING — separate forward migration completed

De volgende vier punten zijn na de featurebranch als één minimale forward migration opgelost:

- terminale goals (`COMPLETED`, `CANCELLED`, `ARCHIVED`) blokkeren inhoudelijke updates van open check-ins; bestaande SELECT/history-operaties blijven read-only toegestaan;
- `completed_at`, `archived_at` en check-in `completed_at` worden bij nieuwe terminale overgangen door de server bepaald; bestaande historische waarden worden behouden;
- HR/Manager RLS blijft permission- en scopegebonden, terwijl bestaande `author_user_id` niet wordt gewijzigd of onbedoeld geldige updates blokkeert;
- de vijf Goals `SECURITY DEFINER` functies gebruiken `search_path=''`, expliciete schema's en beperkte execute-rechten.

De forward migration is `20260823172440_talent_goals_security_hardening.sql`; remote TEST registreerde deze als `20260823172732`. De nieuwe pgTAP-contracttest is groen met `18/18`. De eerder verwijderde migration `20260823121852_harden_talent_goals_product_flow.sql` en incomplete contracttest zijn niet hersteld.

## Verificatie

| Gate / scenario | Resultaat |
| --- | --- |
| `npm run type-check --workspace @liquid-hr/hr-suite` | GREEN |
| Vitest volledige suite | 221 test files, 860 tests passed |
| `check:i18n` | GREEN, 33 namespaces met gelijke NL/EN-sleutels |
| ESLint | exit 0, 8 bestaande warnings buiten deze scope, 0 errors |
| `git diff --check` | GREEN |
| `talent_goals_security_hardening.sql` | GREEN, pgTAP `18/18` op TEST; rollbackbare fixtures opgeschoond |
| Supabase security/performance advisors | Geen Goals-specifieke security finding; bestaande performance-info over ongebruikte indexen |
| `npm run build --workspace @liquid-hr/hr-suite -- --webpack` | GREEN, compile/TypeScript/static generation 224/224 |
| Authenticated manager flow | Bestaande featureflow eerder bewezen; deze hardening-run kon nieuwe browser/API persona-sanity niet uitvoeren door agent-browser CDP tooling failure |
| Authenticated employee flow | Bestaande featureflow eerder bewezen; nieuwe hardening-run persona-sanity niet uitgevoerd door toolinglimitation |
| Authenticated HR flow | Bestaande featureflow eerder bewezen; remote pgTAP bewijst HR archive/timestamps/RLS-contract, nieuwe browser-sanity geblokkeerd |
| Negative concurrency/terminal | stale goal update 409 `TALENT_GOAL_VERSION_CONFLICT`; terminal check-in update 409 `TALENT_CHECKIN_STATUS_LOCKED` |
| UI readback | manager check-in history toonde gewijzigde observation, follow-up action, due date en afgeronde statussen |
| Mobile/theme | 390x844, Default en LinkedHR, geen horizontale overflow; dirty-close protection bevestigd |

De standaard Turbopack-build bleef geblokkeerd door de bekende worktree/package-resolutie. De repository-build is daarom met de bestaande Webpack-route geverifieerd; die is GREEN.

## Cleanup en vervolg

Alle aangemaakte `R3-GOAL-*`-records zijn via de toegestane HR-flow gearchiveerd en opnieuw gelezen. Er is geen delete-contract gebruikt.

Voor vervolgacceptatie blijft de bestaande Goals-flow tegen het huidige TEST-schema leidend. De vier security-hardeningpunten zijn nu technisch opgelost en op TEST via forward migration/regressietest bewezen. Authenticated browser/API persona-sanity blijft open totdat de CDP-tooling hersteld is; productie is niet geraakt.
