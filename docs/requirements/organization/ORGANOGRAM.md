# Organogram

## 1. Status en doel

**Status:** LEIDEND.

Het organogram maakt de actuele organisatiestructuur van de geselecteerde administratie visueel verkenbaar. De eerste versie is uitsluitend leesbaar: wijzigen blijft verlopen via de bestaande afdelings-, plaatsings- en managementflows.

## 2. Scope van versie 1

- De structuur is afdeling-gedreven: `Administration → Department → Employee`.
- Er is geen drag-and-drop en het canvas schrijft geen organisatiegegevens.
- De gebruiker kan zoeken, filteren, focussen, zoomen, verschuiven en doorklikken.
- De peildatum staat in de URL en is standaard vandaag.
- Alleen records die op de peildatum actief zijn worden geprojecteerd.
- Desktop gebruikt een interactief canvas; mobiel gebruikt een compacte verticale boom met dezelfde informatie.

## 3. Brongegevens

Het organogram introduceert geen tweede organisatiestructuur. Het is een projectie van:

- `administrations`;
- `departments`;
- `employee_organizations`;
- `department_management`;
- `management_roles`;
- `employees`;
- expliciet toegestane vrije-velddefinities en -waarden.

Parallelle dienstverbanden en plaatsingen mogen meerdere medewerkerkaarten opleveren wanneer zij organisatorisch verschillend zijn. Iedere kaart verwijst naar de bijbehorende medewerker en, indien beschikbaar, het dienstverband.

## 4. Node-typen

### 4.1 AdministrationNode

Toont de geselecteerde administratie met naam, code en aantal zichtbare actieve medewerkers. De kaart gebruikt de bestaande `primary`-tokens.

### 4.2 DepartmentNode

Toont:

- afdelingsnaam en code;
- aantal actieve plaatsingen;
- de actieve houder van `DIRECT_MANAGER`, lokaal of via ancestor-overerving;
- een expliciete ambiguïteitsstatus wanneer meerdere geldige rolhouders bestaan.

De projectie kiest bij ambiguïteit nooit stil een medewerker.

### 4.3 EmployeeNode

Toont:

- avatar of initialen;
- volledige naam;
- actieve functietitel;
- badges voor actieve managementrollen;
- een deputybadge uitsluitend wanneer die rol als zelfstandige actieve managementrol is vastgelegd.

Klikken opent de bestaande medewerkersdetailroute. Gevoelige gegevens zoals BSN, bankgegevens en salaris worden niet opgenomen.

## 5. Verbindingen en layout

- Administration naar iedere hoofdafdeling.
- Afdeling naar onderliggende afdeling.
- Afdeling naar actieve medewerkerplaatsing.
- De gebruiker kan naast de afdelingweergave ook een managerweergave kiezen die uitsluitend directe manager-medewerkerrelaties toont.
- De functieweergave toont functiegroep → functie → medewerker; de medewerkerkaart vermeldt daarbij de afdeling.
- Automatische layout is deterministisch en verandert niet door zoeken of filteren.
- Bij filteren blijven de paden naar matches zichtbaar.

## 6. Verkenbalk en filters

De verkenbalk is een aantrekkelijke, rustige ingang tot het organogram en geen technisch filterformulier.

- Een prominente zoekbalk zoekt gelijktijdig op medewerker, functie, afdeling en afdelingscode.
- De weergavekeuze (afdelingen, managerrelaties of functiegroepen/functies) staat altijd zichtbaar in de verkenbalk; overige filters mogen dichtgeklapt zijn.
- Snelfilters worden als leesbare chips getoond voor afdeling en managementrol.
- Meer filters opent een compact paneel voor peildatum en toegestane vrije velden.
- Een actieve chip toont de keuze en kan afzonderlijk worden verwijderd.
- Het aantal matches wordt direct en toegankelijk gemeld.
- `Wis alles` verschijnt alleen wanneer filters actief zijn.
- Keuzes zijn toetsenbordbedienbaar, hebben zichtbare focus en gebruiken Nederlandse/Engelse taalbestanden.
- Op mobiel staat zoeken bovenaan en openen filters in een compacte sheet of uitklapbaar paneel.
- Niet-matchende nodes worden gedimd, niet geblurd; tekst blijft rustig en toegankelijk.
- Matches krijgen accent, schaalvergroting is beperkt om layoutverspringing te voorkomen.

Vrije-veldfilters zijn opt-in. Alleen actieve, niet-gevoelige definities met `show_in_organization_chart_filter = true` mogen in filtermetadata en graph-data verschijnen. De bestaande audience- en RLS-regels blijven daarnaast gelden.

## 7. URL-state

Minimaal ondersteunde parameters:

- `date=YYYY-MM-DD`;
- `view=department|manager|job`;
- `q=<zoekterm>`;
- `department=<uuid>`;
- `role=<role-code>`;
- `field=<definition-id>` en `value=<waarde>`.

De server rendert de selectie op basis van deze parameters. Tijdelijke canvaspositie en zoom zijn lokale UI-state.

## 8. Autorisatie en privacy

- Nieuwe canonieke permission: `organization-chart:read`.
- De migratie kent dit recht standaard toe aan `TENANT_ADMIN`, `HR_ADVISOR` en `TEAM_LEAD`; tenantadmins kunnen het daarna via de bestaande rechtenmatrix intrekken of aan andere tenantrollen toekennen.
- De service vereist daarnaast `department:read`, `organization-placement:read` en `management-assignment:read`; medewerkerdata blijft per rij begrensd door `employee:read`/selfscope en RLS.
- Alle queries gebruiken de ingelogde Supabase-client en respecteren RLS.
- De graph bevat uitsluitend medewerkers die de actor via `employee:read` of toepasselijke self-/managementscope mag zien.
- De response bevat alleen expliciet geselecteerde velden en nooit volledige database-rijen.
- Tenant- en administratiegrenzen worden server-side en database-side afgedwongen.

## 9. API-contract

De leesroute retourneert een getypeerde projectie met:

- graphmetadata en peildatum;
- getypeerde nodes en edges;
- toegestane filterdefinities en filteropties;
- zichtbare totalen en ambiguïteitswaarschuwingen.

De route muteert niets. Fouten gebruiken vaste codes voor ongeldige peildatum, ontbrekende administratie, verboden toegang en mislukte projectie.

## 10. Acceptatiecriteria

- De gekozen administratie, afdelingen en actieve plaatsingen zijn correct op iedere geldige peildatum.
- Een gebruiker ziet nooit data buiten tenant, administratie of medewerkerscope.
- Zoeken en filters zijn combineerbaar en via URL deelbaar.
- Niet-matchende nodes worden gedimd terwijl het verbindingspad zichtbaar blijft.
- Managerambiguïteit wordt expliciet weergegeven.
- Desktop en 390px mobiel zijn volledig bruikbaar zonder horizontale pagina-overflow.
- Alle zichtbare tekst bestaat in NL en EN.
- TypeScript, lint, i18n, unit-, database-, build- en browsercontroles slagen.

## 11. Buiten scope

- Drag-and-drop;
- reorganisaties simuleren of publiceren;
- inline wijzigen van plaatsingen, afdelingen of rolhouders;
- loonkosten- en salaris-KPI's;
- automatische deputyactivatie zonder betrouwbare afwezigheidsbron;
