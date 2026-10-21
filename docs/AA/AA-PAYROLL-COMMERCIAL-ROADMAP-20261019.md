# AA-PAYROLL-COMMERCIAL-ROADMAP-20261019 — LiquidHR Payroll Next

> **Postrelease 21-10-2026:** geselecteerde Payroll-code is geïntegreerd in `1.20261021.1` / Vercel READY. Frits/Jupiter november-Kinderopvang `2026.09` heeft een **opgeslagen gesimuleerde CONCEPT-run**: bruto € 1.879,33; na werknemerspensioen/loonheffing € 1.710,84 (**niet definitief nettoloon**); werkgeverskosten € 2.689,17. De 'nog geen K2-run'-situatie in historische §4 (19 oktober) is voor dit CONCEPT ingehaald, **niet** voor FINALIZED, PDF, wettelijke bronreview of commerciële GA. Hosted `/payroll/runs` blijft laden. Beschermde Payroll/Nmbrs-runtime mist oorspronkelijke unieke `.env.local`. Zie [postrelease status](../quality/acceptance/runs/LIQUIDHR-POSTRELEASE-STATUS-20261021.md). De strategische fasering blijft toekomstplanning.


**Status:** PRODUCTVISIE + GEFASSEERDE LEVERROADMAP — voorstel ter uitvoering, geen claim van commerciële gereedheid
**Bijgewerkt:** 19 oktober 2026
**Doelgroep eerste commerciële fase:** Nederlandse mkb-werkgevers (circa 5–35 werknemers, uitbreidbaar naar 50+), HR Admin/salarisadministrateur, accountant, manager en medewerker
**Samenhang:** [AA-PAYROLL-CONVERGENCE-20261018](AA-PAYROLL-CONVERGENCE-20261018.md), [AA-PAYROLL](AA-PAYROLL.md), [AA-REL](AA-REL.md), [AA-OPEN](AA-OPEN.md)

> **North star: Payroll that explains itself.** LiquidHR verklaart van dienstverband, cao en werkuren tot bruto, inhoudingen, nettoloon, werkgeverskosten, documenten en aangiften elke berekening, signaleert wijzigingen voordat een loonrun sluit, en laat bevoegde mensen beslissen. Geen AI-besluiten over wettelijk correcte loonbedragen zonder deterministische payroll-engine en geautoriseerde review.

## 1. Wat voor product bouwen we?

**Niet:** een Payroll Lab, een verzameling calculators, een AI-chat die bedragen verzint of een ingewikkeld traditionele salarispakket met een chatbot erbovenop.

**Wel:** een modulair **payroll operating system** waarin HR-data en cao-/pensioenregels direct de payroll-engine voeden, met één versieerbaar en auditbaar bronmodel, volledige loonperiode-/werkgever-/werknemercontext, en menselijke controle over iedere definitieve actie.

Vier productprincipes:

1. **One source of truth:** één canonieke Core-bron en consistente effectieve datums voor arbeidsvoorwaarden, salaris, pensioenen, looncomponenten en individuele toewijzingen. Historische FINALIZED-runs blijven snapshots.
2. **Every euro explainable:** voor elk loonstrookbedrag toonbaar: invoerrecord, wettelijke/cao-versie, formule, afrondingsstap, gebruiker-/geautomatiseerde actie en verschil met vorige periode. De zichtbare uitleg mag HR/fiscale persoonsgegevens nooit buiten autorisatie vrijgeven.
3. **Automation with accountable approval:** automatisch verzamelen, controleren, voorstellen en waar toegestaan voorbereiden; geldstromen, finaliseren, aangifte en uitzonderlijke correcties alleen volgens beleid met expliciete rechten, consent, audit en bevoegde autorisatie.
4. **Compliant by design:** officiële bronversies, bronreview, ingangsdatum, publicatie en onafhankelijke berekeningsorakels. Onbekende Whk-beschikking, pensioenuitzondering, inkomensverhouding of fiscale bron leidt tot verklaarde exception; nooit naar een stilzwijgende fictieve default.

### Markttoets 19-10-2026

