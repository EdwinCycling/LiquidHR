# PAYDOC01 — LiquidHR loonstrook, jaaropgaaf en Document Designer

**Status:** product- en architectuurvoorstel, nog niet gebouwd of juridisch/fiscaal geaccepteerd.  
**Datum:** 2026-10-01  
**Relatie:** PAYLAB02/03, PAYLAB04 Component Library, CAO-BENCH01, PROFORMA01, toekomstige medewerker-salariscockpit (buiten deze scope).

## Productbesluit

Één documentgeneratie-infrastructuur met twee documentsoorten: **loonstrook** en **jaaropgaaf**. Drie gecontroleerde layouts / authoring paths:

1. **LiquidHR STANDARD** — door LiquidHR onderhouden, structureel vergrendeld en getest tegen de toepasselijke wettelijke vereisten;
2. **CUSTOMIZED STANDARD** — een klant kiest logo, enkele stijlopties, optionele secties, veilige extra klantvelden en volgorde uitsluitend binnen vooraf toegestane grenzen, maar kan verplichte velden, berekeningswaarden en betekenis niet verwijderen of overschrijven;
3. **CUSTOM DESIGNER (opt-in)** — klant bouwt een eigen document uit een gecontroleerde datafield-catalogus en templateblokken, desgewenst een docmerge-achtige ervaring. Geen ongefilterde HTML/JS, willekeurige DB-queries, vrije code of veldexpressies die payroll-herberekeningen kunnen uitvoeren. Bevat verplichte legal-field validation en afzonderlijke klantverantwoordelijkheidsverklaring; 'op eigen risico' is **geen** vrijstelling van wettelijke eisen.

**De engine rekent; de renderer presenteert.** Documenten gebruiken uitsluitend getypeerde, gecontroleerde projecties van immutable gefinaliseerde payrollresultaten/loonstaat. Nooit een tweede fiscale of bruto-netto-berekening in een template.

Het maken van een interne preview of expliciet PRO-FORMA-document mag eerder op een stabiele scenario-output, maar moet technisch van officieel uit te geven documenten gescheiden blijven.

## Onderzochte bronset (bij implementatie opnieuw verifiëren)

Primaire bronnen:
- Rijksoverheid, 'Wat staat er op mijn loonstrook?': https://www.rijksoverheid.nl/vraag-en-antwoord/arbeidsovereenkomst-en-cao/wat-staat-er-op-mijn-loonstrook
- Belastingdienst, 'Issuing pay slips to employees' (verplichtingen incl. digitaal): https://www.belastingdienst.nl/wps/wcm/connect/bldcontenten/belastingdienst/business/payroll_taxes/you_are_not_established_in_the_netherlands_are_you_required_to_withhold_payroll_taxes/when_you_are_going_to_withhold_payroll_taxes/payroll_records/issuing_pay_slips_to_employees
- Belastingdienst, 'Model jaaropgaaf': https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/themaoverstijgend/brochures_en_publicaties/model-jaaropgaaf
- Belastingdienst modeljaaropgaaf vanaf 2022 (één pagina): https://download.belastingdienst.nl/belastingdienst/docs/jaaropgaaf_lh0121z3pl.pdf
- Belastingdienst, 'Issuing annual income statements to employees': https://www.belastingdienst.nl/wps/wcm/connect/bldcontenten/belastingdienst/business/payroll_taxes/you_are_not_established_in_the_netherlands_are_you_required_to_withhold_payroll_taxes/when_you_are_going_to_withhold_payroll_taxes/payroll_records/issuing_annual_income_statements_to_employees
- Handboek Loonheffingen 2026, maartuitgave; verifieer aantal jaaropgaven bij meerdere dienstbetrekkingen/IKV's tegen de actuele toepasselijke versie: https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/themaoverstijgend/brochures_en_publicaties/handboek-loonheffingen

Lay-out- / marktbenchmark, **geen wettelijke autoriteit**:
- Nmbrs, Opbouw van de loonstrook (bijgewerkt 2026-08-31): https://support.payroll.nmbrs.com/hc/nl/articles/204054076-Opbouw-van-de-Loonstrook-Uitleg-en-Inhoud
- AFAS loonstrook & jaaropgave: https://klant.afas.nl/portal-profit/loonstrook
- AFAS salariswijzer (uitleg begrijpelijke loonstrook): https://www.afas.nl/salariswijzer

Hergebruik concepten, maar kopieer geen concurrerende templates/graphics/documenten integraal.

