# LiquidHR Payroll — roadmap en statusoverdracht

**Status:** LIVING / SCOPE PAYROLL — geen afzonderlijk releasebesluit  
**Momentopname:** 2026-10-13, na PAYESS-01- en PAYCALC-REAL-01-overdracht  
**Bron:** Payroll-ontwikkelthread; gedateerde Codex-opleverrapporten, geverifieerde main/featurebranch en `docs/AA/AA-PAYROLL.md`.  
**Doel:** concrete status van dit Payroll-spoor aan de centrale roadmap overdragen, zonder andere LiquidHR-threads te overschrijven.  
**Canonical:** `EdwinCycling/LiquidHR`; één HR-suite, aparte Payroll-database en pure TypeScript calculation engine.

> **Bewijsniveaus strikt gescheiden:** `RELEASED ON SYNTHETIC TEST` ≠ klantproductieacceptatie; `BUILT ON BRANCH` ≠ release; `LOCAL FOUNDATION` ≠ volledige berekening; `PLANNED` ≠ geïmplementeerd. Relevante OPEN-punten blijven in AA-OPEN en de gedateerde acceptatierapporten leidend.

## 1. Gecontroleerde momentopname

- **Canonieke main:** `f7db482b19b81d9c5aa5517c66394faa5f628e1b` (13 oktober 2026); PAYLAB-UX-01 is hierin opgenomen. De automatische Vercel-deployment `dpl_5b3db54pGakfcGWRKywr861N5xCM` is READY met de alias `https://liquid-hr-hr-suite.vercel.app`. Dit is operationeel uitsluitend synthetische TEST; Vercel noemt de deploymentchannel `Production`.
- **PAYESS-01:** op remote featurebranch `work/PAYESS-01-20261013`, HEAD `8d96dd4cba86d2b90ba3649d0fd55ddaa77f0fe6`. Niet in main; geen deployment. Authenticated TEST-acceptatie OPEN.
- **PAYCALC-REAL-01:** lokale branch `work/PAYCALC-REAL-01-20261013`, lokale commit `a23c197bc05710f963aefeb5554093a4a88220cc` (door Codex gerapporteerd; niet remote bevestigd/gepusht). **PARTIAL / HOLD**: cyclusfoundation aanwezig, geen generieke Core-backed salarisberekening.
- **PAYCALC-REAL-01B:** vervolginstructie opgesteld; **uitvoering niet bevestigd**. PAYFLOW-01/02 mogen niet als gestart worden gemarkeerd.
- **Centrale AI-roadmap:** in deze Payroll-thread is geen nieuwe AI/MCP/agent-capability gebouwd. Payroll by exception is een payrollproces en wordt niet ten onrechte als AI-release gemarkeerd. De bestaande `LIQUIDHR_AI_MASTER_ROADMAP.md` heeft een eigen eigenaar en statuslijn.

## 2. Feitelijke voortgang en release-evidence

