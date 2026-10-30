# INS-RELEASE-03 — Final Security & Integration

| Eigenschap | Waarde |
|---|---|
| Datum | 30 oktober 2026 |
| Repository | `EdwinCycling/LiquidHR` |
| Branch | `work/ins-release-01-unblock-20261029` |
| Geteste basis | `7fda769804c57b4c9971d3842c3d7cd052af0065` |
| Omgeving | Geïsoleerde lokale checkout; Windows; Node 22.14.0; npm 10.9.2 |
**Status:** CODE READY

## Samenvatting

De INS-03-rapportages valideren nu expliciet de identiteit en scope van iedere teruggekomen bronrij. De directe-teamgrens staat los van de ruimere operationele verzuimrechten en wordt opnieuw gecontroleerd voor verzuim, frequent verzuim en Bradford. Een onverwacht te brede bronrespons faalt gesloten voordat KPI’s, details of Excel-data worden opgebouwd.

Read-only inspectie van Core TEST bevestigde dat de bestaande permissive `absence_cases`, `absence_spells` en `absence_capacity_changes`-SELECT-paden onder meer `internal_security.can_manage_employee()` gebruiken. Die helper kan HR-groepsrechten én directe-managementrechten honoreren. De effectieve operationele RLS-grens kan daardoor ruimer zijn dan de Insights-grens. De bestaande operationele policies en rechten zijn niet gewijzigd. De inspectie las alleen policies, helperdefinities en geaggregeerde rol-/toewijzingsaantallen; geen verzuimrecords. Er is geen live geauthenticeerde Manager- of Employee-request uitgevoerd, dus dit is geen live row-level persona-bewijs.

## Beveiligingscorrectie

- De bestaande actieve administratie-, tenant-, HR-groep-, directe-team- en medewerkerrelaties worden per teruggekomen rij gevalideerd.
- De Insights-allowlist staat los van `can_manage_employee()`. Een bronrij voor een collega in dezelfde HR-groep, een andere administratie, tenant of HR-groep wordt geweigerd.
- Bradford, frequentie en verzuim gebruiken dezelfde geautoriseerde populatie voor KPI’s, details en Excel. Een medewerker blijft uitgesloten van collega-Insights; een lege Manager-teamlijst levert geen medewerkers op.
- Queryfouten en onvolledige/ongeautoriseerde brongegevens worden niet omgezet in fictieve waarden. Medische vrije tekst is niet toegevoegd aan rapportages.
- De SQL-regressie modelleert de effectieve permissive operationele lezing plus de afzonderlijke rapportfilter met synthetische gegevens. Zij bewijst de applicatiegrens, niet de live Core TEST-RLS-uitkomst.

## INS-RELEASE-02-migratiebeoordeling

`apps/hr-suite/supabase/migrations/20261030065603_ins_release_02_manager_insights_unblock.sql` is behouden en **niet uitgevoerd**.

- De rapportpermissie wordt met `ON CONFLICT DO NOTHING` idempotent toegekend aan actieve, niet-verwijderde globale en tenantgebonden `DIRECT_MANAGER`-rollen.
- De threshold-RPC projecteert alleen `configured` en `frequent_absence_threshold`. `default_case_manager_employee_id` wordt niet teruggegeven.
- De fallbackwaarde `3` wordt alleen door de applicatie gebruikt wanneer de RPC aantoonbaar `configured=false` retourneert wegens een ontbrekende settings-rij. RPC-weigering, inconsistente configuratie, ongeldige waarde of bronfout faalt gesloten.
- De private helper is `SECURITY DEFINER`, heeft lege `search_path`, valideert authenticatie en `report-absence:read`, en is eigendom van de migratierol. De publieke wrapper is `SECURITY INVOKER`, heeft lege `search_path` en dezelfde migratie-eigenaar. Tests controleren EXECUTE voor `authenticated` en weigering voor `anon` en `service_role`.
- Rollback: roltoekenning is additief; verwijder haar niet blind, omdat `ON CONFLICT` niet vastlegt of de rij al bestond. Bij code-rollback kan de toegevoegde permissie blijven staan. Een eventuele database-terugdraaiing vereist een afzonderlijk gecontroleerde forward migration met bewijs welke rijen door deze migratie zijn toegevoegd. Hier is geen rollback of databasewijziging uitgevoerd.
- Migratievolgorde: pas deze migratie, indien later afzonderlijk geautoriseerd, toe nadat de voorafgaande schema- en permissiemigraties voor `absence_settings`, `current_user_has_hr_group_permission` en de gebruikte rollen/permissies zijn toegepast; daarna kan de code die de threshold-RPC aanroept worden uitgerold. Deze acceptatieronde heeft geen migratie toegepast.

