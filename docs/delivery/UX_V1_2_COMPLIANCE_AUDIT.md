# LiquidHR — UX Foundation v1.2 compliance-audit

Auditdatum: 2026-08-21  
Baseline: `origin/main` — `854d047f80d4350370f1a1252b813a3405a21260`  
Verwachte baseline uit de opdracht: `0c935023b6546bf939a6fd6b73e7fcf20b1d3dbc` — niet langer actueel op `origin/main`.

## Executive summary

Er zijn 14 schermen/flows geaudit.

| Status | Aantal |
|---|---:|
| GREEN | 5 |
| AMBER | 2 |
| RED | 7 |

De v1.2-reference Employee Reminders is GREEN: deze flow gebruikt `FormDrawer`, dirty-form protection, `EntityList`, `RowActions`, `ActionMenu`, `ConfirmDialog` en loading/double-submit protection. De voornaamste terugkerende afwijking in de oudere slices is dat normale CRUD nog inline of in een lokale modal wordt uitgevoerd. Daardoor ontbreken op meerdere plaatsen de standaard FormDrawer-surface, vaste action footer, dirty-close protection en de keten `ActionMenu → ConfirmDialog` voor destructive actions.

De belangrijkste correcties zijn daarom interaction-architectuur, niet cosmetische styling:

- normale multi-field CRUD naar `FormDrawer`;
- complexe/multi-step flows naar full page met sticky `FormActions`;
- lokale modal- en confirmvarianten vervangen door de centrale Foundation-patterns;
- rijacties reduceren tot maximaal één frequente zichtbare actie en één `ActionMenu`;
- dirty-state en saving/errorgedrag consequent maken.

Er is één daadwerkelijk gebruikte bestaande Foundation-gap: **Multiselect — LATER** voor documenten/custom fields. Er is geen nieuwe gap nodig om de gevonden v1.2-afwijkingen te verklaren; de benodigde v1.2-primitives en patterns bestaan al in `apps/hr-suite/components/ui` en `apps/hr-suite/components/patterns`.

## Audit scope en classificatie

GREEN betekent hier: de interaction- en collectioncontracten zijn aantoonbaar passend voor deze flow; browseracceptance die in de statusdocumentatie nog openstaat is afzonderlijk gerapporteerd en maakt een read-only/static GREEN niet automatisch RED. AMBER is een concrete, beperkte afwijking. RED is een structurele verkeerde surface of herhaalde lokale interactionarchitectuur.

