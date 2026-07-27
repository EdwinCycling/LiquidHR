# Medewerkerdashboard

Status: **LEIDEND**  
Implementatie: **GEDEELTELIJK — dashboard-, links- en veiligheidsuitbreiding in uitvoering**  
Versie: `2026-07-24`

## 1. Doel

Het medewerkerdashboard is de rustige, leesgerichte landingspagina tussen een verwijzing naar een medewerker en de bestaande medewerkerdetailtabs. De pagina geeft een geautoriseerde kijker een samenvatting van de geselecteerde medewerker, zonder alle onderhoudsdata vooraf te laden.

De route blijft:

- `/employees/[employeeId]`: medewerkerdashboard, standaard geopend;
- `/employees/[employeeId]?tab=personal`: persoonsgegevens;
- `/employees/[employeeId]?tab=employments`: dienstverbanden;
- `/employees/[employeeId]?tab=documents`: dossier;
- `/employees/[employeeId]?tab=reminders`: reminders;
- `/employees/[employeeId]/employments/[employmentId]`: bestaand dienstverbanddetail met eigen tabs.

Er worden voor bestaande medewerkerdetails geen nieuwe parallelle routes zoals `/contact`, `/leave` of `/absence` geïntroduceerd. Nieuwe tabs worden pas toegevoegd wanneer het betreffende domein een echte, geautoriseerde bron en een eigen requirement heeft.

## 2. Navigatie en informatiehiërarchie

### 2.1 Landingsgedrag

Alle productonderdelen die een medewerker als bestemming tonen, openen standaard `/employees/[employeeId]`. Daarmee openen zij het dashboard en niet direct een onderhoudstab.

Dit geldt minimaal voor:

- de medewerkerslijst;
- zoek- en selectieresultaten voor medewerkers;
- het organogram;
- de HR-kalender;
- medewerkersnamen in Insights-tabellen;
- medewerkersnamen bij Aankomende gebeurtenissen;
- een managerlink in het profielhoofd, mits de kijker die manager mag openen.

De bestaande medewerkerslijst, het organogram en de HR-kalender verwijzen al naar dit routepatroon. Insights toont namen nog als tekst en krijgt expliciete links. De rapportprojectie voor Aankomende gebeurtenissen moet daarvoor ook `employeeId` leveren.

Dynamische medewerkerlinks gebruiken standaard `prefetch={false}`. Dit voorkomt dat schermen met veel medewerkers alle dashboards vooraf laden.

### 2.2 Terugkeercontext

Een ingang mag een vaste, gevalideerde broncode meegeven, bijvoorbeeld `from=employees`, `from=insights`, `from=organization-chart` of `from=hr-calendar`. De pagina vertaalt die code naar een bekende interne teruglink. Een willekeurige URL uit de querystring wordt nooit rechtstreeks gebruikt.

### 2.3 Naar medewerkerdetails

Het dashboard maakt op twee plekken duidelijk hoe de gebruiker naar onderhoud gaat:

1. een primaire actie **Medewerkerdetails** in het profielhoofd, die naar `?tab=personal` gaat;
2. direct onder het profielhoofd de bestaande tabnavigatie met **Dashboard**, **Persoonsgegevens**, **Dienstverbanden**, **Dossier** en **Reminders**.

De actieve dashboardtab heet **Dashboard**. De detailtabs blijven afzonderlijke deelbare URL-states. Een widget mag daarnaast naar de relevante detailtab of een specifiek dienstverband verwijzen, maar alleen wanneer die bestemming bestaat en de kijker er toegang toe heeft.

## 3. Wie opent het dashboard?

Toegang wordt niet bepaald door het label van een rol, maar door de combinatie van exact functiepunt, actuele scope, actieve tenant/administratie en RLS.