| ID / onderdeel | Feitelijk resultaat | Status en onderbouwing |
| --- | --- | --- |
| PAYCOMP-EDIT-01 | 24 immutable SYSTEM-definities; CUSTOMER_FORK/CUSTOM als gescopeerde DRAFT, versiehistorie, veilige DSL, validatie, preview en trace. Geen activering van DRAFT in de operationele Payroll-engine. | Eerder beperkte TEST-release; zie `AA-CURRENT` en editoracceptatie. |
| PAYCOMP bibliotheek-UX | Volledig overzicht, zoeken/filteren/sorteren, 25 resultaten per pagina, versies stabiel gegroepeerd; compacte provenance met auditvelden ingeklapt; responsive zonder horizontale overflow. | Op main/TEST geïntegreerd. Bibliotheek-UX: 17 gerichte tests; provenance-UX: 16 gerichte tests volgens overdracht. |
| PAYLAB-UX-01 | Begeleide proefrunstart (administratie, periode, ondersteund scenario, pakketversie), contextbalk, gegroepeerde PASS/WARN/FAIL-controles, veilige links naar exacte SYSTEM-componentversie. CAO-BENCH02 K1 blijft bereikbaar. Overbodig zichtbaar `Synthetische TEST`-label verwijderd. | **DONE / TEST RELEASED**, main `f7db482b...`, Vercel `dpl_5b3db54pGakfcGWRKywr861N5xCM` READY. 12/12 gerichte tests + browser-, lint-, type- en i18n-checks geslaagd. Geen OPEN-punten voor deze slice. |
| PAYDOC-STD-01A | Nieuwe A4 `LIQUIDHR_STANDARD_V1` loonstrook, LiquidHR-branding en employer-wordmark, bedragen/waarschuwingen uit persisted FINALIZED-run; beveiligde HR/Admin preview en download zonder artifactwrite. Oude immutable PDF blijft ongewijzigd (33.174 bytes; SHA-256 `41a84b88ebd06b01eb49802002a14d20f7170eb58628bd884f6d8c5472f1e82a`). Echte klantlogo-integratie is hiermee niet automatisch bewezen. | **LIMITED SYNTHETIC TEST RELEASE**, main `73cb370539770711544637962c4e897ea4cd6265`, Vercel `dpl_HuUFyGHWWpCXgydgdKDxhKEiUKiB` READY. 3.002 tests geslaagd, 8 overgeslagen; hosted anon/auth-negative smoke geslaagd. PDF-browserflow en live bedragcontrole **OPEN**, omdat bestaande Test HR Admin Mars BV kan selecteren en Lisa's FINALIZED-run onder Jupiter BV staat. Geen scopewijziging. |
| PAYESS-01 | `/my-salary`: meerdere echt opgeslagen definitieve perioden, bruto/netto-kerncijfers, Recharts-trend, maandverschillen, componentdrilldown, pensioen-/berekeningswaarschuwingen. Eén gedeeld loonstrokenoverzicht voor geïmporteerde `payslips` en gegenereerde Payroll-PDF's, in Mijn salaris én het bestaande medewerkersdossier. Afzonderlijke employee self-only PDF-route; geen hergebruik van HR Admin-preview, geen dubbel PDF-archief of automatische documentwrite. | **BUILT / PUSHED / CONTROLLED ACCEPTANCE OPEN**: code `e0fc0e97f843d744097687b5db9ff26dd63b8bd5`, docs/head `8d96dd4cba86d2b90ba3649d0fd55ddaa77f0fe6`; 55/55 gerichte en 3.027 HR-suite tests geslaagd, build/type/lint/i18n groen. Geauthenticeerde employee-browseracceptatie van beide documentbronnen en negatieve scope/downloadgevallen **OPEN**. Niet gemerged of gedeployed. Zie [PAYESS-01 acceptatie op featurebranch](https://github.com/EdwinCycling/LiquidHR/blob/work/PAYESS-01-20261013/docs/quality/acceptance/runs/PAYESS-01-20261013.md). |
| PAYCALC-REAL-01 | Bestaande `payroll_periods` als cyclus per administratie/periode, idempotente `DRAFT → OPEN` CAS, werklijst met eerdere persisted runs, actuele Core-bronvergelijking per geautoriseerd dienstverband, bronhash/versieverschillen en scheiding technische versus businessstatus. Definitieve geschiedenis read-only beschermd. | **LOCAL FOUNDATION / PARTIAL / HOLD**: lokale commit `a23c197...`; Payroll-gate 340 PASS/3 SKIP, engine 18 PASS, gericht 26 PASS. Nog **geen** generieke `calculateEmployeePayroll`, geen opgeslagen herberekeningsrevisies, geen scheduler, geen flow voor meerdere werknemers tegelijk. Geen push/merge/deploy, geen remote write/migratie. |
| PAYLAB-COMPARE-01 | Echte run-tegen-run-scenariovergelijking, anders dan bestaande handmatig ingevoerde vergelijkingsbedragen. | **PARKED op expliciet verzoek**; geen Codex-opdracht uitvoeren. |

## 3. Wat wél en niet fiscaal/rekenkundig werkt

**Bestaande bouwstenen:** generieke componentgraph-engine, versioned NL-2026 loonheffing voor een **beperkte, bewezen** reguliere maandcase (WHITE/NL/STD/onder AOW), snapshots/inputsets/resultaat- en bronhashes, pensioentrace, controles, immutable runhistorie, PAYRUN01-lifecycle `CONCEPT → REVIEWED → FINALIZED`, standaardloonstrook en een voorbereid cycle-overzicht.