| Area | Screen/Flow | Status | Issue | v1.2 target | Effort |
|---|---|---|---|---|---|
| Employee 360 | Employees list `/employees` | GREEN | De lijst heeft URL-state voor search/filter/sort/view en de meerdere views zijn expliciet gerechtvaardigd als `/employees` reference exception voor identiteit en foto’s. Navigatie is een link; de collectie heeft geen normale CRUD-rowactie. Evidence: `app/(dashboard)/employees/page.tsx:29-48,62-87,102-186`; `components/employees/employee-list.tsx:59-116,258-345`. | `PageHeader → toolbar/filter → collectie`; één view tenzij de reference exception functionele waarde heeft. | SMALL |
| Employee 360 | Employee overview/dashboard | GREEN | Dit is primair een dashboard/projectie. Links zijn navigatie-links en de compacte activity/profile-link controls zijn eenvoudige, laag-risico contextacties; er is geen algemene collection-CRUDarchitectuur die v1.2 schendt. Evidence: `components/employees/employee-dashboard.tsx:86-105,113-133,200-217`. | Dashboardpanelen mogen bounded zijn; gewone navigatie blijft een link. | SMALL |
| Employee 360 | Personal tab: persoonsgegevens, adressen, bankrekeningen, relaties | RED | Persoonsgegevens gebruikt een multi-section, multi-field inline full-page form; adressen, bankrekeningen en relaties tonen per rij direct Edit en Delete en openen lokale inline forms. Delete gebruikt `window.confirm`. Dit is normale CRUD, geen beperkte inline edit. Evidence: `components/employees/employee-person-card.tsx:267-326,390-409,529-562,568-592`. | Persoonsedit als full page/sticky actions of passende FormDrawer; resource create/edit als FormDrawer; rijacties via maximaal één zichtbare actie en `ActionMenu → ConfirmDialog`. | LARGE |
| Employee 360 | Employment Workspace en contract-/timeline-mutaties | RED | De complexe contractwijziging is een groot multi-step formulier in een custom centered dialog; timeline managers gebruiken eveneens lokale dialogforms. De complexiteit past bij full page, niet bij een lang dialogformulier. Evidence: `components/employment/employment-contract-change-dialog.tsx:544-562`; `components/employment/company-location-timeline-manager.tsx:216-252`; `components/employment/employment-contract-create-form.tsx:108`. | Complexe/multi-step change flow als full page met sticky `FormActions`; normale location/timeline CRUD als FormDrawer; centrale Dialog alleen voor korte bevestiging/beslissing. | LARGE |
| Employee 360 | Documents | RED | Upload en metadata-editing staan in een open inline `<details>`-form met meerdere secties en velden. Delete/restore is als directe rijbutton aanwezig en gebruikt geen `ActionMenu → ConfirmDialog`. Custom `MULTI_SELECT` gebruikt de bestaande native multiple-selectroute. Evidence: `components/documents/employee-document-dossier.tsx:288-301,377-461,465-553`. | Upload als full page wanneer de flow complex blijft, anders FormDrawer; destructive documentactie via `ActionMenu → ConfirmDialog`; multiselect-gap afzonderlijk als LATER registreren. | LARGE |
| Employee 360 | Payslips | GREEN | De flow is read-only: preview en download zijn passende controls/links en er is geen create/edit/delete-form. Evidence: `components/documents/employee-payslips.tsx:76-80`. | Read-only collection met passende links/actions. | SMALL |
| Employee 360 | Reminders | GREEN | Dit is de v1.2-reference. `EntityList`, `RowActions`, `ActionMenu`, `FormDrawer`, `ConfirmDialog`, dirty protection, save loading en response refresh zijn allemaal aanwezig. Evidence: `components/employees/employee-reminders.tsx:8-16,93-124,170-240`; `components/patterns/form-drawer.tsx:35-78`. | Behouden als reference voor volgende migraties. | SMALL |
| Employee 360 | Notes | RED | Create/Edit is inline in de collectie, met multi-field form; Delete is een directe tekstbutton en `window.confirm`. Er is geen `FormDrawer`, `RowActions` of `ConfirmDialog`, en geen dirty-form protection of saving state. Evidence: `components/employees/employee-notes.tsx:36-73`. | `EntityList`/passende collectie; FormDrawer voor create/edit; `RowActions` met `ActionMenu → ConfirmDialog`; dirty/saving/error-contract. | MEDIUM |
| Employee 360 | Absence report/recovery/capacity | RED | Het reportformulier heeft meerdere velden en een searchable employment-select, maar wordt in een lokale centered modal gerenderd. De modal heeft geen fixed footer, geen focus/keyboard contract via Foundation `Dialog`/`Drawer` en geen dirty-close protection. Recovery/capacity zijn aparte inline forms met eigen actiongedrag. Evidence: `components/absence/absence-quick-form.tsx:57-105,127-161`. | Report als FormDrawer/full-screen mobile sheet met vaste footer; korte confirmatie eventueel Dialog; dirty protection en centrale loading/error actions. | LARGE |
| Employee 360 | Processes in Employee Detail | GREEN | In de Employee 360-tab is dit een projectie/link naar proceswerk; de daadwerkelijke process-workflow is een aparte complexe flow. De detaildashboardpresentatie gebruikt read-only links en empty states. Evidence: `components/employees/employee-dashboard.tsx:113-133`; `docs/requirements/ux/REDESIGN_EMPLOYEE_360_DASHBOARD.md:16-28`. | Read-only dashboard projectie; complexe workflow apart auditen. | SMALL |
| Other redesigned | Company Data `/settings/company-data` | RED | Location create/edit gebruikt een lokale custom modal; backdrop, X en Cancel sluiten direct zonder dirty protection. Delete is een directe rijbutton met `window.confirm`; Edit en Delete staan beide prominent naast iedere rij. Evidence: `components/settings/company-data-manager.tsx:160-211,226-243`. | FormDrawer voor location create/edit, fixed footer en dirty protection; `RowActions`/`ActionMenu → ConfirmDialog` voor destructive actions. | MEDIUM |
| Other redesigned | Authorization `/authorization` | AMBER | De permission-editor gebruikt terecht sticky save/reset actions, maar role-create is een inline `<details>`-form met meerdere velden en de coverage-inspectie is een custom modal in plaats van de centrale Dialog. Dit is beperkt tot subflows; de hoofdeditor blijft full-page. Evidence: `components/organization/authorization-manager.tsx:137-180`. | Role-create als FormDrawer; coverage als centrale Dialog met focus/Escape/restore contract. | MEDIUM |
| Other redesigned | Process Automation `/settings/process-automation` | RED | De nieuwe process-wizard is een drie-staps, multi-field flow in een custom dialog met scrollende body. Dat is een structurele afwijking van full page voor multi-step/complexe flows. Publish/retire zijn compacte beslissingen maar gebruiken eveneens lokale dialogmarkup. Evidence: `components/process-automation/studio-workspace.tsx:666-671,860-876`. | Wizard als full page met sticky `FormActions`; publish/retire via centrale Dialog/ConfirmDialog. | LARGE |
| Other redesigned | Start page `/dashboard/start` | AMBER | De flow heeft geen normale CRUD-collection, maar de actuele component gebruikt opnieuw zware lokale surface-/hover-/shadowpatronen en een expliciete horizontal-scroll strip voor quick actions. Dat is niet de v1.2 collectionregel zelf, maar blijft een concrete Foundation-v1 compliance-afwijking binnen een geregistreerde redesign. Evidence: `components/startpage/start-page.tsx:229-243,291-319`; `docs/requirements/ux/REDESIGN_STARTPAGINA.md:19-42`. | Behoud functionele horizontal scroll alleen voor de quick-action rail; bring surfaces/actions terug naar Foundation tokens en generieke composities in een aparte polish-slice. | MEDIUM |

