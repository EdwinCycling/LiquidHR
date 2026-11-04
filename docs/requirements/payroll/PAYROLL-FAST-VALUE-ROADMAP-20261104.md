# Payroll Fast Value — gedetailleerde uitvoeringsroadmap (4 november 2026)

> **Besluit:** prioriteer (1) een volledige bruto-netto- en werkgeverskostenberekening op een bestaande geautoriseerde synthetische medewerker, (2) daarna een read-only ESS-pro-forma voor eigen salaris/extra uren/bonus, (3) vervolgens echte HR Admin-looncomponenttoewijzingen, componenttemplates en grotere Payroll-dekking. Bouw uitsluitend voort op de ene canonieke GitHub main en Vercel-app. Dit document is een nieuwe product-/uitvoeringsprioritering boven de historische volgorde in AA-PAYROLL-COMMERCIAL-ROADMAP-20261019. Het vervangt geen wettelijke/fiscale bronreview.

**Startbasis:** code-audit [AA-PAYROLL-AUDIT-20261104](../../AA/AA-PAYROLL-AUDIT-20261104.md); bestaande productvisie [Commercial Payroll Roadmap](../../AA/AA-PAYROLL-COMMERCIAL-ROADMAP-20261019.md). Realisatie is gestart met [issue #92 — eerste berekening & ESS-pro-forma](https://github.com/EdwinCycling/LiquidHR/issues/92) en [issue #93 — echte per-periode componenten](https://github.com/EdwinCycling/LiquidHR/issues/93). De tickets en dit document zijn **implementatieopdrachten**, niet de claim dat de functionaliteit al geleverd is.

## 1. Bestaande code — niet opnieuw bouwen

| Onderdeel | Code | Status bij start |
| --- | --- | --- |
| Deterministische componentenengine | packages/payroll-engine/src/engine/engine.ts | Pure buildCalculationInputs + calculatePayroll aanwezig; sourceValueOverrides wordt al gevalideerd en in inputHash opgenomen. |
| Nederlandse regels 2026 | packages/payroll-rules-nl-2026 | Scenario's en onafhankelijke orakels aanwezig; geen algemene NL-fiscale dekking. |
| Payroll-bronnen | apps/hr-suite/lib/payroll/source/liquid-hr-source-provider.ts | Actieve bronversies, W04 vrijgegeven uren, IKV/fiscaal/pensioen/werkgever/cumulatieven, source gaps. |
| Persistente individuele berekening | apps/hr-suite/lib/payroll/employee-payroll-calculation-service.ts | Berekening is gekoppeld aan muterende snapshots/runs/lifecycle. **Niet rechtstreeks voor ESS what-if gebruiken.** |
| HR Admin batch & run UI | apps/hr-suite/lib/payroll/payroll-professional-run-service.ts en app/(dashboard)/payroll/runs | Bestaande OPEN-periode- en voorcontroleflow; voor live/demo gerichte eindacceptatie vereist. |
| ESS Mijn salaris | app/(dashboard)/my-salary/page.tsx, components/payroll/my-salary-dashboard.tsx, payroll-professional-service.ts | Toont uitsluitend geautoriseerde FINALIZED-historie en loonstroken; géén actuele read-only scenarioengine. |
| Componentcatalogus | app/(dashboard)/payroll-components, lib/payroll/component-library.ts en component-draft-service.ts | Definities/drafts; eenmalige medewerker-/periode-invoer en -acceptatie nog als afzonderlijke UX/functionele keten te bewijzen. |
| Payroll-aanschakeling | lib/payroll/feature-flag.ts | Globale labpoort geeft true; toegang blijft tenant-/administratie-/RLS-gebonden. |
| Een versie | GitHub main, Vercel liquidhr | Op de 4-nov voorafgaande productbaseline kwamen source-SHA en canonieke alias overeen; nieuwe docs-commits zijn geen nieuwe functionaliteitsacceptatie. |

## 2. Nieuwe prioriteiten — waarde zo vroeg mogelijk zichtbaar

### S0 — PAYFAST-CALC: eerst aantoonbaar berekenen (P0)

**Doel:** binnen de bestaande /payroll/runs-werkplek een medewerker en geautoriseerde OPEN periode kiezen en zichtbaar berekenen: bruto, werknemerspensioen, fiscale loonbasis, loonheffing, netto, werkgeverspremies en werkgeverskosten. Benoem niet-berekenbare componenten expliciet.

**Herbruikbaar bewijs:** R1/R2 Retail, Lisa/Jaap DEMO, K2-synthetische referenties en W04 bronhash. Begin met één daadwerkelijk complete, bestaande geautoriseerde Core→Payroll set (R1/R2 of andere complete fixture via reguliere diensten). De engine-fixture alleen is onvoldoende bewijs dat de echte Core-provider en live app werken. Jantje/Mars met HOURLY_VARIABLE is een tweede testcase, geen reden om de eerste berekening niet te leveren.

**DoD:** echte read via één geautoriseerde HR Admin, broncontrole, conceptberekening, percentages/afrondingen, source/input/result-hashes, controle tegenover bestaande onafhankelijke cent-oracle, leesbare UI/390px. Geen FINALIZED-run en geen fictieve officiële brondata.

### S1 — PAYFAST-SCENARIO: pure read-only rekenketen (P0)

**Doel:** een service rond dezelfde Payroll-engine die een **baseline** en een **hypothetische wijziging** berekent vanaf dezelfde gepinde actieve bronset. Geen writes, geen nieuwe berekeningsrun, geen salariswijziging en geen mutatie van FINALIZED-artifacts.

Bouw in apps/hr-suite/lib/payroll een nieuwe server-only scenario-service (naam vrij naar bestaande conventies). Pipeline:
1. Identificeer actor, self-scope en actieve administratie server-side; lees bestaande Payroll-bron met exact dezelfde provider, correct period identity en sourceVersionVector.
2. Valideer bron-readiness (gewoonlijke fiscaliteit, IKV, contract/schedule, pensioen, werkgeversconfig, openingscumulatieven en toepasselijke payroll component/CAO-versies).
3. Bouw baseline-input met buildCalculationInputs en draai de pure calculatePayroll.
4. Bouw een scenario met expliciet toegestaan en gevalideerd hypothetisch bedrag/urenpercentage plus coherente afgeleide pensioen-, fiscale en werkgeversgrondslagen; gebruik sourceValueOverrides **alleen** op geldige source componentoutputs; snapshot/provenance blijft waarheid over de werkelijke Core-data.
5. Draai dezelfde pure engine; retourneer beide resultaten, verschillen, relevante controles, sourceHash, twee inputHashes, twee resultHashes, regelleverancier-/bronversies en aangenomen wijziging. Scenario-output is niet het werkelijke nettoloon.
6. Bij MISSING/UNSUPPORTED/CONFLICT/SOURCE_GAP of onvolledige productondersteuning: geen schijnnauwkeurige netto-uitkomst; toon reden en herstelactie.

**Essentiële architectuurvalkuil:** calculateEmployeePayroll() maakt getOrCreate snapshots, inputsets en runs aan, markeert runs en schrijft lifecycle. Hergebruik de daaruit afgeleide zuivere berekeningsstappen, niet de muterende orchestration-route. Geen duplicate engine en geen direct clientcontact met Payroll Lab.

### S2 — PAYFAST-ESS: Mijn salaris / Wat als? (P0)

**Routevoorkeur:** /my-salary/pro-forma, met knop "Wat als?" in de bestaande /my-salary. Gebruik bestaande PageShell/Surface, payroll componentlabels, NL/EN-i18n en responsive 390px.

**Scenario's in volgorde van implementatie:**
1. Bonus (eenmalig **bruto**, voor een bestaande ondersteunde reguliere periode; let op juiste bijzonder-beloningstatus en fiscale behandeling, anders SOURCE_GAP).
2. Extra betaalde uren (+1 / +3 / vrij invoer) inclusief onderscheid tussen oproepuren, meerwerk, overwerk en TVT; pas uitsluitend toepasselijke componenten en accorderingsregels toe.
3. Toekomstige contracturen/salarisverhoging: percentage en bruto bedrag (optioneel toekomstige effectieve datum), met duur/parttime factor, cao/schaal/plafonds en pensioenbasis waar relevant; geen automatische contractmutatie.

**UX:** actuele peilperiode + eigen arbeidsrelatie, geldige basisbron, drie invoermogelijkheden, rekenknop/loader, huidig versus pro-forma bruto/werknemerspensioen/loonheffing/netto/werkgeverskosten, deltas, uitleg per component, bronstatus en waarschuwing "Dit is een berekening, geen salariswijziging of aanspraak". Denk ook aan employee selfservice zonder FINALIZED-maanden: de forecast mag actuele geautoriseerde Core-bronnen gebruiken, maar mag niet doen alsof het al een officiële loonstrook is.

**Autorisatie:** gebruik patroon authorizeMySalary (requireAuthContext + requirePermission('salary:read', employeeId)), maar dwing server-side eigen employeeId/employmentId en huidige tenant-/HR-groep-/administratieafbakening af. Andere medewerkers en ongeautoriseerde administraties zijn nooit selecteerbaar. Niet vertrouwensvol uit URL/JSON overgenomen employee-ID.

**Later als apart productgedrag:** "Dit voorstel indienen" via een bestaande PMUX-approval of expliciet goedgekeurde ESS→HR Admin wijzigingsaanvraag met bewaartermijn/audit; niet automatisch een salarisverhoging opslaan door "Berekenen" te klikken.

### S3 — PFAST-02: echte individuele componenten voor OPEN loonperiode (P1)

Issue #93: HR Admin kan uit systeem- of klantcomponentenbibliotheek een gecontroleerde medewerker-/periodetoewijzing maken voor bruto bonus, onkostenvergoeding, inhouding, toeslag. Uitvoeringsdatum, vervaldatum, fiscale/pensioenclassificatie, revisies, maker en goedkeurder. Eerst preview, dan gerichte mutatie, daarna herberekening en audit; retry mag geen dubbele betaling creëren. FINALIZED blijft immutable. Niet dezelfde tabel gebruiken voor definities en toegepaste bedragen tenzij bestaand contract dat werkelijk voorschrijft.

### S4 — PFAST-03: componentbundels tijdens onboarding (P1)

Versiebeheerde, ingangsdatumgebonden templates bij dienstverband: vaste toeslag, reiskostenregeling en andere periodieke componenten met applicabiliteitsregels. Geen toekomstige eenmalige bonus uitbetalen zonder individuele opdracht. Hergebruik de componenttoewijzing uit S3.

### S5 — Completeness hardening (P1, gefaseerd parallel)

- W04/HOURLY_VARIABLE, TWK/correcties: complete negatieve/idempotente Core→Payroll-verloning.
- Variabele en incidentele componenten: extra uren, vakantiegeldreserves, bijzondere beloning, vergoedingen/netto inhouding, mutatiehistorie.
- Fiscale betrouwbaarheid: IKV, loonheffingskorting, bijzondere beloningen, werknemersverzekeringen, meerdere loonperioden, cumulatieven, jaarovergang en eigen werkgeverparameters.
- Pensioen/cao: echte effectieve deelname, franchise, rekenbasis, parttime, deelmaand, vaste/variabele bronperioden, BPF/PFZW/werkgeversregeling.
- Kalender: maand én vierwekenperiode met exact 28 dagen en correcte jaar-/periodeovergang.
- Geautoriseerde PDF-concept, definitieve salarisstrook, werknemersinzage, verschillenverklaring, payroll-worklist en rolgebaseerde acceptatie.
- Core-migraties: 582 lokale SQL-migraties versus 594 remote registraties op de eerdere audit; reconcileer zonder automatische reapply/repair.
- Voor de reguliere TEST-app: één zichtbare en geautoriseerde codeflow, geen verborgen lab-only simulatie als substituut.

### S6 — Wettelijke NL-cyclus (P2, eigen formele gates)

Uitgaande loonaangifte, jaaropgaaf, pensioenbestanden, SEPA-betaalbestand, financiële journaalposten, multi-IKV, volledige TWK/jaarovergang, controle-/review-/inzend-/betaalstatus en onafhankelijke fiscale/CAO/pensioenreview. Eerst genereren en intern controleren; echte verzending/betaling uitsluitend met nieuwe expliciete bevoegdheid. De bestaande roadmap kwalificeert dit terecht als niet-commercieel gereed.

### S7 — Onderscheidende Payroll-beleving (G1–G3)

- **Flightdeck:** exception-first periodedashboard, afwijking naar eigenaar/actie, delta vorige periode en statuslijn.
- **Evidence Graph:** "waarom dit nettobedrag?" van loonstrookbedrag naar bron, berekeningsregel, versie en afronding.
- **Time Machine:** scenario's over meerdere perioden/teams met identieke regelkern; pas uitbouwen als S1 scenario-DNA en P1-brondekking stabiel zijn.
- **AI Payroll Copilot:** verklaart en bereidt voor op basis van bestaande berekende traces, mag nooit zelf netto bedragen verzinnen; goedkeuring bij echte mutaties.
- Na volledige gecontroleerde P2-validatie: P3 parallelverloningspilot en S1 commerciële opschaling.

## 3. Testmatrix en vrijgave

| Aspect | Minimale acceptatie |
| --- | --- |
| Referentiebedragen | Onafhankelijke cent-oracle op minstens één complete vaste maandlooncase en extra-uur/bonus-case; aparte variabele-loon/partial period-cases, geen aangenomen wettelijk correct bedrag. |
| Read-only pro-forma | 0 writes in Core/Payroll Lab: geen create-run/input/snapshot/lifecycle/contract/salary/payslip; gelijke bronhash en stabiele baseline; verschillend scenario-input/resultHash. |
| Correcte bron | Werkelijke jaar/maand/periodiciteit, effectieve regelversies, pensioen en cumulatieven; SOURCE_GAP expliciet in UI en API. |
| Autorisatie | ESS zelf uitsluitend eigen medewerker, HR Admin alleen bevoegde administratie, Manager en buitenlandse scopes geweigerd; service/RLS integratietests. |
| UX | Desktop en 390px, NL/EN, keyboard/label, bruikbare error/loading, heldere disclaimer. |
| Engineering | Gerichte tests vóór merge, root-tests/TypeScript/i18n/build op integratie-SHA; geen tweede engine/DB/actieve Vercel-app. |
| Hosted | Op canonieke bestaande Vercel-app met bewezen Git SHA: minstens één succesvolle volledige read-only scenario-berekening, daarna extra cases. |

## 4. Werkafspraken — voorkom de iteratiecarrousel

- Alleen TEST-synthetische data. Geen officiële waarden verzinnen of ontbrekende bronnen met SQL-bypass vullen.
- Focus eerst op S0+S1+eerste werkende ESS-bonuspro-forma. **Geen algemene login- of fixture-herbouw zolang de bestaande standaardrollen een bruikbare productroute bieden**; registreer een gerichte blocker en lever de onafhankelijke onderdelen wel.
- Commits terug naar dezelfde main, geen achterblijvende long-lived parallelbranch; één bestaande Vercel-app en twee bestaande gescheiden Supabase TEST-databases.
- Binnen een slice: eenmaal echte positieve route, relevante negatieve rol/RLS-tests, bron- en resulthashes, code/testbewijs, gerichte docs. Geen eindeloze herhaling van tests die niet door de wijziging worden geraakt.
- Featurecode actief en zichtbaar voor bevoegde rollen, niet onder een algemene off-switch; **wel** fail-closed bij ongeldige financiële brondata en altijd geen automatische FINALIZED/betalings-/aangifteactie.
- Documenteer uitkomsten op exacte SHA en onderscheid CODE-IN-MAIN, TESTED, HOSTED ACCEPTED en LEGALLY ACCEPTED.

## 5. Directe start / toegewezen werk

**Nu starten:** [PAYROLL-FAST-01 #92](https://github.com/EdwinCycling/LiquidHR/issues/92), eerst S0/S1 en de eerste ESS bonus-simulatie, daarna uren en salariswijziging.

**Parallel of meteen daarna:** [PAYROLL-FAST-02 #93](https://github.com/EdwinCycling/LiquidHR/issues/93) voor echte medewerker-/periode-componentinvoer.

**Daarna:** S4 templates en S5 ontbrekende P1-bronnen; roadmap bijwerken zodra uitvoer bewijs oplevert. Een globale P2-scope of andere betaalkoppeling niet achteloos in dezelfde PR meenemen.
