# Liquid Analyse — AN-0 en AN-1

**Status:** bevroren productcontract voor de lokale feature-branch `work/an-analysis-foundation`.

## Huidige status

- **LEGACY DASHBOARD: RETIRED IN CODE**
- **LEGACY DB: RETIREMENT MIGRATION READY — NOT APPLIED**
- **ANALYSE HUB: ACTIVE**
- **AN-2+: NOT IMPLEMENTED**

De scope is een clean break van het oude globale, persoonlijke widgetdashboard. De dagelijkse Startpagina en contextuele Employee 360-dashboardweergave zijn andere producten en blijven bestaan.

## Routes en toegangscontract

| Route | Besluit | Implementatie |
|---|---|---|
| `/dashboard/start` | Behouden | Dagelijkse Startpagina blijft de bestaande server-side flow; de oude Dashboard-snelkoppeling verwijst nu naar Analyse. |
| `/dashboard` | Retiren met bookmark-veilig redirect | Redirect naar `/insights/analysis`; er wordt geen widget-UI meer geladen. |
| `/insights` | Bestaande Reports-hub behouden | De oude Dashboard-tegel is verwijderd; Analyse verschijnt als bestemming in dezelfde Insights-tegelfamilie. Bestaande R6 Reports blijven intact. |
| `/insights/analysis` | Canonieke Analyse-hub | Beschermd met het bestaande `dashboard:read`-contract; geen nieuw permission-code en geen permission widening. |
| `/settings/dashboard-widgets` | Oude beheerervaring retired | Veilige redirect naar `/insights/analysis`; de settings-tegel, widgetservice en widget-API zijn verwijderd. |

## AN-1 Analyse-hub

De hub gebruikt de bestaande LiquidHR Foundation (`PageShell`, `PageHeader`, `Surface` en `Badge`) en bevat exact vier productopties:

| Optie | Nederlandse tekst | Status | Gedrag |
|---|---|---|---|
| Nieuwe analyse | Stel een vraag en laat LiquidHR een analyse opbouwen. | `PLANNED` | Alleen productrichting; geen input en geen AI-runtime. |
| Verkennen | Begin bij een medewerker, afdeling, functie of andere HR-entiteit. | `PLANNED` | Alleen productrichting; geen entity graph of navigatieruntime. |
| Mijn analyses | Open je opgeslagen persoonlijke analyses. | `PLANNED` | Alleen productrichting; geen opslagmodel of persistence. |
| Rapporten | Open vaste, gecertificeerde HR-rapportages. | `ACTIVE` | Linkt naar de bestaande canonieke Reports-hub `/insights`. |

De drie geplande tegels zijn niet klikbaar. De actieve Rapporten-tegel is de enige tegellink. Er zijn geen fake charts, AI-calls, prompts, credits, providers, vrije SQL, AnalysisSpec-runtime of opgeslagen analyses toegevoegd.

## AN-0 dependency-inventory

De repositorybrede zoekopdracht gebruikte `dashboard`, `dashboard-widget`, `personal_dashboards`, `personal_dashboard_widgets`, `dashboard_widget_configs` en `dashboard_widget_role_access`. Iedere relevante hit is als volgt geclassificeerd.

### REMOVE

- `apps/hr-suite/components/dashboard/**`: globale widget renderer, stream, catalogus, picker, editor, layout/reorder- en progressmodellen inclusief tests.
- `apps/hr-suite/lib/dashboard/**`: dashboard-schema's, persoonlijke dashboardservice, widgetcatalogus, access-, loader-, presentation- en settingsservice inclusief tests.
- `apps/hr-suite/app/api/dashboards/**` en `apps/hr-suite/app/api/settings/dashboard-widgets/route.ts`: globale dashboard- en widgetbeheer-API's.
- `apps/hr-suite/components/settings/dashboard-widget-settings-form.tsx`: widget enable/disable- en rolmatrix-UI.
- `apps/hr-suite/app/(dashboard)/dashboard/loading.tsx`: oude globale widget-loadingarchitectuur.
- `apps/hr-suite/supabase/tests/personal_dashboards.sql`: testcontract voor de retired tabellen.
- `apps/hr-suite/messages/{nl,en}/dashboard.json` en de `dashboard` i18n-namespace: uitsluitend door de retired globale dashboardruntime gebruikt.
- Het oude `dashboard`-item uit `INSIGHT_REPORTS`, de bijbehorende query-state en de oude Insights-labels.
- Setup Assistant-stap `SET-004` voor Dashboard Widgets.

### REDIRECT

- `apps/hr-suite/app/(dashboard)/dashboard/page.tsx`: `/dashboard` → `/insights/analysis`.
- `apps/hr-suite/app/(dashboard)/settings/dashboard-widgets/page.tsx`: oude settings-URL → `/insights/analysis`.

### RENAME/TRANSITION

