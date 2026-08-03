# Project overview — LiquidHR

Peildatum: **2 augustus 2026**. Meetmoment lokale metrics: **2026-08-02T19:36:20Z**. Repository: `C:\Users\Edwin\Documents\Apps\LiquidHR`.

Dit document is een actuele inventaris, geen releasebesluit. Lokale broncijfers en live Supabase-cijfers zijn afzonderlijk gehouden. Recordinhoud, persoonsgegevens, secrets en tokens zijn niet opgehaald.

## 1. Momentopname

| Onderdeel | Waarde |
|---|---|
| Branch | `main` |
| Lokale laatste commit | `d9baecb54cf6a52e8a573c34847bcb6f2ed1d140` — `docs: record production release verification` |
| Remote relatie | `main...origin/main` op het meetmoment |
| Werkboom | Gewijzigd en niet geschikt als schone releasebasis; bestaande wijzigingen zijn behouden |
| HR-appversie | `1.20260729.7` uit `C:\Users\Edwin\Documents\Apps\LiquidHR\apps\hr-suite\lib\app-version.ts` |
| HR-package | `@liquid-hr/hr-suite` `0.1.1` |
| Control-package | `@liquid-hr/control` `0.1.0` |
| Lokale Next-runtime | Niet actief op poort 3000 tijdens deze inventaris |
| Control-runtime | Niet actief op poort 3001 tijdens deze inventaris |

De overview heeft uitsluitend dit nieuwe document toegevoegd; er is niet gecommit, gepusht, gemerged, gedeployed of naar Supabase geschreven.

## 2. Code-KPI's

Bron: `C:\Users\Edwin\Documents\Apps\LiquidHR\docs\skills\project-overview\scripts\collect_local_metrics.ps1`. De meting sluit `node_modules`, `.next`, `.git`, `.turbo`, `coverage` en `dist` uit.

| Metriek | Waarde | Definitie |
|---|---:|---|
| Bestanden | 1.184 | Alle uitgesloten-vendor/buildmappen niet meegerekend |
| Tekstregels | 151.573 | Alle gemeten tekstbestanden |
| TypeScript/TSX-bestanden | 727 | Inclusief tests |
| TypeScript/TSX-regels | 55.768 | Inclusief tests |
| Productie-TS/TSX-bestanden | 606 | Test/spec-bestanden uitgesloten |
| Productie-TS/TSX-regels | 50.915 | Test/spec-bestanden uitgesloten |
| Testbestanden | 121 | Bestanden met `test`/`spec` in TS/TSX/SQL-naam |
| Testregels | 4.853 | Lokale bronregels |
| UI-pagina-routes | 80 | `page.ts`/`page.tsx` in beide apps |
| API-routehandlers | 163 | `app/api/**/route.ts` of `.tsx`; allemaal in HR Suite |
| Componentbestanden | 147 | `components/**` |
| Library/service-bestanden | 196 | `lib/**`-bestanden volgens de metricsregel |
| Lokale SQL-migraties | 184 | `apps/hr-suite/supabase/migrations/*.sql` |
| Gegenereerde tabeltypen | 145 | `packages/db/types.ts` |

### UI- en API-oppervlak

- HR Suite: 72 pagina-routes en 163 API-handlers.
- LiquidHR Control: 8 pagina-routes; geen handlers onder het getelde `app/api/**`-patroon.
- Belangrijke UI-oppervlakken zijn authenticatie en installatie, dashboard/startpagina, medewerkers en dienstverbanden, Workforce, HR-inrichting en stamdata, verlof, verzuim, kalender, reminders, Insights, HERA, autorisatie, productupdates, Talent en platform-support.
- De actuele Talent-oppervlakken omvatten onder meer `/settings/talent`, `/settings/talent/comparison`, `/settings/talent/import`, `/workforce/talent`, `/workforce/talent/goals`, `/my-talent` en `/my-talent/goals`.
- De aparte Control-app bevat gesloten login, dashboard, klantzoeking/detail, onboarding, lifecycle, gebruikssnapshot en platformaudit.

## 3. Database en Supabase

Live project: **LiquidHR**, ref `wnpfloqpjvaacobppbpk`, regio `eu-west-3`, status `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.141`.

### Live metadata

