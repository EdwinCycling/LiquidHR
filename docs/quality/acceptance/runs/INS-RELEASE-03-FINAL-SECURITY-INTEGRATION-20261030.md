# INS-RELEASE-03 — Final Security & Integration

| Eigenschap | Waarde |
|---|---|
| Datum | 30 oktober 2026 |
| Repository | `EdwinCycling/LiquidHR` |
| Branch | `work/ins-release-01-unblock-20261029` |
| Geteste basis | `7fda769804c57b4c9971d3842c3d7cd052af0065` (historische INS-RELEASE-03-basis) |
| Omgeving | Geïsoleerde lokale checkout; Windows; Node 22.14.0; npm 10.9.2 |
**INS-RELEASE-03-status:** Historisch CODE READY voor lokale integratie. **Actuele INS-RELEASE-04-status:** voorbereidingspakket gereed; Core TEST-uitvoering HOLD totdat de fasegates en exacte deployed source-SHA zijn bevestigd.

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
| Git diff-check | PASS | `git diff --check --ignore-space-at-eol` gaf geen whitespacefouten; `core.autocrlf` gaf bij staging een EOL-conversiewaarschuwing voor LF-werkkopieën op Windows |

De volledige suite gaf bestaande Happy DOM-waarschuwingen voor synthetische `blob:payfull-*`-iframe-URL’s; de betrokken tests en de volledige run slaagden. De build genereerde een wijziging in het Focus-widgetartefact; alleen dat exacte bestand is hersteld naar de voorafgaande HEAD-inhoud. `apps/hr-suite/next-env.d.ts` bleef ongewijzigd.

## Git- en Vercel-status

De ontwikkelbranch begon op `7fda769804c57b4c9971d3842c3d7cd052af0065`; `origin/main` was `5e47832123bc90e197b38dc511bd658904e62c96` en een voorouder van die branch. Het Vercel-project `edwinitsolutions/liquidhr` is aan deze GitHub-repository gekoppeld. De projectconfiguratie meldt `createDeployments: disabled`; de aangetroffen Deploy Hook is voor een andere branch. Er is geen GitHub Vercel-deployworkflow aangetroffen. De featurebranch-ref ontbrak voor publicatie; codecommit `6e3e880b104caeeea61f75c52985cda50e8fb6f0` is met een gewone, niet-force push op dezelfde branch gepubliceerd. De post-push `git ls-remote`-SHA kwam overeen en de read-only Vercel-lijst voor deze branch retourneerde 0 deployments.

Er is in deze ronde geen databaseactie, migration apply, accountwijziging, merge of deployment uitgevoerd.

## Resterende acceptatiegrens

Lokale code-, SQL-contract-, type-, lint-, i18n- en buildcontroles zijn geslaagd. Voor Core TEST resteert een afzonderlijk geautoriseerde, geauthenticeerde acceptatie met bestaande HR Admin-, Manager- en Employee-identiteiten om de effectieve live RLS en persona-uitkomsten te bevestigen. Dat bewijs valt buiten deze lokale codegereedheidsbeoordeling.

**Oordeel: CODE READY** voor gecontroleerde integratie en voorbereiding van Core TEST-acceptatie. Dit is geen toestemming om de migratie toe te passen, te mergen of een deployment uit te voeren.

## INS-RELEASE-04 — Gecontroleerd Core TEST-pakket (30 oktober 2026)

Deze sectie is de actuele aanvulling op INS-RELEASE-03 en vervangt de daarin beschreven migratievolgorde. De eerdere bewering dat `20261030065603` ook de Manager-permissie toekent, is voor de huidige branch achterhaald. De historische INS-03-resultaten hierboven blijven staan als bewijs voor hun toenmalige SHA; ze zijn geen hosted acceptatiebewijs voor deze kandidaat.

| Eigenschap | Waarde |
|---|---|
| Repository/branch | `EdwinCycling/LiquidHR` / `work/ins-release-01-unblock-20261029` |
| Branchbasis voor deze aanvulling | `630d2444bcbd7a6aff9a04a2c9821872c76308c5` |
| `origin/main` bij controle | `5e47832123bc90e197b38dc511bd658904e62c96` |
| Core TEST-project | Supabase `wnpfloqpjvaacobppbpk`; Vercel `edwinitsolutions/liquidhr` (`prj_h3voMtzXGfqG6QTodR5d1VTcC1zP`) |
| Resultaat | Lokale uitrol- en acceptatievoorbereiding gereed; geen migratie, deployment of hosted persona-run uitgevoerd |

### Veilige migratie-/deployvolgorde