## Cross-screen findings

1. **Lokale normale CRUD-surfaces blijven terugkomen.** Personal, Notes, Company Data, Documents en Employment timeline flows gebruiken lokale inline forms of custom modalforms, terwijl `FormDrawer` in de suite beschikbaar is en Reminders het referentiegedrag bewijst.

2. **Destructive actions zijn niet uniform.** Notes, Company Data, Personal resources, Documents en Avatar gebruiken directe buttons of `window.confirm` in plaats van `RowActions`/`ActionMenu` plus `ConfirmDialog`. Evidence: `employee-notes.tsx:55-59`, `company-data-manager.tsx:202-208`, `employee-person-card.tsx:581`, `employee-avatar-manager.tsx:36-47`, `employee-document-dossier.tsx:543-553`.

3. **Dirty state is niet suitebreed.** `FormDrawer` beschermt X, Escape, backdrop en Cancel via `ConfirmDialog`; de lokale Company Data, Absence, Notes en diverse employment/dialog flows doen dat niet aantoonbaar. Evidence: `components/patterns/form-drawer.tsx:40-53`; `components/settings/company-data-manager.tsx:170-175,211`; `components/absence/absence-quick-form.tsx:127-130`.

4. **Centrale patterns worden nog niet als default composition gebruikt.** `EntityList`, `RowActions` en `FormDrawer` zijn in de code aanwezig en actief gebruikt door Reminders, maar de oudere collections dupliceren de interactionstructuur lokaal. Evidence: `components/employees/employee-reminders.tsx:8-16,170-240`; `components/patterns/entity-list.tsx`; `components/patterns/row-actions.tsx`.

5. **De auditbaseline en documentatiestatus lopen uiteen.** De statusdocumenten registreren diverse flows als geïmplementeerd of geverifieerd, maar de v1.2 interaction-contracts zijn niet automatisch door die eerdere v1-migraties heen getrokken. De audit classificeert daarom op actuele code-evidence, niet op de oude statuslabel alleen.

## Foundation gaps

### FOUNDATION_GAP — Multiselect — LATER

- Gewenste component/pattern: zoekbare multiselect met zichtbare selectie/chips, selecteer/wis alles en duidelijke keyboard-UX.
- Concrete use case: document custom fields met `field_type === 'MULTI_SELECT'`; de documentdossierflow leest de waarden met `form.getAll(name)`.
- Waarom huidige componenten onvoldoende zijn: de huidige Foundation heeft `DropdownSelect` en native multiple-selectgedrag, maar geen suitebrede zoekbare multiselect-compositie.
- Benodigde props/gedrag: opties, geselecteerde waarden, zoeken, selecteer/wis alles, `onChange`, disabled/loading en native form-submissie.
- Waarschijnlijke hergebruiklocaties: Documents, Reminders en Custom Fields, zoals reeds geregistreerd in `docs/requirements/ux/LIQUIDHR_UX_FOUNDATION_V1.md:72-74`.
- Voorstel: **LATER**; niet eerst bouwen als onderdeel van de correctiebatches hieronder.

Er is geen afzonderlijke Datepicker-gap opgevoerd: de requirements markeren native date-inputs als voldoende voor de huidige scope (`LIQUIDHR_UX_FOUNDATION_V1.md:73`).

## Recommended correction batches

### Batch 1 — Employee CRUD surfaces en destructive actions

