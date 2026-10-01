# PAYMENT01 — Salarisbetalingen en loonheffingen in LiquidHR

**Status:** onderzocht product-/architectuurvoorstel; nog niet gebouwd of geaccepteerd.  
**Datum:** 2026-10-01  
**Dependencies:** PAYLAB02/03, toekomstige volledige payrollfinalisatie, PAYDOC01 loonstrook/jaaropgaaf, aangifteproduct/CONTROL02, TWK/correcties. Geen wijziging aan de lopende PAYLAB04-run.

## 1. Productbesluit

LiquidHR **berekent en bereidt betalingen voor**, maar houdt zelf geen klant-/salarisgelden aan en is geen betaalinstelling. De werkgever betaalt vanaf zijn eigen rekening. In de eerste productrelease: exporteer een **gevalideerd SEPA Credit Transfer XML-bankbestand** na expliciete payroll-/betaalgoedkeuring; bankupload en autorisatie zijn bij de klant. Daarna een optionele directe bankkoppeling via een gekwalificeerde partner of bankinterface.

**Belangrijk:** betalingsopdracht, bankaanlevering, bankacceptatie en daadwerkelijk uitgevoerde betaling zijn verschillende toestanden; een download of API-HTTP 200 is nooit bewijs van bijschrijving.

Geen automatische betaalopdracht uit een pro-forma-, forecast- of niet-gefinaliseerde payrollrun.

### Benchmark Nmbrs (documentatie nagezien 2026-10-01)

1. Nmbrs genereert automatisch een SEPA-betaalbestand na de run; XML wordt handmatig in de bank geïmporteerd. Betalingsdatum/omschrijving instelbaar (datumwijziging in bepaalde Nmbrs-views wordt niet blijvend opgeslagen).
2. Nmbrs Bank Integration zet salaris- en loonheffingsbetalingen automatisch klaar voor goedkeuring bij ABN AMRO, ING, Rabobank en bunq; koppeling is configureerbaar.
3. Netto wordt per run bepaald. Correcties uit oude perioden kunnen in de meest recente run worden verrekend. Bedrag dat daadwerkelijk per bank gaat wordt onderscheiden van andere betaalmethoden.
4. Extra werknemersrekeningnummers zijn mogelijk (Nmbrs ondersteunt naast standaardrekening vijf extra via eigen componenten).
5. Aparte loonaangifte-SEPA vanuit de specifieke ingediende/aangemaakte aangifte; rekening, datum en betalingskenmerk zijn afzonderlijk.
6. Bankkoppeling kan uitvallen: Nmbrs kende op 25 september 2026 een Rabobank-aanleveringsstoring; SEPA-export was de beschreven terugvalroute. **Gebruik nooit blind fallback-export als een directe batch een onbekende submitstatus heeft**: eerst bankbevestiging/reconciliatie om dubbele betaling te voorkomen.
7. Een derde-partijvoorbeeld OneLinQ haalt vergrendelde salarisbetalingen op, laat een bevoegde gebruiker in een afzonderlijk portaal autoriseren en gebruikt vervolgens bankconnectiviteit. Dit bevestigt de haalbaarheid van een partner-adapter.

Bronnen:
- https://support.payroll.nmbrs.com/hc/nl/articles/209083787-SEPA-in-Nmbrs-Payroll
- https://support.payroll.nmbrs.com/hc/nl/articles/4408726189074-Bank-integration-Eenvoudig-en-veilig-salarissen-betalen
- https://support.payroll.nmbrs.com/hc/nl/articles/15718002726802-Netto-betaling-per-run-vanaf-2024
- https://support.payroll.nmbrs.com/hc/nl/articles/204058456-Deel-van-het-netto-salaris-naar-een-ander-bankrekeningnummer-overmaken
- https://support.payroll.nmbrs.com/hc/nl/articles/227039188-Betaling-loonaangifte-via-SEPA
- https://www.nmbrs.com/nl/koppelingen/onelinq
- https://support.payroll.nmbrs.com/hc/nl/articles/39251812134674--Nmbrs-Bank-Integration-Betaalbatches-kunnen-momenteel-niet-verzonden-worden-via-Rabobank

