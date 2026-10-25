# PMUX-06A1-GIT-CLOSEOUT-07 — lokale Git-vastlegging

Datum: 25 oktober 2026. Alleen lokale commits op de bestaande main, vanaf `630df89c84bc2be4774072d387ecb5dc7df10f91`. Geen push, rebase, merge, deployment, Vercel-release of remote databasewrite in deze closeout.

## Commitafbakening

| Onderdeel | Lokale commit | Bestanden |
| --- | --- | ---: |
| Bestaande HR Admin → Manager/Employee-personaflow | ca9547be474e2b571ebdba1d02371a4a8ff398d1 | 4 |
| Directoryprojectie en administratiescope | b3081a9f4aa216f844c99296fe0af3ea84c640ba | 5 |
| P9 API-UUID-contract en definitienormalisatie | 4089f86aa9aef41e6f92ac41a4d11678582e771d | 9 |
| Werkkalender, product-UX, schema, types en acceptatiebewijs | De featurecommit die dit manifest bevat; SHA via git log | 43 |

De definitieve Core TEST GO staat in [PMUX-06A1-20261025-CORE-TEST.md](PMUX-06A1-20261025-CORE-TEST.md). Oudere BLOCKED- en timeoutbewijzen zijn bewust als onveranderde historie meegenomen; ze vervangen het finale bewijs niet. De bestaande runner hoort bij de gezamenlijke role-switch/directory/P9/kalenderacceptatie en is daarom expliciet opgenomen.

## Veiligheid

De hostcontrole met Get-CimInstance vond geen git*-processen. De lege index.lock had sinds 24-10-2026 10:00:11 UTC niet gewijzigd, was ouder dan twaalf uur en kon met FileShare.None exclusief geopend worden. Metadata en hostprocessen zijn direct vóór verwijderen opnieuw gecontroleerd. Alleen deze stale lock is verwijderd; geen andere cleanup.

Focus is niet gestaged of gecommit. Beschermde inhoud vóór/na: SHA256 `A8134B54351065DB6EFF5CBED717511A979AB85118810DA2941195DF8BAEEAEA`. Ook `apps/hr-suite/next-env.d.ts` is uitgesloten en ongewijzigd behouden: SHA256 `B8B3A344484B959AF5E4E3FC1A1609DAC3CB9ECE0CDEB6C145BE29BC4C491000`. Geen env-/secretbestanden gelezen, gestaged of gecommit. Geen nieuwe dependencies of accounts.

Elke staging gebruikte een expliciete bestandslijst, controleerde dat de index exact die lijst bevatte en draaide git diff --cached --check vóór de commit. De index was vooraf leeg. De geselecteerde inhoud is op JWT-/private-key-/secret-keyvormen gecontroleerd zonder gevonden waarden te tonen.

## Toegepaste migraties volledig aanwezig

Read-only Core TEST-migratieregistratie en lokale bron zijn vergeleken. MD5 is hier uitsluitend een inhoudsvergelijking na witruimtenormalisatie, niet een securityhash. Alle drie zijn gelijk:

| Remote versie | Lokale bron | Genormaliseerde MD5 |
| --- | --- | --- |
| 20261024200635 | 20261024150000_employee_directory_scope_hardening.sql | a5104dc28363b961d85523d2e978f81a |
| 20261025061834 | 20261025090000_pmux_p9_deadline_definition_normalization.sql | 586b0fd8a0f6213dd4fecc6aa98750a7 |
| 20261025131521 | 20261025100000_pmux06a1_work_calendars.sql | 82df768138c37afdf5184d648643aded |

De bijbehorende drie contracttests zijn meegecommit. Geen migratie opnieuw toegepast en geen remote registratie gewijzigd.

## Gerichte verificatie

- Acht gerelateerde role-switch/directory/P9-testbestanden: **71 PASS**, 0 FAIL. Inclusief zes directe Manager-medewerkers en een buiten-teammedewerker, veilige directoryprojectie, persona-autorisatie en P9-normalisatie/API-invoer.
- De eerder groene 86 kalendertests, typecheck, gerichte lint en i18n-gates zijn hergebruikt: de productkandidaat is sindsdien niet gewijzigd. Geen herhaling van de volledige kalender- of browseracceptatie voor alleen Git-vastlegging.
- Bestaande databaseUuid- en directoryservices zijn tracked. PGlite en Playwright staan al in de bestaande package-manifests; geen ontbrekende nieuwe dependency gevonden.
- Runner node --check en git diff --check PASS. Per commit ook staged diff-check PASS. Bestaande LF/CRLF-waarschuwingen zijn geen inhoudsverlies.

## Expliciete bestandslijsten

### role

- `apps/hr-suite/lib/auth/test-role-switch.ts`
- `apps/hr-suite/lib/auth/test-role-switch.test.ts`
- `apps/hr-suite/app/api/auth/test-role-switch/route.test.ts`
- `apps/hr-suite/app/local/personas/page.test.tsx`

### directory

- `apps/hr-suite/lib/employee-directory/service.test.ts`
- `apps/hr-suite/lib/organization/team-scope.test.ts`
- `apps/hr-suite/supabase/tests/employee_overview_server_pagination.sql`
- `apps/hr-suite/supabase/migrations/20261024150000_employee_directory_scope_hardening.sql`
- `apps/hr-suite/supabase/migrations/20261024150000_employee_directory_scope_hardening.contract.test.ts`