**Blokker voor generieke Payroll:** de Core sourceadapter `apps/hr-suite/lib/payroll/source/liquid-hr-source-provider.ts` levert voor het fiscale profiel expliciet `SOURCE_GAP / NO_ACCEPTED_SOURCE_CONTRACT`. Realtime salaris-/contract-/roosterdata alleen is onvoldoende om correcte loonheffing en netto uit te rekenen. Een versioned/effective-dated, geautoriseerde fiscale bron met onder meer tabel, woonland, leeftijdscategorie, tijdvak, herleiding en loonheffingskorting moet concreet en controleerbaar aanwezig zijn. Geen profiel of bedragen afleiden uit persona, naam of testscripts.

**Andere gaps:** volledige IKV/multi-IKV, wettelijk voldoende PFZW-maandallocatie/centafronding voor algemene claims, niet-regulier loon/variabele mutaties/toeslagen, cumulatieve loonheffing en bredere 2026-situaties, volledige werkgeverslasten en pensioenfonds-/cao-varianten. Unsupported/source-gap is **geen nulbedrag en geen definitief maakbare volledige loonrun**. Basis voor official/production-grade Payroll moet per combinatie met officiële bron en onafhankelijke oracle worden bewezen.

**Historische regressiereferenties:** Lisa FINALIZED (run `57ac6c10-7a02-49c4-a588-2ca244e621d9`, revisie 5 volgens PAYCALC-handoff); Jaap CONCEPT (run `e20e0345-90ac-489b-9fee-7610b2d8f6a3`, revisie 3); Frits historische FINALIZED (run `338ef391-fbf6-435a-a4d7-e28a8024ebc2`, revisie 4). Frits' verbeterde PFZW-berekeningen zijn eerder als preview bewezen maar de nieuwe opvolgende persisted run is **niet** bewezen. Voor PAYDOC is de Mars/Jupiter-administratiemismatch een acceptatie-evidencegap, geen vastgestelde autorisatiebug. Neem oude en nieuwe Lisa-rekenversies niet door elkaar.

## 4. Productmodel: Continuous Payroll / payroll by exception

**Doelervaring:** per administratie en loonperiode is steeds een **actuele conceptberekening** beschikbaar. De salarisprofessional ziet de uitzonderingen, geen opdracht om iedere keer vanaf nul een run te starten. Conceptberekeningen mogen continu veranderen via **nieuwe immutable revisies**; een definitieve run nooit.

1. **PayrollCycle:** scope `tenant → HR-groep → administratie → periode`; medewerkers/dienstverbanden, regelpakketversies en actieve conceptkandidaten. `OPEN` is niet hetzelfde als `FINALIZED`.
2. **Meerdere berekeningen:** bij relevante Core-/mutatie-/regelwijziging markeer alleen geraakte medewerkers/dienstverbanden stale, bereken idempotent een nieuwe conceptrevisie; registreer oude bronversies, hashes en trace.
3. **Twee lagen status:** technische `PENDING/RUNNING/SUCCEEDED/FAILED` naast business `CONCEPT/REVIEWED/FINALIZED`; meerdere runs per periode toegestaan, één actuele aangewezen kandidaat per werknemer/dienstverband/context, historie bewaard.
4. **Exceptions-first:** ontbrekende bron, afwijkende bedragen, pensioen/fiscale gaps, open checks, late mutaties, gewijzigde pakketversies en blokkades in een actiegerichte werklijst met eigenaar, oorzaak en herstelroute.
5. **Review/finalisatie:** salarisprofessional beoordeelt een actuele versie; `FINALIZED` vereist opnieuw geldige guards en expliciete actie. Geen automatische betaling of indiening.
6. **Correctie:** mutatie na FINALIZED levert een expliciete correctie-/TWK-successor met provenance, geen update aan de historische PDF of salarisrun. Opvolgers worden niet automatisch uitgegeven.
7. **Altijd lopend:** event-/outboxgestuurde invalidering met geplande reconciliatie als vangnet, geschikt voor Vercel/serverless zonder Docker/always-on worker. Volgende periode tijdig openen met bron- en regelingversies. Exacte scheduler/retry/idempotency moet nog worden gebouwd.