## 1. Wettelijke requirements — loonstrook

Geen verplicht Nederlands model, wél verplichte inhoud. De werkgever verstrekt een specificatie bij de eerste loonbetaling en bij gewijzigde loonbedragen/inhoudingen; LiquidHR mag als service standaard **iedere periode** een strook aanbieden.

Verplichte velden/inhoud voor de ondersteunde context, onder voorbehoud van actuele nationale validatie:
- naam werknemer en werkgever;
- betaalde periode;
- brutoloon in geld;
- uitsplitsing loonbestanddelen: basissalaris, toeslagen, overwerk, vergoedingen, bonus en relevante bruto-/netto-opbouw waar aanwezig;
- bedragen van inhoudingen, waaronder toepasselijke loonheffing/pensioen/Zvw en overige werkelijke inhoudingen;
- contractueel gewerkte uren;
- toepasselijk wettelijk minimum(jeugd)loon;
- wettelijke minimumvakantiebijslag;
- toepasselijke aanduidingen schriftelijk contract, onbepaalde tijd en oproepovereenkomst.

Aanbevolen aanvullende informatiedragers (niet uniform alle wettelijk verplicht):
- personeelsnummer, functie, parttime-/fulltimegegevens;
- fiscale tabelkleur/loonheffingskorting waar zinvol;
- fiscaal loon en relevante grondslagen;
- netto salaris, overige netto vergoedingen/inhoudingen en **daadwerkelijk uit te betalen bedrag** duidelijk gescheiden;
- gemaskeerd IBAN;
- reserveringen/vakantiegeld/verloftotalen en cumulatieven alleen voor de ondersteunde/actuele gegevensbron;
- uitleg van termen en bedragen via app-cockpit, niet door overvolle PDF.

Bouw een versioned `RequiredFieldPolicy` voor de wettelijk vereiste inhoud en een optionele `DisplayPolicy`. De renderer mag wettelijke inhoud niet verbergen via klantconfig.

## 2. Wettelijke requirements — jaaropgaaf

De jaaropgaaf is **vormvrij**, maar de verplichting tot jaarlijkse verstrekking en de verplichte gegevens zijn dat niet. Gebruik voor de LiquidHR-standaard het Belastingdienst-model 'vanaf 2022' als inhoudelijke checklist, niet als te kopiëren visueel sjabloon.

Minimaal vastleggen/renderen:
- belastingjaar;
- naam werknemer;
- BSN werknemer, **alleen** op dit afgeschermde document voor de bevoegde ontvanger;
- naam juridische werkgever;
- fiscaal jaarloon / loon voor loonbelasting en volksverzekeringen (loonstaat kolom 14);
- ingehouden loonbelasting/premie volksverzekeringen (kolom 15);
- verrekende arbeidskorting (kolom 18);
- ingehouden bijdrage Zvw (kolom 16), voor zover van toepassing;
- totale premies werknemersverzekeringen (werkgeversdeel), voor zover van toepassing;
- werkgeversheffing Zvw, voor zover van toepassing.

Niet klakkeloos alle bedragen op nul invullen bij ontbrekende bronnen: `NOT_APPLICABLE` en `MISSING/UNSUPPORTED` zijn verschillend. Een definitieve jaaropgaaf is niet mogelijk voordat de relevante loonstaat-, sociale-premie- en Zvw-datasets over het vereiste jaar volledig, reconcilieerbaar en geaccepteerd zijn.

**Multi-IKV/werkgever:** definieer de documentaggregatie expliciet op juridische inhoudingsplichtige, dienstbetrekking, inkomstenverhouding en belastingjaar. Eén werknemer met meerdere IKV's leidt niet automatisch tot één samengevoegd document en zeker niet tot samentelling over verschillende juridische werkgevers. Valideer de actuele handboekregels en documenteer gekozen presentatie wanneer meerdere IKV's binnen één dienstbetrekking vallen. Bewaar trace per wettelijke groep.

Bij uitdienst: voorzie een proces waarmee de voormalige werknemer de jaaropgaaf kan krijgen. Jaaropgaaf kan na afloop van het jaar worden verstrekt en onder toepasselijke omstandigheden eerder bij uitdiensttreding; houd relevante verzending/delivery-evidence vast.

## 3. Documentontwerp en customer boundaries

### A. LiquidHR STANDARD