| Kijker | Toegang tot de medewerker | Inhoud |
|---|---|---|
| Medewerker zelf | Alleen wanneer de ingelogde gebruiker aan deze Employee is gekoppeld en `self:employee:read` bezit | Alleen widgets waarvoor de exacte selfpermission en eventuele doelgroepregel gelden |
| Direct leidinggevende | Alleen bij een actuele managerrelatie of geldige afdelingsscope én `employee:read` op de target | Alleen domeinwidgets waarvoor `DIRECT_MANAGER` de exacte leespermission bezit; nooit automatisch BSN, salaris, dossier of verzuim |
| HR-admin of tenantadmin | Alleen binnen de actieve tenant/administratie en met `employee:read` | Alleen de afzonderlijk toegekende domeinpermissions; de rolnaam is geen bypass |
| Casemanager of andere maatwerkrol | Alleen met een actieve roltoewijzing, een geldige organisatie- of toekomstige casusscope en `employee:read` | Alleen expliciet toegekende domeinpermissions; een verzuimcasus geeft niet automatisch toegang tot de volledige medewerkerkaart |
| Overige gebruiker | Geen geldige targetscope of geen `employee:read`/`self:employee:read` | Dashboard niet toegankelijk; vaste 403/404-afhandeling zonder datalek |

Een roltoewijzing is effective-dated. Een wijziging van afdeling, manager of rol kan de toegang direct veranderen. Een eerder opgeslagen dashboardindeling houdt een widget nooit zichtbaar wanneer de actuele toegang vervalt.

## 4. Verdediging in diepte

Voor iedere dashboardrequest geldt deze volgorde:

1. bepaal de geauthenticeerde actor en actieve tenant-/administratiecontext;
2. controleer `employee:read` voor een andere medewerker of exact `self:employee:read` voor de eigen medewerker;
3. bepaal de actuele targetscope via RLS en de bestaande managementscope;
4. bepaal per widget de vereiste domeinpermission;
5. lees alleen de velden die voor die widget nodig zijn met de ingelogde Supabase-client;
6. pas aanvullende doelgroepregels toe, zoals vrije-veldaudiences en documentaudiences;
7. stuur niet-geautoriseerde waarden nooit naar de browser;
8. toon alleen acties waarvoor de afzonderlijke writepermission is bevestigd.

Een widget is dus geen beveiligingsgrens. De service/API en RLS zijn dat wel. Drag-and-drop, verborgen CSS, blur, hover of een niet-getoonde knop verlenen of beschermen geen toegang.

Bij een geweigerde widgetread wordt de widget niet met gevoelige placeholders gevuld. Een onverwachte queryfout wordt als fout gelogd en niet stil als “geen gegevens” gepresenteerd. Een normale lege dataset krijgt wel een functionele lege staat.

## 5. Profielhoofd en vaste paginaonderdelen

Het profielhoofd en de detailnavigatie zijn vast en niet versleepbaar of verbergbaar. Het profielhoofd bevat uitsluitend geautoriseerde, compacte shelldata:

- avatar of initialen;
- samengestelde naam volgens `NameUsage`;
- personeelsnummer;
- arbeidsstatus;
- actuele functie en afdeling, wanneer zichtbaar;
- oorspronkelijke datum in dienst, wanneer vastgelegd;
- actuele manager als link wanneer de manager binnen de scope van de kijker valt;
- acties **Medewerkerdetails** en een beperkt actiemenu op basis van writepermissions.

### 5.1 Avatarfallback

Wanneer `avatar_url` ontbreekt toont het profielhoofd een neutraal silhouet voor `MALE` of `FEMALE`. Bij `OTHER` of `PREFER_NOT_TO_SAY` worden de initialen gebruikt. De fallback is uitsluitend presentatielogica en verandert geen persoonsgegevens of autorisatie.

Acties zoals ziekmelden, verlof vastleggen, dienstverband beëindigen of dossier exporteren verschijnen pas wanneer de bijbehorende flow bestaat én de actor de exacte actiepermission bezit. Het dashboard introduceert geen generieke mutatieroute.

## 6. Widgetmodel en persoonlijke indeling

### 6.1 Persoonlijke configuratie

