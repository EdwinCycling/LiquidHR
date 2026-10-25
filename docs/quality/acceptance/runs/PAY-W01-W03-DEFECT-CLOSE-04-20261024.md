# PAY-W01-W03-DEFECT-CLOSE-04 — lokale defectfollow-up

**Datum:** 24-10-2026

**Verdict:** **W01 LOCAL PARTIAL; W03 LOCAL PARTIAL; W01/W03 HOSTED OPEN.**

## Werkcontext en bescherming

- Repository `LiquidHR-Payroll`; de bestaande veilige worktree is hergebruikt. Bij aanvang stond die schoon op `f784c257ea65f375732b35570331d99f5c12902a`. De wijzigingen staan uitsluitend op `work/pay-w01-w03-defect-close-04-20261024`.
- De acceptatie-evidence van `474e6754` en de latere rapportupdate `f784c257` zijn onderscheiden en behouden. Dit rapport is een follow-up; de oorspronkelijke meettabel in [PAY-W01-W03-FORCE-LOCAL-03](PAY-W01-W03-FORCE-LOCAL-03-20261024.md) is niet herschreven. De W02-integratiebranch is niet gewijzigd.
- De bestaande lokale TEST-server op poort `51518` is hergebruikt. Headless Chrome gebruikte geïsoleerde browsercontexten; HR Admin meldde aan via `/local/sign-in`, Lisa via de bestaande optie `/local/personas`, en Manager via normale `/login`.
- Geen Payroll-data-write, runberekening, review, runcreatie, finalisatie, migratie of PDF-wijziging. Alleen normale TEST-authenticatie, contextselectie en de bestaande lokale persona-handoff zijn gebruikt.

## W03 — runlijst en volledige werkplek

### Oorzaak en wijziging

Instrumentatie van de normale server-side Payroll-workspace laat zien dat de cyclusprojectie de werkplek blokkeert op 39 `getPayrollSourceSnapshot`-lezingen. De bestaande `loadQueriesInBatches`-loader wachtte per batch van zes voordat de volgende batch begon. In de twee geobserveerde baseline-cycli duurde alleen `source-snapshots-39` **37.788 ms** en **56.922 ms**; lifecycle-events duurden respectievelijk **3.131 ms** en **1.684 ms**. Run-samenvattingen en referentiefilters duurden per fase doorgaans minder dan 1,2 seconde. De runlijst werd al zichtbaar voordat de bronprojectie klaar was.

De loader blijft begrensd, behoudt invoervolgorde, foutafhandeling, autorisatie en `SOURCE_GAP`-diagnostiek. De limiet is van 6 naar **12** verhoogd. Een tweede proef met 24 is niet behouden: de zes bronfasen duurden 17.205 / 18.094 / 29.910 / 33.554 / 24.440 / 61.797 ms (mediaan 27.175 ms), tegenover mediaan 26.603 ms bij 12; de proef van 24 gaf geen mediaanwinst en een grotere uitschieter.

### Heracceptatie met de uiteindelijke limiet 12

Alle metingen gebruikten dezelfde HR Admin, tenant, HR-groep, administratie, expliciete periode `2026-10` en run-/bronprojectie. De runlijst bevatte 14 runs. De volledige werkplek bevatte 39/39 medewerkerregels en toonde dezelfde statusverdeling: 1 concept, 2 definitief en 36 geblokkeerd door bestaande bronhiaten. Dezelfde 39 employment-IDs leverden op desktop en 390 px SHA-256 `27a680bddbd977ce630296ee34e477774fe3434b31a1196cf6fa1e4dff3cda66`; de bronmanifest-digest bleef in de zes lezingen gelijk: `6d5f6a2b5a7099fc7d401f757c81708f8d1185f85caf6b8581aa517ad372ea0c`.

| Viewport | Runlijst zichtbaar | Volledige werkplek | Runs | Medewerkerregels | Overig |
| --- | ---: | ---: | ---: | ---: | --- |
| Desktop 1, 1440×900 | 3.298 ms | 27.742 ms | 14 | 39/39 | HTTP 200, geen overflow of consolefout |
| Desktop 2, 1440×900 | 3.792 ms | 46.585 ms | 14 | 39/39 | HTTP 200, geen overflow of consolefout |
| Desktop 3, 1440×900 | 11.395 ms | 44.089 ms | 14 | 39/39 | HTTP 200, geen overflow of consolefout |
| Mobiel 1, 390×852 | 3.239 ms | 30.842 ms | 14 | 39/39 | HTTP 200, geen overflow of consolefout |
| Mobiel 2, 390×852 | 8.041 ms | 41.281 ms | 14 | 39/39 | HTTP 200, geen overflow of consolefout |
| Mobiel 3, 390×852 | 3.061 ms | 35.301 ms | 14 | 39/39 | HTTP 200, geen overflow of consolefout |

De nieuwe runlijstrespons was dus meestal binnen 3–8 seconden zichtbaar, maar de volledige werkplek duurde nog 27,7–46,6 seconden en bleef wisselend. Daarom is W03 performance **PARTIAL**, zonder statistische p95-claim.

### Eerder gerapporteerde 209/196

De oude rapportage legde 209 desktop- en 196 mobiele roosteritems vast, maar niet de geselecteerde periode, selector/definitie van “roosteritem”, employment-set of bronmanifest. In deze herhaalmeting was er bij gelijke periode en scope geen viewportverschil in de 39 getoonde medewerkerregels of bronhashes. De responsieve component projecteert dezelfde employee-lijst en kent geen aparte mobiele filter/paginering. De exacte 13 historische items zijn niet terug te leiden tot records; de oude telling is **niet gereproduceerd en blijft als historische meetvraag OPEN**, niet als bewezen UI-fix.

## W01 — stroken, conceptpreview en scope

- HR Admin las Lisa’s bestaande FINALIZED-PDF met HTTP 200, 33.174 bytes, SHA-256 `41a84b88ebd06b01eb49802002a14d20f7170eb58628bd884f6d8c5472f1e82a`. Lisa las via Mijn Salaris hetzelfde document met dezelfde lengte en SHA. De pagina was HTTP 200.
- Lisa’s request voor Jaaps conceptpreview bleef HTTP 403. De Manager-controle staat apart hieronder.
- Jaaps bestaande rundetail was HTTP 200; de conceptpreviewlink ontbrak. De HR Admin-previewroute retourneerde HTTP 404 `PAYROLL_CONCEPT_PAYSLIP_UNAVAILABLE`. De route geeft deze 404 wanneer de previewrenderer geen beschikbaar resultaat heeft. Het detail is leesbaar en de previewrenderer vereist daarnaast de bestaande `GENERIC_INPUT_REFERENCE`; de waarnemingen passen bij ontbrekende concept-inputreferentie en tonen geen defect in de PDF-renderer. De precieze opgeslagen referentiestatus is niet via een aparte publieke readback ontsloten. Daarom blijft de preview **OPEN door bestaande bron/input-gap**. Er is geen PDF gemaakt en geen run gefinaliseerd.

## Manager-teamdossier

De bestaande `manager.fixture@liquidhr.test` is via het gewone lokale `/login` aangemeld; `/api/context` bevestigde De Sterren holding / Planeten / Jupiter. De API-contextreadback exposeerde hier geen rol-/permissielijst, dus de scope is getoetst via echte toegestane en geweigerde reads: de Manager-directory bevatte **6** teamleden tegenover **90** in de HR Admin-directory; een dossier binnen het team gaf **200**; een dossier en salarisread buiten het team gaven beide **404**. Manager-teamscope en negatieve probes: **PASS**.

## Kwaliteit en gates

| Gate | Resultaat |
| --- | --- |
| Gerichte Payroll-, lifecycle-, strook- en autorisatieregressies | **84/84 PASS**, 13 testbestanden |
| TypeScript `tsc --noEmit` | **PASS** |
| ESLint gewijzigde service en regressietest | **PASS** |
| Root `npm run build` | **BLOCKED in Windows-sandbox**: HR Suite Turbopack kon geen `playwright-core`-junction maken; Control faalde bij `/_not-found` met `EPERM` tijdens directorycreatie |
| HR Suite Webpack-fallback | **BLOCKED in Windows-sandbox**: `EPERM` tijdens aanmaak van een route-uitvoermap onder geïsoleerde `.next/payrun01-acceptance` |
| Beschermde `next-env.d.ts` | Beide workspaces bleven gelijk aan HEAD, Git-blob `ce4e94a6b10f160ee021fe18939af160d2927dcf` |
| Hosted W01/W03 | **OPEN**; deze run bewijst alleen lokale loopback |