### p9

- `apps/hr-suite/app/api/processes/start/route.ts`
- `apps/hr-suite/app/api/processes/start/route.test.ts`
- `apps/hr-suite/supabase/migrations/20261025090000_pmux_p9_deadline_definition_normalization.sql`
- `apps/hr-suite/supabase/migrations/20261025090000_pmux_p9_deadline_definition_normalization.contract.test.ts`
- `docs/quality/acceptance/runs/PMUX-P9-RUNTIME-FIX-06-20261025.browser-final.json`
- `docs/quality/acceptance/runs/PMUX-P9-RUNTIME-FIX-06-20261025.browser-retry.json`
- `docs/quality/acceptance/runs/PMUX-P9-RUNTIME-FIX-06-20261025.browser.json`
- `docs/quality/acceptance/runs/PMUX-P9-RUNTIME-FIX-06-20261025.md`
- `docs/quality/acceptance/runs/PMUX-P9-RUNTIME-FIX-06-20261025.readback.json`

### calendar

- `apps/hr-suite/app/(dashboard)/settings/page.tsx`
- `apps/hr-suite/app/(dashboard)/settings/process-automation/page.tsx`
- `apps/hr-suite/components/process-automation/process-flow-editor.test.tsx`
- `apps/hr-suite/components/process-automation/process-flow-editor.tsx`
- `apps/hr-suite/lib/process-automation/definition-compiler.test.ts`
- `apps/hr-suite/lib/process-automation/definition-compiler.ts`
- `apps/hr-suite/lib/process-automation/runtime-service.test.ts`
- `apps/hr-suite/lib/process-automation/runtime-service.ts`
- `apps/hr-suite/messages/en/processAutomation.json`
- `apps/hr-suite/messages/en/settings.json`
- `apps/hr-suite/messages/nl/processAutomation.json`
- `apps/hr-suite/messages/nl/settings.json`
- `docs/AA/AA-CURRENT.md`
- `docs/requirements/workflows/PMUX-06A_SLA_DEADLINES.md`
- `docs/requirements/workflows/PMUX_CONSOLIDATED_ROADMAP_20261022.md`
- `packages/db/types.ts`
- `.codex-browser-acceptance-final.cjs`
- `apps/hr-suite/app/(dashboard)/settings/work-calendars/page.tsx`
- `apps/hr-suite/app/api/settings/work-calendars/holidays/route.ts`
- `apps/hr-suite/app/api/settings/work-calendars/preview/route.ts`
- `apps/hr-suite/app/api/settings/work-calendars/route.ts`
- `apps/hr-suite/components/settings/work-calendar-settings.test.tsx`
- `apps/hr-suite/components/settings/work-calendar-settings.tsx`
- `apps/hr-suite/lib/work-calendars/labels.ts`
- `apps/hr-suite/lib/work-calendars/schemas.ts`
- `apps/hr-suite/lib/work-calendars/service.test.ts`
- `apps/hr-suite/lib/work-calendars/service.ts`
- `apps/hr-suite/supabase/migrations/20261025100000_pmux06a1_work_calendars.contract.test.ts`
- `apps/hr-suite/supabase/migrations/20261025100000_pmux06a1_work_calendars.sql`
- `docs/architecture/ADR-PMUX-06A1-WORK-CALENDAR.md`
- `docs/quality/acceptance/runs/PMUX-06A1-20261025-ADMIN-READONLY.browser.json`
- `docs/quality/acceptance/runs/PMUX-06A1-20261025-APPROVED-RETRY.browser.json`
- `docs/quality/acceptance/runs/PMUX-06A1-20261025-APPROVED.browser.json`
- `docs/quality/acceptance/runs/PMUX-06A1-20261025-BUSINESS.readback.json`
- `docs/quality/acceptance/runs/PMUX-06A1-20261025-CASE-READONLY.browser.json`
- `docs/quality/acceptance/runs/PMUX-06A1-20261025-CORE-TEST.md`
- `docs/quality/acceptance/runs/PMUX-06A1-20261025-DEPENDENT.readback.json`
- `docs/quality/acceptance/runs/PMUX-06A1-20261025-LOCAL.md`
- `docs/quality/acceptance/runs/PMUX-06A1-20261025-MIGRATION.readback.json`
- `docs/quality/acceptance/runs/PMUX-06A1-20261025-READONLY.browser.json`
- `docs/quality/acceptance/runs/PMUX-06A1-20261025-TEST-WRITE-PROPOSAL.json`
- `docs/requirements/workflows/PMUX-06A1_WORKDAY_CALENDAR.md`
- `docs/quality/acceptance/runs/PMUX-06A1-GIT-CLOSEOUT-07-20261025.md`

## Resterende grenzen

De kalender is gepubliceerd voor Jupiter/2026; andere scopes/jaren vragen eigen publicatie. Twee bestaande nieuwe-feature FK-indexadviezen zijn als niet-blokkerende optimalisatiepunten vastgelegd in het Core TEST-rapport; geen aanvullende schemawijziging in deze closeout. De lokale commits zijn geen GitHub-integratie of deployment. De beschermde gegenereerde next-env-wijziging blijft buiten de commits.