De eerste slice ondersteunt het rangschikken van de beschikbare widgets. De volgorde wordt via drag-and-drop aangepast en is ook volledig met het toetsenbord bedienbaar. Verbergen en opnieuw toevoegen blijven een expliciete vervolgslice, zodat een widget niet per ongeluk uit beeld verdwijnt zonder een duidelijk herstelpad.

De indeling:

- is persoonlijk per ingelogde gebruiker en tenant;
- geldt voor alle medewerkerdashboards die die gebruiker opent;
- is niet gekoppeld aan één targetmedewerker;
- bevat alleen widgettype, positie, breedte en veilige presentatiewaarden;
- bevat nooit medewerkerdata, filters met persoonsgegevens of autorisatiebesluiten.

De voorkeursopslag volgt het bestaande patroon in `user_preferences.ui_state.employeeDashboard`. Een getypeerde parser en een begrensde API accepteren uitsluitend bekende widgettypes, unieke posities en toegestane breedtes. Brede widgets kunnen uitsluitend in de brede hoofdkolom staan; smalle widgets uitsluitend in de rechterkolom. De volgorde is persoonlijk per gebruiker en geldt voor ieder medewerkerdashboard dat die gebruiker bekijkt. De bestaande dashboard-editor en cataloguspatronen mogen visueel en technisch worden hergebruikt, maar de persoonlijke startdashboards en medewerkerdashboardindeling blijven afzonderlijke contexten.

De server kruist de opgeslagen indeling bij iedere request met:

- tenantbrede moduleactivatie;
- eventueel centraal toegestane medewerkerwidgettypes;
- actuele roltoegang;
- actuele permissions;
- targetscope en RLS;
- aanvullende bron- of doelgroepregels.

### 6.2 Laadarchitectuur

Het aangeleverde voorstel voor één brede query met alle relaties wordt niet gevolgd. Dit strijdt met de bestaande tabprojecties, veldautorisatie en het feit dat meerdere modules nog geen bron hebben.

De pagina gebruikt:

- één kleine getypeerde shellprojectie;
- één getypeerde projector/loader per widget of samenhangend domein;
- parallelle onafhankelijke permission- en datalezingen;
- begrensde queries en batching;
- Server Components en afzonderlijke Suspense/loading-grenzen;
- geen React Query of SWR;
- geen client-side fetch van ruwe medewerkerdata;
- alleen actieve peildatumrecords, tenzij een widget expliciet historie toont.

De eerste detailnavigatie streeft naar p75 maximaal 1.500 ms. De dashboardroute krijgt een layoutgetrouwe skeleton en een ingelogde routeprestatiemeting volgens ADR-0004.

## 7. Widgets, brondata en autorisatie

| Widget | Brongegevens | Minimale leescontrole | Fase |
|---|---|---|---|
| Identiteit en werkcontact | `employees` | `employee:read` of exact `self:employee:read`, plus targetscope/RLS | Eerste slice |
| Privécontact en huidig adres | `employees`, `employee_addresses` | huidige medewerker-/selfscope; selfwijziging apart via `self:address:write` | Eerste slice |
| Persoonlijke kerngegevens | `employees` | `employee:read` of selfvariant; alleen geselecteerde velden | Eerste slice |
| Bankrekening | `employee_bank_accounts` | `bank-account:read` en RLS; uitsluitend gemaskeerde waarde | Eerste slice |
| Actueel dienstverband | `employments`, arbeidsvoorwaarden, rooster, plaatsing | `contract:read` of `self:contract:read`, plus bron-RLS | Eerste slice |
| Salaris | `employment_salaries` | `salary:read` of `self:salary:read`, plus RLS | Eerste slice |
| Vrije velden | definities en `employee_custom_field_values` | `custom-field-values:read` of selfvariant én veld-audience | Eerste slice |
| Verlofsaldi | verlofprojectie/buckets/ledger | `leave:read` of `self:leave:read`, plus RLS | Vervolgslice na een dashboardgeschikte readprojectie |
| Documenten | `employee_documents` en audiences | `document:read`, targetscope, documentaudience en moduleactivatie | Eerste slice, alleen laatste geautoriseerde documenten |
| Reminders | bestaande reminders en doelgroepen | `reminder:read` en toepasselijke recipient-/targetregels | Eerste slice |
| Activiteiten | gesaneerde eventprojectie en handmatige `employee_activity_entries` | `audit:read`/`employee-activity:read`, scope en RLS; nooit ongesaneerde `changes` | Eerste slice voor handmatige notities |
| Verzuim en WvP | nog niet aanwezig | nog te ontwerpen verzuimpermissions, casusscope en RLS | Niet in eerste slice |
| Budgetten | nog niet aanwezig | nog te ontwerpen bronrechten en RLS | Niet in eerste slice |
| Workflows/onboarding | nog niet aanwezig | nog te ontwerpen bronrechten en RLS | Niet in eerste slice |
| Activa, wagenpark en licenties | nog niet aanwezig | per domein eigen permissions en RLS | Niet in eerste slice |
| Opleidingen/certificaten | geen zelfstandig domeinmodel aanwezig | per domein eigen permissions en RLS | Niet in eerste slice |
| Performance reviews | nog niet aanwezig | eigen gevoelige permission- en scopeset | Niet in eerste slice |