## 5. Geprioriteerde bouwvolgorde

### P0 — PAYESS-01 controlled acceptance en beperkte TEST-release

- Haal actuele `origin/main` in de reeds gepushte featurebranch; bescherm PAYLAB-UX-01 en PAYDOC.
- Autoriseer afzonderlijk een bestaande TEST Auth-sign-in/sign-out indien de bestaande sessie niet volstaat. Dat is **geen** brede toestemming voor remote datamutaties.
- Bewijs geauthenticeerd: eigen FINALIZED-periodes, grafiek, beide PDF-bronnen in ESS én dossier, download; tenant/administratie/employee-permissie-negatives, conceptrun niet zichtbaar, desktop/390 px.
- Hergebruik bestaande 55 gerichte/3.027 suite-evidence waar geldig; passende finale CONTROLLED-gate op uiteindelijke code. Daarna expliciet releasebesluit: non-force merge/Git-deployment, READY/SHA/smoke. **Tot dan niet op TEST uitgebracht.**

### P0 — PAYCALC-REAL-01B: generieke echte salarisberekening

- Werk op bestaande PAYCALC-REAL-01-branch; commit `a23c197...` is alleen lokaal gerapporteerd, eerst branch/diff verificatie.
- Rond minimaal één geaccepteerd **Core-backed** fiscaal broncontract af via juiste domein-/rechten-/effectivity-/auditlaag; controleer of canonieke Core-gegevens al bestaan alvorens een broncontract toe te voegen.
- Bouw generieke server-side employee/employment/period flow bovenop de bestaande graph-engine, zonder hardcoded Lisa/Jaap/Frits of vaste maand.
- Bewijs één volledig ondersteunde bruto→grondslag→loonheffing→netto-case met echte geautoriseerde bron, persisted snapshot/inputset/run/trace/controls, en idempotente conceptopvolging bij een inputwijziging.
- Zorg dat unsupported fiscale, pensioen- of IKV-cases aantoonbaar blokkeren en **niet** als volledige salarisverwerking worden gepresenteerd.
- Voor schema-/remote TEST-writes: afzonderlijk mandaat vóór apply; geen automatische merge/deploy. Geen brede nieuwe architectuurperiode als vervanging van een werkende verticale slice.

### P1 — PAYFLOW-01: multi-medewerker runproces

- Actualiseer bestaande `payroll_periods` foundation, voeg volledige werklijst per cyclus, meerdere medewerkers, meerdere conceptrevisies, actuele/stale markers en directe uitzonderingsacties toe.
- Behoud REVIEWED/FINALIZED op de huidige business-lifecycle en laat guards/concurrency/conceptsupersession door services/RLS afdwingen.
- Goedgekeurde salarisperiode vs losse medewerkerfinalisatie expliciet modelleren; minimaal één volledige end-to-end cyclus met meerdere medewerkers, gedeeltelijke blokkade en correctieopvolging testen.

### P2 — PAYFLOW-02: continu herberekenen en kalender/scheduler

- Core/Payroll change notifications of transactionele outbox, debouncing, idempotente worker/queue, backoff/dead-letter, serverless scheduler, period rollover en dagelijkse/verplichte reconciliatie.
- Bronmutaties na finalisatie op exceptionlijst en correctie-opvolger; nooit stilzwijgend definitief veranderen.
- Meet stale-age, herberekeningsvertraging, uitzonderingen, opnieuw draaien en retrygedrag.
- **Geen** automatische finalisatie, bankbetaling, loonaangifte of pensioenaanlevering.

### P1/P2 vervolgproducten (geen opgeleverde scope)

