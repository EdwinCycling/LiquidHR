# Project overview — Liquid HR

Peildatum: **24 juli 2026**. Repository: `C:\Users\Edwin\Documents\Apps\HRMyDay`. Branch: `agent/employee-dashboard-release`. Laatste commit: `22af0f3` (`feat: release employee dashboard and reporting updates`). Applicatieversie: `1.20260724.2`.

## Code-KPI's

| Metriek | Waarde | Bron/definitie |
|---|---:|---|
| Bestanden in werkboom, exclusief vendor/buildmappen | 724 | `rg --files`; exclusief `node_modules`, `.next`, `.git`, `.turbo`, `coverage`, `dist` |
| Alle tekstregels | 77.928 | TS/TSX/JS/CSS/JSON/SQL/Markdown/TOML |
| TypeScript/TSX-bestanden | 471 | Inclusief tests |
| TypeScript/TSX-regels | 36.963 | Inclusief tests |
| Productie-TS/TSX-bestanden | 376 | Test/spec-bestanden uitgesloten |
| Productie-TS/TSX-regels | 32.950 | Test/spec-bestanden uitgesloten |
| Testbestanden | 95 | Vitest- en SQL-testbestanden |
| Testregels | 4.013 | Lokale bronregels |
| UI-pagina-routes | 43 | `page.ts`/`page.tsx` onder `apps/hr-suite/app` |
| API-route handlers | 91 | `route.ts`/`route.tsx` onder `apps/hr-suite/app/api` |
| Componentbestanden | 100 | `apps/hr-suite/components` |
| Library/service-bestanden | 213 | `apps/hr-suite/lib` en `packages` |
| SQL-migraties | 90 | `apps/hr-suite/supabase/migrations` |

## Database en Supabase

De recordcounts zijn op 24-07-2026 via de geconfigureerde Supabase REST/Data API met geaggregeerde `count`-headers op alle 94 getypeerde tabellen opgehaald. Er is geen recordinhoud uitgevoerd.

| Metriek | Waarde |
|---|---:|
| Getypeerde tabellen in `packages/db/types.ts` | 94 |
| Getypeerde views | 1 |
| Getypeerde functions | 27 |
| Live tabellen geteld | 94/94 |
| Live records totaal over alle 94 tabellen | 3.929 |
| Grootste live tabel: `audit_logs` | 1.972 |
| `employment_work_pattern_days` | 406 |
| `dashboard_widget_role_access` | 246 |
| `employee_custom_field_values` | 183 |
| `role_permissions` | 95 |
| RLS-enablements in migratiebron | 75 |
| Policy-definities in migratiebron | 362 |
| Indexdefinities in migratiebron | 252 |
| Functiondefinities in migratiebron | 95 |
| `insert into`-statements in migratiebron | 200 |

Databasegrootte, indexgebruik, dead tuples, cache hit ratio en exacte tabelgroottes zijn niet via de gebruikte Data API vastgesteld. Gebruik daarvoor een Supabase-MCP-query op `pg_stat_user_tables`, `pg_total_relation_size` en de relevante advisor-endpoints.

## Kwaliteit en delivery

- 95 testbestanden / 347 tests geslaagd.
- ESLint, strict TypeScript en NL/EN i18n-pariteit geslaagd.
- Productiebuild geslaagd met 85 pagina's/routes.
- Laatste releasebranch en lokale commit zijn aanwezig; remote GitHub-push en de laatste Supabase-migratie/advisor/typesnapshot zijn nog connector-/auth-afhankelijk.

## Referenties

- `AGENTS.md` — architectuur- en uitvoeringsregels.
- `docs/README.md` — documentrouting en leidende domeindocumenten.
- `docs/delivery/CURRENT_CONTEXT.md` — actuele overdracht en openstaande releaseacties.
- `docs/delivery/IMPLEMENTATION_STATUS.md` — domeinstatus.
- `packages/db/types.ts` — gegenereerde databasetypen.
- `apps/hr-suite/supabase/migrations/` — lokale schema-, RLS-, policy- en seedbron.
- `apps/hr-suite/app/api/` — API-routehandlers.
- `apps/hr-suite/app/` — pagina-routes.

## Vergelijking met traditioneel coderen

Dit is een equivalentie-inschatting, geen geregistreerde tijdmeting. Op basis van circa 32.950 productie-TS/TSX-regels, 94 tabellen, 91 API-handlers, HR/payroll-domeincomplexiteit, RLS, autorisatie, migraties, tests en releasewerk ligt de traditionele inspanning voor de huidige gebouwde scope naar verwachting rond **220–320 mandagen**.

| Werkpakket | Traditionele bandbreedte |
|---|---:|
| Analyse, domeinmodellering en UX | 35–50 dagen |
| Schema, RLS, policies, migraties en types | 35–50 dagen |
| API, services en autorisatie | 45–65 dagen |
| UI, routes, i18n en responsive gedrag | 65–90 dagen |
| Testen, browsercontrole, documentatie en release | 40–65 dagen |
| **Totaal** | **220–320 dagen** |

Alleen ruwe codeproductie zou een lagere bandbreedte geven; die onderschat in dit project de security-, data- en HR-regels. De inschatting zegt niets over feitelijke kalenderduur met AI-assistentie of parallel werk. Niet gebouwde modules zoals volledige verzuim-, performance-, activa- en wagenparkdomeinen zijn niet in dit totaal opgenomen.

