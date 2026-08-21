# LiquidHR screen redesign status

Dit is het centrale register voor schermen die volgens de Liquid Flow UX-redesignskill worden aangepakt. Werk dit document bij wanneer een schermvoorstel, implementatie of verificatie is afgerond.

| Scherm | Route | Status | Resultaat / document | Volgende actie |
|---|---|---|---|---|
| Bedrijfsgegevens | `/settings/company-data` | AFGEROND | [`BEDRIJFSGEGEVENS_REDESIGN.md`](BEDRIJFSGEGEVENS_REDESIGN.md) | Volgende redesign: Rollen en autorisatie |
| Rollen en autorisatie | `/authorization` | LOKAAL GEIMPLEMENTEERD / BROWSERGATE GEBLOKKEERD | [`REDESIGN_ROLLEN_EN_AUTORISATIE.md`](REDESIGN_ROLLEN_EN_AUTORISATIE.md) | Authenticated TEST HR + unauthorized negative opnieuw uitvoeren |
| Workflows en formulieren | `/settings/process-automation` | GEIMPLEMENTEERD | [`REDESIGN_WORKFLOWS_EN_FORMULIEREN.md`](REDESIGN_WORKFLOWS_EN_FORMULIEREN.md) | Browsercontrole uitvoeren in een geauthenticeerde omgeving |
| Dienstverbandwijzigingen | `/employees/[employeeId]/employments/[employmentId]?tab=overview&view=expanded` | GEVERIFIEERD | [`REDESIGN_DIENSTVERBAND_WIJZIGINGEN.md`](REDESIGN_DIENSTVERBAND_WIJZIGINGEN.md) | Volgende redesign: door Edwin te bepalen |
| Startpagina compact en uitgebreid | `/dashboard/start` | LOKAAL GEIMPLEMENTEERD / BROWSERGATE GEBLOKKEERD | [`REDESIGN_STARTPAGINA.md`](REDESIGN_STARTPAGINA.md) | Authenticated compact/expanded + Default/LinkedHR op desktop en 390px uitvoeren |
| Employees + Employee Detail | `/employees`, `/employees/[employeeId]` | GEIMPLEMENTEERD | [`REDESIGN_EMPLOYEES_VNEXT.md`](REDESIGN_EMPLOYEES_VNEXT.md) | Browsergate en eindrapport Blok 3 |
| Employee Personal Tab | `/employees/[employeeId]?tab=personal` | GEIMPLEMENTEERD | [`REDESIGN_EMPLOYEE_PERSONAL_TAB.md`](REDESIGN_EMPLOYEE_PERSONAL_TAB.md) | Browsergate op authenticated feature-preview uitvoeren |
| Employment Workspace | `/employees/[employeeId]/employments/[employmentId]` | GEIMPLEMENTEERD | [`REDESIGN_EMPLOYMENT_WORKSPACE.md`](REDESIGN_EMPLOYMENT_WORKSPACE.md) | Lokale gates gedaan; authenticated desktop/390px-browsercontrole blijft open zonder veilige sessie/env |
| Employee Reminders — Foundation v1.2 reference | `/employees/[employeeId]?tab=reminders` | LOKAAL GEIMPLEMENTEERD / BROWSERGATE OPEN | [`LIQUIDHR_UX_FOUNDATION_V1_2_INTERACTION_COLLECTIONS.md`](LIQUIDHR_UX_FOUNDATION_V1_2_INTERACTION_COLLECTIONS.md) | Authenticated Default + 390px + LinkedHR browserflow uitvoeren |
| Employee 360 Dashboard / Overview + integratie | `/employees/[employeeId]?tab=overview` | GEIMPLEMENTEERD / WACHT OP ACCEPTANCE | [`REDESIGN_EMPLOYEE_360_DASHBOARD.md`](REDESIGN_EMPLOYEE_360_DASHBOARD.md) | Branch-preview visueel accepteren; daarna status GEVERIFIEERD |

## Suitebrede migratieroadmap

0. UX Foundation + Controls — AFGEROND
1. Employee 360
2. Absence & HR Operations
3. Organization & Talent
4. Recruitment & Journeys
5. Work & Automation
6. Home, Management & Insights
7. Settings & Admin
8. Final Product UX Sweep

### Employee 360

- Personal — AFGEROND
- Employments — AFGEROND
- Documents + Payslips — GEIMPLEMENTEERD
- Reminders + Notes — GEIMPLEMENTEERD
- Absence + Processes — GEIMPLEMENTEERD
- Dashboard/Overview + integratie — GEIMPLEMENTEERD / WACHT OP ACCEPTANCE

Volgende roadmap-item: **Absence & HR Operations**

### Final Product UX Sweep

- legacy/ad-hoc UI scan;
- Foundation reuse;
- action/header hierarchy;
- text overflow/wrapping;
- desktop + 390px;
- accessibility/focus;
- loading/error/empty/success;
- Default + LinkedHR;
- browser smoke van representatieve kritieke flows.

## Werkwijze na ieder scherm

1. Werk het schermrequirementsdocument bij.
2. Zet de status hierboven op `AFGEROND`, `OPEN`, `GEPARKEERD` of `GEVERIFIEERD`.
3. Noteer de uitgevoerde controles en openstaande punten.
4. Wijs precies één volgende pagina aan.