- **PAYMUT-01:** variabele mutaties, uren/overwerk, bonussen, toeslagen, vergoedingen (netto/bruto/km), bron-goedkeuring, periodisering en retroactieve gevolgen.
- **PAYRUN-FINISH / PAY-RULE-002:** Jaap/Frits en pensioen-/PFZW-verificatie alleen met juiste wettelijke bron en geautoriseerde testfixture, historisch immutable.
- **CAO/rule coverage:** Kinderopvang, Retail Mode, bedrijfseigen regelingen; per component `SUPPORTED/PARTIAL/UNSUPPORTED` en onafhankelijk rekenbewijs; geen brede NL-cao-claim.
- **PAYDOC02:** officiële loonstaat-/jaaropgaafaggregatie nadat jaar-, IKV-, Zvw-/werknemersverzekerings- en fiscale cumulatieven bewezen zijn. Loonstroken tellen alléén op is onvoldoende.
- **PROFORMA-01 / what-if** en **PAYLAB-COMPARE-01** afzonderlijke producten; de run-tegen-run-vergelijking is voorlopig **PARKED**.
- **Payments, SEPA, loonaangifte en boekhouding** uitsluitend latere, apart geautoriseerde downstream adapters. CONTROL02 / officiële Loonaangifte-XML-import blijft **CANCELLED**; niet via dit plan herstarten.

## 6. Gedeelde product- en veiligheidsafspraken

- **Production-grade UX, test-safe execution:** geen overal terugkerende UI-labels `Synthetische TEST`, `Demo` of `Testmedewerker`. Wel technische TEST-isolatie, juiste bewaarscope en verplichte inhoudelijke onzekerheids- en betaal-/aangiftewaarschuwingen.
- **Immutable en transparant:** eerdere snapshots, source-/input-/result-hashes, FINALIZED-events en historische PDF-artifacts niet herschrijven; nieuwe revisie of expliciete correctie.
- **Rol-/data-isolatie:** geen bypass voor de Mars/Jupiter-fixture of geauthenticeerde ESS-acceptatie; self-only Employee, geautoriseerde Manager/HR, Payroll-scope en RLS op servergrens. Geen browser rechtstreeks op Payroll-DB.
- **Geen Docker, geen secretslog of `.env.local`-kopieën**; centrale TEST-runtime volgens documentatie; geen Core- of Payroll-remote writes/migraties zonder apart uitdrukkelijk mandaat.
- **Lean bewijs, geen schijn-GREEN:** AA-LEAN-02 FAST/STANDARD voor UX, CONTROLLED voor nieuwe Payroll-contracten/auth/schema; gericht tijdens de bouw en één vereiste finale suite op definitieve code. `OPEN` blijft `OPEN`, niet `GREEN`.
- **Parallel werk:** PAYESS en PAYCALC op eigen branches; nieuwe documentatie niet automatisch gebruiken als merge-/releasebevel. Non-force, SHA-gate, geen verschillende Payroll-worktrees blind combineren.
- **AI-integratie later:** HeRa/MCP/AI-agents kunnen in een latere, apart geautoriseerde wave exceptions uitlegbaar maken of voorbereiden via bestaande governed services. Deze thread levert **geen** agent, autonoom payrollbesluit of AI-geautoriseerde mutatie op.

## 7. Links naar leading documents

- [AA-ROAD — strategische productroadmap](../AA/AA-ROAD.md)
- [AA-NEXT — eerstvolgende waves](../AA/AA-NEXT.md)
- [AA-PAYROLL — regels en harde engine-invarianten](../AA/AA-PAYROLL.md)
- [AA-OPEN — release-/security-/acceptatiegaten](../AA/AA-OPEN.md)
- [PAY-RULE-002 finale technische checkpoint](acceptance/PAY-RULE-002-FINAL-CLOSURE-20261010.md)
- [PAYESS-01 acceptatierapport op featurebranch](https://github.com/EdwinCycling/LiquidHR/blob/work/PAYESS-01-20261013/docs/quality/acceptance/runs/PAYESS-01-20261013.md)
- [PAYDOC-STD-01A limited TEST-release](../quality/acceptance/runs/PAYDOC-STD-01A-20261013-LIMITED-TEST.md)
- [AI Master Roadmap — afzonderlijk productspoor](../requirements/ai/LIQUIDHR_AI_MASTER_ROADMAP.md)

**Niet automatisch wijzigen op main:** dit document is een handoff voor selectieve centrale roadmapconvergentie. Een docs-only branch/PR is geen code-/releaseacceptatie.