### 7.1 Gevoelige velden

- BSN staat nooit op het dashboard. Openen blijft een expliciete, gelogde reveal onder Persoonsgegevens met `employee-bsn:read` of `self:employee-bsn:read`.
- Een bankrekening toont maximaal de al beschikbare gemaskeerde waarde. Een volledig IBAN wordt niet aan de dashboardprojectie toegevoegd.
- Salarisdata wordt alleen opgehaald nadat `salary:read` of `self:salary:read` is bevestigd én nadat de bevoegde kijker hover of toetsenbordfocus op de salariskaart activeert. Voor een bevoegde kijker blijft de waarde standaard afgeschermd; bij verlaten van de kaart verdwijnt de zichtbare waarde weer. Voor een onbevoegde kijker bestaat de waarde niet in HTML, RSC-payload of clientstate.
- Auditdata wordt vertaald naar een gesaneerde gebeurtenis. Oude/nieuwe waarden van BSN, bank, salaris, gezondheid en andere gevoelige velden worden niet generiek doorgegeven.
- Een documentkaart respecteert zowel `document:read` als de doelgroepen van ieder document. Het bezit van alleen het algemene functiepunt is onvoldoende.
- Vrije velden worden per definitie en audience beoordeeld. Voorbeeldvelden in een ontwerp zijn nooit automatisch toegestaan.

### 7.2 Parallelle dienstverbanden

Een Employee kan meerdere gelijktijdige Employments hebben. Het dashboard mag deze niet stil samenvoegen.

- De shell mag één duidelijke actuele primaire samenvatting tonen wanneer de bestaande selectie dat eenduidig kan bepalen.
- Dienstverband-, salaris- en verlofwidgets tonen de gekozen `employmentId` of splitsen de gegevens per dienstverband.
- Verlofsaldi worden altijd per `employment_id` gelezen en weergegeven; optellen over parallelle dienstverbanden is verboden.
- Bij ambiguïteit toont de widget een keuze of afzonderlijke kaarten, geen willekeurig geselecteerd dienstverband.

## 8. Layout en responsiviteit

Desktop gebruikt een asymmetrisch raster met een brede hoofdkolom en een compacte rechterkolom. Op kleinere schermen stapelen widgets in hun opgeslagen volgorde.

De standaardindeling voor een bevoegde HR-kijker is:

1. identiteit en contact;
2. actueel dienstverband en organisatie;
3. vrije velden;
4. verlof wanneer beschikbaar;
5. recente documenten en reminders;
6. salaris als afzonderlijke gevoelige kaart;
7. activiteitenfeed met handmatige notitie-invoer zodra `employee-activity:write` is toegekend.

