# LIQUIDHR-PERFORMANCE-RECOVERY-01 — metingen en acceptatie

**Status: PARTIAL / HOLD.** Geauthenticeerde desktop- en mobiele kernflows, scopechecks en één opgeslagen PDF zijn gecontroleerd; de code verlaagt de desktopwerkplekmediaan in deze kleine lokale reeks met 1.200 ms. De mobiele reeks is instabiel en live vergelijking van looncomponenten/sourceversionvectors ontbreekt. Geen run/finalize, TEST-datawrite, merge of deployment uitgevoerd. De acceptatiegrenzen staan hieronder.

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

## Diagnose en nameting

Tijdelijke serverinstrumentatie in dezelfde scope mat vóór de wijziging een bron-snapshotfase van 8.515 ms binnen een werkplekcyclus van 9.660 ms. In een tweede probe liepen de timeline- en tax-/IKV-batches opeenvolgend in 5.914 en 1.873 ms; de gezamenlijke snapshotfase bedroeg 10.665 ms. Er waren 39 afzonderlijke lifecycle-reads, 39 openingssaldo-reads en 61 reads van `employments` over de geïnstrumenteerde route. De cumulatieve requesttijden zijn geen wall-clocktijd en kunnen netwerk, gateway en database omvatten; database-executie is niet afzonderlijk gemeten.

De wijzigingen starten de twee bestaande W03-bronbatches gelijktijdig, bundelen de reeds per medewerker geautoriseerde dienstverbanddirectories en bundelen de lifecycle-historie. De laatste twee batches controleren scope en volledigheid en vallen bij onvolledige resultaten terug op de oorspronkelijke individuele readers. Er is geen globale cache of schemawijziging. In een instrumenteerde proef na de wijzigingen waren er 26 `employments`-reads en 2 lifecycle-reads; de directoryfase bedroeg 717 ms. De 39 openingssaldo-reads bleven ongewijzigd; deze lopen via de gedeelde `loadPayrollSetup`-providerroute die binnen het actieve W04-werk valt. Die code is volgens de scopegrens niet gewijzigd. Vergelijkingen van afzonderlijke timingproeven zijn indicatief door netwerkvariatie.

De nametingen hieronder zijn zonder de tijdelijke serverinstrumentatie uitgevoerd, met dezelfde scope, periode, browser en meetdefinitie als de baseline. De server was bij de eerste desktopmeting al gecompileerd; die eerste visit is daarom niet vergelijkbaar met de cold-serverbaseline.

| Viewport | Type | Runlijst ms | Volledige werkplek ms | Documentcommit ms |
|---|---|---:|---:|---:|
| Desktop 1440×900 | Eerste browserload, server warm | 2644 | 11779 | 2025 |
| Desktop | Warm 1 | 2561 | 13234 | 1721 |
| Desktop | Warm 2 | 1998 | 11558 | 1935 |
| Mobiel 390×852 | Eerste browserload, server warm | 2020 | 11778 | 1953 |
| Mobiel | Warm 1 | 9317 | 19370 | 8690 |
| Mobiel | Warm 2 | 2040 | 11054 | 1967 |

Warme mediaan/langzaamste: desktoplijst **2279,5/2561 ms**, desktopwerkplek **12396/13234 ms**; mobiele lijst **5678,5/9317 ms**, mobiele werkplek **15212/19370 ms**. Tegenover de twee warme baselineproeven is de desktopwerkplekmediaan 1.200 ms lager; de runlijst en mobiele medianen zijn in deze kleine reeks hoger. De mobiele uitschieter is behouden. Er is geen bewijs van een stabiele algemene latencywinst of van de gevraagde streefwaarden.

Alle zes nametingen: HTTP 200, 14 runs, 39 medewerkers, geen waargenomen responsefouten of page-errors en geen horizontale overflow. De medewerker-, samenvattings- en viewportgebonden runlijstfingerprints waren gelijk aan de baseline. Browser-API-responseaantallen waren 12–15 per meting; dit zijn geen server-REST-tellingen. De initiële documenttransfer was ongeveer 42–45 KB gecomprimeerd en 323–329 KB gedecodeerd; browserresources meldden circa 3,2–3,3 MB transfer per navigatie. De browsermetingen isoleren JavaScript/hydration niet van de streamingrespons.

## Aanvullende browser- en autorisatiecontroles

