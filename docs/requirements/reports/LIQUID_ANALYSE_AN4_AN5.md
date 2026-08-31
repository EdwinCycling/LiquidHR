# Liquid Analyse — AN-4 Mijn Analyses en AN-5 Liquid Explore V1

**Status: AN-4/5 TEST GREEN — READY FOR FINAL INTEGRATION**
**Typegen note:** `TYPEGEN SYNC REQUIRED` — remote typegen bevat het nieuwe tabletype, maar brede bestaande remote/local drift wordt niet als generated-types diff vastgelegd.
**Datum:** 2026-08-31
**Authoritative baseline:** `9151248f224fb62a2d18c558c2627e1078c2cf0a` (`origin/main`)
**Implementatiebranch:** `work/an4-an5-my-analyses-explore-v1`

Dit is het leidende requirements- en architectuurcontract voor AN-4/5. Het bouwt voort op [`LIQUID_ANALYSE_AN2_AN3_ENGINE_V1.md`](LIQUID_ANALYSE_AN2_AN3_ENGINE_V1.md): semantic layer → strict versioned `AnalysisSpec` → server-side autorisatie en retrieval → typed `AnalysisResult` → dezelfde Foundation `LiquidCanvas`. AN-6/7/8/9 zijn niet gestart.

## Productcontract AN-4 — Mijn Analyses

De Analysehub houdt exact vier tegels. `Nieuwe analyse` blijft `PLANNED` en niet klikbaar. `Verkennen`, `Mijn analyses` en `Rapporten` zijn `ACTIVE`; de eerste twee linken naar de nieuwe routes en Rapporten blijft linken naar `/insights`.

Mijn Analyses is een persoonlijke, persistente lijst van reproduceerbare analyse-definities. V1 ondersteunt:

- eigen analyses binnen de actuele tenant en actieve HR-groep opsommen;
- een opgeslagen definitie openen en opnieuw uitvoeren tegen actuele geautoriseerde data;
- de huidige Explore-definitie onder een betekenisvolle naam opslaan;
- hernoemen en verwijderen met expliciete bevestiging;
- een veilige empty state.

Er zijn geen folders, favorites, sharing, collaboration, templates, scheduling, exports, history browser, AI-namen, snapshots, widgets, rows of result cache.

## Productcontract AN-5 — Liquid Explore V1

AN-5 is een deterministische guided flow onder `/insights/analysis/explore`. De UI maakt alleen een `AnalysisSpec` uit bestaande semantic capabilities:

- bron `workforce` en entity `employees`;
- measure `headcount` met `count_distinct`-semantiek;
- nul of één dimensie: `department`, `job` of `employment_status`;
- maximaal één bestaande `eq`-filter, met allowlisted waarden voor employment status;
- bestaande sortering, limit en `kpi`/`table`-presentatie;
- uitvoering via de bestaande `/api/insights/analysis`-route en rendering door `LiquidCanvas`.

De UI toont geen databasekolommen, joins, RPC's, SQL, permissioncodes, tenantgegevens, employee-ID's, vrije vraag of AI/provider/credits-flow. De client aggregeert geen employee-data en heeft geen Supabase-pad.

## Saved-definition model en geen-resultaatregel

Er wordt uitsluitend een versioned analyse-definitie opgeslagen, nooit een `AnalysisResult`, resultaatrij, headcount-snapshot, employee-snapshot, rendered widget, cached HR-data of andere result payload. Het minimale model bevat:

- server-owned `tenant_id`, `hr_group_id` en `owner_user_id`;
- betekenisvolle naam met lengtevalidatie;
- `definition_version`;
- versioned JSONB `analysis_spec`;
- UTC `created_at` en `updated_at`.

Een bronbeschrijving, comparison, exploration state en overige conceptvelden zijn alleen toegevoegd wanneer zij betekenisvol en veilig zijn voor V1; er is geen AN-6 comparegedrag geïntroduceerd. `AnalysisSpec` blijft de bron van waarheid voor execution en is later versioneerbaar uit te breiden.

Bij openen: authorize → load definition → validate opgeslagen versioned spec → execute dezelfde bestaande authorization-first engine → retrieve actuele data → produceer een verse `AnalysisResult` → render via dezelfde `LiquidCanvas`. Ontbrekende, gemanipuleerde of unsupported specs worden veilig geweigerd.

## Eigenaarschap, autorisatie en RLS