- vast en geversioneerd officieel LiquidHR-layoutsjabloon voor loonstrook en jaaropgaaf, door LiquidHR intern gereviewd;
- heldere, leesbare kop, contract-/fiscale informatie, bruto-nettoblokken, uitbetaling en relevante cumulatieven;
- voor jaaropgaaf vereiste Belastingdienst-rubrieken goed zichtbaar;
- uniforme PDF A4, meervoudige pagina's met herhalende documentidentiteit/page numbers;
- neutrale toegankelijke typografie en contrast, NL in eerste fase; EN alleen als expliciet vertaalde (juridisch vereiste NL-terminologie intact) layout is geaccepteerd.

'Officiële LiquidHR-variant' betekent door LiquidHR uitgegeven/onderhouden, **niet** door Belastingdienst gekeurd of officieel gecertificeerd.

### B. CUSTOMIZED STANDARD

Toegestane instellingen:
- werkgeverlogo uit goedgekeurde veilige beeldopslag;
- bescheiden kleuraccent, onder voorwaarden;
- keuze om uitsluitend door LiquidHR als optioneel aangemerkte secties te tonen/verbergen (bv. bepaalde niet-verplichte cumulatieven, aanvullende interne identificatie, uitgebreid verlofoverzicht);
- beperkte optionele eigen labels / vastgelegde aanvullende bedrijfsvelden met datatype, toestemming/zichtbaarheid en beperkte lengte, bijvoorbeeld kostenplaats, ploeg, interne mededeling;
- bedrijfsvoetnoot/HR-contact en veilige interne disclaimer;
- preview vóór activering, versioned approval.

Niet toegestaan in deze modus:
- verplichte wettelijke velden verbergen of hernoemen tot onbegrijpelijke betekenis;
- wettelijk vereiste minimums verplaatsen buiten het document;
- fiscale of financiële bedragen bewerken;
- payrollcomponenten herberekenen in het template;
- persoonsgegevens zonder doelbinding toevoegen.

### C. CUSTOM DESIGNER (opt-in, later)

- drag/drop of blokgebaseerd documentmodel, docmerge-achtig op basis van **typed field registry** en read-only data projections;
- templates zijn versioned, gescopeerd, gelogd en alleen door bevoegde HR Admin te bewerken/publiceren;
- dynamische herhaalblokken voor loonregels, inhoudingen, reserveringen en jaarlijkse rubrieken;
- voorwaarden/if-visibility uitsluitend via veilige declaratieve policies, niet via raw code;
- verplichte `RequiredFieldPolicy` en data-validatie vóór publiceren/genereren;
- ontbrekende verplichte onderdelen = BLOCKED, ondanks waarschuwing/eigen risico. Klantverantwoordelijkheid ziet op eigen indeling, begrijpelijkheid, aanvullende niet-wettelijke inhoud en eigen review;
- thumbnail + echte PDF-preview op synthetic fixture, rendering/overflow checks, content consistency, NL/EN labels indien ondersteund;
- een custom template mag geen privégegevens van andere medewerkers of andere administraties opvragen;
- template en gebruikte field schema pinned op issued document.

Document Studio van LiquidHR is bestaand productconcept; bij implementatie eerst analyseren welke veilige editor-/templateprimitieven herbruikbaar zijn. Verwar HR-documentmerge/Word placeholders niet met payrollberekeningslogica. Geen ongesandboxte templatecode.

## 4. Data-contract en pipeline

```text
Payroll engine (versioned components + rules)
         ↓
Immutable finalized PayrollCalculation/IncomeRelationshipResults
         ↓
Canonical PayrollDocumentDataProjection
  - PayslipData
  - AnnualStatementData
         ↓
RequiredFieldPolicy + data readiness + reconciliation
         ↓
Versioned Template Registry & Renderer
         ↓
PDF render + accessibility/security validation
         ↓
Immutable IssuedDocument + PDF content hash
         ↓
Private document storage + access/audit + publication/delivery
         ↓
HR Admin archive and ESS "Mijn loonstroken/jaaropgaven"
```

`PayslipData` bevat identiteit/scope, employee/employment/IKV/period/run references, contractinfo, de benodigde wettelijke loongegevens, gestructureerde componentresultaten, netto vs betaald, reserveringen/cumulatieven indien ondersteund, en wettelijke bronnen/bronversies.

`AnnualStatementData` wordt **niet** samengesteld door zomaar periodestroken op te tellen: gebruik correcte, complete loonstaat-/jaaraggregaties met wettelijke IKV/dienstbetrekking/inhoudingsplichtige-scope. Reconcile tegen gefinaliseerde run- en aangiftegegevens zodra die beschikbaar zijn.

