# LiquidHR screen redesign status

Dit is het centrale register voor schermen die volgens de Liquid Flow UX-redesignskill worden aangepakt. Werk dit document bij wanneer een schermvoorstel, implementatie of verificatie is afgerond.

| Scherm | Route | Status | Resultaat / document | Volgende actie |
|---|---|---|---|---|
| Bedrijfsgegevens | `/settings/company-data` | AFGEROND | [`BEDRIJFSGEGEVENS_REDESIGN.md`](BEDRIJFSGEGEVENS_REDESIGN.md) | Volgende redesign: Rollen en autorisatie |
| Rollen en autorisatie | `/authorization` | GEVERIFIEERD | [`REDESIGN_ROLLEN_EN_AUTORISATIE.md`](REDESIGN_ROLLEN_EN_AUTORISATIE.md) | Edwin bepaalt het volgende scherm |
| Workflows en formulieren | `/settings/process-automation` | GEIMPLEMENTEERD | [`REDESIGN_WORKFLOWS_EN_FORMULIEREN.md`](REDESIGN_WORKFLOWS_EN_FORMULIEREN.md) | Browsercontrole uitvoeren in een geauthenticeerde omgeving |
| Dienstverbandwijzigingen | `/employees/[employeeId]/employments/[employmentId]?tab=overview&view=expanded` | GEVERIFIEERD | [`REDESIGN_DIENSTVERBAND_WIJZIGINGEN.md`](REDESIGN_DIENSTVERBAND_WIJZIGINGEN.md) | Volgende redesign: door Edwin te bepalen |
| Startpagina compact en uitgebreid | `/dashboard/start` | GEIMPLEMENTEERD | [`REDESIGN_STARTPAGINA.md`](REDESIGN_STARTPAGINA.md) | Geauthenticeerde browsercontrole op desktop en 390px uitvoeren |
| Employees + Employee Detail | `/employees`, `/employees/[employeeId]` | GEIMPLEMENTEERD | [`REDESIGN_EMPLOYEES_VNEXT.md`](REDESIGN_EMPLOYEES_VNEXT.md) | Browsergate en eindrapport Blok 3 |
| Employee Personal Tab | `/employees/[employeeId]?tab=personal` | GEIMPLEMENTEERD | [`REDESIGN_EMPLOYEE_PERSONAL_TAB.md`](REDESIGN_EMPLOYEE_PERSONAL_TAB.md) | Browsergate op authenticated feature-preview uitvoeren |
| Employment Workspace | `/employees/[employeeId]/employments/[employmentId]` | GEIMPLEMENTEERD | [`REDESIGN_EMPLOYMENT_WORKSPACE.md`](REDESIGN_EMPLOYMENT_WORKSPACE.md) | Gerichte lokale checks en authenticated desktop/390px-browsercontrole uitvoeren |

## Volgorde

1. Bedrijfsgegevens — afgerond als eerste Liquid Flow-redesign.
2. Rollen en autorisatie — redesign doorgevoerd en geverifieerd op desktop en 390px.
3. Workflows en formulieren — overzicht, productie-inzicht en begeleide aanmaakflow geïmplementeerd; browserverificatie geblokkeerd door ontbrekende lokale worktree-env.
4. Daarna bepaalt Edwin per keer de volgende pagina.
5. Employees UX vNext — lokale Structured Enterprise-pilot; pas na Edwin's visuele akkoord wordt een volgende pagina gekozen.

## Werkwijze na ieder scherm

1. Werk het schermrequirementsdocument bij.
2. Zet de status hierboven op `AFGEROND`, `OPEN`, `GEPARKEERD` of `GEVERIFIEERD`.
3. Noteer de uitgevoerde controles en openstaande punten.
4. Wijs precies één volgende pagina aan.