## Verificatie

| Controle | Resultaat | Evidence |
|---|---:|---|
| Gerichte Insights-/SQL-contracttests | PASS — 4 bestanden, 34 tests | `npx vitest run lib/insights/absence-insight-authorization.test.ts supabase/migrations/absence_insight_manager_scope.contract.test.ts supabase/migrations/20261030065603_ins_release_02_manager_insights_unblock.contract.test.ts app/api/insights/absence/route.test.ts` |
| Payroll-catalogusregressies | PASS — 1 bestand, 6 tests | `npx vitest run lib/payroll/component-catalog.test.ts` |
| Volledige Vitest-suite | PASS — 4.008 PASS / 8 SKIP / 0 FAIL; 788 bestanden PASS / 4 SKIP | `npm test` vanaf repository-root; opgegeven baseline 4.003 / 8 / 0, dus 5 extra regressietests |
| TypeScript | PASS | `npm run type-check` vanaf repository-root; hr-suite, control en payroll-workspaces |
| ESLint | PASS — geen warnings | Gericht op de gewijzigde Insights-services en testbestanden met `npx eslint` |
| NL/EN i18n | PASS — 43 namespaces | `npm run check:i18n` vanaf `apps/hr-suite` |
| Productiebuild | PASS | `npm run build` vanaf `apps/hr-suite`; Next.js genereerde 348 statische pagina’s; build/provenancecontroles geslaagd |
| Git diff-check | PASS | `git diff --check --ignore-space-at-eol`; alleen een Git-regelindelingwaarschuwing voor de nieuwe LF-testbron op Windows, geen whitespacefout |

De volledige suite gaf bestaande Happy DOM-waarschuwingen voor synthetische `blob:payfull-*`-iframe-URL’s; de betrokken tests en de volledige run slaagden. De build genereerde een wijziging in het Focus-widgetartefact; alleen dat exacte bestand is hersteld naar de voorafgaande HEAD-inhoud. `apps/hr-suite/next-env.d.ts` bleef ongewijzigd.

## Git- en Vercel-status

De ontwikkelbranch begon op `7fda769804c57b4c9971d3842c3d7cd052af0065`; `origin/main` was `5e47832123bc90e197b38dc511bd658904e62c96` en een voorouder van die branch. Het Vercel-project `edwinitsolutions/liquidhr` is aan deze GitHub-repository gekoppeld. De projectconfiguratie meldt `createDeployments: disabled`; de aangetroffen Deploy Hook is voor een andere branch. Er is geen GitHub Vercel-deployworkflow aangetroffen. Dit bevestigt dat een featurebranch-push geen automatische Vercel-deployment start via de gecontroleerde Git-integratie.

Er is in deze ronde geen databaseactie, migration apply, accountwijziging, merge of deployment uitgevoerd. De featurebranch-ref wordt vóór publicatie na commit opnieuw gecontroleerd; na een toegestane fast-forwardpush worden remote SHA en Vercel-deployments nogmaals read-only gecontroleerd.

## Resterende acceptatiegrens

Lokale code-, SQL-contract-, type-, lint-, i18n- en buildcontroles zijn geslaagd. Voor Core TEST resteert een afzonderlijk geautoriseerde, geauthenticeerde acceptatie met bestaande HR Admin-, Manager- en Employee-identiteiten om de effectieve live RLS en persona-uitkomsten te bevestigen. Dat bewijs valt buiten deze lokale codegereedheidsbeoordeling.

**Oordeel: CODE READY** voor gecontroleerde integratie en voorbereiding van Core TEST-acceptatie. Dit is geen toestemming om de migratie toe te passen, te mergen of een deployment uit te voeren.