Geen PDF op basis van live, veranderlijke Core-data samenstellen ná runfinalisatie zonder pinned historical source snapshot. Een gegenereerde definitieve PDF moet de vastgestelde bron-/reken-/templatestatus reflecteren.

## 5. Uitgifte, correcties, beveiliging en inzage

- Interne preview vóór publicatie is nooit een officieel issued document.
- Een uitgegeven PDF heeft immutable storage + content hash, juridisch werkgeverslabel, betrokken employee/IKV, periode/jaar, runversion, templateversion, uitgiftemoment en audit.
- Een latere wijziging in template of payroll herschrijft bestaande uitgegeven documenten niet stilzwijgend; maak een nieuwe/corrigerende versie met tracebare relatie, behoud het origineel voor toegestane audit/reconstructie.
- TWK: later beslissen tussen aanvullende verschil-/correctiestrook, vervangende loonstrook of combinatie, met duidelijke medewerkerscommunicatie; documentbron blijft de werkelijk gefinaliseerde gecorrigeerde berekening, nooit fictieve renderingdelta.
- Gebruik private opslag, server-side autorisatie bij ieder lijst-, preview- en downloadverzoek, kort geldige bestandstoegang en audit; geen publieke PDF-links, onbeveiligde e-mailbijlagen of `NEXT_PUBLIC`-payrollsecrets.
- Medewerker: alleen eigen documenten conform server-side subject-scope; HR Admin uitsluitend bevoegde administraties/werknemers; Manager niet vanzelf salarisdocumentenrechten.
- Voor digitale loonstrook: expliciete instemming en zodanige beschikbaarheid dat medewerker de loonstrook op enig moment kan bewaren en opnieuw bekijken. Ontwerp veilige verstrekking/alternatief als instemming ontbreekt.
- Voor voormalige medewerkers: rechtsgeldige toegangs-/afleverroute, vooral voor jaaropgaven na uitdienst.
- Jaaropgaaf bevat BSN: toon dit uitsluitend aan de bevoegde ontvanger binnen de beveiligde PDF, niet in notificatieonderwerpen, logs, voorbeeldtemplates of analytics.
- Retentie, logging, export en deletion volgen geldende personeels-/fiscale bewaarplichten en privacyrichtlijnen; stel daadwerkelijke termijnen na juridische/privacyreview vast.
- Afdrukken/downloaden PDF toegestaan; geen automatisch document via e-mailbijlage verzenden. Optioneel bericht 'Nieuw salarisdocument beschikbaar' zonder salaris/BSN.

## 6. UX en navigatie

**Eén** Payroll Lab-ingang in de bestaande sidebar. Voeg zodra functioneel een overzichtstegel `Loonstroken & Jaaropgaven` toe; geen steeds langer wordende lijst met sidebar-submenu's.

**Klant HR Admin:**
- kies `LiquidHR Standard` of `Aangepaste Standard`;
- upload logo en configureer optionele blokken/eigen velden;
- bekijk echte maar gesanitiseerde PDF-preview vóór publicatie;
- documentuitgifte en archief per periode/jaar/scope;
- later `Eigen ontwerp (beta)` met documentvalidator, preview en expliciete acceptatie van eigen onderhoud/verantwoordelijkheid.

**Medewerker:**
- gebruik bestaande ESS-autorisatie;
- tab/ingang `Mijn loonstroken` / `Mijn jaaropgaven`, mogelijkheid PDF online openen en downloaden;
- geen werkgever-/managerprivédocumenten delen;
- toekomstig `Mijn salaris-cockpit` als eigen productfase met beperkte aggregaties/uitleg, niet in dit document ontwerpen.

Pro-forma-PDF is aparte documentstatus en mag nooit onopgemerkt als officiële loonstrook in het medewerkersarchief terechtkomen.

## 7. Release/gating en implementatiefasen

**PAYDOC00 — Source/Document Contract + Standard Design**
- officieel veldcontract, documentprojection, privacy/securitymatrix en heldere LiquidHR-designs voor loonstrook én jaaropgaaf;
- regels voor verplichte vs optionele gegevens, template versioning, annual completeness en multi-IKV-alignment;
- synthetic complete fixtures, document snapshots en onafhankelijk gecontroleerde field-level oracle.

