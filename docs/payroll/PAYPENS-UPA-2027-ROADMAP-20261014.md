# PAYPENS / PAYUPA — pensioenregels, SIVI UPA 2027 en ontwikkelroadmap

**Vastgelegd:** 14 oktober 2026 · **Status:** ONDERZOCHT / GEPLAND — geen productcode, imports, migraties, salarisrun of fondsaanlevering gestart door dit document.

**Aanleiding:** door gebruiker aangeleverd extern werkboek `Regelingenoverzicht 2027 UPA C202704 SIVI.xlsx`. Het bevat pensioenregelingen van **Pensioenfonds PGB**, inclusief SIVI-UPA-velden, regelversies, percentages/contractverwijzingen en loon-/premiegrondslagdefinities. Dit is geen complete landelijke pensioenfondscatalogus en lost een PFZW-gegevensgat niet rechtstreeks op.

## 1. Brondata en datalocatie — niet verwarren met uitvoerbare rekenregels

De volledige, origineel aangeleverde data wordt **niet** automatisch in deze openbare GitHub-repository gepubliceerd; bronhouder/licentierechten zijn niet onafhankelijk vastgesteld. De bestanden staan in de privé ChatGPT Library onder:

`/LiquidHR/Payroll/Pensioen-UPA-2027/`

| Bestand in private Library | Rol |
| --- | --- |
| `Regelingenoverzicht 2027 UPA C202704 SIVI.xlsx` | Originele Excel, **ongewijzigd**; tabbladen `2027`, `Legenda`, `Versiebeheer`. |
| `LiquidHR_PGB_UPA_2027_brondata_snapshot.json` | Machineleesbare volledige bronrijen met oorsprongs-Excel-rijnummer, alle 33 kolomwaarden, legenda en volledige versiegeschiedenis; **referentie-only**. |
| `LiquidHR_Pensioen_UPA_2027_onderzoeksrapport.md` | Gedetailleerde dataprofilering, modelvoorstel, aandachtspunten en bronnen. |

**Bronintegriteit:** oorspronkelijke XLSX SHA-256 `fe842f4edad8368803dc0be903392a465c51883f60563cb8bae9c22ddb9965fd`. Bij daadwerkelijke implementatie moet de bouwagent de aangeleverde private bron opnieuw geautoriseerd verkrijgen; deze GitHub-verwijzing verleent op zichzelf geen toegang of herpublicatierecht.

**Structuur en dekking:** bronblad `2027!A1:AG155`; 136 regelvarianten (dus niet 136 pensioenfondsen). Versies: **57 × D202601**, **3 × C202703**, **76 × C202704**; daarmee **79 conceptregels voor 2027**. Geen `D2027`-versie aangetoond. `Legenda` specificeert o.a. `n.v.t.` bij niet-toepasbare velden, werkgeverafhankelijke varianten en markeringen; `Versiebeheer` bevat wijzigingen over meerdere jaren.

### Veldgroepen uit de bron (33 bronkolommen)

| Bronkolommen | Semantiek | Te bewaren in LiquidHR |
| --- | --- | --- |
| 1–8 | PUO, fonds, `RegKnmrk`, `RegVrnt`, omschrijving, deelnamevorm, collectief/nominatief, versie | `PensionSchemeCatalogVersion`: bronidentiteit, type, effective version, fonds/uitvoerder |
| 9–10 | Laatste wijzigingsdatum, ingangsdatum geldigheid | Immutable periode-/versiebeheer, provenance |
| 11–18 | Max regelingloon per periode/jaar, min premiegrondslag, franchise en berekenmethodes | `PensionAssessmentDefinition`: regels, cap, franchise, periodisering |
| 19–22 | Totaalpremie, werkgeversdeel, maximaal werknemersdeel, premieverhaal werknemersdeel | Gedifferentieerde `PensionContributionRule`, fiscale behandeling en werkgeverovereenkomst |
| 23–26 | Toetreding, einde opbouw/premie, gebroken tijdvak/deeltijd, primo/ultimo | Geschiktheid en tijdvakgebonden rekenmethodiek |
| 27–29 | Regelingloon `RegLn`, premiegrondslag `PremieGrslg`, pensioengevende uren `AantVerlUPens` | Getypeerde payroll-bases, niet automatisch gelijk aan bruto/werkuren |
| 30–33 | Aanvullende verlofinformatie, `OnrTsl`, `Prov`, generatieregeling | Variabele beloning, verlof-, uren- en generatieregelingsuitzonderingen |