De buildblokkades betreffen junction-/directoryrechten van de sandbox; er is geen buildconfiguratie of guard aangepast. De buildscript-genereerde Focus-widgetbron is naar de oorspronkelijke HEAD-versie teruggezet. Er zijn geen R2-regels, autorisatiechecks, bronhashcontracten of Payroll-API-contracten gewijzigd.

## Eindstatus

- **W01 LOCAL: PARTIAL** — Lisa’s FINALIZED-strook en Employee-selfscope zijn PASS; Jaaps conceptpreview blijft OPEN door de bestaande inputbron.
- **W03 LOCAL: PARTIAL** — gelijke huidige desktop-/mobiele dataset is aangetoond en de seriële batchbottleneck is beperkt; de volledige werkplek blijft te traag en de oude 209/196-telling is niet verklaarbaar met de opgeslagen evidence.
- **Manager-scope: PASS** — eigen teamread toegestaan; dossier- en salarisread buiten team geweigerd.
- **W01/W03 HOSTED: OPEN** — geen hosted actorreadback of hosted meting uitgevoerd.
- Geen nieuw roadmap-wave gestart.

## PAY-W03-SOURCE-SNAPSHOT-OPT-05 follow-up — 24-10-2026

Branch `work/pay-w01-w03-defect-close-04-20261024`; de opdrachtbasis was `a6e48e20c6056840f50c398aa8470f81d1b5567e`. De geoptimaliseerde broncode en geslaagde build zijn geverifieerd op `99af598a2a2127997504078f664a01a5d7df9b32`. De W02-integratiebranch is niet aangeraakt.

### Root cause en gerichte verbetering

De werkplek vraagt voor 39 verschillende employee/employment-combinaties 39 afzonderlijke `getPayrollSourceSnapshot`-projecties. De huidige source-provider/Core-services hebben geen bestaande tenant-/administratiegescopeerde batchcontract. Een directe brede read zonder dezelfde per-employee autorisatie en effectieve-datumselectie zou die controles omzeilen; een nieuwe batchservice zou die dus expliciet moeten uitvoeren. De snapshots blijven 39. De verspilling zat in reads binnen elke snapshot: een onnodige employment-directoryread bij een exact meegegeven `employmentId`, een tweede employment-read voor de IKV-projectie, en vier gedeelde setup-/periodereads die tussen medewerkers gelijk zijn.

De provider slaat de directoryread over en hergebruikt dezelfde scoped employment-projectie voor IKV, met opnieuw `contract:read` en scopecontroles. Vier reads worden binnen het request gedeeld: de Core-read van de periode, de Core-read van labor-condition/pension mappings en de Payroll Lab administration/configuration reads. De cachekeys bevatten alleen de selectorvelden die voor elke read gelden (tenant/HR-groep/periode of tenant/HR-groep/administratie); er wordt geen salaris- of medewerkerdata globaal gecachet. Tenantfilters, effectieve datums, bronversie, hashes, foutpaden en `SOURCE_GAP` blijven behouden. Bij 39 regels zijn **230 minder repository-readoperaties code-afgeleid** (39 directory + 39 IKV-employment + 4 × 38 herhaalde gedeelde reads, op het actieve Payroll Lab-configuratiepad); dit is geen geteld databaseverkeer. Een schemawijziging of migratie was voor deze gerichte hergebruikswijziging niet nodig.

De meetcode maakt de rest van de keten concreet. `getPayrollCycleWorklist` krijgt 39 medewerker-/employmentreferenties uit de bestaande runwerkplek en roept voor elke referentie `getPayrollSourceSnapshot` aan met dezelfde geautoriseerde tenant-/HR-groep-/administratiescope en periode. De referenties en bestaande runsummary bevatten geen volledige actuele bronpayload of source-version-vector; die worden niet uit een eerder opgeslagen snapshot gehaald. De provider autoriseert de medewerker, leest de employment-timeline en actual-work-projectie en bouwt daarna de effectieve bronmomentopname. De endpointtelling hierboven laat herhaalde, per employment benodigde Core PostgREST-reads voor contract, salaris, rooster, arbeidsvoorwaarden, organisatie, pensioen, IKV, belastingprofiel en uren zien. Er is geen Core-RPC of bestaande bulkbronread. Commit `3d6c3c9c` heeft de directory-/IKV-/gedeelde setup-readreductie geïntroduceerd; de nieuwe requestmeting toont dat de resterende Core-bronketen nog steeds 790 waargenomen requests per route heeft.

De vorige service-/browseracceptatie had bronfase 20,1–37,1 seconden bij concurrency 12; concurrency 24 verbeterde niet en had een uitschieter van 61,8 seconden. De loader blijft begrensd op 12. De postwijzigingsmetingen hieronder bewijzen snellere volledige werkplekweergave, maar scheiden de nieuwe bronfase nog niet in database/netwerk, JSON-serialisatie en provider-/UI-projectie.

### Heracceptatie — zelfde tenant, administratie, oktoberperiode en HR Admin

| Viewport | Meting | Runlijst zichtbaar | Volledige werkplek | HTML-documentduur | Runs | Medewerkerregels |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Desktop 1440×900 | 1 | 5.169 ms | 27.353 ms | 22.949 ms | 14 | 39/39 |
| Desktop 1440×900 | 2 | 5.614 ms | 22.700 ms | 17.844 ms | 14 | 39/39 |
| Desktop 1440×900 | 3 | 2.280 ms | 18.992 ms | 16.974 ms | 14 | 39/39 |
| Mobiel 390×852 | 1 | 4.069 ms | 24.418 ms | 20.600 ms | 14 | 39/39 |
| Mobiel 390×852 | 2 | 2.860 ms | 22.067 ms | 19.477 ms | 14 | 39/39 |
| Mobiel 390×852 | 3 | 2.077 ms | 18.311 ms | 16.215 ms | 14 | 39/39 |

Elke reload gaf HTTP 200 en 12 browserrequests: 1 document, 1 CSS, 3 afbeeldingen, 5 scripts, 1 font en 1 fetch. Dit zijn browserrequests en geen database-/RPC-telling. De volledige werkplek was op desktop 18,992–27,353 ms tegenover eerder 27,742–46,585 ms; op 390 px 18,311–24,418 ms tegenover eerder 30,842–41,281 ms. De zes individuele postmetingen staan hierboven; hieruit volgt geen p95.

Dezelfde 39 employment-IDs waren op alle zes nieuwe metingen aanwezig; hun digest was `27a680bddbd977ce630296ee34e477774fe3434b31a1196cf6fa1e4dff3cda66`, gelijk aan de eerdere metingen. Er waren geen dubbele of ontbrekende medewerkerregels en op 390 px geen horizontale overflow. De live UI exposeert echter geen sourceHash of resultaatfingerprint, dus gelijkheid van alle 39 bron-/resultaatfingerprints is niet bewezen. De providerhash-regressietest bevestigt wel dat de expliciete-employmentroute dezelfde hash produceert als de voorgaande route. De historische 209/196-roostertelling is nog steeds niet reproduceerbaar: periode, selector en recordset van die telling ontbreken.

De postwijzigings-HTTP-metingen isoleren geen server-side database-/netwerktijd, JSON-parsetijd of projectietijd. Ook is het exacte aantal Supabase/PostgREST-requests per pagina niet uit de 12 browserrequests af te leiden. Dat blijft een meetbeperking; de 230-readreductie is code-afgeleid, niet gemeten. Daarom blijft W03 LOCAL **PARTIAL**.

### Security en W01-regressies

- HR Admin en Employee Lisa lazen dezelfde bestaande FINALIZED-PDF: HTTP 200, `application/pdf`, 33.174 bytes, SHA-256 `41a84b88ebd06b01eb49802002a14d20f7170eb58628bd884f6d8c5472f1e82a`. De PDF bleef ongewijzigd.
- Lisa’s cross-employee dossier-/salarisprobe bleef geweigerd (HTTP 404). Bestaande Manager-livechecks blijven PASS uit de eerdere normale login: 6 teamleden, in-team dossier 200, buiten-team dossier en salaris 404; ze zijn na deze source-optimalisatie niet opnieuw uitgevoerd.
- Een live foreign-tenant-probe blijft OPEN: de bestaande persona-catalogus bevat geen foreign-tenant-gebruiker/fixture. De gerichte autorisatieregressies zijn wel geslaagd.
- Jaaps conceptpreview blijft OPEN op `PAYROLL_CONCEPT_PAYSLIP_UNAVAILABLE`; er is geen artifact gemaakt of run gefinaliseerd.
- Geen Payroll-datawrite, berekening, finalisatie, migratie of gedeelde TEST-mutatie.

