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

Branch `work/pay-w01-w03-defect-close-04-20261024`, gestart op `a6e48e20c6056840f50c398aa8470f81d1b5567e`; geen W02-branch of andere worktree geopend.

### Bronketen en gerichte wijziging

De 39 `getPayrollSourceSnapshot`-aanroepen blijven bestaan; er is geen tweede Payroll-architectuur, database-RPC of schemawijziging toegevoegd. Elke aanroep startte daarnaast een herhaalde employments-directoryread en een tweede employment-read voor de IKV-projectie. Vier niet-medewerkergebonden reads werden per medewerker herhaald: `labor_condition_pension_arrangements`, de actuele `actual_work_periods`-rij, Payroll-administratie en Payroll-werkgeversconfiguraties. De salaris-, contract-, rooster-, fiscale, IKV-link-, actual-work-entry- en openingscumulatiefreads blijven medewerkergebonden.

De provider slaat de directoryread over als de geautoriseerde caller al een exact `employmentId` meegeeft. De normale, tenant-/HR-groep-/administratie-/medewerkergescopeerde bronprojectie levert en valideert daarna die employment; een ontbrekende of afwijkende rij blijft 404 en actual-work wordt pas na de scope- en effectieve-datumcontrole gelezen. De IKV-projectie hergebruikt uitsluitend diezelfde employment-rij en voert opnieuw `contract:read` en scopecontroles uit.

De vier herhaalde reads gebruiken `React.cache` met expliciete tenant-, HR-groep-, administratie- en periodeargumenten. Dit is request-scoped en bevat geen medewerkergebonden gegevens. De oorspronkelijke selecties, tenantfilters, sortering, limieten, effectieve datums, openingscumulatiefselectie en foutpaden blijven behouden. Op basis van de code zijn bij één 39-regelrequest **230 database/REST-reads minder te verwachten**: 39 directoryreads + 39 employment-lookups + 4 × 38 herhaalde gedeelde reads. Dit is een code-afleiding, geen gemeten post-run requestaantal; de 39 snapshot-aanroepen blijven gelijk.

### Performance en functionele gelijkwaardigheid

| Bewijs | Resultaat |
| --- | --- |
| Eerdere bronfase, concurrency 12 | **37.788 ms** en **56.922 ms**; lifecycle respectievelijk 3.131 ms en 1.684 ms |
| Eerdere volledige werkplek | Desktop **27.742–46.585 ms**; 390 px **30.842–41.281 ms** |
| Nieuwe bronfase / database-netwerk / serialisatie / projectie | **Niet gemeten**: de geïsoleerde Playwright-browser startte niet; geen postwijzigings-HTTP-meting beschikbaar |
| Baseline functionele manifest | 14 runs, 39/39 medewerkerregels; medewerkersdigest `27a680bddbd977ce630296ee34e477774fe3434b31a1196cf6fa1e4dff3cda66`; bronmanifest `6d5f6a2b5a7099fc7d401f757c81708f8d1185f85caf6b8581aa517ad372ea0c` |
| Postwijzigings dataset/fingerprints, desktop en 390 px | **Niet geverifieerd**; geen claims over identieke live dataset, 209/196-telling of prestatiewinst |
| Source-provider hashregressie | **PASS**: expliciete employment-ID-route levert dezelfde `sourceHash` als de vorige selectie, zonder directoryread |

De Playwright CLI kon na twee gerichte pogingen geen geïsoleerde browser starten. Headless Chrome en Edge eindigden beide in de afgeschermde Windows-sandbox bij Crashpad (`TransactNamedPipe`, fout `0x6D`); Edge meldde daarnaast een geweigerde elevatieservice. Er is geen browser-login, persona-switch, serverstop of derde browserpoging uitgevoerd. Bestaande localhost-servers zijn niet gewijzigd.

### Kwaliteitsgates en beschermde data

- **131/131 PASS**, 16 Payroll-/bron-/actual-work-/autorisatie-/strooktests, inclusief de bestaande Retail R1/R2-fixtureflow.
- HR Suite TypeScript `tsc --noEmit`: **PASS**; relevante ESLint: **PASS**; i18n: **43 namespaces gelijk**; `git diff --check`: **PASS**.
- Root `npm run build` op Node `24.22.1` en lockfileblob `cdd20c601e5956b419b96d7a346b36ba5b1ce14b`: command exit `0`; HR Suite compileerde en genereerde 339/339 pagina’s, Control genereerde 12/12. **De volledige rootbuild-gate blijft BLOCKED:** `verify-client-bundle.mjs` en `write-build-provenance.mjs` gebruiken hardcoded `apps/hr-suite/.next`, terwijl Next naar `.next/payrun01-acceptance-20261009` compileerde. De clientscan en provenance konden daardoor niet aan die verse HR Suite-build worden toegeschreven. Het provenance-postscript schreef wel `liquidhr-build-provenance.json` naar de standaard `.next` met de bestaande `BUILD_ID` en precommit-HEAD `a6e48e20`; de lokale `/local/sign-in` endpoint gaf daarna HTTP 200. Die actieve outputmap is niet opnieuw gebouwd of opgeschoond. Geen buildscript-, configuratie- of dependencywijziging gedaan.
- Beide `next-env.d.ts`-bestanden en de gegenereerde Focus-widgetbron zijn bytegelijk gebleven. Er zijn geen dependency-, configuratie-, auth-, RLS- of migratiewijzigingen.
- Geen databasewrite, berekening, finalisatie of PDF-read/-write. De eerder vastgelegde PDF-hash blijft historische evidence; deze follow-up heeft die PDF niet opnieuw opgehaald.

### Gatebesluit en resterend werk

- **W03 LOCAL: HOLD voor acceptatie** — codechecks en HR Suite/Control-compilatie slagen; volledige rootbuild-gate, postwijzigingsmetingen, requestaantal en desktop-/390px-datasetgelijkheid ontbreken. De 209/196-telling en de 13 items zijn niet opnieuw onderzocht.
- **Manager-scope: eerder lokaal PASS**; deze follow-up voerde geen nieuwe live Manager-, Employee- of foreign-tenant-probe uit. De gerichte autorisatietests slaagden.
- **W01 LOCAL: PARTIAL**; eerdere Lisa-PDF-/self-scope-evidence blijft staan, Jaaps conceptpreview blijft OPEN. **W01/W03 HOSTED: OPEN**.
- GitHub issue [#39](https://github.com/EdwinCycling/LiquidHR/issues/39) blijft open. Hosted closeout vereist nog een legitieme HR Admin in production-like TEST, drie actuele list-first-visible-/complete-workspace-metingen met bronattributie, een expliciet budget of gedocumenteerde uitzondering, en de bestaande PDF-/toegangscontrole plus deployment-smoke bij een toekomstige release.
- Geen push, merge, deployment, TEST-write, salarisfinalisatie of nieuwe roadmap-wave.
