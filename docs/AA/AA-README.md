# AA — LiquidHR Canonical Guidance

Status: **LEIDEND ZODRA GEMERGED OP `main`**
Eerste opzet: 2026-09-29

De `docs/AA`-map bevat een kleine set **living documents** voor productsturing, Codex-uitvoering, testbeleid, releasebeleid en roadmap. De documenten worden bijgewerkt in plaats van gekopieerd naar nieuwe versies; Git is de versiehistorie.

## Doel

De AA-set voorkomt dat actuele afspraken verspreid raken over oude prompts, losse chats en historische runrapporten.

- Requirements zeggen **wat** het product moet doen.
- AA-REQ bevat de **fundamentele product- en architectuurregels**.
- AA-OP bepaalt **hoe Codex werkt**.
- AA-TEST bepaalt **hoe we bewijs verzamelen**.
- AA-PAYROLL bevat de **leidende payrollarchitectuur en ontwikkelafspraken**.
- AA-REL bepaalt **hoe convergence, release, deployment en cleanup verlopen**.
- AA-NEXT bepaalt **wat direct hierna komt**.
- AA-ROAD bevat de **langere productkoers**.
- AA-CURRENT beschrijft **waar de actuele code/release staat**.
- AA-ACCEPT beschrijft **wat aantoonbaar accepted/GREEN is** en verwijst naar detailrapporten.
- AA-OPEN registreert **welke benoemde bewijs-, fixture- en besluitpunten nog openstaan**, zodat gedocumenteerde externe blokkades niet opnieuw dezelfde ontwikkellus starten.

## Canonieke documenten

| Document | Functie |
| --- | --- |
| [AA-REQ](AA-REQ.md) | Niet-onderhandelbare product-, data-, security- en architectuurregels |
| [AA-OP](AA-OP.md) | Codex operating model: branches, worktrees, implementatie, migrations, stopcriteria |
| [AA-TEST](AA-TEST.md) | Teststrategie, persona's, testdata en risicogestuurde gates |
| [AA-PAYROLL](AA-PAYROLL.md) | Payroll bounded context, componentengine, ownership, test-/UI-regels |
| [AA-REL](AA-REL.md) | Convergence, versioning, deployment, provenance en cleanup |
| [AA-NEXT](AA-NEXT.md) | Korte-termijnroadmap |
| [AA-ROAD](AA-ROAD.md) | Lange-termijnroadmap |
| [AA-CURRENT](AA-CURRENT.md) | Actuele technische/productstatus |
| [AA-ACCEPT](AA-ACCEPT.md) | Actuele accepted baseline |
| [AA-OPEN](AA-OPEN.md) | Openstaand bewijs, uitgestelde controles, afhankelijkheden, eigenaar en heropeningsvoorwaarden |

## Leesmatrix voor Codex

### Nieuwe feature / productwave
Lees minimaal:
1. `AA-REQ.md`
2. `AA-OP.md`
3. `AA-TEST.md`
4. `AA-CURRENT.md`
5. `AA-NEXT.md`
6. `AA-OPEN.md` — alleen voor de huidige wave relevante open punten; geen automatische volledige heranalyse
7. de domeinspecifieke requirements waarnaar de wave verwijst

### Payroll feature / Payroll Lab
Lees minimaal:
1. `AA-PAYROLL.md`
2. `AA-OP.md`
3. `AA-TEST.md`
4. `AA-CURRENT.md`
5. relevante payrollrequirements/ADR/FDR/acceptance evidence
6. `AA-OPEN.md` voor relevante bestaande Payroll-gates en extern afhankelijke fixturepunten

### Bugfix
Lees minimaal:
1. `AA-OP.md`
2. `AA-TEST.md`
3. `AA-CURRENT.md`

### Database / migration / security
Lees minimaal:
1. `AA-REQ.md`
2. `AA-OP.md`
3. `AA-TEST.md`
4. `AA-CURRENT.md`
5. relevante ADR/FDR en domeinrequirements

### Convergence / release
Lees minimaal:
1. `AA-OP.md`
2. `AA-TEST.md`
3. `AA-REL.md`
4. `AA-CURRENT.md`
5. `AA-ACCEPT.md`
6. `AA-OPEN.md` — bespreek ieder relevant OPEN-punt expliciet; geen stilzwijgende GREEN

Gebruik voor de centrale lokale TEST-runtime en geïsoleerde Vercel Preview daarnaast `docs/delivery/TEST_RUNTIME_AND_VERCEL_PREVIEW.md`.

