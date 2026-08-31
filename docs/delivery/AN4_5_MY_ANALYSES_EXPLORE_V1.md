# AN-4/5 Mijn Analyses + Liquid Explore V1 — delivery handoff

**Status: AN-4/5 TEST GREEN — READY FOR FINAL INTEGRATION**

**Typegen note: `TYPEGEN SYNC REQUIRED` — officiële remote typegen bevat nu het nieuwe saved-analysis type, maar de volledige gegenereerde output heeft brede bestaande remote/local drift. Die brede diff is niet gecommit; de AN-4/5 persistence seam gebruikt bewust de voorbereide narrow typed contracten.**

## Herleidbaarheid

- candidate integration baseline: `9151248f224fb62a2d18c558c2627e1078c2cf0a`;
- current candidate code HEAD: `6bf9e11b88d258031a129e63d8cfe95933e60627` before this post-apply evidence update;
- current `origin/main`: `8b080b06993e9de290d2756e6bef1c93f5a6095d` (`release/security-wave-a-20260831`), advanced independently after the candidate baseline; this worktree is intentionally not rebased or merged in this step;
- branch: `work/an4-an5-my-analyses-explore-v1`;
- worktree: `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\an4-an5-my-analyses-explore-v1`;
- zichtbare appversie blijft `1.20260830.2` — geen releasebump;
- dirty root `work/r5-work-runtime` is niet aangeraakt.

## Geïntegreerd

De nieuwe slice gebruikt de bestaande AN-2/3-engine en LiquidCanvas. De service `lib/insights/saved-analysis-service.ts` doet server-side permission/context resolution, scoped repository-operaties en strict definition-validatie. `saved-analysis-runtime.ts` opent een eigen definitie door validatie en een verse engine-execution te combineren.

De capability-routes zijn:

- `GET/POST /api/insights/saved-analyses`;
- `GET/PATCH/DELETE /api/insights/saved-analyses/[analysisId]`;
- `/insights/analysis/explore`;
- `/insights/analysis/my-analyses`;
- `/insights/analysis/my-analyses/[analysisId]`.

De hub activeert alleen Verkennen en Mijn analyses; Nieuwe analyse blijft bewust planned. De UI gebruikt bestaande Foundation `PageShell`, `PageHeader`, `Surface`, `SectionHeader`, `FormField`, `DropdownSelect`, `TextInput`, `Button`, `EntityList`, `EmptyState`, `Dialog` en `ConfirmDialog`. Er is geen nieuwe generieke primitive, geen MUI/Chakra/Radix/shadcn, geen client-Supabase en geen vrije SQL.

## Persistence en security

De forward migration `20260830143757_saved_analysis_definitions.sql` is lokaal gehard en exact eenmaal op canonical TEST toegepast via `mcp__codex_apps__supabase_apply_migration`. Remote registreerde deze named migration als versie `20260831093310` met naam `20260830143757_saved_analysis_definitions`. De DB-validator spiegelt expliciet de canonieke negen verplichte top-level AnalysisSpec V1-keys: `sort` is verplicht maar nullable, unknown keys worden geweigerd en de defecte `<> 10`-count is verwijderd. De lokale migratiemap bevat `389` bestanden en `386` unieke versies; de eerder vastgestelde set-drift is `313` remote-only en `292` local-only en is niet gerepareerd. De migration voegt uitsluitend het persoonlijke definitie-object toe met expliciete tenant/HR-groep/eigenaar, `ON DELETE RESTRICT`, een gesloten DB-allowlist voor AnalysisSpec V1, index, UTC timestamps, identity-immutability-trigger, defense-in-depth RLS en service-role grants voor de bestaande server-only seam. Authenticated heeft geen directe tabelprivileges, omdat de database de cookie-gekozen actieve HR-groep niet kan zien. `analysis_spec` is het enige opgeslagen analyseobject; gestructureerde medewerker- of uitkomstdata worden door de DB-allowlist geweigerd. De catalogus- en transactionele fixture-RLS-tests staan in `supabase/tests/saved_analysis_definitions.sql` en `supabase/tests/saved_analysis_definitions_rls.sql`; beide zijn na apply uitgevoerd en groen.

RLS gebruikt owner + aangevraagde tenant/HR-groep + bestaande `dashboard:read` en any-active-membership. De server gebruikt daarnaast de cookie-afgeleide actieve context en construeert pas daarna de server-only repository; uitvoering behoudt de AN-2/3 employee-read permission. Cross-user, cross-tenant, cross-group, insufficient-permission, malformed-id, tampered-spec en unsupported-version-paden zijn application-side lokaal fail-closed afgedekt. Post-apply readback bevestigt de negen NOT NULL-kolommen, de drie `ON DELETE RESTRICT`-FK's, beide checks, owner-scope index, RLS, vier authenticated policies, service-role-only table privileges, validator-/trigger-eigenschappen en updated-at/identity triggers.

