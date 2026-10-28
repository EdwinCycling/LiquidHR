# LIQUIDHR-PERFORMANCE-RECOVERY-01 — metingen en acceptatie

**Status: PARTIAL / HOLD.** De bronhash-, versievector- en gap-pariteit is na een gerichte correctie bevestigd voor 39/39 medewerkers. De definitieve desktopnameting heeft twee warme proeven; de mobiele her-meting kwam niet voorbij administratiekeuze en blijft OPEN. Een stabiele algemene latencywinst, mobiele eindmeting en vergelijking van looncomponenten ontbreken. Geen run/finalize, TEST-datawrite, merge of deployment uitgevoerd. De acceptatiegrenzen staan hieronder.

## Baseline vóór productwijzigingen

- 28 oktober 2026. Geïsoleerde checkout van `origin/main` op `11ba924b4a726431ae7928cfd8d2201d738893b4`; Windows, Node 24.22.1, lokale Next.js development/webpack, Chrome headless. Core TEST `wnpfloqpjvaacobppbpk` en Payroll Lab TEST `jhgeriucbkfarxiudzfy` via de bestaande launcher en centrale TestRuntime-configuratie. Geen configuratiewaarden vastgelegd.
- Verse officiële `/login` met bestaande HR Admin-credentials; via de normale contextselectie De Sterren holding / Planeten / Jupiter BV gekozen. `/api/context` bevestigde deze scope; de bestaande persona-statuspagina bevestigde de werkelijke actieve rol `TENANT_ADMIN`. Per viewport een nieuwe browsersessie met afzonderlijke login. Periode `2026-10`; steeds 14 bestaande runs en 39 medewerkerregels. Geen run gestart of gefinaliseerd.
- `first-browser-load` is de eerste routevisit in een nieuwe browsercontext. De desktop-server compileerde de route bij deze eerste visit; bij de eerste mobiele visit was de server al warm. De andere metingen zijn herhaalde volledige navigaties in dezelfde context. Startpunt is `page.goto` naar `/payroll/runs?period=2026-10`; lijsttijd tot een zichtbare runlink, werkplektijd tot de zichtbare periodesamenvatting en de medewerkerregels. Dit is een lokale developmentmeting, geen productie- of hostedmeting.

| Viewport | Type | Runlijst ms | Volledige werkplek ms | Documentcommit ms |
|---|---|---:|---:|---:|
| Desktop 1440×900 | Eerste browserload, servercompile inbegrepen | 7138 | 17937 | 7048 |
| Desktop | Warm 1 | 1888 | 13148 | 1839 |
| Desktop | Warm 2 | 1704 | 14044 | 1651 |
| Mobiel 390×852 | Eerste browserload, server warm | 1834 | 12053 | 1777 |
| Mobiel | Warm 1 | 2609 | 12148 | 1925 |
| Mobiel | Warm 2 | 1866 | 11957 | 1798 |

Warme mediaan/langzaamste: desktoplijst **1796/1888 ms**, desktopwerkplek **13596/14044 ms**; mobiele lijst **2237,5/2609 ms**, mobiele werkplek **12052,5/12148 ms**. De mediaan van twee waarden is hun gemiddelde. Een mobiele cold-servermeting is nog niet uitgevoerd.

In alle zes metingen: HTTP 200, geen waargenomen browser-responsefouten of page-errors, geen horizontale overflow. De fingerprint van de 39 medewerkerregels was steeds `20015fd99be4357c673792727d4c99c79d2d3d0159741f6cb9214ad3ba8f5f62`; die van de samenvatting `3fb1ce00d623198d552b9a2aae0c92ca63650b6fb3aa4638a005e67663899c77`. De runlijstfingerprint bleef per viewport constant. Dit zijn DOM-vingerafdrukken, geen bewijs van bronhashes, PDF-bytepariteit of bedragen op alle detailroutes.