1. **A — Alleen readmodel/RPC.** Pas `20261030065603_ins_release_02_manager_insights_unblock.sql` pas toe na expliciete Core TEST-toestemming. De migratie maakt geen Manager-toekenning. Een ontbrekende RPC laat HR Admin frequentieverzuim gesloten falen met `503`; er is geen stille drempelfallback naar 3.
2. **B — Beveiligde app.** Deploy uitsluitend na afzonderlijk `RELEASE LIQUIDHR TEST` en pin de exacte kandidaat-SHA. De actuele Vercel-aliasmetadata koppelt de actieve deployment aan `dpl_BVSDnuTsJYHCvWnVotw4waxpxJ1n`, aangemaakt op 25 oktober 2026 via CLI, maar bevat geen betrouwbaar bron-SHA of zichtbare productversie. Behandel de actieve app daarom als mogelijk verouderd. Ga niet door naar C zolang de actieve app niet aantoonbaar de beveiligde kandidaat is.
3. **C — Managerrecht activeren.** Pas `20261030120901_ins_release_04_manager_insights_activation.sql` pas na B en na afzonderlijke expliciete Core TEST-toestemming toe. Zij kent alleen `report-absence:read` toe aan actieve, niet-verwijderde `DIRECT_MANAGER`-rollen (globaal of tenantgebonden), en verandert operationele absence-permissies of RLS niet. Een privé ledger bevat uitsluitend grants die deze migratie nieuw heeft ingevoegd.
4. **D — Directe acceptatie.** Start meteen daarna één geauthenticeerde run met de bestaande, geautoriseerde synthetische HR Admin-, Manager-, lege-Manager- en Employee-sessies. Bevestig live source-SHA, doelproject, migratieversies A vóór C, alias en recente release-readback voordat de runner requests verstuurt. Bij enige securityfailure: stop de run en voer eerst de geautoriseerde containment uit.

De read-only Supabase-migratielijst bevatte 591 versies en bevatte noch `20261030065603` noch `20261030120901`. Er is niet geschreven of gemigreerd. De contextselectie-API's die de runner voor een geautoriseerde administratie-/negatieve contextproef gebruikt, zijn nagelezen: ze valideren de context en zetten uitsluitend cookies; ze schrijven geen businessdata. Alle directe PostgREST-verzoeken in de runner zijn GET's met de bestaande gebruikerssessie.

### RPC- en permissiebeoordeling

- De threshold-helper is `SECURITY DEFINER` met lege `search_path`; de publieke wrapper is `SECURITY INVOKER` met lege `search_path`. Contracttests controleren eigenaarschap door de migratierol, `EXECUTE` voor `authenticated` en geen `EXECUTE` voor `anon` of `service_role`.
- De helper vereist een geauthenticeerde gebruiker, niet-lege tenant-/HR-groepscope en `report-absence:read` voor die scope. Zij projecteert alleen `configured` en `frequent_absence_threshold`, weigert dubbele/ongeldige settings en retourneert `configured=false` alleen als de settingsrij aantoonbaar ontbreekt. `default_case_manager_employee_id` wordt niet gelezen of teruggegeven.
- Fase A geeft dus geen Manager Insights-toegang. Contracttests bewijzen weigering vóór C en toegang na C voor de juiste scope. De activeringsmigratie is idempotent, omvat globale en tenantgebonden actieve Manager-rollen en laat bestaande Manager- en HR Admin-toekenningen bij rollback intact.
- Containment na een fout ná C: eerst (na afzonderlijke DB-toestemming) alleen de door fase C gelogde rechten verwijderen; behoud de ledger voor audit/provenance:

```sql
begin;
delete from public.role_permissions rp
using internal_security.ins_release_04_manager_permission_activation_log activation
where activation.migration_version = '20261030120901'
  and rp.management_role_id = activation.management_role_id
  and rp.permission_id = activation.permission_id;
commit;
```

Verifieer daarna de nul-/bestaande grantset. Herstel pas daarna, indien nodig en afzonderlijk geautoriseerd, de vorige Vercel-app. Fase A introduceert geen Manager-recht en kan voor containment blijven staan; er is geen destructieve rollback van de RPC nodig. Geen rollback is in deze opdracht uitgevoerd.

### Acceptatie-runner

`apps/hr-suite/scripts/ins-release-04-core-test-acceptance.mjs` bereidt één gecontroleerde run voor. De runner weigert te starten zonder `--confirm-authorized-core-test`, manifest, exact verwachte 40-karakter source-SHA, juiste Vercel-/Supabase-projecten, recente runtime-readback, A-vóór-C migratieversies, toegestane alias, bestaande sessiestates en geconfigureerde testverwachtingen. Hij maakt geen login, sessie of JWT, gebruikt geen service role, schrijft geen responsebestanden en logt geen tokens, cookies, namen, diagnoses of vrije medische tekst.