De server leidt tenant, actieve HR-groep en user af uit de bestaande `AuthContext`; clientvelden kunnen deze scope niet bepalen. Alle saved-analysis-operaties vereisen het bestaande `dashboard:read`-contract. Execution behoudt daarnaast de bestaande `employee:read` of `employee-directory:read`-eis van AN-2/3.

RLS definieert select/insert/update/delete voor de authenticated eigenaar in de aangevraagde tenant/HR-groep met bestaande `dashboard:read`-helpers en any-active-membership. De database ziet de cookie-gekozen actieve HR-groep niet. Daarom heeft authenticated geen directe tabelprivileges; de server valideert eerst de actieve context, permission en eigenaar en gebruikt daarna de bestaande server-only `createAdminClient`-seam met expliciete scopefilters. Identityvelden en `definition_version` zijn database-side immutable. Een andere user, tenant of HR-groep kan niet via de serverrepository worden bereikt; directe authenticated tabel-DML/SELECT is privilege-denied.

## Routes en serviceflow

| Capability | Route | Gedrag |
|---|---|---|
| list | `GET /api/insights/saved-analyses` | Eigen lijstprojecties binnen actuele scope; geen spec/resultaatdata. |
| save | `POST /api/insights/saved-analyses` | Strict naam + bestaande `AnalysisSpec` valideren; server vult scope/eigenaar. |
| get/open definition | `GET /api/insights/saved-analyses/:analysisId` | Eigen gevalideerde definitie; deze route voert niet uit. |
| rename/update | `PATCH /api/insights/saved-analyses/:analysisId` | Alleen naam en/of gevalideerde spec; geen scopevelden. |
| delete | `DELETE /api/insights/saved-analyses/:analysisId` | Alleen eigen rij, na expliciete UI-confirmation. |

De pagina's zijn `/insights/analysis`, `/insights/analysis/explore`, `/insights/analysis/my-analyses` en `/insights/analysis/my-analyses/[analysisId]`. De service gebruikt de bestaande engine; er is geen generieke arbitrary persistence endpoint.

## AnalysisSpec-versioning

`AnalysisSpec` V1 blijft de enige executionbron. De persistence-laag valideert inkomende en opgeslagen specs strikt, koppelt `definition_version` aan de specversie en reject onbekende fields, identifiers, filters, operators en versions. De UI kan alleen de allowlist opbouwen; de server blijft de autoritatieve grens.

## Hubstatus en roadmapgrens

Na AN-4/5 zijn Verkennen, Mijn analyses en Rapporten actief; Nieuwe analyse blijft gepland en niet klikbaar. AN-6 Contextual Drill & Compare, AN-7 Waarom? / Explain en AN-8 Conversational Analysis blijven volledig buiten deze slice. Ook AI planning, providers, Liquid Credits, free text, SQL, charts, dashboard widgets, sharing, scheduling, result caching, AN-9 report integration en WebMCP zijn niet gestart.

## Schema- en migratiebesluit

Na inspectie van de lokale migrations en de read-only TEST-catalogus bestaat geen geldige actieve saved-analysis-store. De TEST-catalogus bevatte `257` public tables zonder `saved_analysis`, `personal_dashboard`, analysis- of widget-store; de remote migration history bevatte geen `saved_analysis`, AN-4 of AN-5-registratie. De retired `personal_dashboard*`-tabellen worden niet hergebruikt. `ai_user_preferences` is AI-preference data zonder HR-groep en is niet geschikt. Daarom is een nieuwe forward migration vereist:

`apps/hr-suite/supabase/migrations/20260830143757_saved_analysis_definitions.sql`

De migration maakt alleen `public.saved_analysis_definitions` met de composite tenant/HR-groep-FK, owner-FK met `ON DELETE RESTRICT`, naam/version/spec checks plus een strikte DB-allowlist voor AnalysisSpec V1. De validator vereist alle negen canonieke top-level keys, accepteert `sort: null`, weigert unknown keys en gebruikt geen foutieve vaste `10`-count. Verder zijn er één owner-scope index, UTC update-trigger, identity-immutability-trigger, vier defense-in-depth authenticated RLS policies, expliciete public/anon/authenticated revoke, internal validator usage/execute voor `service_role` en tabel CRUD voor `service_role`. Er is geen data-backfill, geen result- of employee-kolom en geen generieke service-role endpoint; de bestaande server-only repository blijft de enige application seam.

