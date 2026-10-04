# CAO-BENCH02 fase 2 — geïntegreerde kandidaat

**Stand: 2026-10-04 — PARTIAL, niet GREEN.** Na de finale provenance-/exact-runfixes zijn alle zeven benchmarkscenario's opnieuw via de geauthenticeerde browser uitgevoerd, persistent opgeslagen en per run-ID teruggelezen. H1, conceptloonstrook, echte K1- en K2-PDF/JSON-downloads met inhoudspariteit, desktop (1440×900), mobiel (393×852), bestaande Test Manager-/Test Employee-persona's en twee andere HR-groepen zijn gecontroleerd. De enige open acceptatiecontrole is een directe negatieve admin-naar-admin-proef over een tweede Payroll-enabled administratie; zo'n administratie bestaat niet in deze TEST-fixture en is niet nagebootst. De lokale labelcorrectie voor arrangementversie is gericht getest; typecheck, lint, i18n en productiebuild zijn opnieuw geslaagd. Er is niets gepusht, gemerged of gedeployed.

## Branch en grens

- Branch: `work/cao-bench02-20261003`.
- Basis-HEAD: `05b78d7c6b2dbed4d14648b78bf78b497ab1d337`, vanaf de exacte fase-1-code. De geaccepteerde fase-2-kandidaat was `c968e728c35f82ee56d4ef5c0ad642439111b9f7`; deze closeout bevat een gerichte UI-label/regressietest en bijgewerkte acceptatiedocumentatie op dezelfde featurebranch.
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

De waarden hieronder zijn onafhankelijke rekenoracles die door de ruletests zijn vergeleken. De onderstaande runs zijn na de laatste provenance-/exact-runfixes persistent opgeslagen, via hun exacte run-ID opnieuw in de browser geopend en via de database-readback gecontroleerd. De oudere historische runs zijn immutable gebleven:

| Case | TEST-status | Run-ID | Opgeslagen bruto |
| --- | --- | --- | ---: |
| K1 | SUCCEEDED | `81160d5e-6eac-4975-bfdb-a540911b8680` | €2.777,00 |
| K2 | SUCCEEDED | `4f5e6cc0-f12a-45c2-9be5-6ff61d1cb064` | €1.911,735632183908045976 (weergave €1.911,74) |
| R1 | SUCCEEDED | `a4a742c2-4df5-433b-8547-39d00c0a904e` | €4.767,20 |
| R2 | SUCCEEDED | `c1b92c72-210a-4c68-8e29-71b33e277bad` | €1.621,23 |
| B1 | SUCCEEDED | `8f00badc-14a6-4560-8d67-aa8961215b66` | €3.600,13; compa 100% |
| B2 | SUCCEEDED | `db194fd2-43cb-4784-ae7b-0c34f65afc07` | €2.912,00; compa 101,107366% |
| C1 | SUCCEEDED | `e2fc3d8f-4e04-4ae3-9cb7-1919a04b57f1` | €12.000,00 per maand |

De K1 readback bewaart arrangementversie `2026.07` apart van regelpackage-/regelversie `2026.01`; het zijn geen verwisselbare versievelden. De verse K1 input-, source-, result-, arrangement-package- en regel-packagehashes zijn respectievelijk `f3d1de111abb9138dd67f2adb2a5e59c5869c2256396ebdc9efe174d76ed6dec`, `a4b3a8ade09f317e049b0ca4cf296524a452fe1929523532d6c31c0d279c45b8`, `fec6054f3c7f0b4852ce2a251dd34ccfe3604a6409998e81562f41594c1705c2`, `6fd9984fdd5fb45b793d92230c6d3e52b0a048eb0dc1c4677bedb3e4e3a1cc0a` en `cb6fb9f2603293e82dd969970d11156127a03e6de7c614342a447ab7324720d3`. Heropening en readback reproduceerden deze provenance voor dezelfde run. De onafhankelijke brutoverificatie stemt met de opgeslagen resultaten overeen. Er is geen netto-uitkomst afgeleid of gepresenteerd.

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

- Op fase-2-kandidaat `c968e728c35f82ee56d4ef5c0ad642439111b9f7` slaagde de gehele relevante Payroll/UI/rules-selectie na de provenance-/exact-runfixes, serieel uitgevoerd: **37 bestanden PASS, 3 overgeslagen; 240 tests PASS, 3 overgeslagen**. Na de daaropvolgende lokale arrangementlabelcorrectie is de geraakte componenttest opnieuw uitgevoerd: **5/5 PASS**.
- HR Suite strict type-check: PASS.
- Rules package type-check: PASS.
- Volledige HR Suite ESLint: 0 errors; 6 bestaande warnings in `payroll-import/service.test.ts`, buiten deze wijziging. i18n-check: **41 NL/EN namespaces met gelijke sleutels**.
- De retail-test controleert de inhoudelijke source-SHA van `retail-mode.ts`, na normalisatie van de hashdeclaratie. De Kinderopvang-ruletest controleert dezelfde soort binding.
- ESLint op de aangepaste componenttest: PASS. NL/EN labels en sleutels zijn meegenomen in de i18n-check.
- Productiebuild na de arrangementlabelcorrectie: Next.js 16.3.6 compileerde, TypeScript slaagde, **309/309** statische pagina's gegenereerd; Payroll client-boundary negatieve controle geslaagd over 152 browserassets. De build-generator rapporteerde kandidaat-HEAD `c968e72`, de HEAD die gold vóór de lokale closeoutcommit.
- Launcher: één gecontroleerde verse Payroll TEST-start op vrije poort 3000 gebruikte `scripts/start-test-worktree.ps1` en de centrale TEST-configuratie. Alleen aanwezigheid van vereiste variabelen werd gerapporteerd; waarden bleven verborgen. `/login` gaf HTTP 200. Na de browseracceptatie is uitsluitend de eigen serverlistener gestopt; andere serverprocessen zijn ongemoeid gelaten. De door Next gegenereerde `next-env.d.ts` is schoon hersteld.
- LUNA MAX follow-up review op de aangebrachte fixes: geen resterende actionable P1/P2. De review omvatte exacte run-ID-doorvoer, case/run fail-closed controle, rule package ID/provenance en de Kinderopvang traceversie. De regressie-, type-, lint- en productiebuildgates zijn daarna opnieuw uitgevoerd.