- [AFAS salarissoftware](https://www.afas.nl/salarispakket) noemt >200 cao's, pensioenregels, automatische cao-updates en een Payroll Auditor.
- [Loket salarissoftware](https://loket.nl/functionaliteiten/salaris/) noemt >250 controles, automatische aangifte, koppelingen en proefruns.
- [Nmbrs payroll workflows](https://support.payroll.nmbrs.com/hc/nl/articles/204056656-Payroll-workflows) kent automatische en instelbare salarisverwerkingsworkflows.

**Conclusie:** “we hebben cao's / checks / automatisering / AI” is geen verdedigbare uniciteitsclaim. Beoogde onderscheidende combinatie: *live impact van HR-mutaties, payroll evidence graph, bron-gebaseerde cao-diffs, open regelcomponenten met governance en veilige AI-acties*. Valideer dat nog in klantinterviews; het woord “uniek” is voorlopig een ambitie, geen marktfeit.

## 2. Vijf productervaringen die klanten moeten onthouden

### A. Payroll Flightdeck — alleen aandacht voor afwijkingen

- Eén werkgever-/periodedashboard: **Ready, Needs review, Blocked, Ready for approval, Finalized, Payable, Filed** (de laatste twee afzonderlijk, nooit afgeleid uit FINALIZED).
- Per blokkade: exacte medewerker, bron, verantwoordelijke, benodigde volgende handeling en effect op periode/contract.
- Vergelijk vorige periode, huidige concept, cao-wijziging en werkgeverlasten; geautoriseerde bulkoplossingen.
- Rolgebaseerde review door klant, accountant, salarisadministrateur en manager; audit van beslissingen.

### B. “Waarom krijg ik dit bedrag?” — Payroll Evidence Graph

- Klik op `Netto €x` en volg het spoor naar bruto, uren, toeslagen, pensioen, loonheffing en bron.
- Per bedrag de onderliggende cao-/fiscale regel, versiedatum, inputs, formule/afronder en wijziging sinds vorige strook.
- Medewerker krijgt een begrijpelijke beperkte uitleg; HR Admin/salarisexpert mag dieper gaan. Geen gegevens van andere medewerkers.
- Downloadbaar controlebewijs voor interne QA, accountants en uitzonderingsreviews.

### C. Cao & Pension Autopilot — **bronversies centraal**, toepassing per werkgever

- Centraal officieel cao-register met volledige varianten, schaaltabellen, beoordelingsstappen, toeslagen en bron-PDF/hash/validatie.
- PFZW/BPF/bedrijfseigen regelingen met componenten, deelnamevoorwaarden, franchise/cap, deeltijd-/deelmaandmethoden en historische versies.
- Een aangekondigde wijziging toont: **welke werkgevers/medewerkers worden geraakt, vanaf wanneer, verschil in bruto/netto/werkgeverskosten, wie moet bevestigen**.
- Publicatie met validatie en vier-ogen review; werkgever kan toepasselijkheid en echte uitzonderingen beheren, niet de centrale landelijke cao aanpassen.
- Correctieversies met dezelfde officiële ingangsdatum moeten bestaande historische loonruns onveranderd laten.

### D. Payroll Time Machine — veilig voorspellen, vergelijken en corrigeren

- “Wat als contract 32→24 uur gaat?”, “Wat kost een salarisverhoging?”, “Wat betekent de nieuwe cao?”, “Wat zou een bonus netto opleveren?”
- Forecast per medewerker/team/administratie en jaar, inclusief werkgeverslasten en pensioen.
- Gescheiden **scenario**, **voorgenomen wijziging**, **daadwerkelijke effectieve wijziging** en **gefinaliseerde loonrun**. Een simulatie schrijft nooit automatisch naar de salarisbron.
- Retro-correcties in nieuwe reguliere correctieruns met bewijsverwijzing; nooit bestaande FINALIZED-run aanpassen.

### E. AI Payroll Copilot — via MCP, met regels en rechten

- Agent kan **uitleggen, controleren, voorbereiden en signaleren**: “Waarom wijkt Noah af?”, “Welke cao-versies wijzigen in januari?”, “Wat blokkeert mijn loonrun?”, “Maak een concept van de jaarovergang.”
- Alleen deterministische engine berekent bedragen. De agent citeert bron/versie en mag ontbrekende feiten niet invullen.
- Tool-level autorisatie, expliciete gebruikerstoestemming voor mutaties, audit, budget-/creditlimieten en PII-minimalisatie; geen agent met directe databaseadministratierechten.
- Eerst read-only → voorstellen ter review → beperkte geautoriseerde acties → pas later gecontroleerde procesautomatisering.

## 3. Stapsgewijze leverroadmap

Alle iteratieaantallen zijn **planningshypothesen** voor afgebakende Codex-waves, geen beloften over doorlooptijd. Een wave heeft één eindresultaat, echte Core-readback en bewijs; niet één mega-run van een hele dag.

| Wave | Focus | Verwachte omvang | Meetbaar GO-criterium |
| --- | --- | --- | --- |
| **D0 — Demo payslip (lokaal PARTIAL afgerond, 21-10)** | Bestaande FINALIZED Mars DEMO-002-PDF vanuit normale HR Admin en Employee-selfservice bekijken/downloaden | **Uitgevoerd op lokale featurebranch** | Desktop HR Admin/Employee en identieke opgeslagen bytes/hash PASS; HR Admin 390 px PASS. Employee 390 px, live Manager/foreign-tenant probes en hosted acceptance blijven OPEN. Geen commerciële GA-claim; zie [PAYDOC-D0](../quality/acceptance/runs/PAYDOC-D0-20261021-LOCAL.md). |
| **D1 — Kinderopvang K2** | Bestaande 01-11 salarisregel met juiste CAO_SCALE/tijdlijn en PFZW, periode-consistente uren, concept-run en PDF | **2–4 gerichte iteraties** | Nieuwe opgeslagen K2-CONCEPT-run met bruto/pensioen/loonheffing/netto/werkgeverskosten, PDF/hash; geen historisch FINALIZED geraakt |
| **D2 — Vier echte cao-cases** | Retail Mode R1/R2, K2 en Mars: contracten, bedrijven, branch/trede, premies, uitzonderingen | **circa 5–8 gerichte iteraties totaal vanaf geldige basis** | Vier reproduceerbare Core-runtraces, scopes, officiële/werkgeverbron, review & PDF; onbekende legaliteit expliciet HOLD |
| **F0 — Code convergence** | PAYINTEGRATE, PAYQA, CAO-SETUP/PENSION/SOURCE/CORE-RESET, Core `25P02`, STAR integreren; Node/npm/Windows-runtimes en migraties | Parallel na D1 | Eén gecontroleerde integration HEAD, op juiste actieve Core gebonden; unit/type/build/security/browser + scopechecks; nog geen main/deploy |
| **P1 — Payroll Minimum Reliable Core** | Reguliere maandverwerking, werkgeversconfig, fiscale tabellen, salarisschalen, variabele componenten, deeltijd/deelmaand, pensioen, ESS-documenten, cumulatieven | Meerdere waves | Meerdere maanden, typen dienstverband/IKV, componenten en 4 cao-cases deterministisch/peer-reviewed; alle blokkerende bronvelden expliciet |
| **P2 — Wettelijk complete NL-cyclus voor ondersteunde doelgroep** | Bijzondere beloningen, multi-IKV, TWK-correcties, jaarovergang, jaaropgaaf, loonaangifte **uitgaand**, pensioenaanlevering indien vereist, SEPA betaalbestand, financiële journaalposten, dubbele autorisatie en inzendstatus | Afzonderlijke harde releasegate | Onafhankelijke orakels, end-to-end proefperioden/jaargang, gevalideerde aangifte-/betaalbestanden; zonder bewezen volledigheid niet als commerciële live-payroll aanbieden |
| **P3 — Pilot met parallelverloning** | 2–3 welomschreven pilotwerkgevers (eenvoudig bedrijfseigen + 1 ondersteunde cao) en 3 volledige loonperioden naast bestaand gecertificeerd proces | Pilot per werkgever | Verklaarde verschillen binnen acceptatiegrenzen, bron-/cao-/pensioenreview door deskundige, herhaalbare correcties, security/AVG/backups/incidentplan, rollback |
| **G1 — Payroll Flightdeck + Explainability** | Exception-first UX, evidence graph, versievergelijking en loonstrookuitleg | Na betrouwbare P1-kern, kan deels parallel | Elke berekende component verklaarbaar; 100% traces in ondersteunde scenario's; geautoriseerde drilldown, geen leaky PII |
| **G2 — Time Machine + intelligent cao-diff** | Scenarioengine, netto-/werkgeverskostenimpact, toekomstige cao-wijzigingen, retro-simulatie | Na P2 regelvastheid | Simulatie creëert geen payroll-write; reproduceerbaar verschilrapport, overeenkomend met echte engine op dezelfde input |
| **G3 — AI Payroll Copilot / managed autopilot** | Read-only advies via MCP, daarna approval-first changes, tenantbreed exceptionmanagement | Pas na G1, P2-autorisatie | Elke agentactie traceerbaar, geen ongeautoriseerde persoonsgegevens, geen AI-berekende bedragen, veilige weigeringen en menselijke goedkeuring |
| **S1 — Commercial scale** | Accountantportal, self-serve migratie (loonstrook-PDF/history na expliciete review), leveranciers-API, rapportage, jaarovergangen, performance, SLA, metering/billing en support | Na bewezen pilot | Gestandaardiseerde klant-onboarding, 3-cyclus betrouwbaar, schaalbaarheid, documentatie/support en formele releaseprocedure |

### Wat mag al vóór volledige P2?

- **Demo's** met duidelijk fictieve personen en echte LiquidHR-product-UX.
- **Interne berekeningen** en gecontroleerde pilot/paralleldraai zonder echte betaling/aangifte.
- **Geen** toezegging “wettelijk volledig verlonen” of productieve salarisuitbetalingen voordat P2/pilotacceptatie rond is.

De commerciële pilot heeft een aparte vrijgave na security, bronkwaliteit, privacy-/contractuele en fiscale toets. Gegevens die de werkgever verplicht verstrekt, zoals Whk-beschikking of specifieke vrijstelling, worden nooit automatisch “gecertificeerd”.

## 4. Historische stand per 19-10-2026 (zie postrelease-update)

### Al aantoonbaar

- Reguliere maandwerkplek, componentengraph, fiscale routes, werkgeverparameters, pensioen en opslag van historische FINALIZED Mars-runs.
- **Emma:** bruto € 2.110,20, netto € 1.282,37, werkgeverskosten € 2.799,30; bestaande FINALIZED-PDF/hash en 32/32 controles.
- **Noah:** bruto € 1.758,50, netto € 1.070,23, werkgeverskosten € 2.329,33; bestaande FINALIZED-PDF/hash en 32/32 controles.
- Officiële **Kinderopvang**-bron in Core: 4 PUBLISHED effectieve perioden à 196 tredebedragen = **784** actuele bronwaarden; oude 1-rij-proefversie ARCHIVED, niet destructief verwijderd.
- **Retail Non-Food**-bron in Core: PUBLISHED januari 2026 **533** rijen en juli 2026 **577** rijen, totale **1.110**; onderscheid Mode/Sport-Schoenen/Tuincentra/Wonen en 2%-beoordelingsregels.
- PFZW/bedrijfseigen productroutes gebouwd en K2-werknemersinvoer gedeeltelijk opgeslagen; K2 heeft nog geen nieuwe loonrun.
- Core `57014/25P02` talentfix geaccepteerd op eigen branch en lokaal opgenomen in `integration/pay-converge-20261018`; overige CAO/STAR nog niet integraal.
- Salaris-RPC-migratie `20261019165116` toegepast, behoud van `CAO_SCALE` beoogd.

### Open blokkades / correcte volgorde

1. **Frits K2 bestaande 01-11 tijdlijnregel:** `TIMELINE_EFFECTIVE_DATE_CONFLICT` bij poging tweede regel; veilig correctiepad gebruiken, geen tweede effectieve regel op dezelfde datum. Originele salaris-/urenperioden en 18-10 zondaguren niet onterecht combineren.
2. Gedeelde lokale runtime/hardlink/Node-Windows issues: één ondersteunde launcher, geen dagenlange start-/browserlus; leg eventuele echte blokkade vast.
3. PFZW/BPF en bedrijfseigen deelname-/bronverificatie; CAO-pensioen en payroll-cumulatieven voor K2/R1/R2.
4. Bestaande proef-/Demo-regelingen consolideren en werknemers in juiste administratie op daadwerkelijke scope, zonder historische FINALIZED-verwijzingen te verliezen.
5. Productcode en migratieversies plus STAR integreren; full QA op gecombineerde SHA.
6. Voor echte commerciële klantpayroll ontbreken P2 wettelijke/jaarwerk-/betaal-/aangifteketen en formele review; niet verwarren met gereedheid van één loonstrook.

**Deze roadmap is toekomstplanning. Uitbreidingen voorbij D2/P2 zijn geen al gebouwde features.**

## 5. Technische flexibele kern — anti-spaghetti

```text
[Core HR / contract / IKV / uren / verlof / variabel loon]
                         |
                         v
[Bronregister: wet + cao + pensioen + werkgeverversies]
                         |
                         v
[Effective-dated input snapshot en toestemmingscontext]
                         |
                         v
[Deterministische payroll-componentengraph]
        |         |          |            |
      bruto    pensioen   fiscaal     werkgeverkosten
        \         |          |           /
         +---- trace + delta + bewijs ---+
                         |
                         v
     [concept -> review -> FINALIZED snapshot]
             |            |             |
        loonstrook     cumulatieven    exports/aangifte
                         |
             [AI leest/verklaart/adviseert]
             [actie alleen met autorisatie]
```

Technische niet-onderhandelbare afspraken:

- **Immutable effective revisions** + vervangende correctieversies, periodieke source snapshots en payroll-run lineage.
- **Component graph** met type- en basisafhankelijkheden, afrondingsbeleid per wettelijke fase, geen arbitraire `eval` of klantcode in salarisprocessen.
- **Fiscale/cao-/pensioenparameterlaag** met bronbewijslast, menselijke approval en géén browser-hardcoded fiscale getallen.
- **RLS tenant + HR-groep + administratie + rol + IKV** bij iedere mutatie en readback, inclusief AI/MCP.
- **Deterministische rekenkern** als enige autoriteit voor bedrag, trace en PDF; AI mag niet direct factuele salarisbedragen produceren zonder rekenresultaat.
- **Scheid** goedkeuring, FINALIZED, PAYABLE en FILED; elk met eigen status, actor, audit en toegangsbeleid.
- **Migraties en opbouw van templates** via normale UI/service met idempotentie, revisieconflict-afhandeling en historische herleidbaarheid.

## 6. Commerciële verpakking — te testen, niet nu al prijzen vastleggen

| Aanbod | Voor wie | Propositie |
| --- | --- | --- |
| **LiquidHR Payroll Core** | Kleine mkb-werkgevers, eenvoudige/ondersteunde cao | Zelf loon verwerken, centrale cao's, werkgever/employee ESS, loonstroken, jaaropgaaf en basis-exports (pas als P2 vrijgegeven) |
| **LiquidHR Payroll Plus** | Groeiend mkb en payrollspecialisten | Meerdere administraties, uitgebreide cao-/pensioenregelingen, multi-IKV, vier-ogen, declaraties/urenintegratie en correcties |
| **LiquidHR Payroll Intelligence** | Complexere organisaties en accountants | Evidence Graph, Flightdeck, Time Machine, cao-diff, AI Copilot en bedrijfsbrede controls |

Prijsarchitectuur pas vastleggen na kostprijs/Loonaangifte-onderhoud, pilotfeedback, vraagbereidheid, AVG-verwerkerskosten en supportbelasting. Voorkom verborgen fiscale-/pensioenonderhoudskosten. AI-creditbudgetten kunnen aansluiten op bestaande LiquidHR-governance, maar mogen de kernpayroll niet stoppen.

**Go-to-market:** start met één beheersbare NL-sector/bedrijfseigen regeling plus Kinderopvang/Retail als bewezen ondersteunde branches; verkoop “minder werk en meer controle”, niet “alles is automatisch wettelijk correct”. Bouw aantoonbare cases voor HR-professional en accountant; maak demo en echte productie apart in marketing/contracten.

## 7. Meetbare succescriteria

### Productbewijs

- **100%** van bedragen en bronregels in ondersteunde referentiecases heeft een trace naar invoer/versie/formule/afronding.
- **0** onverklaarde afwijkingen tegenover onafhankelijke salaris-, pensioen- en fiscale orakels in de ondertekende acceptatieset; afwijkingen worden als HOLD vastgelegd.
- **0** ongeautoriseerde cross-tenant/cross-admin reads of writes in gerichte security-, persona- en live-acceptatie.
- **0** stilzwijgende wettelijk gefingeerde werkgeversinstellingen.
- Historische FINALIZED-run/PDF/hash mag niet wijzigen door broncorrectie, reimport of retro-scenario.

### Commerciële hypothesen — te toetsen in pilots

- Normale perioderun voor een klein bedrijf met correcte brondata binnen minuten te reviewen; uitzonderingen zichtbaar en gericht af te handelen.
- Inrichting van een ondersteunde eenvoudige werkgever binnen één werkdag zonder salarisexpertische bronherinvoer (exclusief verplicht te verzamelen werkgeverbescheiden).
- Gebruiker kan in minder dan twee minuten uitleggen waarom het nettoloon van één werknemer veranderde.
- De bespaarde tijd en foutcorrecties zijn aantoonbaar versus parallelverloning bij minstens 2–3 pilotwerkgevers.

### Stop-/vrijgavepoorten

- **DEMO GO:** een echte opgeslagen, visueel gecontroleerde fictieve PDF plus veilige presentatie.
- **TECH INTEGRATION GO:** geïntegreerde SHA, schone migratiegeschiedenis, TypeScript/Vitest/build/lint, browserroles en vier cao-/bedrijfseigen cases.
- **PILOT GO:** ondersteunde doelgroep, compliance/expert review, drie parallelle loonperioden, contract/AVG/security, rollback, support en aansprakelijkheidsafbakening.
- **COMMERCIAL LIVE GO:** de wettelijk vereiste loon-/jaar-/aangifte-/betaling/uitzonderingsketen voor de verkochte use cases aantoonbaar compleet; externe betaal-/filingfuncties afzonderlijk geautoriseerd.

## 8. Besluit: eerst tastbare output, daarna onderscheid

**Directe prioriteit:** D0 heeft nu beperkte lokale viewer-/bytepariteit voor bestaande Mars DEMO-002-data; de resterende mobiele/browser- en scopegates staan in AA-OPEN. D1, een K2-CONCEPT-run met originele Core-bronnen, geldige tijdlijn en loonstrook, blijft een afzonderlijke toekomstige wave en is niet door D0 gestart. Niet wachten op AI/Flightdeck voor een eerste demo; commerciële en wettelijke acceptatie blijven apart.

**Daarna:** D2 meerdere cao-cases, F0 codeconvergentie, P1/P2 complete looncyclus. G1/G2/G3 parallel onderzoeken zodra rekenkern/evidence betrouwbaar zijn. Alleen zo wordt de visie geloofwaardig én verkoopbaar.

### Strategische samenvatting

> **LiquidHR Payroll = Payroll Flightdeck + Evidence Graph + Cao/Pension Autopilot + Time Machine + AI Copilot, boven op een aantoonbaar correcte Nederlandse salarisengine.** Het verschil maken we met vertrouwen, uitlegbaarheid, flexibiliteit en voorspellende workflow — niet met onbewezen uniciteitsclaims.