De originele bronwaarden blijven ongewijzigd in de JSON-snapshot, inclusief Excel-datumserienummers, multiline vrije tekst en percentagevelden. Import **normaliseert alleen in staging**, met correct gevalideerde Excel-datumconversie en expliciet onderscheid tussen geldige cijfers, samengestelde regeltekst, `n.v.t.`, `actuarieel`, `zie overeenkomst` en `onbekend`.

### Verplichte validatiebevindingen

- Alle 79 conceptregels voor 2027 zijn **niet productie-actief**. Bronbeheerder/fonds moet definitieve tarieven, versies en toepasselijkheid bevestigen.
- Veel premieparameters zijn werkgever-/cao-specifiek: eerdere bronprofilering telde bij deze 79 conceptregels 17 zuiver numerieke totaalpremies, 51 contract-/cao-verwijzingen en 11 gemengde vrije tekstwaarden. Vermijd automatische `0%`-fallback.
- De reeks `U0557-4010` op Excelrijen 119–126 toont ingangsdatums 2–9 januari 2027. Markeer voor bronhouderreview; niet zelf stilzwijgend aanpassen.
- `D202601`-historie en `C2027..`-concepten staan op hetzelfde 2027-werkblad; de tabnaam is geen ingangsdatumbron.
- `OR1`/`OR2` hebben een optioneel rapportage-/financiële-administratiekarakter in sommige rijen; berekeningsnoodzaak en UPA-plicht zijn niet hetzelfde.
- Het ingevulde PGB-werkboek is niet onafhankelijk als officieel definitieve SIVI-tariefpublicatie gevalideerd.
- Deze catalogus is niet hetzelfde als Core-medewerker-/pensioentoewijzing of een bevestigde werkgeversovereenkomst.

## 2. Doelmodel — fondscatalogus gescheiden van pensioenberekening en UPA

1. `PensionSchemeCatalogVersion`: fondscodes/regelingkenmerk/variant, bronrevisie, effectieve versie, status en provenance, **zonder** automatisch operationele deelname toe te wijzen.
2. `EmployerPensionAgreementVersion`: wettelijke/contractuele toepasselijkheid, uitvoeringsafspraak, werkgever-/werknemerssplit, franchise, staffel, pensioenloonbegrip, tariefbron en geldigheid.
3. `EmploymentPensionAssignmentVersion`: gescopeerde, effectieve koppeling aan Core Employment en, waar nodig, IKV; primaire en compatibele aanvullende fondsverplichtingen expliciet modelleren.
4. `PensionAssessmentSnapshot`: loon, uren, arbeidsduur, verlof, regelingloon, cumulatieven, franchise, caps, prorata/primo/ultimo en gepinde bron-/contractversies.
5. `PensionContributionResults`: apart afgeronde werkgevers-/werknemerspremies, pensioencompensatie, sociale fondsen en fiscale loonstaatbehandeling met trace.
6. `UPASubmissionSnapshot`: latere adapter voor `RegKnmrk`/`RegVrnt`, aangifteperiode, XSD-validatie, fondsrespons, retries en correcties.

Hergebruik de bestaande Core-projecties voor pension assignments/arrangements, bestaande component graph engine en immutable Payroll Lab-persistentie; introduceer geen hardcoded PGB-case in de generieke rekenengine. Per scope expliciet `SOURCE_GAP`/`UNSUPPORTED` bij ontbrekende contract-/fiscale bron. Geen migratie of salarisresultaat zonder bestaande goedgekeurde datagates.

