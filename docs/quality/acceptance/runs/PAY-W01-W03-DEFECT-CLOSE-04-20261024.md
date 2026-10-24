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

De werkplek vraagt voor 39 verschillende employee/employment-combinaties 39 afzonderlijke `getPayrollSourceSnapshot`-projecties. De huidige source-provider/Core-services hebben geen bestaande tenant-/administratiegescopeerde batchcontract; samenvoegen tot één brede read zou de afzonderlijke employee-autorisatie en effectieve-datumselectie omzeilen. De snapshots blijven dus 39. De verspilling zat in reads binnen elke snapshot: een onnodige employment-directoryread bij een exact meegegeven `employmentId`, een tweede employment-read voor de IKV-projectie, en vier gedeelde setup-/periodereads die tussen medewerkers gelijk zijn.

De provider slaat de directoryread over en hergebruikt dezelfde scoped employment-projectie voor IKV, met opnieuw `contract:read` en scopecontroles. De vier gedeelde reads gebruiken `React.cache` binnen het request, met tenant-, HR-groep-, administratie- en periodeargumenten; er wordt geen salaris- of medewerkerdata globaal gecachet. Tenantfilters, effectieve datums, bronversie, hashes, foutpaden en `SOURCE_GAP` blijven behouden. De reads verdwijnen of delen alleen waar de bestaande services dezelfde gegevens al veilig leveren. Bij 39 regels zijn **230 minder repository-readoperaties code-afgeleid** (39 directory + 39 IKV-employment + 4 × 38 herhaalde gedeelde reads); dit is geen geteld databaseverkeer. Een schemawijziging of migratie is niet nodig.

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
| Root productiebuild op dezelfde branch/buildcontext | **PASS** op Node `24.22.1` en lockfileblob `cdd20c601e5956b419b96d7a346b36ba5b1ce14b`; HR Suite 339/339 pagina’s en Control 12/12, inclusief client-bundlecontrole, provenance en trace-allowlist |
| Isolatie buildoutput | **PASS** met `LIQUIDHR_NEXT_DIST_DIR=.next/payrun01-acceptance-20261009`; geen sandboxfout/configuratieversoepeling |
| Beschermde bestanden | Beide `next-env.d.ts`-bestanden en Focus-widgetbron bleven bytegelijk |
| `git diff --check` | **PASS** na rapportupdate |

### Gatebesluit en resterend werk

- **W03 LOCAL: PARTIAL** — de serviceverbetering en end-to-end verbetering zijn lokaal aangetoond; 14 runs en 39/39 medewerkerregels zijn gelijk. Database/RPC-aantal, afzonderlijke database-/serialisatie-/projectietijden en live bron-/resultaatfingerprints zijn niet ontsloten. Live foreign-tenant-probe ontbreekt wegens afwezigheid van een bestaande persona/fixture.
- **W01 LOCAL: PARTIAL** — Lisa’s immutable PDF en self-scope zijn lokaal PASS; Jaaps preview blijft OPEN door de bestaande bron/inputgap. **W01/W03 HOSTED: OPEN**.
- GitHub issue [#39](https://github.com/EdwinCycling/LiquidHR/issues/39) blijft OPEN. Afzonderlijk nodig: geautoriseerde HR Admin op production-like TEST met actor/scope-readback; drie hosted herhaalmetingen met bronattributie en volledige inhoud; een overeengekomen performancebudget of gedocumenteerde uitzondering; en bij een latere release de PDF-/toegangscontrole en deployment-smoke.
- Geen push, merge, deployment, TEST-write, salarisfinalisatie of nieuwe roadmap-wave.