De eerste browserlogin bereikte zonder contextselectie een 409; de selectie is daarna normaal uitgevoerd en opnieuw bevestigd. Een eenmalige servermelding `JWT issued at future` trad vóór de geslaagde selectie op; de gemeten machineklok en de HTTP-datum van de Core TEST-endpoint waren gelijk. De oorzaak van die melding is niet vastgesteld.

## Diagnose en eerste nameting (kandidaat vóór hash-ordercorrectie)

Tijdelijke serverinstrumentatie in dezelfde scope mat vóór de wijziging een bron-snapshotfase van 8.515 ms binnen een werkplekcyclus van 9.660 ms. In een tweede probe liepen de timeline- en tax-/IKV-batches opeenvolgend in 5.914 en 1.873 ms; de gezamenlijke snapshotfase bedroeg 10.665 ms. Er waren 39 afzonderlijke lifecycle-reads, 39 openingssaldo-reads en 61 reads van `employments` over de geïnstrumenteerde route. De cumulatieve requesttijden zijn geen wall-clocktijd en kunnen netwerk, gateway en database omvatten; database-executie is niet afzonderlijk gemeten.

De wijzigingen starten de twee bestaande W03-bronbatches gelijktijdig, bundelen de reeds per medewerker geautoriseerde dienstverbanddirectories en bundelen de lifecycle-historie. De laatste twee batches controleren scope en volledigheid en vallen bij onvolledige resultaten terug op de oorspronkelijke individuele readers. Er is geen globale cache of schemawijziging. In een instrumenteerde proef na de wijzigingen waren er 26 `employments`-reads en 2 lifecycle-reads; de directoryfase bedroeg 717 ms. De 39 openingssaldo-reads bleven ongewijzigd; deze lopen via de gedeelde `loadPayrollSetup`-providerroute die binnen het actieve W04-werk valt. Die code is volgens de scopegrens niet gewijzigd. Vergelijkingen van afzonderlijke timingproeven zijn indicatief door netwerkvariatie.

De eerste nametingen hieronder zijn zonder tijdelijke serverinstrumentatie uitgevoerd, met dezelfde scope, periode, browser en meetdefinitie als de baseline. Ze horen bij de kandidaat vóór de later ontdekte hash-orderafwijking en zijn geen mobiele of desktop-eindmeting van de gecorrigeerde code. De server was bij de eerste desktopmeting al gecompileerd; die eerste visit is daarom niet vergelijkbaar met de cold-serverbaseline.

| Viewport | Type | Runlijst ms | Volledige werkplek ms | Documentcommit ms |
|---|---|---:|---:|---:|
| Desktop 1440×900 | Eerste browserload, server warm | 2644 | 11779 | 2025 |
| Desktop | Warm 1 | 2561 | 13234 | 1721 |
| Desktop | Warm 2 | 1998 | 11558 | 1935 |
| Mobiel 390×852 | Eerste browserload, server warm | 2020 | 11778 | 1953 |
| Mobiel | Warm 1 | 9317 | 19370 | 8690 |
| Mobiel | Warm 2 | 2040 | 11054 | 1967 |

Warme mediaan/langzaamste: desktoplijst **2279,5/2561 ms**, desktopwerkplek **12396/13234 ms**; mobiele lijst **5678,5/9317 ms**, mobiele werkplek **15212/19370 ms**. Tegenover de twee warme baselineproeven is de desktopwerkplekmediaan 1.200 ms lager; de runlijst en mobiele medianen zijn in deze kleine reeks hoger. De mobiele uitschieter is behouden. Er is geen bewijs van een stabiele algemene latencywinst of van de gevraagde streefwaarden.

Alle zes eerste nametingen: HTTP 200, 14 runs, 39 medewerkers, geen waargenomen responsefouten of page-errors en geen horizontale overflow. De medewerker-, samenvattings- en viewportgebonden runlijstfingerprints waren gelijk aan de baseline. Browser-API-responseaantallen waren 12–15 per meting; dit zijn geen server-REST-tellingen. De initiële documenttransfer was ongeveer 42–45 KB gecomprimeerd en 323–329 KB gedecodeerd; browserresources meldden circa 3,2–3,3 MB transfer per navigatie. De browsermetingen isoleren JavaScript/hydration niet van de streamingrespons.