## 3. Roadmap en afbakening

| Wave | Volgorde | Concreet resultaat | Acceptatiegrens |
| --- | --- | --- | --- |
| **PAYFULL-01 / PENSION-INTEGRATION** | **Nu, in lopende bouwslag** | Enginecontracten/golden cases voor een bewezen deelnemerregeling: pensioengevend loon → grondslag → werknemers- én werkgeverspremie en fiscale/netto-consequenties. Gebruik de bron als **ontwerp-/tegenvoorbeeld**, niet als definitieve 2027-prijsbron. | Eén volledige voor de gekozen maand gevalideerde situatie; niet-complete cases blokkeren finalisatie. Niet wachten op heel UPA 2027. |
| **PAYPENS-CATALOG-01** | P1 | XLSX/JSON → **quarantaine-/stagingimport**, 33-veld mapping, diff, versie/status, bronhash, beheerreview, datavalidatie, termijnverloop. | Geen automatische activering. Fonds-/contracteigenaar bevestigt gebruikte tarieven. |
| **PAYPENS-CALC-01** | P1 | Generieke premie-/pensioengrondslagengine incl. franchise/cap, maand vs jaar, ouderdom/aanvulling, werknemer/werkgever, differentiatie, primo/ultimo, parttime en staffels. | Onafhankelijke officiële rule/oracle en correcties per ondersteunde regeling. |
| **PAYPENS-WTP-01** | P1 | Effective-dated transitie 2026→2027, werkgeverspecifieke overlap, opvolgers, acceptatie/controle. | Nooit historische finalized runs herschrijven; 2027-regels pas actief na geverifieerde definitieve bron. |
| **PAYUPA-01** | P2 | SIVI-UPA 2027 berichtopbouw/validatie, XML/XSD, foutafhandeling, beveiligde dossierstatus, proces voor ACK en correcties. | Eerst TEST; géén automatische inzending naar pensioenuitvoerder. |
| **PAYPENS-RECON-01** | P2 | Match berekende premie, aangegeven UPA en fondsfactuur; uitzonderingenbak. | Traceerbare verschillen en herstelworkflow. |
| **Meer pensioenuitvoerders** | Later | PFZW, PMT, PME etc. via dezelfde adapters, mits regelingbronnen en overeenkomst beschikbaar. | PGB-werkboek bewijst geen PFZW-waarden of landelijke dekking. |

**Belangrijke productregel:** geen zichtbare `synthetisch`, `fixture`, `benchmark`, `demo` of interne importcodes op gewone Payroll-schermen. Een nette business-UI mag wel professioneel ogen, maar niet doen alsof een niet-ondersteunde regeling geldig is. Beschikbaarheid, toepasselijkheid, berekeningsdekking en daadwerkelijke UPA-verzending blijven gescheiden aantoonbare statussen. Zie `AA-REQ §5`.

## 4. Wanneer aanvullende informatie nodig is

**Nu niet nodig:** het bronbestand ondersteunt architectuur, validatieregels en ontwerp van eerste pensionslices.

**Voor productiegeschikte tarieven / aangifte later wél relevant:** definitieve door PGB/SIVI bevestigde versie voor 2027; bronhouder of distributierechten; werkgever-/fondsuitvoeringsovereenkomst (voor `zie overeenkomst`); daadwerkelijke contract-/deelnemerkoppeling; onafhankelijke premievoorbeelden; en voor PFZW een eigen geverifieerde fondscatalogus. Vraag deze gegevens alleen bij de betreffende wave.

## 5. Externe standaarden — bij uitvoering opnieuw te verifiëren

- SIVI UPA: https://www.sivi.org/pensioen/uniforme-pensioenaangifte/
- SIVI UPA downloads en XSD: https://www.sivi.org/pensioen/uniforme-pensioenaangifte/upa-downloads/
- PGB werkgevers pensioenaangifte: https://www.pensioenfondspgb.nl/werkgevers/administratie/pensioenaangifte-met-upa/
