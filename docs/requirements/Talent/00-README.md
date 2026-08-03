# LiquidHR Workforce & Talent Management — v2 Product Package

**Product owner / auteur:** Edwin Dingjan  
**E-mail:** edwin@editsolutions.nl  
**Datum:** 31 juli 2026

---

## Inhoud van dit pakket

| Bestand | Doel |
|---|---|
| `01-LiquidHR-Workforce-Talent-Product-Blueprint-v2.0.md` | Definitieve single source of truth voor product, domein, UX, data, security en scope. |
| `02-LiquidHR-AI-Architecture-Instructions.md` | Instructies voor Codex/AI om eerst de bestaande repository te analyseren en een veilig technisch ontwerp te maken. |
| `03-LiquidHR-Codex-Implementation-Plan.md` | Gefaseerd implementatieplan met milestones, gates, tests en releasevoorwaarden. |
| `04-LiquidHR-Codex-Prompt-Library.md` | Copy/paste-prompts voor repositoryanalyse, architectuur, bouw, review en acceptatie. |
| `05-LiquidHR-Acceptance-Test-Pack.md` | Productacceptatietests, negatieve securitytests en releasecriteria. |
| `06-LiquidHR-Decision-Register-Glossary.md` | Definitieve besluiten, rationale en vaste terminologie. |
| `07-LiquidHR-UI-Reference-Library.md` | Uitleg en correcties bij UI-001 t/m UI-013. |
| `08-LiquidHR-Requirement-Traceability-Matrix.md` | Koppeling tussen requirements, implementatiestappen, prompts, tests en UI-references. |
| `09-LiquidHR-Vlootschouw-9-grid-Requirements.md` | Leidende requirements voor campagnegestuurde 9-grid-scoring, historie en managerreminders. |
| `10-LiquidHR-Continuous-Appraisal-Requirements.md` | Leidende requirements voor de gedeelde medewerker-manager-timeline, commentaren, historische integriteit en handover. |
| `ui-references/` | De 13 officiële mockups plus één extra alternatief dashboardconcept. |

---

## Aanbevolen leesvolgorde

### Voor Product Owner

1. Product Blueprint
2. Decision Register & Glossary
3. UI Reference Library
4. Acceptance Test Pack

### Voor Codex / AI-ontwikkeling

1. Product Blueprint
2. AI Architecture Instructions
3. Codex Implementation Plan
4. relevante prompt uit Prompt Library
5. Acceptance Test Pack

### Voor tester of reviewer

1. Product Blueprint — relevante module
2. Acceptance Test Pack
3. Traceability Matrix
4. Decision Register bij terminologietwijfel

---

## Belangrijkste vaste regels

- De Product Blueprint is leidend.
- Mockups zijn ondersteunend, niet pixel-perfect.
- Settings configureert; Workforce gebruikt; medewerker consumeert.
- HR Admin beheert de Talent-fundamenten. Voor de afzonderlijke Continuous Appraisal-slice geldt document 10: medewerker en manager mogen binnen hun gedeelde timeline items en commentaren toevoegen volgens de daar beschreven permissions en historische grenzen.
- Functiegroep → Functie is de vereiste kern; Functiefamilie is optioneel.
- Senioriteit is optioneel per functie en configureerbaar.
- Eén dynamisch Talent Level Model per tenant, locked na eerste gebruik.
- Capability is intern generiek met vijf herkenbare UI-typen.
- Eén logisch functieprofiel per functie met opvolgende datumversies.
- Geen AI, import, assessments, approvals, profile comparison of Team Talent analytics in fase 1.
- De 9-grid is sinds 3 augustus 2026 een expliciete operationele uitbreiding voor HR Admin en Manager; zie document 09 en FDR-0004.
- Continuous Appraisal is sinds 3 augustus 2026 een expliciete medewerker-manager-uitbreiding; document 10 en FDR-0005 zijn leidend voor die module.
- Dashboards tonen alleen echte data.
- Tenantisolatie en profile history zijn release blockers.

---

## Starten met Codex

1. Kopieer deze volledige map naar de root of documentatiemap van de LiquidHR-repository.
2. Commit de documenten afzonderlijk van functionele code.
3. Start met **Prompt 00 — Repositoryanalyse en technische baseline**.
4. Laat Codex nog niets bouwen voordat de repositoryanalyse, gap analysis, file map en securitydesign zijn beoordeeld.
5. Voer daarna één implementatiemilestone per keer uit.
6. Gebruik na iedere milestone Prompt 18 voor een gerichte code review.
7. Gebruik Prompt 17 pas voor de release candidate.

---

## Versiebeheer

Aanbevolen documentversies:

```text
Product Blueprint: 2.x
AI Architecture Instructions: 1.x
Implementation Plan: 1.x
Prompt Library: 1.x
Acceptance Test Pack: 1.x
Decision Register: append-only decisions
UI References: stabiele UI-ID’s
```

Wijzig een bestaande business rule niet stilzwijgend. Voeg een Decision Record toe en werk Blueprint, tests en traceability gelijktijdig bij.

---

## Eigendom en vertrouwelijkheid

Dit pakket beschrijft proprietary productconcepten en implementatierichtlijnen voor LiquidHR Workforce & Talent Management.

© 2026 Edwin Dingjan. Alle rechten voorbehouden.
