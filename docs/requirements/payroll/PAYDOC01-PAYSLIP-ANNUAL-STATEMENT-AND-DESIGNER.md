# PAYDOC01 — Payslip, Annual Statement and Document Design

**Status:** LEIDEND productrequirementsdocument; product implementation and legal acceptance remain separately evidenced<br>
**Scope:** payroll-generated payslips, annual statements, PDF rendering, employee access and distribution<br>
**Productregel:** [`PRODUCT_ENVIRONMENT_PARITY`](../../architecture/PRODUCT_ENVIRONMENT_PARITY.md)

## Productbesluit

Dezelfde payrollresultaten, werkgevergegevens, documentcomponenten, layout en lifecycle bepalen een loonstrook, ongeacht of LiquidHR lokaal, op TEST of in Production draait. De omgeving verandert de productpresentatie niet.

Een LiquidHR Standard-template wordt door LiquidHR onderhouden en is niet automatisch door een overheidsinstantie gecertificeerd. Templates tonen alleen data uit de vastgelegde bron-/resultaatsnapshot. Een technisch geslaagde berekening of PDF bewijst niet op zichzelf wettelijke volledigheid of compliance.

## Documenttypen en lifecycle

- `PAYSLIP` toont de gecontroleerde periode-uitkomst van een specifieke medewerker, dienstverband en toepasselijke IKV's.
- `ANNUAL_STATEMENT` wordt uit de correcte loonstaat-/jaaraggregatie en de vereiste werkgever-, dienstbetrekking- en IKV-groepering opgebouwd; het is niet simpelweg een optelsom van PDF-loonstroken.
- Documentsjablonen zijn versiegebonden. Klantaanpassing kan alleen uitdrukkelijk optionele blokken en toegestane werkgeverbranding aanpassen. Verplichte velden, bedragen, betekenis en brontoewijzing blijven beschermd door een server-side validator.
- De normale documentlifecycle onderscheidt concept, gecontroleerd en definitief/uitgegeven wanneer die domeinstatus van toepassing is. De PDF en de opslag-/distributiestatus worden niet verward.

Digitale loonstrooktoegang volgt toepasselijke instemming, wettelijke bewaarplicht en duurzame employee-inzage. Een werknemer leest alleen de eigen documenten; HR Admins handelen binnen hun toegestane administratie. Manager-toegang vereist een expliciet product- en autorisatiebesluit.

## Inhoud en presentatie

Een loonstrook gebruikt de normale zakelijke presentatie en de relevante opgeslagen werkgever-, medewerker-, dienstverband-, IKV-, periode-, looncomponent-, inhoudings-, netto- en werkgeverskostenvelden die voor die uitkomst vereist zijn. De inhoud volgt de geldende wettelijke bron- en veldspecificaties voor de relevante datum; de implementatie legt die bronnen en validatie vast.

Toon geen *TEST*, *synthetisch*, *fixture*, *DEMO* of technische acceptatiestatus enkel omdat de brondata of renderomgeving TEST is. Geen environment-only watermerk of disclaimer in een PDF. Gebruik normale producttermen. **Concept** staat wel op een conceptdocument; een correctie-, supersession- of definitieve status blijft volgens het documentcontract zichtbaar.

Een expliciet gekozen fictieve bedrijfs- of medewerkernaam is gewone opgeslagen administratiegegevens en mag worden getoond. Opgegeven werkgeverparameters zijn niet automatisch wettelijk gevalideerd. Interne documentatie benoemt de herkomst, aannames, juridische bewijsgrenzen en testomgeving; normale klantdocumenten doen dat niet via technische testlabels.

## Reproduceerbaarheid en audit

Een gegenereerd document verwijst naar:

- immutable payrollresultaat en input-/bronsnapshot;
- exacte engine-, fiscale regel-, CAO-/regeling- en templateversies;
- administratie, dienstverband, IKV, periode en toepasselijke lifecycle;
- outputhash, tijdstip, maker/actor en audit-events;
- eventuele correctie-/supersessionrelatie.

Een eenmaal definitief uitgegeven PDF wordt niet stilzwijgend gewijzigd. Een correctie genereert een nieuwe versie/artefact met expliciete provenance. PDF-waarden komen uit de gepinde persistente uitkomst; de renderer rekent niet opnieuw.

## TEST-omgeving en distributie

TEST gebruikt fictieve gegevens maar genereert dezelfde professionele klantgerichte layout en dezelfde toegestane documentfunctionaliteit. Externe uitgifte van een technisch TEST-document als authentiek betaaldocument is verboden.

Blokkeer in TEST, fail-closed op de omgeving-/distributiegrens:

- officiële aangifte of verzending naar een overheidsvoorziening;
- SEPA- of andere daadwerkelijke betaling;
- externe loonstrookdistributie buiten de gecontroleerde TEST-context;
- verbinding met Production-systemen of credentials.

De gewone documentpresentatie blijft gelijk. De veiligheidsgrens is de distributie- en integratielaag, niet een afwijkende PDF-inhoud, watermerk of disclaimer. Preview/download binnen de gecontroleerde TEST-omgeving mag alleen binnen de bestaande rechten en documentstatus plaatsvinden.

Interne acceptatierapporten registreren wel dat een PDF technisch uit TEST-data kwam, welke input fictief of werkgeveropgegeven was, welke hash is gecontroleerd, en of juridische/documentcompliance afzonderlijk is aangetoond. Behandel een interne TEST-PDF niet als bewijs dat externe distributie of authentieke uitgifte is toegestaan.

De historische [PAYRUN01 checkpoint van 2026-10-06](../../payroll/acceptance/PAYRUN01-IMPLEMENTATION-CHECKPOINT-20261006.md) beschrijft een gemarkeerd TEST-artefact voor die technische run. Dat is historische fixture-evidence en geen klantgerichte PDF-specificatie; nieuwe product-PDF's volgen deze PAYDOC01-regel.

## Acceptatiecriteria

1. Dezelfde geldige payrollsnapshot en templateversie produceren dezelfde inhoud en lay-out in lokale, TEST en Production-runtime.
2. Er is geen environment-only test-, fixture- of synthetisch-watermerk/disclaimer.
3. Functionele documentstatus, waaronder Concept, blijft correct zichtbaar.
4. Bedragen, werkgever-/werknemercontext, bronversies, controles, outputhash en audit zijn aan de persistente uitkomst gebonden.
5. Rechten, instemming, administratie-/employee-scope en downloadbeveiliging worden server-side afgedwongen.
6. Correcties en herberekeningen maken nieuwe expliciete artefacten; historische PDF's en hashes blijven onveranderd.
7. TEST blokkeert echte aangifte, SEPA-betaling, externe distributie en Production-integratie buiten de documentrenderer.
8. Interne TEST/dataherkomst en wettelijke onzekerheid lekken niet in gewone klantpresentatie, maar zijn wel in acceptatie- en auditbewijs vastgelegd.

## Relaties

- [`AA-PAYROLL §18`](../../AA/AA-PAYROLL.md)
- [`PRODUCT_ENVIRONMENT_PARITY`](../../architecture/PRODUCT_ENVIRONMENT_PARITY.md)
- [`PAYPENS01`](PAYPENS01-CORE-PENSION-PRODUCT-DESIGN.md)
- [`Documenten en Dossier`](../documents/Documenten_en_Dossier_Systeem_Master.md)