Benchmark betreft waargenomen productfunctionaliteit, geen toezegging dat iedere bank/use-case voor LiquidHR beschikbaar is.

## 2. Nederlandse/Europese standaarden en actuele bron

- Gebruik ISO 20022 **SEPA Credit Transfer Customer-to-PSP**-berichten, voor de actuele EPC 2025 SCT Customer-to-PSP IG (gebaseerd op 2019 ISO 20022 message generation, concreet XSD/profile na implementatieonderzoek vastzetten), plus actuele bank-/Nederlandse implementatieregels. Geen zelfbedachte XML. Versieer de exporter inclusief schema/profile en betaalbankcompatibiliteit.
- EPC 2025 SCT Rulebook **v1.2 geldt sinds 30 september 2026**; het eerdere aangekondigde einde voor ongestructureerde adressen in november 2026 is uitgesteld. Programmeer die oude deadline niet in als harde afwijzing.
- EPC-IG verstrekt XSD als technische subset: XSD-validatie **alleen** volstaat niet; ook EPC business rules en bank-specifieke beperkingen/testfiles controleren.
- `Verification of Payee` / IBAN-naamcontrole is sinds 2025 onderdeel van Europese betaalprocessen; de bank/PSP heeft hier zijn eigen verplichtingen. LiquidHR valideert IBAN-formaat, beschikbare tenaamstelling en wijzigingen; directe VOP-integratie is toekomstig/partnerafhankelijk. Voor corporate bulkbestanden kunnen regels/bankopties verschillen. Geef nooit zelf een juridisch 'name verified' zonder echte PSP-respons.
- Voor loonheffingen: betaal exact het **eindbedrag van de daadwerkelijke aangifte**, niet automatisch de som van inhoudingen op alle individuele stroken. Gebruik het tijdvakgebonden betalingskenmerk en de dan geldende officiële betaalrekening, met voorzichtige wijzigingsprocedure. Volgens de Belastingdienst is vanaf 1 mei 2026 de algemene zakelijke loonheffingenrekening gewijzigd naar de Rabobank; g-rekening en andere betaaltypen kunnen afwijkende routes hebben. Geen hardcoded ontvangerrekening in eeuwig geldige code.
- Door bankcutoffs/weekenden/feestdagen en deadlines kan een gewenste betaaldatum niet altijd zonder meer worden gegarandeerd: configureer planning en bevestig status.

Primaire bronnen:
- https://www.europeanpaymentscouncil.eu/what-we-do/epc-payment-schemes/sepa-credit-transfer-sct/sepa-credit-transfer-rulebook-and
- https://www.europeanpaymentscouncil.eu/document-library/implementation-guidelines/sepa-credit-transfer-customer-psp-implementation-1
- https://www.betaalvereniging.nl/kennisbank/standaarden-in-betalingsverkeer/sepa-implementatierichtlijnen/
- https://www.europeanpaymentscouncil.eu/document-library/rulebooks/verification-payee-scheme-rulebook-0
- https://www.belastingdienst.nl/wps/wcm/connect/nl/betalenenontvangen/content/betaalgegevens-zakelijke-belastingen
- https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/themaoverstijgend/brochures_en_publicaties/aangifte-loonheffingen-tijdvakcodes-aangifte-en-betaaldatums

## 3. Canoniek onderscheid: bedrag, betaalinstructie en batch

**PayrollResult**: het gefinaliseerde berekende resultaat (incl. bruto, netto en relevante betaalcomponenten).

**PayableProjection**: aansluitend `PAYABLE_AMOUNT`: het werkelijk verschuldigde bedrag aan deze ontvanger na uitbetalingscomponenten, inhoudingen en eventuele toegestane correcties. Niet gelijkstellen aan `NET_WAGE`.

**PaymentInstruction**: één concrete geplande transfer: payer legal entity/administration, bankrekening, payee (employee/third party/tax authority), bankrekening, valuta EUR, bedrag, datum, betalingskenmerk/omschrijving, source run/result hashes, purpose `SALARY | SALARY_CORRECTION | TAX | PENSION | OTHER_APPROVED` en immutable instruction key.

**PaymentOrder/Batch**: een gescopeerde verzameling instructies voor één werkgever-/debiteurrekening, execution date, bank export format/profile, approval context, status en batchhash. Een payrollrun kan meer dan één batch opleveren (andere betaaldag, payer bank account, werknemersgroep, doel).