- HR Admin selecteerde in de UI de bestaande periode `2026-10`, zag 39 medewerkers en opende Lisa's bestaande definitieve run. Een warme detailnavigatie duurde 8.332 ms; voor deze route is geen vergelijkbare actuele voormeting vastgelegd.
- De bestaande PDF-viewer haalde het opgeslagen artifact op met HTTP 200, 33.174 bytes en SHA-256 `41a84b88ebd06b01eb49802002a14d20f7170eb58628bd884f6d8c5472f1e82a`, gelijk aan het historische [integratiebewijs](PAY-W02-W03-W04-INTEGRATION-20261025.md). Er is geen PDF gegenereerd of opgeslagen.
- Terug naar de runlijst en via de normale schakelaar naar Mars BV: contextselectie HTTP 303; daarna werkplek HTTP 200, tien medewerkerregels, 12.977 ms. Dit is één aanvullende meting en geen voor/na-vergelijking.
- Op mobiel is Mars BV eenmaal via de zichtbare administratiekeuze bevestigd. Een afzonderlijke herhaling bereikte de zichtbare keuzelijst maar liep bij het indienen vast vóór bevestiging van de POST; de mobiele Mars-werkplekmeting blijft OPEN. De mislukte poging is behouden, niet uit de timings gefilterd.
- Verse `/login` voor de bestaande Manager bevestigde de serverrol `DIRECT_MANAGER` en Planeten/Jupiter. De directory bevatte zes teamleden; een bekend teamlid gaf HTTP 200, een buiten de lijst gelegen medewerker HTTP 404.
- Verse `/login` voor Lisa bevestigde dezelfde identiteit en gekoppelde medewerker, maar de feitelijke actieve rol was `DIRECT_MANAGER`. Haar eigen Payroll-PDF gaf HTTP 200 en dezelfde 33.174 bytes/hash; Jaaps loonstrook gaf HTTP 404. Dit is dus geen Employee-rolbewijs. Er zijn geen rollen of rechten gewijzigd.
- Verse `/login` voor de afzonderlijke Employee-fixture bevestigde de identiteit en actieve rol `EMPLOYEE` in Planeten/Jupiter. De eigen medewerkersread gaf HTTP 200 en Lisa's dossierread HTTP 403. De tijdelijke, uitsluitend lokale rol-instrumentatie is na deze checks verwijderd.

De volledige vergelijking van bruto/netto, werkgeverskosten, pensioen/fiscale componenten en live source hashes/version vectors vóór en na is nog niet afgerond. De bestaande DOM- en PDF-hashes bewijzen die gegevens niet afzonderlijk. Mobiele Mars-werkplekmeting, stabiele mobiele latencyverbetering en de gevraagde streefwaarden blijven OPEN; overall is dit geen volledige performance-acceptatie.

## Finale lokale kwaliteitschecks

- De vijf geraakte Payroll-testbestanden: **75/75 PASS**. HR Suite TypeScript-typecheck en ESLint voor de negen gewijzigde Payroll-code-/testbestanden: **PASS**.
- Volledige HR-suite: **754 testbestanden PASS, 4 SKIP, 1 FAIL; 3.783 tests PASS, 8 SKIP, 2 FAIL**. Beide failures zitten in het ongewijzigde `apps/hr-suite/supabase/migrations/20261024150000_employee_directory_scope_hardening.contract.test.ts`, dat vaste ingesprongen SQL-tekst verwacht terwijl de ongewijzigde migratie de replacementtekst anders inspringt. Die migration/testpaden zijn niet aangepast; dit is geen wijziging in deze Payroll-diff. De suite is niet herhaald na deze geconstateerde mismatch.
- Productiebuild: **PASS** op codecommit `e86483b3323274cdc4d2167a7972abe46b661ab4` via de bestaande Production-buildlauncher. Next.js-compilatie, TypeScript, 343 prerendered pages, Payroll client-boundary scanner, function traces en buildprovenance slaagden. Er is geen server gestart, push gedaan of deployment aangemaakt.
- Eindverdict performanceacceptatie blijft **PARTIAL / HOLD** door mobiele instabiliteit, ontbrekende mobiele Mars-werkplek- en live bron-/bedragenpariteit en het niet halen van stabiele gevraagde streefwaarden. De twee onafhankelijke migration-contracttestfailures zijn open voor de repositorybasis; er is geen code buiten deze Payroll-diff aangepast om ze te omzeilen.
- Branch `work/liquidhr-performance-recovery-01-20261028` is gepusht; [Draft PR #53](https://github.com/EdwinCycling/LiquidHR/pull/53) staat open tegen `main`. Opeenvolgende GitHub-readbacks gaven wisselende `mergeable`-waarden (`false` en `true`); de lokale niet-muterende `git merge-tree`-simulatie tegen de ongewijzigde `main` eindigde zonder conflicten. Bij de remote readback waren geen hosted workflow-runs of statuschecks aanwezig. Geen merge of deployment.