**PAYDOC01 — LiquidHR Standard loonstrook + minimale branding**
- eerst echte PDF uit gevalideerde `PayslipData` of strikt als synthetic preview zolang definitieve payroll/deliveryvoorwaarden ontbreken;
- werkgeverlogo, optionele blokken, beperkte extra velden;
- template-versie, required-fieldvalidator, PDF snapshots/testextractie en document hash;
- HR Admin preview + geautoriseerde medewerker-PDF-inzage zodra echte finalization/deliveryflow beschikbaar is.

**PAYDOC02 — Jaaropgaaf en jaarlijks aggregatiecontract**
- bouw pas `AnnualStatementData` zodra volledige wettelijke jaargegevens (incl. werknemersverzekeringen/Zvw/arbeidskorting) en correct afgesproken IKV-/inhoudingsplichtigegroepen beschikbaar zijn;
- officieel model als testoracle; niet op basis van PAYLAB03 een schijnbaar complete jaaropgaaf uitgeven;
- zelfstandige jaaropgaaf-PDF met status, templateversion, publicatie en ESS-access.

**PAYDOC03 — Custom Designer**
- typed field library, veilige declaratieve documentblokken, preview, mandatory validator, immutability, klantverantwoordelijkheid en rollback naar Standard.

Medewerker salaris-cockpit = apart traject na afstemming.

**Niet in lopende PAYLAB04 implementeren**; dit is de productspecificatie en fasering.

## 8. Acceptancecriteria

- elk vereist veld voor gekozen jaar/type ingevuld vanuit gecontroleerde bron of duidelijke BLOCKED-reden;
- weggelaten optionele secties laten wettelijke gegevens én berekende totalen intact;
- logo/eigen veld voegen geen financiële mutatie toe;
- PDF getallen (alle vereiste posten incl. netto/uitbetaling) sluiten exact aan op immutable bronsnapshot/loonstaat; geen nieuwe rekenformule in renderer;
- document is na uitgifte immutable en latere templates wijzigen bestaande PDF niet;
- jaaropgaaf correct per wettelijke inhoudingsplichtige en gevalideerde dienstbetrekking/IKV-groepering, ook bij meerdere IKV's;
- mobile ESS PDF preview / download en accesstests voor eigen/niet-eigen/cross-admin;
- geanonimiseerde voorbeeldweergave voor editor en tests;
- NB: huidige PAYLAB03 ondersteunt één regulier synthetisch maandscenario zonder pensioen, werkgeverspremies, Zvw of volledig jaar/YTD. Daarom eerst complete projecties/preview testen en **geen wettelijke completeness-/productie-uitgifteclaim** voordat ontbrekende engine/source-rules beschikbaar zijn.

## 9. Visuele benchmark — AFAS Salariswijzer (gebruikersreferentie, 2026-10-01)

Gebruiker deelde een schermafbeelding van een AFAS-voorbeeldloonstrook (april 2026) en https://www.afas.nl/salariswijzer als uitlegbron. Deze benchmark **is geen sjabloon dat mag worden gekopieerd**. De verstrekte screenshot bevat medewerker-/rekeningidentificatie; commit deze afbeelding niet in repository of openbare documentatie, citeer geen persoonlijke velden of volledige IBAN en gebruik voor UI-tests uitsluitend gesynthetiseerde gegevens.

### Waarneembare UX-secties en LiquidHR-vertaling

| Sectie in benchmark | LiquidHR-keuze |
| --- | --- |
| Maand/jaar + prominent uitbetaalbedrag | Toon periode en `PAYABLE_AMOUNT` als eerste, groot en duidelijk, los van `NET_WAGE`. |
| Betalingen met rekening en bedrag | Afzonderlijke payment projection uit immutable finalized run; IBAN naar beleid gemaskeerd in app/voorbeeld, documenten alleen voor bevoegde ontvanger. |
| Bruto-nettotabel | Gebruik de echte componentresultaten en gestructureerde loonregels; hoeveelheids-, grondslag- en bedragkolommen waar relevant. |
| Kolommen Normaal, Bijzonder en Cumulatief | Toon alleen wanneer de onderliggende correcte statutory classification en period/YTD-datasets beschikbaar zijn; geen uit één bedrag nagemaakte fictieve cumulatieven. |
| Contract- en dienstverbandkenmerken | Uren, parttime%, contractkenmerken, relevant minimumloon en andere wettelijk verplichte gegevens uit gepinde HR/sourceversies. |
| Fiscale kenmerken en basis | Tabelkleur, loonheffingskorting en bijzonder-tariefreferentie indien ondersteund; strikt gescheiden van bruto-/netto-output. |
| Mobiliteit | Dynamisch optioneel blok met cataloguswaarde, bijtelling en waar van toepassing eigen bijdrage; uitsluitend bij werkelijk toegepaste regeling. |
| Reserveringen/saldi | Herhaalbare regels voor vakantie- en overige reserveringen met mutatie en saldo, pas na accepted balances/YTD-contracten. |