- Startpagina-label en snelkoppeling `openDashboard` zijn `openAnalysis` en `/insights/analysis` geworden; `/dashboard/start` zelf is niet gewijzigd of hernoemd.
- De oude Dashboard-bestemming in `/insights` is vervangen door de Analyse-bestemming met `ACTIVE`-status en link naar `/insights/analysis`.
- Het Settings-overzicht bevat geen Dashboard Widgets-tegel meer; Menuvolgorde behoudt zijn bestaande route en gebruikt een neutrale lijsticoon.

### KEEP

- `/dashboard/start`, de StartPage-service, StartPage-layoutvoorkeuren en de bestaande startpagina-acceptance blijven behouden.
- Employee 360: `components/employees/employee-dashboard*`, `lib/preferences/employee-dashboard*` en `/api/preferences/employee-dashboard` zijn een aparte persoonlijke contextweergave en gebruiken geen legacy `personal_dashboard*`-tabellen.
- Recruitment-, Talent-, product-update- en andere domeinspecifieke componenten met “dashboard” in de naam blijven behouden wanneer zij geen globale widgetcatalogus of persoonlijke dashboardpersistente gebruiken.
- De LiquidHR Control Plane `/dashboard` is een aparte app en valt buiten de HR Suite-route.
- `dashboard:read` blijft het bestaande server-side/RLS-toegangscontract voor Analyse. `dashboard-widget:read` en `dashboard-widget:write` blijven voorlopig als inerte legacy-permissionrecords bestaan; deletion is uitgesteld als afzonderlijke autorisatie-opruimschuld.
- Historische ontwerp-/plan-documenten en oude migration history blijven bewaard. Zij zijn geen actieve runtime- of schemaregistratie en worden niet stil verwijderd.
- `packages/db/types.ts` blijft het gegenereerde bestand van de nog niet toegepaste TEST-state; synchronisatie volgt pas na gecontroleerde migration apply.

## Database retirement

De nieuwe forward migration `20260828125223_retire_legacy_dashboard.sql` wijzigt geen oude migration history en verwijdert geen andere data. De gecontroleerde volgorde is:

1. `public.personal_dashboard_widgets`
2. `public.personal_dashboards`
3. `public.dashboard_widget_role_access`
4. `public.dashboard_widget_configs`

De inventory van de huidige migrations vond voor deze objecten de verwachte foreign keys, indexes, update-/audit-triggers, RLS policies en authenticated grants. De widget child-tabel verwijst naar `personal_dashboards`; daarom wordt zij eerst verwijderd. Er zijn in de actieve repository buiten deze legacy-objecten geen functies/RPC's of views gevonden die deze tabellen gebruiken. De migration gebruikt bewust geen `CASCADE`, zodat een onverwachte dependency de apply stopt in plaats van andere objecten te verwijderen.

De oudere migrations die deze tabellen later uitbreiden of seeden blijven letterlijk ongewijzigd. De migration is lokaal aangemaakt en voorbereid, maar niet op TEST toegepast. **DB TYPES SYNC PENDING TEST MIGRATION APPLY.**

## Foundation en architectuurgrenzen

- De hub blijft een rustige LiquidHR-pagina met bestaande Foundation-componenten, semantic tokens, vlakke borders, whitespace en responsive gridgedrag.
- Geen gradients, glass/neon/AI-glow, fake dashboard-widget-layout, zware shadows of nieuwe generieke primitives.
- Geen nieuwe API-route, query-seam, database-entiteit, saved-analysis-model of runtime state voor AN-1.
- Toekomstige analyse loopt conceptueel via `vraag → HR Semantic Layer → veilige AnalysisSpec → geautoriseerde data retrieval → renderer`; AI mag nooit vrije SQL genereren.
- Alle zichtbare tekst staat in NL/EN met gelijke sleutels; Nederlands blijft de standaardtaal.

## Bevroren roadmap

| Fase | Doel |
|---|---|
| AN-0 | Legacy Dashboard Retirement |
| AN-1 | Analyse Hub |
| AN-2 | HR Semantic Layer |
| AN-3 | Liquid Canvas V1 |
| AN-4 | Mijn Analyses |
| AN-5 | Liquid Explore V1 |
| AN-6 | Contextual Drill & Compare |
| AN-7 | Waarom? / Explain |
| AN-8 | Conversational Analysis |
| AN-9 | Certified Reports Integration |
| AN-10 | Security & Acceptance |

Architectuurregel: autorisatie en data retrieval blijven authoritative server-side; AI genereert geen vrije SQL.

### Toekomstig Mijn Analyses-model

Alleen voor toekomstige AN-4-documentatie: er worden geen data snapshots of widgets opgeslagen. Het conceptuele model bevat gebruiker, naam, oorspronkelijke vraag, scope, measures, dimensions, filters, comparison, visualization spec en exploration state. Bij openen wordt actuele data opnieuw opgehaald. Dit model is niet gebouwd in AN-1.