Target: TEST Supabase-project `wnpfloqpjvaacobppbpk`. De migration is exact eenmaal toegepast met `mcp__codex_apps__supabase_apply_migration`; remote registreerde haar als `20260831093310 / saved_analysis_definitions`. `packages/db/types.ts` is niet breed overschreven door remote drift; de officiële typegen-output bevat wel `saved_analysis_definitions`, zodat `TYPEGEN SYNC REQUIRED` openstaat. De cataloguscontracttest staat in `apps/hr-suite/supabase/tests/saved_analysis_definitions.sql`; de transactionele fixture-RLS-test staat in `apps/hr-suite/supabase/tests/saved_analysis_definitions_rls.sql`.

## Test- en acceptance evidence

Lokaal in de worktree zijn de definition, persistence-service, open-runtime, API, hub, Explore, Mijn Analyses, LiquidCanvas, AI Usage-regressie en migration-contracttests groen: `23` testbestanden / `80/80` tests. `check:i18n` is groen met `33` gelijke NL/EN-namespaces, ESLint is groen, strict TypeScript is groen, `git diff --check` is groen en de Webpack production build genereert `233/233` pagina's.

De lokale tests dekken anon- en permission-denial vóór persistence, owner/tenant/HR-group isolation op application-niveau, eigen CRUD, malformed IDs, tampered en unsupported specs, employee/result-shaped en nested JSON, semantic allowlists, bestaande execution-permissions, client-Supabase-afwezigheid en save/open-runtime. De fresh-runtime-test bewijst dat openen opnieuw tegen actuele data uitvoert en geen snapshot leest. Na apply is de cataloguscontracttest groen en de transactionele fixture-RLS-test `29/29` groen; alle inserts zijn teruggerold. Remote bevat `408` unieke versies; de eerder vastgestelde drift (`313` remote-only, `292` local-only) is niet gerepareerd. Advisors tonen geen AN-securityfinding; twee AN-gerelateerde performance-INFO's blijven staan naast baselinebevindingen. Officiële typegen bevat het nieuwe tabletype/relaties, maar brede noise is niet geschreven of gecommit. Authenticated browseracceptance is groen: HR Admin `Planeten`, exacte vier hub-states, create/open/re-execute/delete; Manager ziet geen item en krijgt voor creator-GET/PATCH/DELETE `404 SAVED_ANALYSIS_NOT_FOUND`. Een fake tenant/group-query overschrijft de servercontext niet. Remote privacy/cleanup-check: `0` saved-analysis-rows, `0` acceptance rows en `0` verboden top-level/employee keys.

## Release evidence

De candidate is zonder mergeconflict geïntegreerd vanaf `origin/main` `9151248f224fb62a2d18c558c2627e1078c2cf0a`; de huidige `origin/main` is onafhankelijk door Security Wave A voortgeschoven naar `8b080b06993e9de290d2756e6bef1c93f5a6095d` met zichtbare versie `1.20260831.1`, en deze candidate is niet gerebased. De candidate-versie blijft `1.20260830.2` en is niet gebumpt. Er is exact één toegestane TEST-migration toegepast; er is geen backfill, brede typegen-write, push, deploy of release uitgevoerd. Authenticated acceptance is groen in de aparte lokale browsercontext; post-apply DB-readback en cleanup zijn groen.

## Approval gate

**AN-4/5 MIGRATION GATE — EXPLICIT TEST APPROVAL REQUIRED**

De expliciete approval is ontvangen en de gecontroleerde stappen zijn uitsluitend tegen TEST uitgevoerd. Apply gebruikte exact één named mechanisme:

```powershell
mcp__codex_apps__supabase_apply_migration(
  project_id="wnpfloqpjvaacobppbpk",
  name="20260830143757_saved_analysis_definitions",
  query=<exact contents of apps/hr-suite/supabase/migrations/20260830143757_saved_analysis_definitions.sql>
)
```

De history drift is vastgesteld en niet gerepareerd: geen `db push`, `--include-all`, repair, pull of handmatige history-edit. Na de named apply zijn schema/RLS/grant/trigger-readback, officiële typegen-inspectie zonder brede noise-commit, advisors, de transactionele SQL-contracttest en de authenticated owner/tenant/HR-group browser/API-gates uitgevoerd. Main, versie, push en release zijn onaangeraakt.