Niet-gebouwde modules krijgen in de cockpit wel een vaste, visueel herkenbare lege vensterstaat zodat de toekomstige compositie beoordeeld kan worden. Deze vensters tonen uitsluitend uitleg en een veilige vervolgstap; ze bevatten geen voorbeeldnamen, voorbeeldcijfers, fake records of verzonnen status. Ze worden niet als datakaart of geautoriseerde bron gepresenteerd.

Alle zichtbare tekst staat in de paritaire namespaces `messages/nl` en `messages/en`. Kleur is nooit het enige statussignaal. Drag-and-drop heeft toetsenbordalternatieven, zichtbare focus en toegankelijke aankondigingen. Desktop en 390 px mogen geen horizontale pagina-overflow hebben.

## 9. Uitvoeringsplan

### Stap 1 — Contracten en securitymatrix vastleggen

1. Inventariseer per eerste-slicewidget de bestaande tabel, RLS-policy, permission en selfvariant.
2. Leg vast welke velden in de projector komen; gebruik geen `select('*')`.
3. Voeg alleen ontbrekende canonieke permissions via een migratie toe. Maak geen rolnaamchecks in componenten.
4. Schrijf vooraf positieve en negatieve autorisatiegevallen voor self, directe manager, HR-admin, maatwerkrol, andere afdeling, andere administratie en andere tenant.
5. Beslis vóór een verzuimslice afzonderlijk over casusscope, medische gegevens en WvP-rollen.

### Stap 2 — Voorkeur- en widgetcontract

1. Definieer een getypeerde `employeeDashboard`-layout in `user_preferences.ui_state`.
2. Bouw een begrensde GET/PATCH-route voor de eigen indeling.
3. Hergebruik de bestaande drag-and-drop/editorbouwstenen waar mogelijk.
4. Zorg dat opslaan alleen presentatievoorkeuren wijzigt en nooit role access, permissions of targetdata.

### Stap 3 — Serverprojecties

1. Maak een kleine `getEmployeeDashboardShell(employeeId)`-projectie met de centrale targetcheck.
2. Maak per eerste-slicewidget een getypeerde loader met eigen permissioncheck en RLS-query.
3. Gebruik `Promise.all` voor onafhankelijke checks en reads, begrens groeiende bronnen en selecteer alleen benodigde velden.
4. Maak onderscheid tussen verboden, leeg, niet-geconfigureerd en technisch mislukt.
5. Laat salaris, documenten, vrije velden en bankgegevens nooit via een algemene employeeprojectie meeliften.

### Stap 4 — Dashboard-UI

1. Maak `/employees/[employeeId]` de cockpitweergave en hernoem de huidige overzichttab naar Dashboard.
2. Voeg de vaste actie **Medewerkerdetails** en de bestaande detailtabs direct onder het profielhoofd toe.
3. Bouw het responsieve widgetraster, loading states, lege staten en widgeteditor.
4. Toon alleen geautoriseerde widgets en acties; verwijder een widget direct uit de renderprojectie wanneer actuele toegang ontbreekt.
5. Voeg links vanuit widgets naar bestaande detail- en dienstverbandtabs toe.

### Stap 5 — Ingangen naar het dashboard

1. Bevestig de bestaande links vanuit medewerkerslijst, employee-selectors, organogram en HR-kalender.
2. Maak iedere medewerkernaam in de live Insights-detailtabellen een link naar `/employees/[employeeId]`.
3. Breid Aankomende gebeurtenissen uit met `employeeId` en maak de naam een link.
4. Voeg waar nuttig een vaste, gevalideerde `from`-broncode toe en test de teruglink.
5. Controleer dat CSV-exports hun bestaande gegevenscontract houden; een UI-link verandert niet automatisch het exportformaat.

### Stap 6 — Verificatie en oplevering