## Lokale en remote evidence na apply

- gecombineerde AN-4/5 + AN-2/3 + LiquidCanvas + AI Usage regressies: `23` files / `80/80` groen;
- `npm.cmd run type-check --workspace @liquid-hr/hr-suite`: groen;
- `node scripts/check-i18n.mjs`: groen, `33` gelijke namespaces;
- `npm.cmd run lint --workspace @liquid-hr/hr-suite -- --quiet`: groen;
- `git diff --check`: groen;
- Webpack production build: groen, `233/233` gegenereerde pagina's;
- local config: canonical TEST `.env.local` is uitsluitend naar deze ignored candidate-worktree gekopieerd; benodigde Supabase-variabelen zijn aanwezig, zonder waarden te loggen of de root-env te wijzigen;
- authenticated browser: aparte Playwright-sessies logden HR Admin en Manager normaal in (`POST /login` `200`). HR Admin zag tenant/context `Planeten`; de Analyse-hub bevatte exact vier tegels: Nieuwe analyse `Gepland`, Verkennen/Mijn analyses/Rapporten `Actief`;
- HR Admin productflow: via Explore `Afdeling` geselecteerd, headcount-analyse uitgevoerd (`POST /api/insights/analysis` `200`), `QA Headcount by department` via de UI opgeslagen (`POST /api/insights/saved-analyses` `201`), zichtbaar in Mijn analyses en via de detailroute opnieuw uitgevoerd met actuele data. Delete via bevestigingsdialoog gaf `200`; de UI toonde de lege state;
- owner/scope browserflow: Manager zag een lege Mijn analyses-lijst; creator-UUID GET/PATCH/DELETE gaven alle drie `404 SAVED_ANALYSIS_NOT_FOUND`. Een fake `tenant_id`/`hr_group_id` query op de HR Admin-list gaf alleen de eigen server-gescopeerde rij terug; er is geen client-scope-input om autorisatie te vervangen. Geen page/console-errors in de productflow; alleen verwachte development preload/HMR-warnings en expected negative-404 navigation-events;
- persistence readback: owner matcht `hradmin.fixture`, `definition_version=1`, tenant en HR-group aanwezig; `analysis_spec` was exact configuration-only (`version=1`, `workforce`, `employees`, `headcount`, `department`, `filters=[]`, `sort=null`, `limit=25`, `presentation=auto`) met nul verboden employee/result/snapshot/SQL/narrative keys;
- remote cataloguscontracttest: groen na rollback; transactionele pgTAP/RLS-test: `29/29` groen na rollback;
- remote advisors na apply: geen AN-4/5 security-finding; twee AN-gerelateerde performance-INFO's (`unindexed_foreign_keys` voor de owner-FK en direct na apply ongebruikte owner-scope-index), naast bestaande projectbaseline-waarschuwingen;
- officiële typegen: output bevat `saved_analysis_definitions` met de verwachte velden/relaties en geen persoonlijke dashboardtypes; brede outputdrift is niet naar `packages/db/types.ts` geschreven of gecommit;
- fresh-data invariant: de reeds voorbereide `saved-analysis-runtime.test.ts` in de `80/80`-gate bevestigt opnieuw uitvoeren tegen actuele brondata en geen result snapshot; er zijn geen employee-fixtures toegevoegd;
- remote privacy/cleanup: `saved_analysis_definitions` bevat na normale UI-delete `0` rijen, `0` verboden top-level keys en `0` employee keys; geen unrelated TEST-data is gemuteerd;
- root/worktree safety: root dirty state en challenge repo niet aangeraakt;
- remote DB: geen verandering.

## Exacte apply-grens

De history-blocker is voor deze afgebakende applystap opgelost: exact één named Supabase MCP-mechanisme is gebruikt, `mcp__codex_apps__supabase_apply_migration`, met project `wnpfloqpjvaacobppbpk`, naam `20260830143757_saved_analysis_definitions` en een SQL-payload die exact gelijk was aan de lokale forward migration. De remote registratie kreeg serverversie `20260831093310` met de named migrationnaam. Geen ander migrationmechanisme is gebruikt.

De apply en de post-apply DB-gates zijn afgerond. Er is geen `db push`, `--include-all`, repair, pull of handmatige history-edit gebruikt. De authenticated owner/tenant/HR-group browser/API-acceptatie is groen. De candidate is niet gerebased op de inmiddels voortgeschoven `origin/main`; main, versie, push, deploy en release zijn onaangeroerd.
