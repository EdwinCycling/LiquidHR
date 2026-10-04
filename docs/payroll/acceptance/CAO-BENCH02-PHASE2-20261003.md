# CAO-BENCH02 fase 2 — geïntegreerde kandidaat

**Stand: 2026-10-04 — PARTIAL, niet GREEN.** De oorspronkelijke browserrun heeft zeven scenario's persistent opgeslagen en uitgelezen; H1, K1-PDF/JSON, desktop (1440×900), mobiel (393×852) en een negatieve HR-groepscopeprobe zijn toen uitgevoerd. De onafhankelijke LUNA MAX-review vond daarna drie provenance-/exact-run regressierisico's, die gericht zijn hersteld en getest. Na deze fixes kon de browser geen Payroll-klantcontext openen: de zichtbare pagina meldde dat het account was ingelogd maar niet aan een klantomgeving was gekoppeld. Daarom zijn K1/K2 en de bijgewerkte PDF/JSON na de laatste fixes niet opnieuw browsermatig bewezen. Er is ook geen tweede Payroll-enabled administratie of aparte niet-adminfixture voor de live rol-/administratiescopeproef. Productiebuild en lokale codegates zijn geslaagd. De lokale fase-2-commit is gemaakt; er is niets gepusht, gemerged of gedeployed.

## Branch en grens

- Branch: `work/cao-bench02-20261003`.
- Basis-HEAD: `05b78d7c6b2dbed4d14648b78bf78b497ab1d337`, vanaf de exacte fase-1-code; fase-2-commit staat lokaal op de branch; geen nieuwe featurebranch.
- Worktree: `C:\Users\Edwin\Documents\Apps\LiquidHR-Payroll\CAO-BENCH02-20261003`; fase-2-wijzigingen zijn lokaal.
- Appversie blijft `1.20261002.1`.
- Geen push, merge, deployment, versieaanpassing, Core-/CONTROL02-schemawijziging of Core-write.
- `.env.local` is niet gelezen, gelogd, gekopieerd of gewijzigd.

## Parallelle bijdrage en integratie

| Slice | Bijdrage |
| --- | --- |
| Benchmarkinventaris | Alleen-lezen inventaris bevestigde behoud van 24 SYSTEM-componenten, 19 historische M0/NL-2026-runs en bestaande CUSTOMER_FORK-provenance. Geen historische rijen zijn verwijderd, gearchiveerd of herschreven. |
| Kinderopvang | Geversioneerde tabellen en K1/K2-regels, expliciete synthetische aannames, bronreferenties, implementatiehash en grens-/negatievetests. |
| Retail Mode | R1/R2-implementatie en onafhankelijke bron-/oraclecontrole. De review signaleerde ontbrekende zichtbare melding van de niet-berekende 8% vakantietoeslag en een labelhash; beide zijn in deze integratie gecorrigeerd. |
| Open bands en H1 | Synthetische bandentabel A–J met midpoint/compa-ratio, C1 via vrij overeengekomen loon en een losse Metalektro-HP-toepasselijkheidsfunctie met bewijsstatussen. |
| Calculation Experience | Responsieve conceptstrook, berekeningsdetails, technische trace en beveiligde PDF/JSON-validatiepackroute. |
| Integratie en review | Availability-/snapshotgrenzen en route-/servicegedrag zijn gecontroleerd. De LUNA MAX-review vond problemen met exacte runselectie en package-/traceprovenance; fixes en regressies zijn toegevoegd. De follow-up review vond geen resterende P1/P2. |

## Package- en scenariomatrix

De waarden hieronder zijn onafhankelijke rekenoracles die door de ruletests zijn vergeleken. De oorspronkelijke browserberekeningen zijn persistent opgeslagen en via exacte run-ID's uitgelezen vóór de laatste provenance-/exact-run fixes. Deze historische runs zijn immutable gebleven; de browserreadback is na de fixes niet herhaald:

| Case | TEST-status | Run-ID | Opgeslagen bruto |
| --- | --- | --- | ---: |
| K1 | SUCCEEDED | `e95853c9-09a9-4eb3-bab8-1c2c39c5ffea` | €2.777,00 |
| K2 | SUCCEEDED | `f303f748-26b0-4043-999e-d75ea9290ad8` | €1.911,735632183908045976 (weergave €1.911,74) |
| R1 | SUCCEEDED | `a4a742c2-4df5-433b-8547-39d00c0a904e` | €4.767,20 |
| R2 | SUCCEEDED | `92fbd917-a37e-4a72-a1fb-a588e47c1c6f` | €1.621,23 |
| B1 | SUCCEEDED | `93ea092a-ee5e-4dea-9e24-bec89ba0f4d5` | €3.600,13; compa 100% |
| B2 | SUCCEEDED | `c66bc758-6ae1-45da-9089-06b233164d92` | €2.912,00; compa 101,107366% |
| C1 | SUCCEEDED | `3f415a2d-22c5-4f14-af24-88f2cdb7758e` | €12.000,00 per maand |

