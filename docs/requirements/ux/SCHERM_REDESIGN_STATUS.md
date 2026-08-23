# LiquidHR screen redesign status

Dit is het centrale register voor schermen die volgens de Liquid Flow UX-redesignskill worden aangepakt. Werk dit document bij wanneer een schermvoorstel, implementatie of verificatie is afgerond.

## Centrale R2/R3-integratie — 2026-08-23 — actuele run

De 11 aangewezen GREEN-branchdelta's zijn lokaal geïntegreerd op `work/r2-r3-integration`, vanaf baseline `abfa0bbb7db628f588faa3d4818a4f4663f27b46`, met integration HEAD `479b5b3156b59e99333ca486d2fc2237a31f09ed`. Roadmap 2 **Absence & HR Operations** en Roadmap 3 **Organization & Talent** zijn technisch GREEN op de integratiebranch. De authenticated browsermatrix is `BLOCKED BY ENVIRONMENT`: de canonical TEST-env bestaat, maar fixture-auth kon niet worden gereset; alleen anonieme login/redirect-sanity is daarom bewezen. Employment labor-condition is bewust niet geïntegreerd.

| Geïntegreerd scherm/domein | Route | Status | Resterend |
|---|---|---|---|
| Authorization Coverage | `/authorization` | TECHNICAL GREEN / AUTH BROWSER BLOCKED | Authenticated coverage-dialog/save |
| Startpage matrix | `/dashboard/start` | TECHNICAL GREEN / AUTH BROWSER BLOCKED | Authenticated role/theme/responsive matrix |
| Organization / Departments | `/departments` | TECHNICAL GREEN / AUTH BROWSER BLOCKED | Authenticated CRUD/scope matrix |
| Continuous Appraisal | `/my-appraisal`, `/workforce/continuous-appraisal` | TECHNICAL GREEN / AUTH BROWSER BLOCKED | Authenticated role/responsive matrix |
| Star Performers | `/workforce/star-performers`, `/workforce/star-performer-tags` | TECHNICAL GREEN / AUTH BROWSER BLOCKED | Authenticated role/scope matrix |
| 9-grid | `/workforce/9-grid` | TECHNICAL GREEN / AUTH BROWSER BLOCKED | Authenticated campaign/manager matrix |
| Absence & Insights | `/absence/new`, `/insights` | TECHNICAL GREEN / AUTH BROWSER BLOCKED | Authenticated absence/persona matrix |
| HR Calendar + Leave | `/hr-calendar` | TECHNICAL GREEN / AUTH BROWSER BLOCKED | Authenticated calendar/leave matrix |
| Process Automation lifecycle | `/settings/process-automation` | TECHNICAL GREEN / AUTH BROWSER BLOCKED | Authenticated create/publish/retire matrix |
| Company Documents | `/company-documents` | TECHNICAL GREEN / AUTH BROWSER BLOCKED | Authenticated document CRUD/scope matrix |

De branch is niet klaar voor main-integratie: **READY TO INTEGRATE INTO MAIN = NO**.

## Final integration status — 2026-08-21 — actuele run

De vier UX v1.2 correction batches zijn geïntegreerd op `work/ux-v1-2-integration`, met exact acceptance-HEAD `b3ba2097eb5b7b606fe49220bb912cf37174eeb5`. De TEST-RLS-functionfix en inherited technische gates zijn groen. Document PDF/TXT upload, signed download, delete/restore/final-delete en cleanup zijn browsermatig bewezen; alle 9 acceptance-records zijn soft-deleted, alle 9 storage objects verwijderd en er zijn 0 orphans. Absence report/recovery is groen met capacity-readback als amber evidence gap. HR role create/cleanup en geldige manager/employee negative API 403 zijn groen. Employment real mutation, authorization coverage/save, process lifecycle en de volledige responsive Default+LinkedHR matrix blijven open. De gecombineerde status is **RED / niet volledig bewezen**. Zie [`delivery/CURRENT_CONTEXT.md`](../../delivery/CURRENT_CONTEXT.md) en [`delivery/TEST_ACCEPTANCE_MATRIX.md`](../../delivery/TEST_ACCEPTANCE_MATRIX.md).

| Scherm | Route | Status | Resultaat / document | Volgende actie |
|---|---|---|---|---|
| Bedrijfsgegevens | `/settings/company-data` | GEÏNTEGREERD / NEGATIVE BROWSER PROVEN | [`BEDRIJFSGEGEVENS_REDESIGN.md`](BEDRIJFSGEGEVENS_REDESIGN.md) | HR add/edit en cleanup nog uitvoeren |
| Rollen en autorisatie | `/authorization` | GEÏNTEGREERD / CREATE + NEGATIVE API PROVEN | [`REDESIGN_ROLLEN_EN_AUTORISATIE.md`](REDESIGN_ROLLEN_EN_AUTORISATIE.md) | Coverage-dialog/save acceptance nog uitvoeren |
| Workflows en formulieren | `/settings/process-automation` | GEÏNTEGREERD / ROUTE PROVEN | [`REDESIGN_WORKFLOWS_EN_FORMULIEREN.md`](REDESIGN_WORKFLOWS_EN_FORMULIEREN.md) | Create/publish/retire/changelog/cleanup acceptance uitvoeren |
| Dienstverbandwijzigingen | `/employees/[employeeId]/employments/[employmentId]?tab=overview&view=expanded` | GEÏNTEGREERD / WIZARD ENTRY PROVEN | [`REDESIGN_DIENSTVERBAND_WIJZIGINGEN.md`](REDESIGN_DIENSTVERBAND_WIJZIGINGEN.md) | Real contract/CAO/location/organization mutation acceptance uitvoeren |
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