### Kwaliteit en gates

| Gate | Resultaat |
| --- | --- |
| Gerichte Payroll-, source-, actual-work-, lifecycle-, PDF-, Retail R1/R2- en autorisatieregressies | **131/131 PASS**, 16 bestanden |
| HR Suite TypeScript | **PASS** |
| Relevante ESLint | **PASS** |
| i18n | **PASS**, 43 namespaces gelijk |
| Root productiebuild in dezelfde werkende buildcontext als W02 | **PASS** op Node `24.22.1` en lockfileblob `cdd20c601e5956b419b96d7a346b36ba5b1ce14b`; HR Suite 339/339 pagina’s en Control 12/12, inclusief client-bundlecontrole, provenance en trace-allowlist |
| Isolatie buildoutput | **PASS** met `LIQUIDHR_NEXT_DIST_DIR=.next/payrun01-acceptance-20261009`; geen sandboxfout/configuratieversoepeling |
| Beschermde bestanden | Beide `next-env.d.ts`-bestanden en Focus-widgetbron bleven bytegelijk |
| `git diff --check` | **PASS** na rapportupdate |

### Gatebesluit en resterend werk

- **W03 LOCAL: PARTIAL** — de serviceverbetering en end-to-end verbetering zijn lokaal aangetoond; 14 runs, 39/39 medewerkerregels en gelijke geaggregeerde bron-/resultaatfingerprints zijn bevestigd. Tijdelijke serverinstrumentatie telde 790 Core-PostgREST-requests per route en geen Core-RPC's; Payroll Lab wordt via een aparte client gelezen en is niet in die endpointtelling uitgesplitst. JSON-parsing en lokale providerprojectie zijn gering; databaseverwerking kan niet los van netwerk-/serverwachttijd worden gemeten met deze clientinstrumentatie. Live foreign-tenant-probe ontbreekt wegens afwezigheid van een bestaande persona/fixture.
- **W01 LOCAL: PARTIAL** — Lisa’s immutable PDF en self-scope zijn lokaal PASS; Jaaps preview blijft OPEN door de bestaande bron/inputgap. **W01/W03 HOSTED: OPEN**.
- GitHub issue [#39](https://github.com/EdwinCycling/LiquidHR/issues/39) blijft OPEN. Afzonderlijk nodig: geautoriseerde HR Admin op production-like TEST met actor/scope-readback; drie hosted herhaalmetingen met bronattributie en volledige inhoud; een overeengekomen performancebudget of gedocumenteerde uitzondering; en bij een latere release de PDF-/toegangscontrole en deployment-smoke.
- Geen push, merge, deployment, TEST-write, salarisfinalisatie of nieuwe roadmap-wave.

## PAY-W03-SOURCE-SNAPSHOT-OPT-05 — aanvullende lokale meting (25-10-2026)

De productcode is sinds de gemeten codecommit `99af598a2a2127997504078f664a01a5d7df9b32` ongewijzigd; de latere commits tot HEAD `5e7539a651f64938bb664319b43e7ebb53b95cc4` wijzigen alleen rapportage. De bestaande lokale server in deze worktree op poort `51518` is hergebruikt. De TEST-launcher bevestigde dat de poort bezet was en dat geen proces werd gestopt; een aparte poging op `51519` stopte zelf toen Next.js de bestaande dev-server herkende. De bestaande server is niet herstart.

Headless Chrome gebruikte een nieuwe geïsoleerde context en de normale lokale HR Admin-login. De bestaande contextkeuze was De Sterren holding / Planeten / Jupiter BV; `/api/context` gaf HTTP 200 en bevestigde deze drie labels zonder identifiers te bewaren. De expliciete periode bleef `2026-10`.

| Viewport | Meting | Runlijst zichtbaar | Werkplek volledig | HTTP | Runs | Medewerkers | Employee-digest | Overig |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 390×852 | 1 | 2.280 ms | 35.470 ms (33.190 ms na lijst) | 200 | 14 | 39/39 | gelijk aan eerder | Geen overflow; 39 `SOURCE_GAP`-diagnostiekmeldingen; 0 page-errors |
| 390×852 | 2 | 2.143 ms | 23.651 ms | 200 | 14 | 39/39 | `27a680bddbd977ce630296ee34e477774fe3434b31a1196cf6fa1e4dff3cda66` | Geen overflow; 39 `SOURCE_GAP`-diagnostiekmeldingen; 0 page-errors |

De tweede meting registreerde 14 browserrequests voor de runroute: 1 document, 1 stylesheet, 4 afbeeldingen, 5 scripts, 1 font en 2 fetches. Dit zijn geen database-/PostgREST-/RPC-requests. De response bevatte geen `Server-Timing`-header. De laatste 39 `PAYROLL_SOURCE_PROVIDER_GAP`-logregels besloegen 12.140 ms van eerste tot laatste callback; die span is geen meting van de volledige bronfase en splitst netwerk, responseverwerking of projectie niet uit.

Een tussenliggende mobiele poging toonde de runlijst, maar kreeg de volledige werkplek niet binnen 60 seconden; de meting is verworpen en niet als succesvolle trial geteld. De daaropvolgende twee metingen slaagden. Dit bevestigt dat de werkplek nog wisselende latenties heeft. De eerder vastgelegde zes geauthenticeerde metingen blijven code-equivalent geldig: drie desktop en drie 390px-metingen met 14 runs en de digest van 39 employment-IDs. De nieuwste twee mobiele metingen behouden dezelfde 39/39-dataset; de interface ontsluit nog steeds geen individuele bron- en resultaatfingerprints.

Er is geen bestaande batchfaciliteit aangetroffen die 39 employee/employment-snapshots kan vervangen met behoud van de autorisatie per werknemer, effectieve datumselectie en bronprovenance. De huidige calls blijven daarom 39 snapshots vóór en na de optimalisatie. De 230 minder interne repository-readoperaties zijn code-afgeleid.

### Tijdelijke source-read-instrumentatie

Om de fetchketen te meten is de normale server-side source-read-cyclus tijdelijk instrumenteerd. De meting telde alleen requestaantallen, endpointnamen, tijden, responsebytes en geaggregeerde fingerprints; geen querywaarden, persoonsgegevens of salarisbedragen zijn gelogd. De meetmodule en wijzigingen aan `server.ts`, de cycle-service en source-provider zijn na de twee metingen exact naar HEAD hersteld. De bestaande dev-server bleef actief.

| Viewport | Runlijst zichtbaar | Volledige werkplek | Sourcefase wall time | Waargenomen Core PostgREST-requests | Core responsebytes | Employee-rows |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Desktop 1440×900 | 5.807 ms | 45.467 ms | 32.856,9 ms | 790 | 1.641.084 | 39/39 |
| 390×852 | 4.585 ms | 38.458 ms | 30.679,9 ms | 790 | 1.641.084 | 39/39 |

Beide viewportnavigaties gaven HTTP 200, 14 runs, dezelfde 39 employment-IDs (`27a680bddbd977ce630296ee34e477774fe3434b31a1196cf6fa1e4dff3cda66`), geen overflow en geen page-errors. Elke route emitteerde 39 bestaande `SOURCE_GAP`-diagnostiekmeldingen. Browserresources telden 13 requests op desktop en 12 op mobiel; dat zijn niet de 790 waargenomen Core-serverreads. De extra meetinstrumentatie en dev-HMR maken deze twee volledige-werkplekmetingen ongeschikt als directe vergelijking met de eerdere on-geïnstrumenteerde latencyreeks.

De geaggregeerde bronfingerprint was op beide viewports identiek: `1f1ae21392dfab6515878f2fa6ff33b38bcedd8a0dddb776ffa520eb166c985d`. De geaggregeerde run-/resultaatfingerprint was eveneens identiek: `ae5e293e87f4c2fc3d26f3c041eb0d72a82ecefdac83f4c32d37da8c7611cdb8`. Alle 39 bronhashes waren aanwezig.

De 790 waargenomen Core PostgREST-requests per viewport gingen naar:

| Tabelendpoint | Requests |
| --- | ---: |
| `employments` | 78 |
| `employment_income_relationships` | 78 |
| `employees` | 40 |
| `employment_contracts` | 39 |
| `employment_labor_conditions` | 39 |
| `employee_organizations` | 39 |
| `employment_salaries` | 39 |
| `employment_schedules` | 39 |
| `employment_pension_arrangement_assignments` | 39 |
| `pension_arrangements` | 39 |
| `pension_arrangement_tiers` | 39 |
| `pension_arrangement_versions` | 39 |
| `pension_arrangement_version_tiers` | 39 |
| `income_relationships` | 39 |
| `employment_payroll_tax_profiles` | 39 |
| `employment_work_hour_entries` | 39 |
| `labor_condition_sets` | 35 |
| `jobs` | 24 |
| `job_revisions` | 24 |
| `work_hour_types` | 2 |
| `actual_work_periods` | 1 |
| `labor_condition_pension_arrangements` | 1 |

Op de waargenomen Core endpoints werd geen `/rpc` aangeroepen. De Payroll Lab setup gebruikt een aparte Supabase-client: de code leest per request de payroll-administratie en, als die actief is, de configuratierijen. Deze tabelreads zijn niet aanwezig in de waargenomen Core-endpointlijst; het precieze totale HTTP-aantal over beide databases is daarmee niet vastgesteld. Voor de waargenomen Core-requests waren de request-tot-headersommen 739.915,1 ms desktop en 400.664,1 ms mobiel; de langzaamste individuele request was 12.366,9 ms respectievelijk 3.812,6 ms. Response-body-readtijd was 40.863,5 ms en 38.513,1 ms als som over Core requests; JSON-parsing kostte 40,6 ms en 41,3 ms. De providerfasen `timeline` namen 355.609,3/206.864,7 ms geaggregeerd over 39 workers; `actualWork` 6.843,9/18.986,9 ms; `payrollSetup` 11.287,3/102.784,6 ms; pure providerprojectie 144,1/1.194,4 ms. Deze worker- en requesttijd-sommen lopen parallel en zijn geen wandkloktijd. Samen met 1,64 MB Core-response-inhoud laat dit zien dat de gemeten source-wall-time vooral door de veelvoud aan Core-bronreads wordt bepaald; JSON-parsing en lokale providerprojectie zijn klein. De headersmeting scheidt databaseverwerking niet van netwerkvertraging.

Er is geen bestaande batchroute. De kleinste code-only kandidaat is een nieuwe bounded per-table Core-service die eerst elk employee-/employment-paar via de bestaande permissiechecks autoriseert, dezelfde authenticated Supabase-client/RLS en expliciete scope-/effective-date-/confirmed-employment-filters gebruikt, de huidige projection mapping hergebruikt, en per rij identieke hashes/version vectors en geïsoleerde `SOURCE_GAP`-uitkomsten oplevert. Payroll Lab blijft een aparte readpath met zijn bestaande request-scoped cache. Deze service bestaat niet en is nog niet op data-, autorisatie- of foutisolatie-equivalentie bewezen; direct bulkselecteren zonder die stappen is niet veilig. Als het ontwerp die checks niet binnen een begrensde multi-table read kan behouden, is een Core read-only batch-RPC een alternatief, maar die vergt schema-/migratieontwerp, contracttests voor Employee/Manager/foreign-tenant-negatieven en afzonderlijke migratieautorisatie. Geen van beide routes is in OPT-05 uitgevoerd; er was geen migratie.

De Lisa-PDF-, Employee-selfscope- en Manager-teamnegatieve controles uit de eerdere lokale acceptatie zijn in deze follow-up niet opnieuw uitgevoerd; zij blijven historische PASS-evidence. Er is geen Employee- of Manager-sessie gebruikt in de nieuwe metingen en geen foreign-tenantpersona beschikbaar. De browserprobe heeft alleen bestaande data gelezen; er is geen berekening, runmutatie, finalisatie, PDF-write of migratie uitgevoerd.

GitHub issue [#39](https://github.com/EdwinCycling/LiquidHR/issues/39) is op 25-10 read-only gecontroleerd en blijft OPEN. Het vraagt nog steeds een geautoriseerde HR Admin in production-like TEST, minimaal drie hosted list-/workspace-metingen met bronattributie en volledigheid, een overeengekomen performancebudget of concrete uitzondering, en bij een latere productie-release PDF-/toegangscontrole en deployment-smoke.

**Status:** W03 LOCAL blijft **PARTIAL**; W01 LOCAL blijft **PARTIAL**; W01/W03 HOSTED en issue #39 blijven **OPEN**. Productiebuild en 131/131 gerichte regressies blijven PASS op codecommit `99af598a`; deze follow-up is documentatie plus read-only lokale meting.

### OPT-05 technische conclusie en veilige vervolgstap

De structurele oorzaak is niet de lokale JSON- of providerprojectie: per werkplek worden 39 individueel geautoriseerde employee/employment-snapshots opgebouwd en daarvoor 790 Core PostgREST-tabelrequests afgehandeld. Per endpoint zijn de waargenomen Core-aantallen hierboven uitgesplitst. De bestaande wijziging vermijdt code-afgeleid 230 interne repository-readoperaties, maar verandert het aantal snapshots (39) en de 790 Core-requests niet. De 790 requests zijn server-side reads die niet zichtbaar waren in de browserresource-teller; dit zijn geen 790 browserrequests. Payroll Lab is een afzonderlijke datastore; zijn requestaantal is niet in deze endpointtelling opgenomen.

De meting scheidde de waargenomen Core-clientrequest-tot-headers, response-body-consumptie, JSON-parse en providerprojectie. Zij kan de Postgres-querytijd niet scheiden van PostgREST/serverwachttijd en netwerktransport, noch JSON-serialisatietijd aan de serverzijde van de body-transfer. De gemeten Core-fasen bedroegen respectievelijk: request-tot-headers som 739.915,1/400.664,1 ms; body-consumptiesom 40.863,5/38.513,1 ms; JSON-parse 40,6/41,3 ms; pure providerprojectie 144,1/1.194,4 ms (desktop/mobiel). De request-, body- en worker-fases overlappen door begrensde concurrency 12; alleen de sourcefase wall time is direct optelbaar als 32.856,9/30.679,9 ms. Payroll Lab wordt via een aparte client gelezen en is niet apart uitgesplitst. De bottleneck is bewezen als de hoeveelheid en latency van Core-bronreads, maar de verdeling daarvan tussen database en netwerk blijft een meetgrens.

Een veilige batchread kan niet als bestaande service/RPC worden hergebruikt. De 39 snapshots zijn per medewerker geautoriseerd, periode-/effective-date-geselecteerd en bevatten eigen bronversies, fingerprints en `SOURCE_GAP`-uitkomsten. Een brede clientquery zou de bestaande Core-servicecontrole en per-employee foutisolatie kunnen omzeilen. De kleinste verdedigbare volgende stap is een read-only, begrensde batch-source-contract/RPC die scope uit de geauthenticeerde servercontext afleidt en dezelfde controle per employee/employment uitvoert. Dat vergt schema-/migratieontwerp en expliciete migratieautorisatie; er is geen migratie, gedeelde write of productcodewijziging uitgevoerd in OPT-05. Een in-app multi-query zonder DDL is alleen een kandidaat na aantoonbare RLS-, effective-date-, provenance- en `SOURCE_GAP`-equivalentie; er is nog geen bestaande faciliteit die dit garandeert.

**OPT-05-resultaat:** de eerdere service-optimalisatie blijft functioneel equivalent volgens de lokale 39/39-, bronhash- en resultfingerprintmetingen, maar de voornaamste 790-Core-requestbronfase is niet structureel verkort. W03 LOCAL blijft **PARTIAL**. Een per-table batchprojectie zonder DDL is technisch denkbaar, maar is geen bestaande faciliteit en de gelijkwaardigheid van permissies, tenant-/HR-groep-/administratiescope, effectieve datums, confirmed-employmentchecks, provenance en `SOURCE_GAP` is niet aangetoond. Het implementeren daarvan vereist een nieuwe Core source service en een volledige service-/autorisatie-/regressiesuite; dat is niet bewezen als veilige gerichte wijziging binnen deze meting. Een Core batch-RPC zou schema-/migratieontwerp en afzonderlijke autorisatie vereisen; Payroll Lab blijft apart. Hosted issue #39 blijft **OPEN**.

## PAY-W03-SOURCE-SNAPSHOT-OPT-05 — request-scoped catalogread-hergebruik (25-10-2026)

Deze aanvulling supersedeert de eerdere 790 Core-requesttelling voor de productcode op commit `a55b25fbc18459b0631ebc7f36104cd548deb866`. De worktree is de bestaande featurebranch `work/pay-w01-w03-defect-close-04-20261024`; W02, `main` en hosted TEST zijn niet gewijzigd.

### Oorzaak en veilige wijziging

De werkplek bouwt nog steeds **39 afzonderlijk geautoriseerde `getPayrollSourceSnapshot`-momentopnamen**. De bestaande runlijst levert employee-/employmentreferenties en runstatus, geen volledige actuele sourcepayload of version-vector. Er bestaat geen complete batchservice of Core-RPC waarmee die momentopnamen veilig kunnen worden vervangen. De aantoonbare redundantie zat in identieke, scopegebonden catalogreads die tijdens die 39 projecties herhaald werden, waaronder pension-version-tiers en gedeelde labor-condition-, job-/revision- en pensioenconfiguratie.

Een request-scoped React-cache deelt uitsluitend identieke catalogread-promises binnen één serverrender. De sleutels bevatten tenant, HR-groep, administratie en de gesorteerde selectors; de authenticated Supabase-query, bestaande scopefilters, kolommen, sortering, foutpad en `SOURCE_GAP`-gedrag blijven staan. De employee-specifieke timeline, autorisatie, effectieve-datumselectie, sourceversion-vector, hash en payrollsetup worden niet globaal gecachet. De pension-version-tier read heeft dezelfde scopefilters. Er is geen gedeelde/global cache, brede ongescopeerde read, schemawijziging of migratie.

### Bronketen en fingerprintgelijkheid

De tijdelijke requestmeting telde voor de volledige route vóór deze wijziging 790 Core-PostgREST-requests plus 41 reads via de aparte Payroll Lab-client: **831 totaal**. Na hergebruik waren dat 581 Core-requests plus dezelfde 41 Payroll Lab-reads: **622 totaal**, **209 minder (25,2%)**. Er werd geen Core-RPC aangeroepen. De 39 employee/employment-snapshots bleven 39; de wijziging dedupliceert herhaalde bronreads, niet de autorisatie- of momentopnamegrens.

Met dezelfde tijdelijke server-side sourcefasemeting daalde de waargenomen source wall time van **54.652 ms naar 12.921 ms**. Dit is geen garantie voor totale route-/browserlatentie. De huidige meting splitst Postgres-querytijd niet van server-/netwerkvertraging, en splitst response-serialisatie, body-transfer en post-optimalisatieprojectie niet afzonderlijk uit. Er is dus geen nieuwe, vergelijkbare postwijzigingsmeting voor elk van die subfasen.

Voor en na waren de geaggregeerde projecties gelijk: 39 bronregels en 39 bronhashes; identity `66fe1d9fb312d1c93409bcf954289cce415280b85c18bdcc641a8475cf9c2132`, source-hash `06715f14e59bc1f9fa01e9efa6901317ae82c1a2f8437eba4e9e4ba0dd05f93b`, version-vector `7a7687c73e0c7765c6fd2c917f4bdce738415ae878315e48028077eeadd8e2a6`, gap `b516cebfcc0d9ed2185990393f9ec5cb93c1b710e4461e24bb46fed877d3d935` en opgeslagen run/source/result `8e9af3dd73b36c1dd57771cae056b74258cc8c3f26a1607dd08fa589f8062608`. De interpretatie van effectieve bronnen, hashes, foutuitkomsten en resultaten veranderde niet.

### Lokale browsermetingen

Een geïsoleerde headless Chrome-context meldde via de bestaande `/local/sign-in` HR Admin aan; contextreadback bevestigde De Sterren holding / Planeten. Alle navigaties gebruikten `2026-10`. Per trial waren de run-ID-digest `069470e5acaf51d3cb0018f4f64a004e6478393de2c5a3fe12fd09e1abef7c1d` en employmentdigest `27a680bddbd977ce630296ee34e477774fe3434b31a1196cf6fa1e4dff3cda66` identiek; elke bevestigde werkplek had 14 runs en 39/39 medewerkerregels.

| Viewport | Trial | Documentgereed; werkplekbevestiging uiterlijk op dit tijdstip | HTTP | Browserrequests / fetch-XHR | Extra controles |
| --- | ---: | ---: | ---: | ---: | --- |
| Desktop 1440×900 | 1 | 44.877 / 45.071 ms | 200 | 13 / 1 | 14 runs, 39/39, geen overflow, geen onverwachte console- of page-error |
| Desktop 1440×900 | 2 | 44.270 / 44.453 ms | 200 | 12 / 1 | 14 runs, 39/39, geen overflow, geen onverwachte console- of page-error |
| Desktop 1440×900 | 3 | 58.575 / 58.790 ms | 200 | 12 / 1 | 14 runs, 39/39, geen overflow, geen onverwachte console- of page-error |
| 390×852 | 1 | 59.357 / 59.562 ms | 200 | 13 / 2 | 14 runs, 39/39, geen overflow, 2 niet-geclassificeerde console-errors, 0 page-errors |
| 390×852 | 2 | 18.554 / 18.738 ms | 200 | 12 / 1 | 14 runs, 39/39, geen overflow, geen onverwachte console- of page-error |
| 390×852 | 3 | 15.403 / 15.601 ms | 200 | 12 / 1 | 14 runs, 39/39, geen overflow, geen onverwachte console- of page-error |

De gemeten tweede waarde is een bovengrens: de harness wachtte eerst op `DOMContentLoaded` en bevestigde daarna het runlijst-/werkplekmarker en de 39 checkboxes. De eerder gelogde `listVisibleMs` is daarom **geen geldige zichtbaarheidstijd** en wordt niet als zodanig gerapporteerd. De 12–13 browserrequests zijn resources/fetches van Chrome en geen database-/PostgREST-/RPC-aantallen. De desktopwaarden en de eerste mobiele waarde zijn bovendien duidelijke uitschieters tegenover de twee laatste mobiele renders; uit zes metingen volgt geen p95.

Een nieuwe serverstart om die zichtbaarheidstiming te corrigeren werd geblokkeerd door de voorgeschreven launcher-preflight: deze shell meldde dat de centrale lokale TEST-config ontbreekt onder zijn `LOCALAPPDATA`. Er is geen fallback/configuratie gebruikt en geen configwaarde gelezen. De bezette/andere worktree-server is niet aangeraakt. Daarom blijft directe actuele `time-to-visible-list`-acceptatie OPEN.

### Security, bestaande records en kwaliteit

- De 188 gerichte tests in 24 bestanden slaagden: request-cache scope-/fail-closedtests, source-provider en Payroll lifecycle, authorization/scope, Retail R1/R2-oracle- en flowregressies, bestaande payslip- en runroutes.
- HR Suite TypeScript **PASS**; ESLint op de vijf gewijzigde source-/testbestanden **PASS**; `git diff --check` **PASS**.
- De volledige rootproductiebuild slaagde op Node `24.22.1`, lockfileblob `cdd20c601e5956b419b96d7a346b36ba5b1ce14b`, geïsoleerd via `LIQUIDHR_NEXT_DIST_DIR=.next/payrun01-acceptance-20261009`: HR Suite **339/339**, Control **12/12**, client-boundary, PDF renderer trace allowlist en vereiste runtime-assets **PASS**. Buildprovenance wees naar deze codecommit. De buildgegenereerde `next-env.d.ts` en Focus-widgetbron zijn exact naar hun HEAD-bytes teruggezet; config en dependencies zijn niet gewijzigd.
- Er is geen Payroll-write, runberekening, runlifecyclemutatie, PDF-write, migratie of gedeelde TEST-mutatie gedaan. Lisa’s eerdere PDF-hash `41a84b88ebd06b01eb49802002a14d20f7170eb58628bd884f6d8c5472f1e82a` en Manager-teamchecks zijn historische read-only evidence; ze zijn in deze follow-up niet opnieuw opgehaald. De gewijzigde service schrijft geen PDF- of runartefacten.
- Manager-/Employee-negatieve servicechecks vallen in de geslaagde autorisatieregressies; een actuele live Manager-/Employee-probe ontbreekt. De persona-catalogus heeft geen foreign-tenant-identiteit, dus die liveprobe blijft OPEN.

**Gate:** **W03 LOCAL PARTIAL** — het aantal requests en de geïnstrumenteerde sourcefase daalden aantoonbaar, de 14-run/39-medewerkerdataset en fingerprints bleven gelijk, maar de nieuwe full-document waarnemingen zijn traag/wisselend en een geldige `time-to-visible-list`-meting ontbreekt. De brede batchread is niet geïmplementeerd: die moet eerst aantoonbaar dezelfde per-medewerkerautorisatie, RLS, effectieve datums, provenance, version vectors, fingerprinting en geïsoleerde `SOURCE_GAP`-uitkomsten behouden. Als daarvoor een Core batch-RPC nodig blijkt, vereist die een apart schemaontwerp en afzonderlijke migratieautorisatie. **W01 LOCAL blijft PARTIAL; W01/W03 HOSTED en GitHub issue #39 blijven OPEN.** Geen push, merge, deployment, migratie of salarisfinalisatie.

## PAY-W03-SOURCE-SNAPSHOT-OPT-05 — hergebruik van income-links (25-10-2026)

### Bronketen en gerichte wijziging

- De route bouwt nog steeds één `getPayrollSourceSnapshot` per medewerker/employment: 39 afzonderlijke snapshots voor de bekende werkplek. Er is geen bestaande complete batchservice of Core-RPC gevonden.
- Binnen een snapshot werden de periodegescopeerde `employment_income_relationships`-links afzonderlijk gelezen door de employment-projectie en de tax-sourceprojectie. De tax-projectie had de benodigde link- en income-relationshipkolommen al onder dezelfde geauthenticeerde Core-client gelezen.
- Codecommit `ed1eb478ac839cf7273d11d67297241f1b65b756` voegt een kleine pure joinprojectie toe en laat de source provider die data hergebruiken als de bestaande employment-, link- en income-resultsets elk onder de huidige limiet van 100 rijen blijven en iedere target-link een income-relatie heeft. DRAFT-status, effectieve datums, link-/relatie-updated-at en volgorde blijven onderdeel van de bronprojectie.
- Bij een mogelijke truncatie, ontbrekende join, of tax-readfout wordt de bestaande per-employment-read als fallback gebruikt. De bestaande autorisatie, tenant-/HR-groep-/administratiefilters, bronvalidatie, hashes, version vectors en `SOURCE_GAP`-paden blijven behouden. Er is geen globale cache, brede ongefilterde query of Payroll-datawrite toegevoegd.

### Impact en grenzen van het bewijs

De laatste gemeten code vóór deze wijziging telde 581 Core PostgREST-requests plus 41 afzonderlijke Payroll Lab-reads per route. Bij 39 complete tax-linkprojecties schrapt de wijziging maximaal 39 dubbele Core-requests: code-afgeleid maximaal 542 Core + 41 Payroll Lab; de requestreductie op de huidige dataset is **niet** live gemeten. Dit verandert het aantal snapshots niet en lost de resterende per-medewerker bronreadketen niet volledig op. Er wordt geen nieuwe bronfase- of volledige-werkplekduur geclaimd.

De bestaande voor/na-fingerprints en 14-run/39-medewerkercontrole uit de eerdere follow-up zijn van commit `a55b25fbc18459b0631ebc7f36104cd548deb866`; zij zijn geen post-`ed1eb478`-livegelijkheidbewijs.

### Kwaliteit en runtimeblokkade

- Gerichte Payroll-, autorisatie-, lifecycle-, Employee-berekening- en Retail R1/R2-regressies: **69/69 PASS** over zes bestanden. TypeScript, ESLint op de vier gewijzigde code-/testbestanden en `git diff --check`: **PASS**.
- De volledige rootproductiebuild is op codecommit `ed1eb478ac839cf7273d11d67297241f1b65b756` uitgevoerd in `LIQUIDHR_NEXT_DIST_DIR=.next/payrun01-acceptance-20261009`: HR Suite **339/339**, Control **12/12**, Payroll client-boundary scan, PDF-renderer-tracecontroles en buildprovenance **PASS**. Node was `24.22.1`; lockfileblob `cdd20c601e5956b419b96d7a346b36ba5b1ce14b`.
- De geautoriseerde provisioning/launchercontrole verifieerde de bestaande lokale TEST-config als hardlink en de Development-preflight slaagde. De serverstart op vrije poort `51624` stopte daarna veilig: Next rapporteerde de bestaande `.next/dev`-lock van PID `11092` in deze worktree, hoewel `51518` vanuit deze uitvoeringscontext geen listener/HTTP-antwoord had. Een tweede startpoging met een aparte `LIQUIDHR_NEXT_DIST_DIR` raakte dezelfde lock. Geen proces, lock of andere server is gestopt of gewijzigd.
- Daarom zijn na `ed1eb478` geen geauthenticeerde desktop-/390px-runs, live 14/39-/fingerprintcontrole of Manager-/Employee-/foreign-tenant-browserprobes uitgevoerd. De oorspronkelijke `next-env.d.ts` en Focus-widgetbytes zijn na de rootbuild naar hun vooraf vastgelegde HEAD-hashes teruggezet; dependency- en runtimeconfiguraties zijn niet gewijzigd.
- Geen bestaande FINALIZED-run of PDF, gedeelde TEST-data, payroll lifecycle, schema of migratie is gewijzigd.

**OPT-05-gate:** **W03 LOCAL PARTIAL; actuele end-to-end performanceacceptatie HOLD.** De dubbele linkread is veilig begrensd aangepakt en de rootbuild slaagt, maar de bredere bronreadketen en postwijzigingsperformance zijn niet live geverifieerd. W01 LOCAL blijft PARTIAL. W01/W03 HOSTED en GitHub issue #39 blijven OPEN. Issue #39 vereist nog een bevoegde HR Admin in production-like TEST, drie of meer afzonderlijke `/payroll/runs`-metingen voor first-visible en volledig gestreamde werkplek, bron-/datasetattributie en een afgesproken budget of concrete uitzondering; PDF-/toegangscontrole en deployment-smoke horen bij een latere productie-release. Geen push, merge, deployment, migratie, gedeelde TEST-write of salarisfinalisatie.

## PAY-W03-SOURCE-SNAPSHOT-OPT-05 — post-ed1 live browser- en bronfingerprintcontrole (25-10-2026)

De gemeten productcode is commit ed1eb478ac839cf7273d11d67297241f1b65b756; alleen de acceptatiedocumentatie wordt hierna gewijzigd. De bestaande lokale server op 51518 is hergebruikt. Een geïsoleerde browser meldde via /local/sign-in aan als de bestaande HR Admin en gebruikte De Sterren holding / Planeten / Jupiter BV voor periode 2026-10. De metingen waren read-only.

### Browsermatrix en datavolledigheid

| Viewport | Trial | Runlijst zichtbaar (ms) | Werkplek volledig (ms) | Browserresources | Resultaat |
| --- | ---: | ---: | ---: | ---: | --- |
| Desktop 1440×900 | 1 | 2338 | 19699 | 14 | 14 runs, 39/39 medewerkers |
| Desktop 1440×900 | 2 | 4632 | 18111 | 12 | 14 runs, 39/39 medewerkers |
| Desktop 1440×900 | 3 | 1772 | 18090 | 12 | 14 runs, 39/39 medewerkers |
| 390×852 | 1 | 2181 | 19408 | 12 | 14 runs, 39/39 medewerkers; geen overflow |
| 390×852 | 2 | 2061 | 15127 | 12 | 14 runs, 39/39 medewerkers; geen overflow |
| 390×852 | 3 | 1979 | 16996 | 12 | 14 runs, 39/39 medewerkers; geen overflow |

Tegenover de eerder gerapporteerde lokale full-workspace-baseline van 27,7–46,6 s desktop en 78,2 s op 390px liggen deze on-geïnstrumenteerde post-ed1-renders op 18090–19699 ms desktop en 15127–19408 ms op 390px (ongeveer 18–20 s en 15–19 s). Het zijn afzonderlijke meetreeksen, geen gecontroleerde A/B-test; daarom wordt geen causale winst aan alleen income-linkhergebruik toegeschreven. De afzonderlijk geïnstrumenteerde sourcefase blijft variabel op 10699–33273 ms.

De browserresource-aantallen zijn geen database- of RPC-aantallen. De run-ID-, employment-ID- en gerenderde medewerker/resultaatdigests bleven over alle zes trials gelijk: b5025fa5528ddca6ecffe90f4fef8599e9a6542cbffe140d45548f7f968d9a72, 996525893bf7691f960c152e7dc725faaff8e7cc9aa49c3583e9aabf532ce21e en c4c6302420b8fad681e141d93f975efc204bc2201900004eb4063ac0eb31cc79. De 14 zichtbare lijstregels omvatten ook andere perioden; de huidige oktoberprojectie bevat 12 opgeslagen run-samenvattingen en 39 actuele medewerkerwerkitems.

### Bronfase en fingerprints

In een afzonderlijke tijdelijke servicefasemeting (los van de on-geïnstrumenteerde UI-matrix) registreerden zes voltooide reads elk 39 snapshots, concurrency 12 en nul fallback op de hergebruikte inkomenslinks. De gemeten bronfasetijden waren:

| Viewport/trial | Sourcefase wall time (ms) |
| --- | ---: |
| Desktop 1 | 13478 |
| 390px 1 | 12805 |
| Desktop 2 | 10699 |
| 390px 2 | 33273 |
| Desktop 3 | 24533 |
| 390px 3 | 24839 |

Deze sourcefase loopt over de bronrequests en projectie; zij scheidt Postgres-querytijd niet van PostgREST/serverwachttijd en netwerktransport. JSON-parsing en lokale providerprojectie waren in de eerdere requestinstrumentatie klein. Een afzonderlijk geïnstrumenteerde HMR-reeks had sterk afwijkende volledige-werkplekduur en is niet met bovenstaande gewone trials vermengd. Uit drie trials volgt geen p95.

Na commit ed1eb voerde tijdelijke hash-only instrumentatie nog twee desktop- en twee 390px-service-reads uit. Per read waren 39/39 actuele sourcehashes aanwezig en werden 39 werkitems geprojecteerd. De geaggregeerde bronfingerprint was op beide viewports gelijk: 2c03532ae27c52f7422f51e3173aafb41cf53b561aa70e7e8035b058571efafa. De geaggregeerde opgeslagen run-/input-/resultaatfingerprint was eveneens gelijk: 7361351a095f25f1b0cffafa64931d229f38b01f52a44925b13cb3709e86b8bc. In de periodeprojectie hadden 9 van de 12 opgeslagen runs een resultHash; de drie zonder resultHash bleven in de fingerprint opgenomen met hun status. Alleen aantallen en digests zijn tijdelijk vastgelegd; geen ruwe identifiers, bronpayloads of loonbedragen. De tijdelijke code en het hashlog zijn verwijderd; payroll-cycle-service.ts is exact naar HEAD hersteld.

### Bronreads en resterende bottleneck

De 39 afzonderlijk geautoriseerde source snapshots blijven bestaan. Na cataloghergebruik was eerder 581 Core PostgREST-requests plus 41 Payroll Lab-reads per route direct gemeten (622 totaal). De tijdelijke source-providerlog bevestigde op zes voltooide reads hergebruik van de inkomenslinks voor 39/39 medewerkers en nul fallback. Daarmee zijn na ed1 maximaal 39 Core-requests vermeden: 542 Core plus 41 Payroll Lab, 583 totaal, is een code-afgeleide schatting en geen nieuwe HTTP-interceptie. De historische pre-catalogreadbasis was 790 Core plus 41 Payroll Lab, 831 totaal. Er was geen Core-RPC.

De structurele bottleneck is nog steeds de fan-out van de employee/employment-specifieke timelines en actual-work-bronlezingen; de geïnstrumenteerde source wall time bleef 10699–33273 ms. Het PayrollSourceProvider-contract ondersteunt alleen getPayrollSourceSnapshot(input). Die service autoriseert elk employeeId afzonderlijk, controleert expliciete tenant/HR-groep/administratie en bevestigde periode-overlappende employment, en bouwt per medewerker de effectieve datums, sourceVersionVector, fingerprint en SOURCE_GAP-uitkomsten. Er bestaat geen complete Payroll-batchprovider of Core-batch-RPC.

De code bevat wel getActualWorkBulkProjectionForAuth, maar die route is geen equivalent Payroll-bronbatch: hij begint met alle actieve medewerkers in de HR-groep, kiest één werkurentype en DAY/PERIOD-granulariteit, en selecteert regels op het bij die granulariteit horende periodeveld. getActualWorkPayrollProjection selecteert daarentegen per expliciet employee-/employment-paar alle relevante regels met posting_period_start voor de loonmaand, laadt alle daarbij gebruikte werkurentyperij en periodestatus, en laat status-/goedkeuringsinformatie intact. De bulkroute kan dus niet zonder inhouds- en autorisatieverschil als Payroll-sourceprovider worden hergebruikt.

Een nieuwe code-only batch blijft technisch denkbaar. De veilige contractgrens is een begrensde lijst expliciete employee-/employment-paren: eerst voor ieder doel de bestaande permissionchecks uitvoeren en bevestigen dat tenant, HR-groep en administratie identiek zijn; daarna dezelfde authenticated RLS-client gebruiken met expliciete scopes en exacte paarselectie; vervolgens iedere resultaatrij terugpartitioneren per paar en de bestaande effective-date-, provenance-, version-vector-, fingerprint- en SOURCE_GAP-projecties behouden. Pariteitsbewijs moet 39/39 bronhashes en resultaten, ongeldige employment, per-medewerker autorisatieweigering, foreign tenant, limiet/paginering en foutisolatie omvatten. Dit batchcontract is niet geïmplementeerd of bewezen; als die garanties niet binnen begrensde table reads passen, vereist een Core read-only batch-RPC schemaontwerp en afzonderlijke migratieautorisatie. Geen batchservice of migratie is in dit resultaat toegevoegd.

### Security, kwaliteit en gates

- De bronfingerprintmeting gebruikte alleen de bestaande HR Admin-scope. Manager-teamnegatieven en Lisa’s Employee-selfscope/PDF blijven historische lokale PASS; zij zijn in deze aanvullende run niet opnieuw uitgevoerd. Er is geen bestaande foreign-tenantpersona beschikbaar; die liveprobe blijft OPEN. De gerichte autorisatieregressies zijn inbegrepen in de 69/69 tests op codecommit ed1eb.
- TypeScript, gerichte ESLint en git diff --check waren PASS op de ongewijzigde codecommit. De rootproductiebuild in dezelfde werkende buildcontext als W02 was PASS: HR Suite 339/339 en Control 12/12, inclusief Payroll client-boundary, PDF-trace en buildprovenance.
- Geen Payroll-write, nieuwe berekening, lifecyclewijziging, FINALIZED-run/PDF-wijziging, migratie of gedeelde TEST-mutatie. Configuraties en dependencies zijn niet gewijzigd; apps/hr-suite/next-env.d.ts bleef bytegelijk.

**Gate:** W03 LOCAL **PARTIAL/HOLD**. De gerichte hergebruikoptimalisatie, 14-run/39-medewerker-volledigheid, viewportgelijkheid en geaggregeerde bron-/resultaatfingerprints zijn bevestigd. De oorspronkelijke grote fan-out is echter niet vervangen door een batchread en de bronfase blijft variabel. W01 LOCAL blijft **PARTIAL** (Jaaps bestaande conceptpreview is OPEN); W01/W03 HOSTED en issue #39 blijven **OPEN**.

GitHub issue #39 is read-only opnieuw gecontroleerd op 25-10-2026 en blijft OPEN, zonder comments. De hosted gate vraagt een bevoegde HR Admin in production-like TEST met actor-/scopecorroboratie, minstens drie herhaalbare hosted list-first-visible- en complete-workspace-metingen met contextuele latency ranges, volledigheidsbewijs en bronattributie van de trage fase, plus een afgesproken performancebudget of expliciete uitzondering. PDF-/toegangscontrole en deployment-smoke volgen pas bij een afzonderlijk geautoriseerde toekomstige release. Er is geen issuecomment geplaatst.

## PAY-W03-SOURCE-SNAPSHOT-OPT-05 — begrensde bronbatch en heracceptatie (25-10-2026)

### Werkcontext en root cause

- De opdracht noemde begin-HEAD `a6e48e20c6056840f50c398aa8470f81d1b5567e`. De bestaande worktree stond bij aanvang al op `38e98f339b38354637954b0daa59e6d8ccddd52d`, een descendant met eerdere W03-code- en acceptatiecommits; `a6e48e20` is ancestor. Er is niet gereset of van branch gewisseld. De W02-integratiebranch is niet aangeraakt.
- De werkplek heeft 39 expliciete employee-/employment-paren en blijft 39 afzonderlijke canonieke `PayrollSourceSnapshot`s maken. Er was geen bestaande complete Payroll-batchreader of Core-RPC. De dubbele kosten zaten in de bronketens binnen die snapshots: tax/IKV las vijf tabellen per medewerker en Actual Work las medewerkeritems en typen per medewerker, met dezelfde maandstatus telkens opnieuw opgevraagd.
- De nieuwe reader groepeert tax-/IKV-bronnen in groepen van vier medewerkers en Actual Work in groepen van vier exacte employee-/employment-paren. De gedeelde periodestatus wordt eenmaal per request gelezen; iedere medewerker wordt eerst door de bestaande Payroll-autorisatie gecontroleerd. Taxreaders bevestigen daarnaast dezelfde geautoriseerde tenant, HR-groep en administratie. Query's gebruiken de bestaande authenticated Supabase-client/RLS en expliciete scope-, employee-, employment- en effectieve-datumfilters. Resultaten worden per medewerker of exact paar teruggepartitioneerd.
- Voor 39 doelen verlaagt de taxread van 39×5 = 195 naar 10×5 = 50 requests (145 minder). De Actual Work-regressiefixture daalt van 39 itemreads + 1 gedeelde periode + 39 type-reads = 79 naar 10 itemgroepen + 1 periode + 10 typegroepen = 21 (58 minder). Dit zijn code-/fixture-aantallen, geen telling van alle live routeverzoeken. De volledige bronmomentopnamen blijven 39. Er is geen globale salaris-/persoonscache, onbegrensde parallelisatie, RPC, schemawijziging of migratie toegevoegd; overlimiet-/foutpaden vallen terug op de bestaande individuele reader.

### Bronfasemeting en latency

Een afzonderlijk geïnstrumenteerde normale `/payroll/runs`-request bevatte 39 ingevoerde, geautoriseerde en geprojecteerde snapshots. Binnen de `getPayrollSourceSnapshots`-bronfase telde de wrapper 367 Core `/rest/v1`-requests en 187.588 responsebytes; geen Core-RPC. Dit meet alleen die bronfase en is daarom niet rechtstreeks vergelijkbaar met de historische telling van 790 Core-requests voor de volledige route; Payroll Lab gebruikt een aparte client die in deze wrapper niet meetelt.

| Geïnstrumenteerde bronfase | Tijd |
| --- | ---: |
| Timeline-/tax-batchfase | 15.687 ms |
| Actual Work-batchfase | 324 ms |
| Snapshotsetup en projectie | 1.642 ms |
| Totale bronfase | 17.711 ms |

`Server-Timing` en upstream-querylatency ontbraken. De verzamelde response-header-wachttijd (384.644 ms opgeteld over parallelle fetches) en bodyreadtijd (6.784 ms opgeteld) zijn geen individuele request-wall-times. De meting kan Postgres-uitvoering niet scheiden van netwerk-/serverwachttijd en heeft JSON-parsing niet afzonderlijk geklokt. De resterende trage stap is de employee-/employment-specifieke timelinefase; de nieuwe batch beperkt de dubbele tax-/Actual Work-fan-out maar elimineert die timeline niet.

### Geauthenticeerde browserheracceptatie

De bestaande lokale TEST-launcher startte de app op vrije poort `51625`; een geïsoleerde headless Chrome-context gebruikte de bestaande HR Admin-login en dezelfde tenant, HR-groep, administratie en oktoberperiode. Alle zes normale metingen gaven HTTP 200, 14 runs, 39/39 medewerkerregels, geen overflow en geen page-error. De runlijst- en werkplekdigests bleven respectievelijk `f74829800d9514fedf331de135b8af3d72a9307a39768688c95ad613939e9556` en `f9fe800aaec1f1dd2c8b7b779304fc727146899d54f13758bd73520d17a49dea` op elke trial.

| Viewport | Trial | Runlijst zichtbaar | Volledige werkplek | Runs | Medewerkers |
| --- | ---: | ---: | ---: | ---: | ---: |
| Desktop 1440×900 | 1 | 2.605 ms | 17.767 ms | 14 | 39/39 |
| Desktop 1440×900 | 2 | 2.157 ms | 12.990 ms | 14 | 39/39 |
| Desktop 1440×900 | 3 | 2.063 ms | 11.835 ms | 14 | 39/39 |
| 390×852 | 1 | 1.676 ms | 13.093 ms | 14 | 39/39 |
| 390×852 | 2 | 1.813 ms | 12.642 ms | 14 | 39/39 |
| 390×852 | 3 | 10.602 ms | 29.781 ms | 14 | 39/39 |

Vergeleken met de opgegeven werkplekmeting vóór deze wijziging (27,7–46,6 s desktop en 78,2 s mobiel) waren alle zes normale renders sneller. De afzonderlijk gemeten bronfase was 17,711 s. Dit zijn geen gecontroleerde A/B-trials en er is geen p95 berekend; de mobiele uitschieter en de nog trage timelinefase blijven relevant. De live interface toont geen individuele source-/result-hashes. De providerregressies vergelijken batch- en individuele snapshots wel op sourcehash, canonical hash, version vector en `SOURCE_GAP`-uitkomsten; live cross-viewport vergelijking bevestigt de gelijke 14/39 dataset en bovenstaande geaggregeerde digests.

### Security, kwaliteit en resterende grenzen

- De 26 gerichte testbestanden slaagden **209/209**. Dit omvat batchpartitionering, mixed-scope fail-closed, uitgesloten niet-geautoriseerde medewerkers, Employee-self-/cross-employee-afwijzing, Manager zonder Payroll-adminscope en Retail R1/R2-oracles/flows. Een bestaande foreign-tenantpersona ontbreekt; een live foreign-tenant-probe is dus OPEN. Manager-teamdossier was eerder lokaal PASS (in-team 200, buiten-team dossier en salaris 404) en is in deze meting niet opnieuw via de browser uitgevoerd.
- TypeScript, ESLint op gewijzigde Payroll-service-/testbestanden, i18n (43 NL/EN namespaces) en `git diff --check`: **PASS**.
- De root `npm run build` slaagde op codecommit `1f1124c1932aebb5f0c5f2943e62ec68d5b2695c`, Node `24.22.1`, met dezelfde geïsoleerde buildcontext als W02 en de bestaande guarded TEST-config: HR Suite **339/339**, Control **12/12**, Payroll client-boundary, PDF/function-trace en buildprovenance **PASS**. Configwaarden zijn niet getoond; dependencies/configuraties zijn niet aangepast.
- Beide `next-env.d.ts`-bestanden zijn bytegelijk aan hun beginstand; de HR Suite SHA-256 bleef `1B59D4C6B83807DB275D43F3CF2CC8E9323F465FAB764EEA091CC5BECD5BAD37`. De door de launcher gegenereerde Focus-widgetbron is naar de vastgelegde HEAD-versie teruggezet.
- Geen bestaande run/PDF, Payroll lifecycle, gedeelde TEST-data, migratie, account/grant, push, merge of deployment is gewijzigd.

**Gate:** **W03 LOCAL PARTIAL** — de bounded batch verlaagt aantoonbaar bronrequest-fan-out en de normale desktop-/mobiele werkplekmetingen zijn sneller en volledig. De timelinefase blijft 15,7 s in de ene gescheiden bronmeting; database-uitvoering en netwerk/serverwachttijd zijn niet los te meten en er is geen live foreign-tenantpersona. **W01 LOCAL blijft PARTIAL**; deze wijziging raakt geen W01-contracten. **W01/W03 HOSTED en issue #39 blijven OPEN.** Voor hosted issue #39 zijn nog nodig: een bevoegde hosted HR Admin met actor-/scope-readback; minstens drie hosted `/payroll/runs`-trials met first-visible, volledige 14/39-dataset en fase-attributie; een afgesproken latencybudget of expliciete uitzondering; en, bij een later afzonderlijk geautoriseerde release, PDF-/toegangssmoke en deployment-smoke. Geen roadmap-wave gestart.

### Aanvullende hosted-gate controle (25-10-2026)

- Read-only `git ls-remote origin refs/heads/main` bevestigt `630df89c84bc2be4774072d387ecb5dc7df10f91`. Read-only Vercel-deploymentmetadata noemt voor alias `liquid-hr-hr-suite.vercel.app` deployment `dpl_EoR4bf4pjsuJA53aRwQ1nDfcME8K`, READY, Git-ref `main` maar bron-SHA `1c4eb3d1bfe75d8145b87484125fcfcb6605aacf`. Die deployment-SHA wijkt af van zowel actuele `origin/main` als deze featurebranch; hosted codeprovenance is daarom niet gelijkgesteld aan de lokale OPT-05-code.
- Er was in deze geïsoleerde uitvoering geen hosted HR Admin-sessie. De bestaande persona-preflight met `-SkipBrowser` faalde gesloten omdat `LOCALAPPDATA` naar de sandboxruntime wees en de vereiste centrale lokale TEST-configuratie daar ontbrak. Geen credentialwaarde is gelezen of getoond; geen hosted login, sharelink, Vercel-bypass of appdata-write is uitgevoerd. Dit levert geen nieuwe hosted actor-/scope- of performance-evidence op.
- De actuele open actie blijft: een bevoegde bestaande HR Admin via de normale hosted `/login`-flow beschikbaar hebben voor actor-/scope-readback en ten minste drie hosted metingen. Voor bewijs op de OPT-05-code moet de hosted deployment bovendien die exacte code bevatten; daarvoor is buiten deze opdracht een afzonderlijk releasemandaat nodig. De provenance-afwijking tussen de huidige Vercel deployment en `origin/main` moet vóór gebruik van die hosted deployment worden verklaard.