De screenshot toont terecht waarom `NET_WAGE` en `PAYABLE_AMOUNT` afzonderlijke resultaatsoorten zijn: netto kan door een afzonderlijke netto-/keuzebudgetbetaling afwijken van uitbetaling. **Een goede LiquidHR-required control sluit alle werkelijk toepasselijke nettovergoedingen, netto-inhoudingen en uitbetalingscomponenten expliciet aan op de betaling.** Gebruik geen hardcoded verschilcorrectie in de PDF-renderer.

### AFAS-uitleg als referentie voor medewerkerbegrip

AFAS beschrijft op zijn Salariswijzer-pagina onder meer bijtelling auto, brutoloon, BSN, bijzonder-tariefjaarloon, keuzebudget, loonheffing, nettoloon, nettovergoedingen, parttimepercentage, pensioen, tabelkleur en vakantiegeld. Gebruik deze onderwerpen als benchmark voor een toekomstige **typed term/explanation catalog** die in de web-ESS loonstrookviewer contextual hulp toont. Per term een door LiquidHR onderhouden, versioned beknopte uitleg met toepasselijkheid; niet blind AFAS-tekst kopiëren en niet alle technische uitleg in de PDF proppen.

### Voorgestelde LiquidHR Standard PDF-indeling

1. **Header:** werkgeverlogo of neutraal LiquidHR, werknemer, uitbetalingsperiode, geboekstempeldatum/documentversie voor interne audit.
2. **Uitbetaling:** opvallend `uit te betalen`; betaalmethode/rekening en eventuele afzonderlijke deelbetalingen.
3. **Bruto → fiscaal → netto → uit te betalen:** heldere, blokgewijze periodieke berekening, echte componentregels met hoeveelheid, basis en bedrag. Bijzondere looncomponenten en cumulatieven alleen als ondersteund.
4. **Dienstverband & fiscale informatie:** compacte verplichte gegevens en relevante interpretatiecontext, optionele extra bedrijfsvelden op afgesproken plekken.
5. **Conditionele blokken:** auto/mobiliteit, reserveringen/verlofsaldi, vergoedingen/bijzondere context, uitsluitend waar van toepassing én gevalideerd.
6. **Documentfooter:** werkgevercontact indien geconfigureerd, betalings-/documentreferentie en paginering.

Klant mag binnen `CUSTOMIZED_STANDARD` alleen **als optioneel gemarkeerde** blokken of velden verbergen. Denk aan interne kostenplaats, extra mededeling of uitgebreide reserveringsinformatie voor zover die niet vereist is in het getoonde documenttype. Verplichte loonregels en juridische contract-/minimumloonvelden blijven beschermd. Klantlogo hoort in de headerzone, met veilige bestands-/beeldvalidatie.

### Validatie/golden documentcases

- **NET ≠ PAYABLE:** een synthetische extra nettobetaling van €25 leidt tot exact €25 extra uitbetaling, met beide waarden afzonderlijk duidelijk op de strook en aansluiting naar betalingsprojectie.
- **No optional data:** geen lege mobiliteits- of reserveblokken zonder werkelijk ondersteunde brondata.
- **Required fields:** alle vereiste velden blijven zichtbaar na klantconfiguratie die optionele secties verbergt.
- **Classification:** normale, bijzondere en cumulatieve bedragen verschijnen alleen na onderbouwde berekening en statutaire classificatie; nooit afgeleid uit visuele tabelstructuur.
- **Versioning:** wijziging logo/opmaak creëert nieuwe templateversie en verandert reeds uitgegeven PDF-documenten niet.
- **Legibility:** A4 PDF met lange loonregellijst, meervoudige pagina's, behoorlijke layout op afdruk en mobiele PDF-viewer.
- **Disclosure:** BSN (voor zover wettelijk benodigd), IBAN en andere persoonsgegevens blijven uitsluitend bij de bevoegde werknemer of geautoriseerde payrollactor.

Geraadpleegde uitlegpagina AFAS: https://www.afas.nl/salariswijzer (geraadpleegd 2026-10-01). Dit blijft een secundaire UX-benchmark; voor verplichte inhoud gelden officiële Nederlandse bronnen uit de eerdere secties.