**PaymentAttempt/ExportArtifact**: aanleveringspoging of bankexport van een *bevroren* batch, met exact bytes-hash, instructie- en batchreferenties, exportmoment en uitvoerkanaal. Opnieuw exporteren van dezelfde bevroren batch moet byte-/inhoudelijk identiek zijn behalve expliciet gedocumenteerde niet-financiële bestandsmetadata. Wijziging betekent nieuwe batchrevision en nieuwe goedkeuring.

**PaymentEvent/Status**: goedkeuring, export, submit, bankacceptatie, executie, reject/return, exception/reconciliation. Audit append-only, nooit status van banking bevestigen uitsluitend omdat een UI-knop is gebruikt.

**TaxPaymentObligation**: los gekoppeld aan exact geaccepteerde aangifteversie, juridische inhoudingsplichtige, tijdvak, definitief aangiftebedrag, betalingskenmerk, deadline en actuele officiële ontvangersgegevens. Betaalstatus en aangiftestatus blijven afzonderlijk.

**RecoveryCase** voor negatieve nettobetalingen: niet omzetten naar een negatieve SEPA Credit Transfer of zonder mandaat van werknemer incasseren. Kies handmatige verrekening/correctieproces waar juridisch toegestaan en herbereken correct.

Vermijd directe aanpassing van gefinaliseerde run/documenten na batchgoedkeuring.

## 4. End-to-end workflow

```text
Continuous Payroll → gecontroleerde huidige projectie
  → approval/freeze/finalization
  → immutable PayrollResult + PayableProjection
  → Payment readiness (rekening, amount, employer scope, coverage)
  → proposed PaymentInstructions
  → PaymentOrder/Batch (in te zien / payroll-by-exception controls)
  → bevoegde klantgoedkeuring (optionele vier-ogen afhankelijk van beleid)
  → batch FREEZE + immutabele export/submission snapshot
  ├─ SEPA XML-download → klant uploadt/autoriseert bij bank
  └─ later BankAdapter → klaarzetten → klant autoriseert bij bank
  → bank-/klantfeedback en reconciliation
  → PAID/REJECTED/UNKNOWN-partial statuses per instructie
  → financiële aansluiting/audit + employee document delivery
```

Goedkeuring van payrollfinalisatie en goedkeuring van de betaalbatch zijn **verschillende** stappen/capabilities. Geen automatische overdracht van betaalbevoegdheid op basis van HR Admin alleen.

Statusmachine minimaal:
`DRAFT → READY_FOR_APPROVAL → APPROVED → FROZEN → EXPORTED/SUBMISSION_PENDING → SUBMITTED → BANK_ACCEPTED → SETTLED`;
`REJECTED`, `PARTIALLY_SETTLED`, `CANCELLED` en `UNKNOWN_STATUS` waar van toepassing. Een gedownload SEPA-bestand bewijst uitsluitend `EXPORTED`, nooit `SUBMITTED` of `SETTLED`.

Na goedkeuring wijzigingen aan rekening, bedrag, bestemming, betaaldatum of batchsamenstelling = nieuwe batchrevision en **nieuwe** goedkeuring. Eenmalige, scoped approval en immutable exact batchhash.

Niet op iedere organisatie een vierogenstelsel afdwingen zonder besluit; bied een instelbaar betaalmandaat/vierogenpolicy met expliciete sterk gecontroleerde authorizationmatrix en operationele status.

## 5. Readiness en veiligheidscontrols

Fail closed bij:
- ontbrekende/malformed IBAN of ontbrekende betaalmachtiging;
- rekeningnaamwijziging/IBAN-wijziging na approval zonder herautorisatie;
- geen unieke instruction identity/batch scope of onverklaarde dubbelen;
- batch bestaat uit meerdere juridische werkgevers zonder toegestane scheiding;
- totale batchbedragen/totalen per werknemer sluiten niet exact aan op `PayableProjection`;
- ontbrekende of incomplete definitieve payrollcomponenten;
- niet-verwerkte payrollchanges na freeze of run revision mismatch;
- ongeoorloofde bankrekeningwijziging, mislukte bank-/VOP-resultaatbeoordeling waar bank aangeeft actie nodig;
- ontbrekend geldig tijdvak-/betalingskenmerk voor tax payment;
- reeds geëxporteerde/ingestuurde/onzekere batch zonder aantoonbare reconcilatie bij nieuwe export.

