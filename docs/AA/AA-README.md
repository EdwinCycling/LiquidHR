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
- AA-REL bepaalt **hoe convergence, release, deployment en cleanup verlopen**.
- AA-NEXT bepaalt **wat direct hierna komt**.
- AA-ROAD bevat de **langere productkoers**.
- AA-CURRENT beschrijft **waar de actuele code/release staat**.
- AA-ACCEPT beschrijft **wat aantoonbaar accepted/GREEN is** en verwijst naar detailrapporten.

## Canonieke documenten

| Document | Functie |
| --- | --- |
| [AA-REQ](AA-REQ.md) | Niet-onderhandelbare product-, data-, security- en architectuurregels |
| [AA-OP](AA-OP.md) | Codex operating model: branches, worktrees, implementatie, migrations, stopcriteria |
| [AA-TEST](AA-TEST.md) | Teststrategie, persona's, testdata en risicogestuurde gates |
| [AA-REL](AA-REL.md) | Convergence, versioning, deployment, provenance en cleanup |
| [AA-NEXT](AA-NEXT.md) | Korte-termijnroadmap |
| [AA-ROAD](AA-ROAD.md) | Lange-termijnroadmap |
| [AA-CURRENT](AA-CURRENT.md) | Actuele technische/productstatus |
| [AA-ACCEPT](AA-ACCEPT.md) | Actuele accepted baseline |

## Leesmatrix voor Codex

### Nieuwe feature / productwave
Lees minimaal:
1. `AA-REQ.md`
2. `AA-OP.md`
3. `AA-TEST.md`
4. `AA-CURRENT.md`
5. `AA-NEXT.md`
6. de domeinspecifieke requirements waarnaar de wave verwijst

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

### Roadmapplanning
Lees:
1. `AA-NEXT.md`
2. `AA-ROAD.md`
3. `AA-CURRENT.md`
4. `AA-ACCEPT.md`

## Bronnen en prioriteit

Bij conflict geldt in deze volgorde:

1. expliciet, actueel besluit in een ADR/FDR of leidend requirement;
2. AA-REQ / AA-OP / AA-TEST / AA-REL;
3. AA-CURRENT / AA-ACCEPT;
4. domeinspecifieke requirements;
5. actuele acceptance reports;
6. oudere delivery/handoff-documenten;
7. historische prompts of chatnotities.

Een oud document wordt nooit stilzwijgend als actueler behandeld dan een later vastgelegd besluit.

## Updatebeleid

- Geen `v2-final-final`-bestanden; werk het canonieke AA-bestand bij.
- Codex wijzigt AA-documenten alleen wanneer de run dit expliciet toestaat.
- Roadmapwijzigingen zijn productbesluiten en worden niet autonoom door Codex verzonnen.
- Na een GREEN release worden minimaal `AA-CURRENT`, `AA-ACCEPT` en `AA-NEXT` gecontroleerd.
- Nieuwe structurele werkafspraken gaan naar AA-OP/AA-TEST/AA-REL, niet alleen naar een runrapport.
- Gedateerde acceptance evidence blijft onder `docs/quality/acceptance/runs/`.

## Relatie met bestaande documenten

Bestaande documenten blijven geldig voor detail en historie, onder andere:
- `docs/delivery/CURRENT_CONTEXT.md`
- `docs/delivery/IMPLEMENTATION_STATUS.md`
- `docs/quality/acceptance/REPORTING-STANDARD.md`
- `docs/architecture/ENVIRONMENT_AND_AI_RULES.md`
- `docs/decisions/`
- `docs/requirements/`

De AA-set vervangt die documenten niet; hij maakt duidelijk **wat Codex eerst moet lezen en welke afspraken actueel leidend zijn**.
