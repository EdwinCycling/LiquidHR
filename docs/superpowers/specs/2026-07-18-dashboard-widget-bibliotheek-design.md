# Dashboard-widgetbibliotheek en autorisatie

## Status

Goedgekeurd ontwerp op 2026-07-18. Dit document is de functionele en technische basis voor de uitbreiding van Module 5 (Liquid Display) en Module 14 (Dashboard Builder).

## Doel

Liquid HR krijgt een tenantgebonden bibliotheek met mooie, consistente HR-widgets. De HR-admin beheert per widget of deze actief is en voor welke tenantrollen de widget beschikbaar is. Medewerkers bouwen persoonlijke dashboards met alleen widgets waarvoor zij op dat moment geautoriseerd zijn. Wordt een widget gedeactiveerd of verliest de gebruiker de roltoegang, dan verdwijnt de widget ook uit bestaande dashboards.

De bibliotheek bevat alle vijf afgesproken HR-categorieën. Alleen widgets met een bestaande betrouwbare databron worden geïmplementeerd. Verlof, verzuim, aanwezigheid, declaraties, loonstroken en AI-compliance blijven categorieën/future slots totdat hun schema, RLS en services bestaan.

## Widgetcatalogus

De catalogus wordt typed in code beheerd. Iedere entry bevat minimaal:

- `type`: stabiele Engelse identifier;
- `category`: `CORE_HR`, `EMPLOYMENT`, `DOCUMENTS`, `COMPENSATION`, of `ORGANIZATION_TIME`;
- Nederlandse en Engelse message keys voor titel, omschrijving en lege staat;
- `visualization`: `PROFILE`, `KPI`, `TABLE`, `PROGRESS`, `BAR`, `DONUT`, `LINE`, `TIMELINE`, `CALENDAR`;
- `defaultWidth`: `HALF`, `TWO_THIRDS` of `FULL`;
- benodigde canonical permissions;
- loader-key die uitsluitend geautoriseerde serverdata mag leveren.

### CORE_HR

`MY_PROFILE`, `PROFILE_COMPLETENESS`, `MY_EMERGENCY_CONTACTS`, `EMPLOYEE_DIRECTORY`, `UPCOMING_BIRTHDAYS`, `HEADCOUNT_BY_DEPARTMENT`, `GENDER_DISTRIBUTION`, `EDUCATION_MIX`, `NATIONALITY_DISTRIBUTION`.

Bronnen: `employees`, `employee_relations`, `employee_organizations`, `departments`, `employee_administration_assignments`. BSN wordt nooit als widgetdata geleverd. Gearchiveerde medewerkers worden standaard uitgesloten.

### EMPLOYMENT

`MY_CONTRACT_DETAILS`, `CONTRACT_TYPE_MIX`, `EXPIRING_CONTRACTS`, `PROBATION_ALERTS`, `UPCOMING_STARTS`, `CURRENT_MONTH_ENDS`, `AVERAGE_TENURE`, `EMPLOYMENT_STATUS_MIX`, `EMPLOYMENT_CHANGE_TIMELINE`.

Bronnen: `employments`, `employment_terminations`, `employment_change_sets`, `employee_organizations`. Contractlabels worden via i18n vertaald; ruwe enumwaarden komen nooit in zichtbare UI.

### DOCUMENTS

`MY_RECENT_DOCUMENTS`, `EXPIRING_DOCUMENTS`, `DOCUMENTS_BY_CATEGORY`, `DOCUMENTS_PER_EMPLOYEE`, `DOCUMENT_REMINDER_STATUS`.

Bronnen: `employee_documents`, `document_categories`, `reminders` en doelgroepservices. Downloadlinks blijven signed/private en worden niet in widgetdata opgenomen.

### COMPENSATION

`MY_SALARY_HISTORY`, `AVERAGE_SALARY_BY_DEPARTMENT`, `SALARY_SCALE_OCCUPANCY`, `PAYMENT_TYPE_MIX`, `COST_ALLOCATION_MIX`, `SALARY_CHANGE_TIMELINE`.

Bronnen: `employment_salaries`, `salary_scales`, `salary_scale_steps`, `employment_cost_allocations`, `cost_centers`, `employee_organizations`. Iedere salarisloader vereist expliciet `salary:read`; zonder dit recht wordt de widget niet aangeboden.

### ORGANIZATION_TIME

`MY_WEEKLY_ROSTER`, `WEEKDAY_HOURS`, `FTE_BY_DEPARTMENT`, `ROSTER_COVERAGE_BY_DEPARTMENT`, `UPCOMING_HOLIDAYS`, `ACTIVE_REMINDERS`, `ORGANIZATION_SUMMARY`, `WORK_PATTERNS_BY_DEPARTMENT`.

Bronnen: `employment_work_patterns`, `employment_work_pattern_days`, `holidays`, `reminders`, `departments`, `employee_organizations` en bestaande organisatiegrafiekservices. Verlof/verzuim/aanwezigheid worden hier pas toegevoegd nadat de modules beschikbaar zijn.