Test met 1 cent verschil (block), dubbele klik/idempotency, concurrente approval, verloren provider-callback, bank reject, bank timeout UNKNOWN, partial settle, duplicate payer/payee intents en bank down fallback.

Beperk export/download door server-side salary/payment permissions, scope per tenant/HR-group/legal payer/admin; bescherm bankrekening- en betaal-PDF/XML-data. Bewaar alle betaalbestanden alleen in private storage met audit en korte geldige autorisatie.

Bankrekeningwijziging voor medewerker is een hoogrisicowijziging: logging/goedkeuring/cutoff-policy en mogelijke IBAN-name-check; beperk last-minute frauderisico.

## 6. Betalingsonderdelen voor de eerste releases

**PAYMENT00 — Domein + simulatie (eerst)**
- onafhankelijke betalingsprojectie bovenop de bestaande immutable payrollrun;
- PaymentInstruction/Batch/Attempt/Status/TaxPaymentObligation/RecoveryCase-contracten en securitymatrix;
- synthetische testinstructies, readiness en reconciliation invariants;
- eerste test: PAYLAB03 `NET_WAGE = PAYABLE_AMOUNT = € 3.181,33` uitsluitend binnen zijn *beperkte* synthetic fiscale case. Geen pretend live payroll payment.

**PAYMENT01 — Gevalideerde SEPA-export**
- alleen voor werkelijk geaccepteerde, gefinaliseerde payroll en voldoende complete payment data; zolang finalization ontbreekt alleen duidelijk gescheiden synthetic test-SEPA-export;
- minimaal één werkgeverrekening, EUR en één werknemerrekening; beschikbare batch grouping/bedrijfsomschrijving en geplande betaaldatum;
- EPC SCT IG + bankprofiel(s), XSD + business-rule validation en bankacceptatie-testbestanden;
- betaallijst (inclusief controles en gescopeerde betaalgegevens), batchrevision, expliciete approval, XML-bestand/hash; user bank-upload/autoriseert zelf;
- bijzondere situaties `UNSUPPORTED` zolang betaalcomponenten niet bestaan; geen schijnpayrolluitgifte.

**PAYMENT02 — Instructies, uitzonderingen en reconciliation**
- split payments op meerdere employee accounts, voor zover geautoriseerd, derde-begunstigden/beslag onder afzonderlijk juridisch getoetst beleid;
- correctie- / TWK-instructies en negatieve netto RecoveryCases;
- providerstatusimport/pain.002 wanneer ondersteund; bankafschrift `camt.053` / `camt.054` of afgesproken bankexport via partner;
- uitbetaling ≠ netto aansluiting, bank reject/return/duplicate detectie;
- betalingen over meerdere batches/datums binnen één perioderun.

**PAYMENT03 — Optionele directe bankkoppeling**
- bankadapter/PSP-partneronderzoek incl. contract- en security/privacyreview;
- rekeningtoestemming / onboarding / authorizations, bank-specifieke integratie-/webhookstatus;
- klaarzetten vanuit bevroren batch, klant geeft uiteindelijke bankgoedkeuring;
- retry/idempotency met status reconciliation; **geen** blind fallback-SEPA wanneer banksubmitstatus onbekend;
- geen eigen klantgelden, geen claim over regulatoire status van nog niet gekozen PSP-partner;
- scheduling/automatische workflows pas na expliciete klantinstelling en bankmandaat.

**PAYMENT04 — Loonheffingen/pensioenbetaling**
- apart na officiële aangifte-/fonds-/pensioenprojecties, met actuele betalingskenmerk- en ontvangerbeheer en deadlinecontrol;
- nooit belastingen voorbereiden als 'totaal individuele loonheffingen' wanneer definitieve aangifte-eindsom afwijkt door afronding/correctie;
- ondersteun eventuele g-rekening later uitsluitend onder expliciet gevalideerd speciaal profiel en productbesluit.