| Metriek | Waarde | Bron |
|---|---:|---|
| Publieke tabellen | 145 | Supabase `list_tables` en read-only SQL |
| Tabellen met RLS | 145/145 | Supabase `list_tables` en read-only SQL |
| Publieke views | 2 | Read-only SQL op `pg_views` |
| Publieke functies | 47 | Read-only SQL op `pg_proc` |
| Publieke policies | 459 | Read-only SQL op `pg_policies` |
| Publieke indexes | 656 | Read-only SQL op `pg_indexes` |
| Live records totaal | 5.871 | Som van de door Supabase gerapporteerde tabelrijen; geen recordinhoud |
| Databasegrootte | 36.408.467 bytes, circa 35 MB | `pg_database_size(current_database())` |
| Remote migratieregistraties | 183 | Supabase migration history |
| Laatste remote migratie | `20260802183735_close_expired_platform_support_sessions` | Supabase migration history |

Grootste live tabellen volgens `pg_total_relation_size`:

| Tabel | Records | Totale grootte |
|---|---:|---:|
| `public.audit_logs` | 2.899 | 2.912 kB |
| `public.employment_work_pattern_days` | 406 | 224 kB |
| `public.role_permissions` | 255 | — |
| `public.dashboard_widget_role_access` | 246 | 240 kB |
| `public.employee_custom_field_values` | 183 | 248 kB |
| `public.permissions` | 119 | — |
| `public.talent_capability_level_content` | 92 | — |
| `public.dashboard_widget_configs` | 84 | — |
| `public.employee_organizations` | 78 | 376 kB |
| `public.employment_contracts` | 78 | — |

De live metadata meldt dus volledige RLS-dekking. De lokale metrics zijn broncodepatroon-tellingen en zijn niet één-op-één gelijk aan live objectaantallen: lokaal zijn bijvoorbeeld 120 RLS-enablements, 560 policy-definities, 357 indexdefinities en 193 functiondefinities geteld.

### Migratieverschil

Er zijn **184 lokale migratiebestanden** en **183 remote registraties**. Dit is alleen als verschil vastgesteld; er is geen automatische synchronisatie of reparatie uitgevoerd. Voor een volgende release moet de migratiehistorie vóór `db push`, commit of deployment gecontroleerd en expliciet verklaard worden.

### Supabase-advisors

De actuele read-only advisorcontrole rapporteert:

- Security: **12 meldingen** — 10 `WARN`, 2 `INFO`.
  - 9 publiek uitvoerbare `SECURITY DEFINER`-functies voor `authenticated`.
  - 1 waarschuwing voor uitgeschakelde leaked-password protection.
  - 2 informatieve meldingen voor RLS zonder policy op `public.absence_mutations` en `public.platform_support_sessions`.
- Performance: **237 meldingen** — 3 `WARN`, 234 `INFO`.
  - 3 tabellen met meerdere permissive policies voor dezelfde authenticated SELECT-actie.
  - 62 niet-geïndexeerde foreign keys.
  - 172 ongebruikte indexes; dit is in de kleine demo-dataset geen zelfstandig bewijs dat een index verwijderd moet worden.

Relevante Supabase-remediatiepagina's: [SECURITY DEFINER-executie](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [RLS zonder policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [meerdere permissive policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies), [niet-geïndexeerde foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) en [ongebruikte indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## 4. Kwaliteit en delivery

### Laatst gedocumenteerde releasegate

Volgens `C:\Users\Edwin\Documents\Apps\LiquidHR\docs\delivery\CURRENT_CONTEXT.md` is de laatste M2-gate op 2 augustus 2026:

- 119 testbestanden en 442 tests geslaagd.
- Gerichte importtests: 6/6 geslaagd.
- Strict TypeScript, ESLint zonder warnings, i18n-pariteit met 26 namespaces en productiebuild met 151 pagina's geslaagd.
- `git diff --check` en de remote comparison/import- en goals/reporting-contracten geslaagd.
- Fixture-scale `EXPLAIN ANALYZE` bleef onder circa 1,6 ms op de kleine demo-dataset.
- De drie-fixture-browsercontrole voor HR Admin, manager en medewerker is vastgelegd.

Dit zijn overgenomen delivery-bewijzen; de volledige testsuite, typecheck en productiebuild zijn voor deze nieuwe overview niet opnieuw gedraaid. De actuele spotcheck `git diff --check` eindigde met exit 0, naast verwachte line-ending-waarschuwingen van Git op de bestaande gewijzigde werkboom.

