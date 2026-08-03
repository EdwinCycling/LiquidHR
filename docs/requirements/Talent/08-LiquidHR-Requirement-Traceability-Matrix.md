# LiquidHR Workforce & Talent Management
## Requirement Traceability Matrix v1.0

**Auteur:** Edwin Dingjan  
**Datum:** 31 juli 2026

---

## Doel

Deze matrix koppelt de belangrijkste productrequirements aan implementatiemilestones, Codex-prompts, acceptatietests en UI-references. Zij maakt zichtbaar of een requirement aantoonbaar is ontworpen, gebouwd en getest.

| Domein | Blueprint / BR | Implementatie | Codex prompt | Acceptance tests | UI |
|---|---|---|---|---|---|
| Contextscheiding | BR-001 t/m BR-003 | M1, M6, M7, M8 | 01, 13, 14, 15 | AT-NAV-001 t/m 008 | UI-001, UI-003, UI-007 |
| UI-precedence | BR-004 | Alle milestones | Alle prompts | AT-SCOPE-001 t/m 012 | UI-001 t/m UI-013 |
| Real data dashboards | BR-007, BR-096, BR-097 | M6 | 13 | AT-DASH-001 t/m 012 | UI-002, UI-003 |
| Rollen | BR-011 t/m BR-018 | M1 | 01, 02 | AT-AUTH-001 t/m 010 | Alle contextschermen |
| Capabilitymodel | BR-019 t/m BR-030 | M3 | 05, 06 | AT-CAP-001 t/m 020 | UI-003, UI-004, UI-011 |
| Talent Level Model | BR-031 t/m BR-038 | M2 | 03 | AT-LVL-001 t/m 012 | UI-009 |
| Senioriteit | BR-039 t/m BR-047 | M2, M4 | 04, 08 | AT-SEN-001 t/m 012 | UI-010 |
| Functiegroep → Functie | BR-048, BR-049 | M4 | 07, 08 | AT-JOB-001 t/m 020 | UI-005, UI-012 |
| Optionele Functiefamilie | BR-050 t/m BR-052 | M4 | 07, 09 | AT-JOB-001 t/m 003, 016-018 | UI-005, UI-012 |
| Function uniqueness | BR-053, BR-054 | M4 | 08 | AT-JOB-006 t/m 012 | UI-005 |
| Bestaande HR-relatie | BR-058 | M0, M4, M8 | 00, 07, 08, 15 | AT-JOB-020, AT-MY-001 t/m 009 | UI-007 |
| Eén logical profile | BR-059 | M5 | 10 | AT-PRO-001, 002 | UI-006, UI-013 |
| Datumversies | BR-060, BR-065 t/m 070 | M5 | 10, 12 | AT-PRO-010 t/m 021 | UI-006, UI-013 |
| Profile statuses | BR-061 t/m 064 | M5 | 10, 12 | AT-PRO-002 t/m 004, 016 | UI-006 |
| Capability requirements | BR-071 t/m 075 | M5 | 11 | AT-PRO-005 t/m 009 | UI-011, UI-013 |
| Transactionele activation | BR-067, BR-076, BR-092 | M5 | 10 | AT-PRO-010 t/m 018, 023 | UI-006 |
| Geen workflow | BR-016, BR-078 | Scope guard | 10, 12 | AT-SCOPE-003, 004 | UI-006 |
| Mijn Talent read-only | BR-079, BR-080, BR-084 | M8 | 15 | AT-MY-001 t/m 013 | UI-007 |
| Manager scope | BR-081 | M1, M7 | 01, 14 | AT-AUTH-005, 006; AT-WF-001 t/m 010 | UI-001 |
| Team Talent later | BR-082 | Out of scope | 14, 17 | AT-SCOPE-007 | UI-008 |
| Geen persoonlijke records | BR-083 | Out of scope | 15 | AT-SCOPE-005, 006 | UI-007, UI-008 |
| Tenantisolatie | BR-085, BR-086 | M1, alle data milestones | 01, 16 | Alle Critical cross-tenant tests | Alle |
| Audit | BR-017, BR-087, BR-088 | M1 | 02 | AT-AUD-001 t/m 010 | UI-002, UI-006 |
| Concurrency | BR-089 | M5, M6 | 10, 12 | AT-ERR-001, 006, 007; AT-PRO-018 | UI-006 |
| Soft lifecycle | BR-090 | M2-M5 | 04-12 | Inactivationtests per domein | UI-003, UI-010 |
| Search permission | BR-093 | M3, M4, M7 | 06, 09, 14 | AT-SRCH-001 t/m 008 | UI-005 |
| Geen import | BR-094 | Out of scope | Alle prompts | AT-SCOPE-002 | UI-003, UI-013 |
| Geen AI | BR-095 | Out of scope | Alle prompts | AT-SCOPE-001 | UI-002, UI-004, UI-013 |
| Accessibility | BR-098 | M6-M9 | 16 | AT-UX-001 t/m 012 | Alle |
| Internationalisatie | BR-099 | M6-M9 | 16 | AT-UX-011 | Alle |
| Product architecture rule | BR-100 | Alle milestones | Alle prompts | AT-NAV en scope guards | UI-001, UI-003, UI-007 |

---

## Statuskolommen voor uitvoering

Voeg tijdens implementatie per rij de volgende kolommen toe of beheer dit in issue tracking:

- Design approved;
- Migration implemented;
- Backend implemented;
- Frontend implemented;
- Security tested;
- Acceptance passed;
- Release version;
- Evidence link/commit.

Een requirement is pas Done wanneer implementatie én aantoonbaar testbewijs aanwezig zijn.

---

**Einde Requirement Traceability Matrix**