De run controleert HR Admin in twee toegestane administraties, Manager-direct-team versus buiten-team-, administratie-, HR-groep- en tenantproeven, lege Manager-populatie, Employee-weigering plus Employee-selfservice, de JSON-/Excel- of CSV-populatie, drempel, browserfilters/periodes, NL/EN, desktop en 390px mobiel. Directe RLS-lezingen gebruiken de echte bestaande persona-sessie en selecteren alleen niet-medische identity-/sleutelkolommen; operationele verzuimrechten worden apart geteld van de beperktere Insights-allowlist. Bewijsuitvoer bevat alleen statuscodes, aantallen, deployment-SHA en populatiepariteit; geen persoonsrecords.

Het script is statisch gecontroleerd en de `--help`-route is getest. Het is **niet** tegen Core TEST uitgevoerd. De private manifest- en sessiebestanden worden pas bij een afzonderlijk geautoriseerde run aangeleverd; de Vercel- en Supabase-readback daarin moet direct voor uitvoering opnieuw worden bevestigd.

### GitHub/Vercel-triggercontrole

De bestaande PR #71 is open en Draft; de remote head is op dit controlemoment gelijk aan `630d2444bcbd7a6aff9a04a2c9821872c76308c5`. De Vercel-project-API via de read-only CLI-fallback meldt `gitProviderOptions.createDeployments = disabled`. De gekoppelde Git-config heeft één deploy-hook met ref `work/ai-gpt-live`; die hook richt zich niet op deze branch. De repository bevat geen push-deployworkflow voor Vercel. Vercel meldt nul deployments voor de INS-RELEASE-branch. De aparte Vercel webhooklijst gaf HTTP 403; dit is niet gebruikt als bewijs. De expliciete disabled Git-trigger, de hook-ref en het ontbreken van repository-deployworkflow vormen het gebruikte pushveiligheidsbewijs. Na push moeten branch-head en Vercel-branchdeploymentcount opnieuw read-only worden gecontroleerd.

### Verificatie van deze kandidaat

| Controle | Resultaat | Evidence |
|---|---:|---|
| Gerichte migratie-/threshold-tests | PASS — 2 bestanden, 11 tests | `npm test -- --reporter=dot supabase/migrations/20261030065603_ins_release_02_manager_insights_unblock.contract.test.ts lib/insights/frequent-absence-report.test.ts` vanuit `apps/hr-suite` |
| Volledige Vitest-suite | PASS — 4.012 PASS / 8 SKIP / 0 FAIL; 788 bestanden PASS / 4 SKIP | `npm test -- --reporter=dot` vanaf repository-root; 4 nieuwe tests ten opzichte van de gemelde 4.008 / 8 / 0 baseline |
| HR-suite TypeScript | PASS | `npm run type-check` vanuit `apps/hr-suite` |
| Gericht ESLint | PASS — geen warnings | `npx eslint lib/insights/frequent-absence-report.test.ts supabase/migrations/20261030065603_ins_release_02_manager_insights_unblock.contract.test.ts scripts/ins-release-04-core-test-acceptance.mjs` |
| Runner-syntax en help | PASS | `node --check scripts/ins-release-04-core-test-acceptance.mjs`; `node scripts/ins-release-04-core-test-acceptance.mjs --help` |
| Live persona/RLS/browseracceptatie | NOT RUN | Vereist expliciete fases A–D en een verifieerbare actieve app-SHA; geen live request gedaan |
| i18n/build | Niet opnieuw uitgevoerd | Geen UI- of vertaalbestanden gewijzigd; alleen migraties, regressietests, runner en dit rapport |

De volledige suite gaf opnieuw de bekende Happy DOM-waarschuwingen voor synthetische `blob:payfull-*`-iframe-URL's; alle betrokken tests slaagden en de volledige run eindigde met exitcode 0. Dit zijn waarschuwingen, geen nieuwe regressies.

### Actueel oordeel

**CODE READY** voor review van de gefaseerde lokale implementatie en voorbereiding. **HOLD** voor Core TEST-uitvoering totdat (1) de exacte beveiligde app-SHA op het doelalias is bewezen, (2) expliciete Core TEST-toestemming voor migratie A en later C is gegeven, en (3) `RELEASE LIQUIDHR TEST` voor fase B is gegeven. Er is geen migration apply, SQL-write, role grant, deployment, aliaswijziging, merge of hosted personaacceptatie uitgevoerd. Een push van de gecontroleerde featurebranch naar de bestaande Draft PR is veilig voorbereid op basis van de vastgelegde Vercel-triggercontrole; na push worden remote SHA en het aantal deployments opnieuw gecontroleerd.
