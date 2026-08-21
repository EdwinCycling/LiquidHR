# LiquidHR screen redesign status

Dit is het centrale register voor schermen die volgens de Liquid Flow UX-redesignskill worden aangepakt. Werk dit document bij wanneer een schermvoorstel, implementatie of verificatie is afgerond.

## Final integration status — 2026-08-21 — actuele run

De vier UX v1.2 correction batches zijn geïntegreerd op `work/ux-v1-2-integration`. De TEST-RLS-functionfix is via een nieuwe forward migration toegepast en de remote regressietest is groen. De documentupload is daarna authenticated browsermatig opnieuw uitgevoerd: PDF en TXT geven HTTP 201 en de PDF is na reload zichtbaar; de downloadroute geeft HTTP 307 naar signed storage. De externe signed-storage-follow-up en document-delete zijn niet betrouwbaar bewezen in deze browseromgeving. Absence/employment real mutations, HR authorization create/coverage, process publish/retire/cleanup, volledige persona-negatives en de complete Default+LinkedHR acceptance blijven open. De vier acceptance-records/objecten zijn niet verwijderd omdat remote destructieve cleanup in deze run geen nieuwe directe bevestiging kreeg. De gecombineerde status is **RED / niet volledig bewezen**. Zie [`delivery/CURRENT_CONTEXT.md`](../../delivery/CURRENT_CONTEXT.md) en [`delivery/TEST_ACCEPTANCE_MATRIX.md`](../../delivery/TEST_ACCEPTANCE_MATRIX.md).

| Scherm | Route | Status | Resultaat / document | Volgende actie |
|---|---|---|---|---|
| Bedrijfsgegevens | `/settings/company-data` | GEÏNTEGREERD / NEGATIVE BROWSER PROVEN | [`BEDRIJFSGEGEVENS_REDESIGN.md`](BEDRIJFSGEGEVENS_REDESIGN.md) | HR add/edit en cleanup nog uitvoeren |
| Rollen en autorisatie | `/authorization` | GEÏNTEGREERD / NEGATIVE BROWSER PROVEN | [`REDESIGN_ROLLEN_EN_AUTORISATIE.md`](REDESIGN_ROLLEN_EN_AUTORISATIE.md) | HR create-role en coverage-dialog acceptance nog uitvoeren |
| Workflows en formulieren | `/settings/process-automation` | GEÏNTEGREERD / PARTIAL BROWSER PROVEN | [`REDESIGN_WORKFLOWS_EN_FORMULIEREN.md`](REDESIGN_WORKFLOWS_EN_FORMULIEREN.md) | Publish/retire/changelog acceptance nog uitvoeren |
| Dienstverbandwijzigingen | `/employees/[employeeId]/employments/[employmentId]?tab=overview&view=expanded` | GEÏNTEGREERD / WIZARD ENTRY PROVEN | [`REDESIGN_DIENSTVERBAND_WIJZIGINGEN.md`](REDESIGN_DIENSTVERBAND_WIJZIGINGEN.md) | Real create/mutation acceptance nog uitvoeren |
| Startpagina compact en uitgebreid | `/dashboard/start` | GEÏNTEGREERD / 390PX PARTIAL PROVEN | [`REDESIGN_STARTPAGINA.md`](REDESIGN_STARTPAGINA.md) | Desktop drag/reorder en volledige theme-matrix nog uitvoeren |
| Employees + Employee Detail | `/employees`, `/employees/[employeeId]` | GEIMPLEMENTEERD / DOCUMENT SCHEMA BLOCKER | [`REDESIGN_EMPLOYEES_VNEXT.md`](REDESIGN_EMPLOYEES_VNEXT.md) | TEST function-replacement goedkeuren; daarna document CRUD en resterende acceptance |
| Employee Personal Tab | `/employees/[employeeId]?tab=personal` | GEÏNTEGREERD / AUTHENTICATED CRUD PROVEN | [`REDESIGN_EMPLOYEE_PERSONAL_TAB.md`](REDESIGN_EMPLOYEE_PERSONAL_TAB.md) | Document-uploadfout apart oplossen; overige resourceflows uitbreiden |
| Employment Workspace | `/employees/[employeeId]/employments/[employmentId]` | GEÏNTEGREERD / AUTHENTICATED PARTIAL | [`REDESIGN_EMPLOYMENT_WORKSPACE.md`](REDESIGN_EMPLOYMENT_WORKSPACE.md) | Authenticated real mutation en desktopmatrix nog uitvoeren |
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