## Bronhashpariteit en eindmeting na correctie

De eerste read-only vergelijking via de officiële HR Admin/Jupiter-worklist gaf 38/39 gelijke `sourceHash`-waarden; alle 39 versievectoren en gaps waren gelijk. De afwijkende canonieke source-contractreferenties waren beide `actualWorkType`; de batch las typen voor vier medewerkers samen en filterde daarna per medewerker. Daardoor kon de ongesorteerde referentielijst een andere volgorde krijgen dan bij de bestaande individuele reader, wat de hash veranderde zonder gewijzigde bronset of versievector.

De correctie behoudt de gebundelde entry-reads, maar haalt work-hour types per exacte medewerker-/dienstverbandinput op met dezelfde queryvorm als de individuele reader. De officiële read-only worklist vergeleek daarna **39/39 source hashes, 39/39 versievectoren en 39/39 gaps**. Tijdelijke parity-instrumentatie logde alleen aantallen en veld-/type-labels en is verwijderd. Deze A/B-probe deed extra individuele bronreads en telt daarom niet als latencymeting.

Definitieve desktop-hermeting na de correctie, twee warme proeven, dezelfde Jupiter-scope en meetdefinitie:

| Viewport | Type | Runlijst ms | Volledige werkplek ms | Documentcommit ms |
|---|---|---:|---:|---:|
| Desktop 1440×900 | Warm 1 | 1934 | 11043 | 1844 |
| Desktop | Warm 2 | 2017 | 12073 | 1901 |

De warme mediaan/langzaamste is **1975,5/2017 ms** voor de runlijst en **11558/12073 ms** voor de volledige werkplek. Tegenover de baseline zijn dat respectievelijk 179,5 ms hoger en 2.038 ms lager (circa 15%). Twee proeven bewijzen geen stabiele algemene winst of dat de gevraagde streefwaarden zijn gehaald.

De mobiele hermeting na de correctie is **OPEN**: de normale HR Admin-flow bereikte de administratiekeuze, maar de verwachte `/api/context/administration`-POST kwam niet binnen de timeout. Een eerdere herhaling had hetzelfde probleem; verdere retries zijn gestopt. De eerdere mobiele timings hierboven horen bij de kandidaat vóór de hash-ordercorrectie en zijn geen eindbewijs voor de gecorrigeerde code.

## Aanvullende browser- en autorisatiecontroles

- HR Admin selecteerde in de UI de bestaande periode `2026-10`, zag 39 medewerkers en opende Lisa's bestaande definitieve run. Een warme detailnavigatie duurde 8.332 ms; voor deze route is geen vergelijkbare actuele voormeting vastgelegd.
- De bestaande PDF-viewer haalde het opgeslagen artifact op met HTTP 200, 33.174 bytes en SHA-256 `41a84b88ebd06b01eb49802002a14d20f7170eb58628bd884f6d8c5472f1e82a`, gelijk aan het historische [integratiebewijs](PAY-W02-W03-W04-INTEGRATION-20261025.md). Er is geen PDF gegenereerd of opgeslagen.
- Terug naar de runlijst en via de normale schakelaar naar Mars BV: contextselectie HTTP 303; daarna werkplek HTTP 200, tien medewerkerregels, 12.977 ms. Dit is één aanvullende meting en geen voor/na-vergelijking.
- Op mobiel is Mars BV eenmaal via de zichtbare administratiekeuze bevestigd. Een afzonderlijke herhaling bereikte de zichtbare keuzelijst maar liep bij het indienen vast vóór bevestiging van de POST; de mobiele Mars-werkplekmeting blijft OPEN. De mislukte poging is behouden, niet uit de timings gefilterd.
- Verse `/login` voor de bestaande Manager bevestigde de serverrol `DIRECT_MANAGER` en Planeten/Jupiter. De directory bevatte zes teamleden; een bekend teamlid gaf HTTP 200, een buiten de lijst gelegen medewerker HTTP 404.
- Verse `/login` voor Lisa bevestigde dezelfde identiteit en gekoppelde medewerker, maar de feitelijke actieve rol was `DIRECT_MANAGER`. Haar eigen Payroll-PDF gaf HTTP 200 en dezelfde 33.174 bytes/hash; Jaaps loonstrook gaf HTTP 404. Dit is dus geen Employee-rolbewijs. Er zijn geen rollen of rechten gewijzigd.
- Verse `/login` voor de afzonderlijke Employee-fixture bevestigde de identiteit en actieve rol `EMPLOYEE` in Planeten/Jupiter. De eigen medewerkersread gaf HTTP 200 en Lisa's dossierread HTTP 403. De tijdelijke, uitsluitend lokale rol-instrumentatie is na deze checks verwijderd.