De K1 readback bewaart arrangementversie `2026.07` apart van regelpackage-/regelversie `2026.01`; het zijn geen verwisselbare versievelden. De input-, source- en result-hashes van K1 zijn respectievelijk `21f868c3f7597220508ae52dd60b245d387a5e2e90360610b2a160bdf802563a`, `e4f058cc0544d0b221084728579b03b45e27f66c401db590ebbfb6fa94068255` en `58ba3f51bcde586bed62bd51535d3862d4e6da99534380b8e4af45c5ac76ac46`. De onafhankelijke brutoverificatie stemt met de opgeslagen resultaten overeen. Er is geen netto-uitkomst afgeleid of gepresenteerd.

| Case | Regeling en peildatum | Afgesproken synthetische scope | Bruto-oracle |
| --- | --- | --- | ---: |
| K1 | Kinderopvang, augustus 2026; salarisnummer 12, voltijd 36 uur | Schaal 6, 2026.01-maandtabel, één maand, geen zondaguren | €2.777,00 |
| K2 | Kinderopvang, september 2026; salarisnummer 12 | Schaal 6, versie 2026.09, 24/36 uur, vier zondaguren tegen 45% | Exact €1.911,735632183908045976; op scherm/PDF €1.911,74. Afzonderlijk afgeronde regels kunnen één cent afwijken van het afgeronde totaalcijfer. |
| R1 | Retail Non-Food branchemodule Mode, juli 2026 | I/15, bestaand werkelijk uurloon €28,90; 1,9% verhoging begrensd op juli-tabelmaximum | Oude-tabeluitkomst €4.758,96; juli €4.767,20 |
| R2 | Retail Non-Food branchemodule Mode, juli 2026 | C/1, 24/38 uur; twee expliciet samenvallende uren voor de best-of-premiumproef | Basissalaris €1.605,79 + toeslag €15,44 = €1.621,23 |
| B1 | Synthetische bedrijfsregeling, open band F, juli 2026 | Voltijd 40 uur op het midpoint; midpoint wordt HALF_UP op €20,77 vastgelegd | €3.600,13 per maand; compa-ratio 100% |
| B2 | Synthetische bedrijfsregeling, open band F, juli 2026 | €21,00 per uur, 32/40 uur; compa-ratio op vastgelegd midpoint €20,77 | €2.912,00 per maand; compa-ratio 101,107366% |
| C1 | Synthetische bedrijfsregeling, juli 2026 | CEO-fixture met €12.000 individueel overeengekomen maandloon, zonder band of trede | €12.000,00 bruto per maand; €144.000 alleen als twaalfmaandsindicatie |
| H1 | Afzonderlijk Metalektro-HP-voorbeeld, geen loonberekening | Hogere specialist met bewijs: mogelijk binnen scope; bestuurder: uitgesloten; ontbrekend bewijs: beoordeling vereist | Geen loonbedrag |

Het open-bandenpakket is uitdrukkelijk een **LiquidHR-bedrijfsbeleid**. Alleen de gepubliceerde minimum-/maximum-uurbedragen worden als brondata gebruikt. Midpoint, urenconversie, compa-ratio en fixtures zijn synthetisch; de bron-cao wordt niet toegepast op de demo. Het model voert geen automatische salarisaanpassing uit.

Retail ondersteunt uitsluitend de volwassen Mode-rijen C/1 en I/15. Het brutoresultaat sluit nu expliciet de 8% vakantietoeslag en feestdagentoeslag uit in de UI, JSON en PDF. De R2-oracle veronderstelt de twee urenoverlap zoals vastgelegd in het scenario; de aggregaatinvoer is geen algemene rooster-/urenverdelingsadapter. E-commerce-nachturen zonder tijdvakverdeling zijn fail-closed.

De pinnende identiteiten per laag zijn niet allemaal dezelfde string: K1 selecteert de administratieve arrangementversie `2026.07` (vanaf juli beschikbaar), maar de toepasselijke schaal-6/salarisnummer-12-maandtabel en calculation rule blijven `2026.01` omdat deze cel in de gepubliceerde 2026-jan-versie ongewijzigd is; K2 gebruikt arrangement- en tabelversie `2026.09`. Retail selecteert arrangementversie `2026.07`; het rules-package en de rule gebruiken versie `2026.7`, terwijl de rule-input als tabelselector `retail-non-food/2026.07` vastlegt. De snapshot- en rule-packagehashes binden hun eigen versiecontext; die velden mogen niet als één versie-ID worden geïnterpreteerd.