## Browser- en securityacceptatie

TEST-HARNESS01 is niet blind samengevoegd met de featurebranch. De bestaande kandidaatserver is via de guarded launcher gestart; de harness werd als afzonderlijke acceptatieclient gebruikt. Een tijdelijke wegwerpkopie kreeg alleen kandidaat-specifieke verwachte markers/ID's en is na de run verwijderd. Er is geen harness- of parallelle featurebranch in deze kandidaat geïntegreerd. De bestaande Test HR Admin is gebruikt en de context is in de browser gecontroleerd als **De Sterren holding → Planeten → Jupiter BV**.

Alle zeven berekeningen hierboven zijn na de laatste codefixes in die Payroll-context via de echte browser uitgevoerd. Hun exacte runs zijn opnieuw geopend, status/resultaten zijn uit de persistente opslag teruggelezen en brutobedragen zijn met de onafhankelijke scenario-oracles vergeleken. K1 toont arrangement `2026.07` naast regelpackage/regel `2026.01`; K2 toont arrangement en regelpackageversie `2026.09`. De zeven actuele run-ID's zijn de waarden in de matrix hierboven.

H1 is herhaald zonder loonberekening: specialist met aanwezig bewijs **Mogelijk binnen scope**, bestuurder **Uitgesloten**, ontbrekend bewijs **Beoordeling nodig**. Geen nettoresultaat is afgeleid of getoond. De conceptloonstrook voor K1 en K2 toont de persistente run en brutoresultaten, benoemt de arrangementversie apart van de regelversie en houdt inhoudingen/netto als niet berekend.

Echte browserdownloads voor K1-run `81160d5e-6eac-4975-bfdb-a540911b8680` en K2-run `4f5e6cc0-f12a-45c2-9be5-6ff61d1cb064` zijn opgeslagen als bestanden met dezelfde run-ID in `C:\Users\Edwin\Downloads` (`cao-bench02-k1-...-validation-pack.pdf/.json` en `cao-bench02-k2-...-validation-pack.pdf/.json`). Per scenario zijn de PDF en JSON inhoudelijk vergeleken: case, exacte persistente run-ID, status, arrangementversie, regelpackage-/regelversie, brutototaal en result-/source-/input-hashes stemmen overeen. Beide PDF's hebben 13 pagina's; K1 heeft arrangement `2026.07` en regels `2026.01`, K2 heeft arrangement/regels `2026.09`. Beide bevatten `NIET VOOR LOONBETALING` en presenteren geen netto-uitkomst. De K1-hashes staan hierboven.

Browserweergave is gecontroleerd op desktop 1440×900 en mobiele viewport 393×852 (iPhone 16-afmetingen, browserviewport). Op beide formaten waren runstatus, bruto, conceptstrook en PDF/JSON-acties zichtbaar, zonder horizontale overflow; netto, inhoudingen en werkgeverslasten bleven niet berekend. De originele context is na de scopeprobes hersteld.

Negatieve controles gebruikten bestaande Test Manager- en Test Employee-persona's en bestaande geïsoleerde TEST-hr-groepen; er is geen account aangemaakt of rechtenescalatie uitgevoerd. Beide persona's kregen voor K1 `/geen-toegang`; de K1-export gaf respectievelijk HTTP 404 en HTTP 403. De bestaande Test HR Admin kreeg vanuit `TEST-MULTIGROUP` en `TEST-BOUNDARY` eveneens `/geen-toegang` en export-404. De admincontext is daarna teruggezet op Planeten → Jupiter BV en de K1-run werkte opnieuw. In deze TEST-configuratie is maar één Payroll-enabled administratie ingericht; daardoor ontbreekt uitsluitend de directe admin-naar-admin-proef op een tweede Payroll-administratie. De andere live negatieve persona- en groepsscopeprobes zijn wel uitgevoerd. De historische fase-1 shared-shell Core-read caveat blijft staan; deze acceptatie heeft geen Core-data uitgelezen.

**Eindstatus: PARTIAL, niet GREEN.** Berekeningen, persistente readbacks, H1, conceptloonstrook, werkelijke K1/K2-downloads en hun onderlinge inhoudspariteit, beschikbare rol-/groepscopeprobes, desktop/mobiel, gerichte regressie, typechecks, lint en productiebuild zijn bewezen voor de kandidaat. Het enige open punt voor de volledige gevraagde live autorisatiematrix is een bestaande tweede Payroll-enabled administratie. Die fixture ontbreekt en is bewust niet nagebootst; daarom is geen GREEN afgegeven. Geen nettoresultaat verzonnen, geen historische snapshot gewijzigd, geen Core-/CONTROL02-write, push, merge of deployment.