### Open release- en productpunten

1. **M2.9 release-hardening — eigenaar: release/productteam.** Voer een representatieve performance-baseline, snapshot/restore-oefening en volledige axe/keyboard-herhaling uit.
2. **Authenticatie/routing — eigenaar: HR-appteam.** Het bestaande `/departments`-landingspad voor de medewerker heeft nog een algemene rechten-serverfout; de directe Talent-route werkt volgens de laatste overdracht.
3. **Database-historie — eigenaar: database/releaseteam.** Verklaar het verschil tussen 184 lokale en 183 remote migraties voordat een releaseworkflow wordt gestart.
4. **Advisor-harding — eigenaar: security/database.** Beoordeel de 10 security-WARNs en 3 performance-WARNs; behoud bestaande gedragsgaranties rond RLS, grants en `SECURITY DEFINER`-RPC's.
5. **Releasebasis — eigenaar: release-eigenaar.** De werkboom bevat omvangrijke niet-gecommitte wijzigingen. Maak geen backup, restore, commit, merge, push of deployment zonder expliciete scopecontrole.
6. **Lokale runtime — eigenaar: ontwikkelaar.** Start poort 3000 en, indien Control wordt gecontroleerd, poort 3001 opnieuw vóór browserverificatie; beide waren tijdens deze inventaris niet actief.

## 5. Referenties

- `C:\Users\Edwin\Documents\Apps\LiquidHR\AGENTS.md` — uitvoerings- en veiligheidsregels.
- `C:\Users\Edwin\Documents\Apps\LiquidHR\docs\README.md` — documentrouting en leidende domeinstatus.
- `C:\Users\Edwin\Documents\Apps\LiquidHR\docs\delivery\CURRENT_CONTEXT.md` — actuele overdracht en laatste delivery-bewijs.
- `C:\Users\Edwin\Documents\Apps\LiquidHR\docs\delivery\IMPLEMENTATION_STATUS.md` — historische en actuele implementatiestatus.
- `C:\Users\Edwin\Documents\Apps\LiquidHR\docs\skills\project-overview\SKILL.md` — reproduceerbare overview-procedure.
- `C:\Users\Edwin\Documents\Apps\LiquidHR\docs\skills\project-overview\scripts\collect_local_metrics.ps1` — lokale KPI-generator.
- `C:\Users\Edwin\Documents\Apps\LiquidHR\packages\db\types.ts` — gegenereerde databasetypen.
- `C:\Users\Edwin\Documents\Apps\LiquidHR\apps\hr-suite\supabase\migrations\` — lokale schema-, RLS-, policy- en seedbron.
- `C:\Users\Edwin\Documents\Apps\LiquidHR\apps\hr-suite\app\` en `C:\Users\Edwin\Documents\Apps\LiquidHR\apps\hr-suite\app\api\` — pagina- en API-routes.

## 6. Traditionele mandagenvergelijking

Dit is een transparante equivalentie-inschatting, geen timesheet. De bandbreedte omvat de huidige gebouwde scope met HR Suite, Control Plane, Talent M2, HR-masterdata, dienstverbanden, verlof, verzuim, autorisatie, RLS, tests, browsercontroles en releasewerk. Toekomstige modules die in de requirements als open staan zijn niet meegerekend.

Op basis van 50.915 productie-TS/TSX-regels, 145 live tabellen, 163 API-handlers, 80 pagina-routes, de autorisatie- en HR-domeincomplexiteit en de afzonderlijke Control-app ligt de traditionele equivalentie op circa **335–480 mandagen**.

| Werkpakket | Traditionele bandbreedte |
|---|---:|
| Analyse, domeinmodellering en UX | 55–80 dagen |
| Schema, RLS, policies, migraties en types | 70–95 dagen |
| API, services en autorisatie | 75–110 dagen |
| UI, routes, i18n en responsive gedrag | 90–130 dagen |
| Tests, browsercontrole, documentatie en release | 45–65 dagen |
| **Totaal** | **335–480 dagen** |

De inschatting zegt niets over kalenderduur met AI-assistentie, hergebruik of parallel werk. Ruwe codeproductie alleen zou de security-, gegevensbeschermings-, HR- en release-inspanning onderschatten.