### Roadmapplanning
Lees:
1. `AA-NEXT.md`
2. `AA-ROAD.md`
3. `AA-CURRENT.md`
4. `AA-ACCEPT.md`
5. `AA-OPEN.md` voor relevante evidencegaps en beslissingen

### Grotere geïntegreerde ontwikkelronde

De standaard voor omvangrijke productwaves is één orchestrator met gespecialiseerde parallelle LUNA MAX-agents en één concrete gebruikersgerichte oplevering. Iedere wave heeft geïntegreerde test- en bugfixverantwoordelijkheid. Houd één canonieke productversie en centrale `main`-/migration-/releasecoördinatie; een openstaande externe fixture of productbeslissing komt met eigenaar en heropeningsvoorwaarde in AA-OPEN, niet in een eindeloze serie nieuwe acceptatieopdrachten.

De orchestrator levert altijd een korte overdracht met **"Wat levert deze ronde ons op?"** en **"De beoogde volgende mijlpalen"**. Een lokale `PARTIAL`-feature kan op een reviewbare Draft PR worden gezet en onafhankelijke ontwikkeling mag doorgaan, maar beveiligings-/domeingates blijven verplicht vóór hun betreffende activatie/merge/release. Zie AA-OP §§5–6, AA-TEST §1A en AA-REL.

## Bronnen en prioriteit

Bij conflict geldt in deze volgorde:

1. expliciet, actueel besluit in een ADR/FDR of leidend requirement;
2. AA-REQ / AA-OP / AA-TEST / AA-PAYROLL / AA-REL;
3. AA-CURRENT / AA-ACCEPT;
4. domeinspecifieke requirements;
5. actuele acceptance reports;
6. oudere delivery/handoff-documenten;
7. historische prompts of chatnotities.

Een oud document wordt nooit stilzwijgend als actueler behandeld dan een later vastgelegd besluit.

## Scherpteprotocol

De AA-set is ook bedoeld om Edwin, ChatGPT en Codex elkaar inhoudelijk scherp te laten houden.

Maak bij iedere relevante conclusie onderscheid tussen:
- **BEDOELD** — productwens of requirement;
- **GEBOUWD** — aantoonbaar in code/schema aanwezig;
- **GETEST** — het specifieke gedrag is daadwerkelijk bewezen;
- **RELEASED** — de bewezen code staat op de canonieke release/main/deployment.

Regels:
- Zet een aanname nooit stilzwijgend om in een feit.
- Een grote groene regressiesuite bewijst niet automatisch dat elk scherm of businessscenario handmatig is geaccepteerd.
- Een catalogus van 19 rapporten bewijst niet dat alle 19 rapporten volledig geharmoniseerd zijn.
- Een parser/stagingcontract bewijst niet automatisch een live end-to-end import.
- Als een gebruikersaanname, Codex-rapport of ouder document botst met actuele code/evidence: benoem het verschil en corrigeer de AA-baseline.
- Als tijdens een run een herhaalbare procesles ontstaat, leg die in AA vast in plaats van dezelfde uitleg in toekomstige prompts te herhalen.

## Updatebeleid

- Geen `v2-final-final`-bestanden; werk het canonieke AA-bestand bij.
- Codex wijzigt AA-documenten alleen wanneer de run dit expliciet toestaat.
- Roadmapwijzigingen zijn productbesluiten en worden niet autonoom door Codex verzonnen.
- Na een GREEN release worden minimaal `AA-CURRENT`, `AA-ACCEPT` en `AA-NEXT` gecontroleerd.
- Nieuwe structurele werkafspraken gaan naar AA-OP/AA-TEST/AA-REL, niet alleen naar een runrapport.
- Gedateerde acceptance evidence blijft onder `docs/quality/acceptance/runs/`.
- Zet vastgestelde externe fixture-/bewijs-/besluitpunten met eigenaar en afsluitproef in `AA-OPEN.md`; het vervangt geen regressietest, releasebesluit of acceptatierapport.

## Relatie met bestaande documenten

Bestaande documenten blijven geldig voor detail en historie, onder andere:
- `docs/delivery/CURRENT_CONTEXT.md`
- `docs/delivery/IMPLEMENTATION_STATUS.md`
- `docs/quality/acceptance/REPORTING-STANDARD.md`
- `docs/architecture/ENVIRONMENT_AND_AI_RULES.md`
- `docs/decisions/`
- `docs/requirements/`

De AA-set vervangt die documenten niet; hij maakt duidelijk **wat Codex eerst moet lezen en welke afspraken actueel leidend zijn**.