De batch-vs-individuele bronhash-/versievector-/gap-pariteit is bewezen voor de 39 bestaande medewerkers; een onafhankelijke vergelijking van bruto/netto, werkgeverskosten en pensioen-/fiscale componenten met opgeslagen berekeningen is niet uitgevoerd. De DOM- en PDF-hashes bewijzen die bedragen niet afzonderlijk. Mobiele eindmeting, mobiele Mars-werkplekmeting, stabiele algemene latencyverbetering en de gevraagde streefwaarden blijven OPEN; overall is dit geen volledige performance-acceptatie.

## Finale lokale kwaliteitschecks

- Na de hash-ordercorrectie: **68/68 gerichte tests PASS** over de werkbron, Payroll-sourceprovider en integratie; de werkbrontest slaagde ook opnieuw **14/14** op de schone codecommit. HR Suite TypeScript-typecheck en ESLint voor de twee gewijzigde code-/testbestanden: **PASS** (ESLint rapporteerde alleen de bestaande `no-html-link-for-pages`-waarschuwing).
- Volledige HR-suite op de eerdere performancekandidaat: **754 testbestanden PASS, 4 SKIP, 1 FAIL; 3.783 tests PASS, 8 SKIP, 2 FAIL**. Beide failures zitten in het ongewijzigde `apps/hr-suite/supabase/migrations/20261024150000_employee_directory_scope_hardening.contract.test.ts`, dat vaste ingesprongen SQL-tekst verwacht terwijl de ongewijzigde migratie de replacementtekst anders inspringt. Die migration/testpaden zijn niet aangepast; de volledige suite is na de latere hash-ordercorrectie niet herhaald.
- Productiebuild: **PASS** op definitieve codecommit `5b43acf3514b608364427908d754ef6d1973e0e7` via de bestaande Production-buildlauncher. Next.js-compilatie, TypeScript, 343 prerendered pages, Payroll client-boundary scanner, function traces en buildprovenance slaagden. De eerste sandboxrun stopte op Windows-junctionrechten; dezelfde build slaagde bij de toegestane retry. Er is geen server gestart, deployment aangemaakt of TEST-data gewijzigd.
- Eindverdict performanceacceptatie blijft **PARTIAL / HOLD** door de ontbrekende mobiele hermeting, ontbrekende onafhankelijke component-/bedragenvergelijking en het ontbreken van stabiele algemene latencywinst en bewezen streefwaarden. De twee migration-contracttestfailures op de eerdere kandidaat blijven open voor de repositorybasis; er is geen code buiten deze Payroll-diff aangepast om ze te omzeilen.
- Branch `work/liquidhr-performance-recovery-01-20261028` is gepusht; [Draft PR #53](https://github.com/EdwinCycling/LiquidHR/pull/53) staat open tegen `main`. Opeenvolgende GitHub-readbacks gaven wisselende `mergeable`-waarden (`false` en `true`); de lokale niet-muterende `git merge-tree`-simulatie tegen de ongewijzigde `main` eindigde zonder conflicten. Bij de remote readback waren geen hosted workflow-runs of statuschecks aanwezig. Geen merge of deployment.