1. Unit-tests voor layoutparser, widgettoegang, employmentselectie en veilige linkcontext.
2. Route-/servicetests voor iedere widget met toegestane en geweigerde permissions.
3. SQL-isolatietests voor self, manager/afdeling, andere administratie en andere tenant; voor documenten ook doelgroepnegatieven.
4. Controleer dat onbevoegde salaris-, bank-, BSN-, document- en vrije-veldwaarden niet in de response of RSC-payload staan.
5. Draai Supabase advisors en genereer `packages/db/types.ts` opnieuw wanneer schema, permissions of policies wijzigen.
6. Draai gerichte tests, ESLint, strict TypeScript, `check:i18n`, productiebuild en de LiquidHR-releasegate.
7. Voer ingelogde browsercontroles uit met minimaal een medewerker, directe manager, HR-admin en beperkte maatwerkrol, op desktop en 390 px.
8. Meet de eerste dashboardnavigatie en warme tabwissel volgens ADR-0004 en leg de resultaten vast in `CURRENT_CONTEXT.md`.
9. Controleer de publieke preview met dezelfde relevante rollen vóór merge/release.

### Uitgevoerd in de eerste slice (2026-07-24)

- Dashboardroute, kleurrijke profielkop, vaste **Medewerkerdetails**-actie en bestaande detailtabs zijn gerealiseerd.
- Bestaande geautoriseerde medewerker-, dienstverband-, vrije-veld- en documentprojecties worden gebruikt; niet-bestaande domeinen tonen lege vensters zonder fake data.
- Medewerkerlijst, organogram, kalender en Insights openen het dashboard; Insights-rapportnamen en aankomende gebeurtenissen bevatten nu `employeeId`-links.
- Avatarfallbacks, reminders, lazy salarisreveal, persoonlijke vaste-kolom-widgetvolgorde en handmatige activiteitnotities zijn toegevoegd. De handmatige notitie gebruikt `employee_activity_entries` en de nieuwe permissions `employee-activity:read/write`.
- Open voor vervolgslice: verlofprojectie, volledige gesaneerde auditweergave, remote migration/advisors/typesnapshot, positieve/negatieve SQL-isolatietests en ingelogde rol-/390px-browsercontrole.

## 10. Acceptatiecriteria

- Een klik op een medewerker in lijst, Insights, organogram of kalender opent het medewerkerdashboard.
- De pagina maakt direct duidelijk hoe **Medewerkerdetails** en de bestaande detailtabs worden geopend.
- Self, manager, HR-admin en maatwerkrollen krijgen aantoonbaar verschillende, correcte widgetsets op basis van permissions én scope.
- Geen enkele widget of opgeslagen indeling kan RLS of een ontbrekende permission omzeilen.
- BSN staat niet op het dashboard; onbevoegde salaris-, bank-, document- en vrije-veldwaarden bereiken de browser niet.
- Verlof en andere dienstverbandgebonden cijfers blijven per `employment_id`.
- Niet-gebouwde domeinen tonen een aantrekkelijke lege modulekaart zonder fictieve data; lege staten zijn duidelijk onderscheiden van echte, lege brondata.
- De persoonlijke widgetindeling geldt voor alle bekeken medewerkers van die gebruiker en niet voor andere gebruikers.
- De pagina en links zijn toetsenbordbedienbaar, i18n-compleet en bruikbaar zonder horizontale overflow op 390 px.
- Autorisatie-, RLS-, type-, lint-, i18n-, build-, performance- en browsercontroles zijn aantoonbaar geslaagd.

## 11. Buiten de eerste slice

- verzuim/WvP en medische casusscope;
- budgetten;
- onboarding- en andere workflows;
- activa, wagenpark en softwarelicenties;
- opleidingen en certificaten als zelfstandig domein;
- performance reviews;
- algemene profielnotities of opmerkingen;
- PDF-dossierexport;
- nieuwe onderhoudstabs zonder gerealiseerde domeinbron.

Deze onderdelen krijgen eerst een eigen datamodel, permissions, RLS, API-contract en requirement. Een algemene profielopmerking wordt niet opgeslagen als `SicknessNote`; gezondheidsnotities en algemene HR-notities blijven strikt gescheiden.