## Tenantinstellingen en rollen

De codecatalogus blijft de technische bron voor widgetmetadata. Tenantinstellingen worden opgeslagen in twee nieuwe RLS-tabellen:

- `dashboard_widget_configs`: tenant, widgettype, `is_enabled`, auditvelden;
- `dashboard_widget_role_access`: tenant, widgettype, `management_role_id`.

De combinatie `(tenant_id, widget_type)` is uniek. Een widget zonder actieve config is niet beschikbaar. Een actieve widget zonder rolkoppeling is uit veiligheidsoverwegingen niet beschikbaar. De migratie seedt alleen widgettypes met beschikbare dataloaders en koppelt de bestaande tenantrollen volgens de doelgroepen uit deze spec:

- medewerker/self: eigen profiel-, contract-, dossier-, salaris- en roosterwidgets;
- manager: geautoriseerde team-/organisatiescopewidgets;
- HR-admin: tenantbrede analysewidgets.

De instellingenpagina is uitsluitend zichtbaar achter `settings:read` plus `dashboard-widget:write`. De API controleert deze permission server-side; RLS verhindert directe tenantoverschrijdende toegang. Wijzigingen worden in `audit_logs` vastgelegd.

## Dashboardopslag en filtering

`personal_dashboard_widgets.settings` krijgt een gevalideerde layoutinstelling:

```ts
{ width: 'HALF' | 'TWO_THIRDS' | 'FULL' }
```

Oude testwidgets worden bij het laden en opslaan gefilterd wanneer ze niet meer in de catalogus voorkomen. Bestaande dashboards behouden geldige widgets en krijgen geen automatische toegang tot nieuwe widgets; de gebruiker voegt nieuwe widgets via de bibliotheek toe.

De dashboardservice voert bij iedere read/save uit:

1. catalogusfilter;
2. tenantconfiguratiecheck;
3. rol- en permissioncheck;
4. verwijderen van ongeldige widgets uit de response;
5. optioneel opruimen bij de eerstvolgende layout-save.

Hierdoor kan een gedeactiveerde widget nooit via een oud dashboard blijven renderen.

## Serverdata en visualisaties

Elke widgetloader is een server-only functie met een klein, typed viewmodel. Loaders gebruiken bestaande services waar mogelijk en voeren geen client-side Supabase-query's uit. De dashboardroute vraagt de loaderdata voor de zichtbare widgets parallel op; een fout in één widget maakt niet het hele dashboard onbruikbaar. Die widget toont een i18n-fout-/lege staat en wordt geaudit in serverlogs zonder PII.

Recharts wordt gebruikt voor `BAR`, `DONUT` en `LINE` met vaste Liquid HR-kleuren via CSS-variabelen. Tabellen, KPI's, progress bars, tijdlijnen en kalenders gebruiken dezelfde kaartkop, spacing, legenda, tooltip, focusstijl en lege staat. Iedere grafiek krijgt een tekstalternatief of samenvatting voor toegankelijkheid.

## UI-flow

### HR-admin: Widgetbibliotheek

Nieuwe route `/settings/dashboard-widgets` onder de bestaande instellingenhub:

- categorie-filter en zoekveld;
- kaart per widget met titel, omschrijving, visualisatie en databronstatus;
- schakelaar Actief/inactief;
- rolchips/checkboxes voor toegestane managementrollen;
- duidelijke melding hoeveel bestaande dashboards door uitschakelen worden geraakt;
- opslaan met optimistic UI alleen na serverbevestiging.

### Gebruiker: Dashboard Builder

De bestaande editor toont alleen beschikbare widgettypes, gegroepeerd per categorie. Iedere widgetkaart toont titel en preview. Bij toevoegen of bewerken kiest de gebruiker breedte `1/2`, `2/3` of `volledig`. Het raster gebruikt zes kolommen zodat alle drie breedtes consistent uitlijnen.

## Foutafhandeling en veiligheid

- Geen `any`; alle catalogus-, loader- en API-inputs zijn Zod/TypeScript-typed.
- Geen raw salary, BSN of documentbytes in generieke widgetpayloads.
- Tenant, administratie, rol en employee scope worden uitsluitend server-side afgeleid.
- Een uitgeschakelde of niet-geautoriseerde widget wordt niet alleen verborgen, maar ook uit API-responses en save-validatie geweerd.
- Foutmeldingen en lege staten zijn volledig NL/EN en komen uit message namespaces.

## Verificatie

- Unit tests voor cataloguspariteit, categorieën, width-validatie en filtering van disabled/unauthorized widgets.
- Service tests voor ieder loadercontract met geautoriseerde en geweigerde scope.
- RLS/integratietests voor tenantisolatie, HR-adminconfiguratie en roltoegang.
- i18n-check, type-check, lint, Vitest en productiebuild.
- Browsercontrole op poort 3000 van de dashboardeditor, widgetinstellingen en een desktopbreedte; controle dat een uitgeschakelde widget uit bestaand dashboard verdwijnt.