## Bronnen en toepassingsgrenzen

- Kinderopvang: [officiële salarisschalen 2025–2026](https://www.kinderopvang-werkt.nl/sites/fcb_kinderopvang/files/2025-04/Bijlage-2-Salarisschalen-Cao-Kinderopvang-2025-2026.pdf) bevatten de maandbedragen, urenbasis 36 uur en september 2026-bedragen; de [integrale cao-tekst](https://www.kinderopvang-werkt.nl/sites/fcb_kinderopvang/files/2025-06/Cao-Kinderopvang-2025-2026-integraal.pdf) is de referentie voor urenbasis, zondagtoeslag en toepasselijkheidsvoorwaarden. K1/K2 implementeren alleen scale 6 / salary number 12 en de genoemde synthetische ureninvoer; interimvoorwaarden en echte juridische toepasselijkheid zijn niet geïmplementeerd.
- Retail: [januari 2026 cao](https://www.inretail.nl/wp-content/uploads/2026/02/260121-Cao-Retail-Non-Food-januari-2026-def.pdf) en [juli 2026 cao](https://www.inretail.nl/wp-content/uploads/2026/05/260527-Cao-Retail-Non-Food-juli-2026-def.pdf) leveren de Mode-tabelcellen. De [Inretail-uitleg over de juli-verhoging](https://www.inretail.nl/kennisbank/personeel/loontabellen-cao-retail-non-food-per-1-juli-2026/) bevestigt 1,9%; de juli-cao beschrijft maandconversie, begrensde loonaanpassing, uurtoeslagen en 8% vakantietoeslag. Alleen de expliciet benoemde R1/R2-cellen/regels zijn geactiveerd.
- Open bands: [Staatscourant 2026, nr. 11183](https://zoek.officielebekendmakingen.nl/stcrt-2026-11183.html) publiceert de januari- en juli-basisuurloonminima/-maxima voor groepen A–J. De regeling neemt uitsluitend die grenzen over als synthetische bedrijfsreferentie.
- Metalektro HP: regels linken naar de twee versiebronnen [Staatscourant 2026, nr. 14650](https://zoek.officielebekendmakingen.nl/stcrt-2026-14650.html) en [Staatscourant 2026, nr. 22083](https://zoek.officielebekendmakingen.nl/stcrt-2026-22083.html). H1 is alleen een synthetische bewijs-/toepasselijkheidstest; titel of salaris alleen geeft geen uitkomst.

## Payroll Lab TEST-reconciliatie en behoud

Project `jhgeriucbkfarxiudzfy` is uitsluitend de afzonderlijke Payroll Lab TEST-database. Fase-1-migratiehistorie is niet herschreven; de beperkte forward-only migraties `20261003140000_paylab06_audited_availability_start` en `20261003180000_paylab06_benchmark_fixture_codes` zijn daarop toegepast en door readback gecontroleerd.

Readback vóór de zeven berekeningen: 3 beschikbare nieuwe pakketten; 7 synthetische arrangementtoewijzingen; 8 compositiesnapshots (waaronder beide Kinderopvang-versies); 19 bestaande run-/source-/input-/trace-/golden-case-ankers; 136 componentresultaten en 112 controls. De 19 historische berekeningen blijven 12 M0 en 7 NL-2026. Daarna zijn de zeven hierboven vermelde CAO-BENCH02-runs persistent opgeslagen en via run-ID en database-readback gecontroleerd. Huidige assignment- en snapshotrijen verwijzen uitsluitend naar Payroll Lab-fixtures.

RLS staat aan op de vier arrangementtabellen; policies beperken toegang tot `service_role`. Arrangement-FK's verwijzen niet naar Core. Readback/advisor gaf geen nieuw arrangementtableprobleem. De eerder bestaande advisor-waarschuwingen over twee mutable-search-pathfuncties, `rls_auto_enable()`-execute grants en ongeïndexeerde legacy Payroll Lab-FK's zijn niet door deze slice gewijzigd.

## Verificatie uitgevoerd

- Gehele relevante Payroll/UI/rules-selectie na de gerichte reviewfixes, serieel uitgevoerd: **37 bestanden PASS, 3 overgeslagen; 240 tests PASS, 3 overgeslagen**.
- HR Suite strict type-check: PASS.
- Rules package type-check: PASS.
- Gewijzigde HR Suite TS/TSX ESLint-scope: 0 errors; JSON en packagebestanden zijn door die app-config genegeerd. i18n-check: **41 NL/EN namespaces met gelijke sleutels**.
- De retail-test controleert de inhoudelijke source-SHA van `retail-mode.ts`, na normalisatie van de hashdeclaratie. De Kinderopvang-ruletest controleert dezelfde soort binding.
- Gewijzigde HR TS/TSX ESLint-scope: 0 errors. `git diff --check`: PASS.
- Productiebuild: Next.js 16.3.6 compileerde, TypeScript slaagde, **309/309** statische pagina's gegenereerd; Payroll client-boundary negatieve controle geslaagd over 152 browserassets.
- Launcher: één gecontroleerde verse Payroll TEST-start op vrije poort 3000 gebruikte de centrale TEST-configuratie. De probe meldde alleen dat vereiste variabelen aanwezig waren; waarden bleven verborgen. `/login` gaf HTTP 200. Alleen de eigen listener en launcher zijn daarna gestopt. De lijst met overige listenerendpoint-/PID-paren bleef vóór en na identiek; poort 3010 is gesloten. De door Next gegenereerde `next-env.d.ts` is na de build schoon hersteld.
- LUNA MAX follow-up review op de aangebrachte fixes: geen resterende actionable P1/P2. De review omvatte exacte run-ID-doorvoer, case/run fail-closed controle, rule package ID/provenance en de Kinderopvang traceversie. De regressie-, type-, lint- en productiebuildgates zijn daarna opnieuw uitgevoerd.

## Browser- en securityacceptatie

Vóór de reviewfixes heeft de geauthenticeerde Test HR Admin-browser alle zeven exacte runroutes geopend in de oorspronkelijke Planeten-hr-groep. Desktop en mobiel toonden de toenmalige brutoresultaten, `Netto salaris / NIET BEREKEND` en exportlinks met dezelfde run-ID; H1 toonde toepasselijkheidsstatussen zonder berekening of conceptstrook. Na de fixes is de route opnieuw geopend, maar de pagina eindigde op `/geen-toegang` met de zichtbare melding dat de ingelogde gebruiker niet aan een klantomgeving was gekoppeld. Dit is geen algemene loginanalyse: het betekent dat de actuele K1/K2-resultaten en exports niet in de browser zijn herbevestigd.

Vóór de reviewfixes is K1 als echte PDF- en JSON-download getest. Die inhoud bevatte destijds `SUCCEEDED`, de run-ID, arrangement `2026.07`, regel `2026.01`, €2.777,00 bruto en geen nettoresultaat; de PDF was 13 A4-pagina's. C1 validatiepack-API gaf toen HTTP 200 voor JSON en PDF. De service is intussen gericht aangepast voor exacte historische runselectie en correcte arrangement-/regelpackageprovenance. De eerdere downloadbewijzen gelden daarom niet als heracceptatie van de bijgewerkte exports; die downloads moeten nog in een actieve Payroll-context worden herhaald en onderling vergeleken.

Voor een live negatieve scopeproef is naar een andere HR-groep gewisseld. De Payroll-route werd daar geweigerd (`/geen-toegang`) en de validatiepack-API gaf `404 PAYROLL_VALIDATION_PACK_UNAVAILABLE`. Dit bewijst de HR-groepsgrens voor deze gebruiker. De actieve context bood geen tweede Payroll-enabled administratie of aparte niet-admin-Testgebruiker; daarom is de volledige live rollen-/administratiescope-matrix **niet bewezen**. Geautomatiseerde permissie- en scope-regressies slagen, maar vervangen dat live bewijs niet. De fase-1 shared-shell Core-read caveat blijft historisch staan; deze CAO Payroll-routetest heeft geen Core-data uitgelezen.

**Eindstatus: PARTIAL, niet GREEN.** Lokale regressies, typechecks, lint en productiebuild zijn na de fixes bewezen. De oorspronkelijke zeven persistente runs en browsermatrix zijn historisch bewijs van vóór de laatste provenance-/exact-run codewijzigingen. Actuele K1/K2-run-readback, bijgewerkte conceptloonstrook/PDF/JSON-pariteit en browsermatrix na de fixes blijven open doordat de browser geen Payroll-klantcontext had. Een tweede live administratie en aparte niet-adminidentiteit ontbreken eveneens. Er is geen nettoresultaat verzonnen; historische snapshots zijn niet gewijzigd. Geen Core- of CONTROL02-write, push, merge of deployment.