## 7. UI, rollen en aansluiting met documenten

Sidebar blijft **alleen `Payroll Lab`**. Wanneer functioneel wordt vanuit die centrale overzichtspagina een tegel `Betalingen` geopend.

Conceptuele betaalschermen:
- `Te betalen`: aanstaande salarisbatches, belasting-/pensioenverplichtingen (als ondersteund), bedragen, gewenste datum, gereedheid en afwijkingen;
- `Betaalbatch`: aantallen, totaal, betaalrekening werkgever, betaalregels, IBAN-status, wijzigingen sinds approval, outstanding issues, verantwoordelijke goedkeurder;
- `Goedkeuren` door bevoegde payroll/payment rol;
- `Download SEPA` (eerste release), later `Zet klaar bij bank`;
- `Status & historie`: audit, bankstatus/handmatige verklaring, reconciliation, rejects en exports.

HR Admin mag payroll-/betaalvoorstel bekijken voor zijn gescopeerde administraties; **betaling goedkeuren/autoriserende bankactie vereist aanvullende expliciete payment capability**, niet standaard HR Admin.

Geen medewerkerselfservice-betalingsinitiatief. Medewerker ziet na uitgifte een loonstrook waarop netto loon en uitbetaling consistent zijn. Bank- en externe geldontvangst wordt niet als voltooid gemeld zolang daarvoor geen betrouwbare bevestiging bestaat.

`PAYDOC01`: definitieve loonstrook toont `NET_WAGE` en `PAYABLE_AMOUNT` (indien verschillend) en een correcte betalingsspecificatie uit dezelfde pinned PayableProjection. Niet dynamisch de historische PDF veranderen zodra bankstatus later wijzigt.

## 8. Golden cases

- P1: één synthetische werknemer, bruto 4000 / belasting 818.67 / netto = payable 3181.33; bereken/leid batch af uit ondersteunde testfixture.
- P2: twee werknemers, één payer, exact totaal = som van instructions en projections.
- P3: netto 3053.39 plus aparte goedgekeurde netto betaling 25.00 → payable 3078.39 (generieke **synthetische** aansluiting, geen referentie aan aangeleverde echte persoonsgegevens).
- P4: werknemer ontvangt betaalinstructies naar twee rekeningen: som exact payable; pas na uitvoeringscontract.
- P5: TWK + current, correctie en negative net: niet blind SEPA met negatieve bedragen maken.
- P6: batch is geëxporteerd, bankkoppeling timeout geeft UNKNOWN, fallback mag niet automatisch dubbele instructie produceren.
- P7: 0.01 verschil tussen PayableProjection en batch → BLOCKED.
- P8: goedgekeurde batch krijgt gewijzigd IBAN of bedrag → hergoedkeuring.
- P9: tax payment amount komt uit officiële aangifte, heeft uniek periodebetalingskenmerk, verwacht bedrag en deadline; nog niet actief in PAYMENT01.
- P10: SETTLED alleen op basis van bankreconciliatie/bevestigde provider- of expliciet gelogde klantverklaring; niet op export.
- P11: verkeerde tenant/HR-group/admin/payer, forged bankrecipient of ontbrekende payment permission → denied.
- P12: huidige EPC-/bankprofiel-compatibiliteit, XSD + business rules, non-Latin/unicode sanitization, lange namen, feestdag-/cutoff/currencynegative.

## 9. Niet doen

- Geen eigen geldrekening of door LiquidHR ontvangen en doorgestorte salarissen.
- Geen automatische bankacties zonder contract/mandaat.
- Geen betaling uit PROFORMA- of nog voorlopige forecast-resultaten.
- Geen veronderstelling `NET_WAGE = PAYABLE_AMOUNT` in het algemene domeincontract.
- Geen afronding, correctie of belastingberekening in SEPA-/XML-renderers.
- Geen employee-IBAN openbaar in bulk-PDF/log/client-assets; autorisatie bij iedere access.
- Geen bankacceptatiestatus verwarren met settlement.
- Geen 'iedere HR Admin kan salarisbetalingen accorderen' zonder expliciet payment-rollenbesluit.
- Geen volledige PAYMENT-implementatie toevoegen aan de lopende PAYLAB04 of PAYDOC-fase.