- Scope: Personal resources, Notes, Company Data locations, Documents upload/delete en de kleine avatar/resource-acties.
- Waarom samen: dezelfde afwijking keert terug: lokale inline/modal CRUD en directe destructive actions.
- Gedeelde files/components: `FormDrawer`, `FormActions`, `ConfirmDialog`, `EntityList`, `RowActions`, `ActionMenu`; domeincomponenten in `components/employees`, `components/documents`, `components/settings`.
- Conflict risico: MEDIUM; meerdere domeinen raken dezelfde employee-detail layout, maar API/permissions blijven behouden.
- Zwaarte: LARGE.
- Reasoning: één interactionmigratie maakt de v1.2-default concreet zonder businesslogica te wijzigen.
- Aanbevolen branchnaam: `work/ux-v1-2-employee-crud-surfaces`.
- Afhankelijkheden: geen schema/API-wijziging; Reminders-reference als contract; multiselect blijft LATER.
- Acceptance personas: HR Admin positieve CRUD; Manager/Employee alleen volgens bestaande capability/self-service scope; minimaal negatieve delete/write-check waar relevant.

### Batch 2 — Absence en Employment mutation surfaces

- Scope: absence report/recovery/capacity en employment contract/location/timeline mutation flows.
- Waarom samen: beide zijn contextuele HR-mutaties met complexe validatie en moeten dezelfde keuze maken tussen full page, FormDrawer en korte ConfirmDialog.
- Gedeelde files/components: `Drawer`, `FormDrawer`, `FormActions`, `ConfirmDialog`, employment/absence mutation components.
- Conflict risico: HIGH; effectieve datums, salary/organization/cost payloads en self-service permissiongrenzen mogen niet veranderen.
- Zwaarte: LARGE.
- Reasoning: de huidige custom dialogs hebben de grootste risico’s rond focus, dirty close en bereikbaarheid van actions.
- Aanbevolen branchnaam: `work/ux-v1-2-hr-mutation-surfaces`.
- Afhankelijkheden: Batch 1-patronen; geen remote databaseactie.
- Acceptance personas: HR Admin voor HR-mutaties; Employee alleen self-service absence report; Manager negatieve scope-test.

### Batch 3 — Process Automation workflow dialogs

- Scope: process create wizard, publish en retire confirmation in `/settings/process-automation`.
- Waarom samen: één studio-flow bevat zowel de complexe multi-step create surface als compacte decision dialogs.
- Gedeelde files/components: `Dialog`, `Drawer`/full-page `FormActions`, `ConfirmDialog`; `components/process-automation/studio-workspace.tsx`.
- Conflict risico: MEDIUM; autosave, revision conflict, publish/retire permissions en URL/cataloguscontext moeten behouden blijven.
- Zwaarte: LARGE.
- Reasoning: de wizard is architectonisch een full-page flow; publish/retire zijn juist korte confirmations en kunnen uniform naar centrale patterns.
- Aanbevolen branchnaam: `work/ux-v1-2-process-automation-interactions`.
- Afhankelijkheden: centrale v1.2 patterns; geen API/schemawijziging.
- Acceptance personas: HR Admin/TENANT_ADMIN met `process-definition:write`/`publish`; read-only rol moet de actions niet kunnen uitvoeren.

### Batch 4 — Foundation polish en acceptance sweep

- Scope: Authorization subflows, Start page Foundation-surface polish en resterende browser/390px checks voor de geaudite flows.
- Waarom samen: dit zijn beperkte afwijkingen nadat de structurele CRUD/mutationcorrecties zijn uitgevoerd; ze delen vooral de centrale Dialog/Surface/accessibility acceptance.
- Gedeelde files/components: `Dialog`, `FormDrawer` waar role-create past, `Surface`, `Button`, canonical tabs, `components/organization/authorization-manager.tsx`, `components/startpage/start-page.tsx`.
- Conflict risico: LOW/MEDIUM; URL-state, permission matrix en startpage `viewMode` moeten gelijk blijven.
- Zwaarte: MEDIUM.
- Reasoning: geen nieuwe productflow; alleen interaction reuse, tokengebruik en representatieve acceptance.
- Aanbevolen branchnaam: `work/ux-v1-2-foundation-polish`.
- Afhankelijkheden: Batches 1–3 voor gedeelde evidence en geen open regressies.
- Acceptance personas: HR Admin voor authorization; Manager/Employee route- en permission-negative checks; Default en LinkedHR op desktop/390px.

## Audit validation

- Iedere AMBER/RED heeft code-evidence en verwijst naar een v1.2 interaction-, action-, dirty-state- of Foundation-reuseprincipe.
- GREEN is niet gebaseerd op browseracceptance-aannames: GREEN flows zijn read-only, reference-conform of expliciet buiten normale CRUD-surfacekeuze.
- Geen RED-classificatie is uitsluitend gebaseerd op styling; Start page is daarom AMBER.
- Productcode, CSS, translations, API, database, fixtures en tests zijn in deze audit niet gewijzigd.
- Browseracceptance is alleen nodig als follow-up voor de correction batches; deze audit claimt geen nieuwe authenticated browsergate.
