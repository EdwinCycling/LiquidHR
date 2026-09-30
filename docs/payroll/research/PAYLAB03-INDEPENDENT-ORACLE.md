# PAYLAB03 — onafhankelijke fiscale oracle

Gecontroleerd op 2026-09-30. Deze oracle is vóór de productiecalculator geschreven,
importeert geen LiquidHR-code en gebruikt uitsluitend `decimal.Decimal` en officiële
Belastingdienst-bronnen. De verwachte bedragen zijn bovendien vergeleken met
rechtstreeks gelezen gepubliceerde maandtabelrijen. Productie-uitkomsten zijn geen bron.

## Officiële bronnen

- [Rekenvoorschriften januari 2026, versie 2](https://download.belastingdienst.nl/belastingdienst/docs/rekenvoorschriften_voor_geautomatiseerde_loonadministratie_lh991z62fd.pdf): titel p.1, versiebeheer p.3, annualisatie en Lv p.6–8, schijven p.9, AHK p.10, ARK p.12–13, X en aftopping p.13–14, tijdvakafronding p.15–16.
- [Parameterbijlage januari 2026](https://download.belastingdienst.nl/belastingdienst/docs/bijlage_rekenvoorschr_voor_geauto_loonadm_pdf_lh991b61fd.pdf): p.4, Nederland / jonger dan AOW / wit / Std.
- [Officiële witte maandtabel 2026 Nederland Std](https://download.belastingdienst.nl/belastingdienst/dl/rekenhulpen/loonheffing/2026/v01/pdf/wit_mnd_nl_std_20260101.pdf): januariversie, hieronder exact de gebruikte pagina's.
- [Officiële publicatiepagina](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/themaoverstijgend/brochures_en_publicaties/rekenvoorschriften-voor-de-geautomatiseerde-loonadministratie): op controledatum staat versie 2 als actuele 2026-download. Versie 2 corrigeert het tweedeschijftarief naar 37,56%.

Pagina's zijn de zichtbare PDFpaginanummers, niet nul-gebaseerde indexes.
Bronhashes en centrale versiepinning worden door de bronanalist vastgelegd.

## Scope en rekenroute

Nederland, jonger dan AOW, witte tabel, Std, volledige reguliere maand 2026,
geen aanvullende kortingen of uitzonderingen. Loon voor loonheffing is expliciet
de grondslag, niet impliciet het bruto. Referentie ondersteunt LHK ja/nee;
geen negatief loon en geen loon boven Lmax (133110 jaar / 11092.50 maand).

De auditcode [nl2026_reference.py](oracle/nl2026_reference.py) gebruikt aparte
Python-decimalberekening met jaarlijkse stap54, factor12, schijventarief met
gegeven cumulatieve bedragen13900/28752, X1 naar beneden op hele euro's, AHK naar
boven op hele euro's, elk ARK-product rekenkundig op5decimalen en ARK naar boven
op hele euro's. ARK-opbouw is cumulatief gemaximeerd op996,5300,5685. X wordt
niet negatief. Bij overmatige theoretische kortingen worden de kortingen verminderd
in bronvolgorde AOK,ARK,OUK,AHK; in deze jonge werknemersscope dus ARK vóór AHK.
Daarna jaarlijkse bedragen/factor12 rekenkundig op2decimalen.

De jaarlijks floored grondslag bepaalt zowel schijven als kortingen. Een raw
jaarloon net boven een wettelijke grens kan nog in dezelfde Lv54-rij vallen.
AHK wordt exact bij ahkg2 nul; ARK exact bij arkg4 nul (bronvoetnoten).

## Eerste case CC-NL-2026-001

Bruto regulier loon4000.00, geen pensioeninhouding, loon voor loonheffing4000.00.

| Stap | Onafhankelijke uitkomst |
| --- | ---: |
| Raw annualisatie4000 × 12 | 48000.00 |
| Jaarloon floor(48000/54) ×54 | 47952 |
| Maandtabelloon | 3996.00 |
| X1: floor((47952−38883) ×0.3756+13900) | 17306 |
| AHK: ceil(3115−(47952−29736) ×0.06398) | 1950 |
| ARK: ceil(5685−(47952−45592) ×0.06510) | 5532 |
| X:17306−1950−5532 | 9824 |
| Loonheffing:9824/12, rekenkundig centen | 818.67 |
| Verrekende arbeidskorting:5532/12 | 461.00 |
| Netto4000−818.67 | 3181.33 |

Dit stemt exact overeen met officiële maandtabel p.24, rij3996.00,
jonger dan AOW, met LHK. Zonder LHK geeft dezelfde rij1442.17.

## Onafhankelijke compliancecases

Alle21cases met tussenuitkomsten zijn bevroren in
[nl2026-expected.json](oracle/nl2026-expected.json). Uitvoering van de reference
heeft alle gevallen én de onafhankelijke maandtabelankers exact gecontroleerd.

| Case / grondslag | Lv-maandrij | Loonheffing | ARK | Tabelpagina |
| --- | ---: | ---: | ---: | ---: |
| Laag500.00 | 499.50 | 0.00 | 0.00 | 3 |
| Laag1000.00 | 999.00 | 13.83 | 83.67 | 6 |
| Midden3000.00 | 2997.00 | 386.83 | 458.17 | 18 |
| CC4000.00 | 3996.00 | 818.67 | 461.00 | 24 |
| Hoog9000.00 | 9000.00 | 3480.67 | 135.25 | 55 |
| AHK rawgrens2477.99 /2478.00 /2478.01 | 2475.00 | 177.17 | 448.00 | 15 |
| AHK effectieve stap2479.49 | 2475.00 | 177.17 | 448.00 | 15 |
| AHK effectieve stap2479.50 /2479.51 | 2479.50 | 178.83 | 448.08 | 15 |
| Afrondstap4000.49 | 3996.00 | 818.67 | 461.00 | 24 |
| Afrondstap4000.50 /4000.51 | 4000.50 | 820.92 | 460.67 | 25 |
| Rawschijfgrens6535.49 /6535.50 /6535.51 | 6534.00 | 2099.58 | 295.75 | 40 |
| Effectieve schijfstap6538.49 | 6534.00 | 2099.58 | 295.75 | 40 |
| Effectieve schijfstap6538.50 /6538.51 | 6538.50 | 2101.92 | 295.50 | 40 |
| Zonder LHK4000.00 | 3996.00 | 1442.17 | 0.00 | 24 |

Laag500.00 is bewust essentieel: theoretische ARK499jaar mag niet als verrekende
ARK worden getoond. X1=2142, theoretische AHK3115 overschrijdt X1 al; na aftopping
is AHK2142 en ARK0. De gepubliceerde tabel bevestigt dat.

## Auditstatus

Onafhankelijke bronafleiding en tabelcrosscheck: GREEN voor deze21cases.
Dit document accepteert op zichzelf geen productiecalculator of browserrun.
Een verschil met deze waarden blokkeert fiscale acceptatie totdat de officiële
bron en root cause het verschil verklaren. Geen fiscale dekking buiten de
expliciete witte/Std/onder-AOW/reguliere maandscope claimen.

Reproduceer uitsluitend de audit-oracle:

```text
python docs/payroll/research/oracle/nl2026_reference.py
```

De reference importeert geen engine, rule package, frontend, database of auth.
