# Dashboardervaring en HR-instellingen — ontwerp

## Status

Goedgekeurd ontwerp op 2026-07-18. Dit document vult de bestaande dashboard-widgetbibliotheek aan met een snelle gestreamde laadervaring, een begrijpelijke widgetkiezer en twee gerichte verbeteringen aan de HR-instellingenhub.

## Doel

Het dashboard toont direct zijn structuur en vult widgets daarna onafhankelijk en parallel met geautoriseerde serverdata. De gebruiker ziet de totale voortgang, kan alle widgetdata bewust vernieuwen en blijft bij een trage of mislukte widget met de rest van het dashboard werken.

De HR-admin kan daarnaast de tenantbrede beschikbaarheid en roltoegang van widgets vanuit de instellingenhub beheren. De kaart **Medewerkers** in die hub verwijst niet langer naar de medewerkerslijst, maar opent voorlopig een toegankelijke pop-up die uitlegt dat medewerkerinstellingen later worden ingericht.

## Vastgestelde functionele keuzes

- De gewone link **Medewerkers** in de hoofdnavigatie blijft naar `/employees` gaan.
- Alleen de kaart **Medewerkers** in `/settings` wordt een pop-uptrigger.
- De tijdelijke medewerkerpop-up bevat een titel, korte toelichting, status **Komt later** en een sluitknop. Zij bevat nog geen instellingen of opslag.
- De bestaande route `/settings/dashboard-widgets` is de beheerplek voor actief/inactief en roltoegang per widget.
- De dashboardeditor toont nooit ruwe codes zoals `EXPIRING_CONTRACTS` of `MY_SALARY_HISTORY`.
- **Widget toevoegen** opent een modal met zoeken, categorieën, Nederlandse/Engelse titel, omschrijving en visualisatietype.
- Het dashboard toont onmiddellijk contouren op de definitieve posities en breedtes van de opgeslagen widgets.
- Widgetinhoud laadt onafhankelijk en parallel. Een langzame widget blokkeert geen andere widget.
- Een algemene voortgangsindicator toont het aantal afgeronde widgets ten opzichte van het totaal.
- De knop **Vernieuwen** herlaadt alle widgetdata, maar wijzigt geen dashboardnaam, widgetvolgorde, breedte of tenantinstelling.

## Benaderingen en besluit

### Gekozen: servergestreamde widgets met afzonderlijke Suspense-grenzen

De Server Component haalt eerst in één beveiligde bootstrapstap de gebruikercontext, dashboardmetadata, widgetindeling en zichtbare catalogus op. Daarna starten de benodigde widgetloaders parallel. Iedere widget krijgt een eigen `Suspense`-grens met een skeleton die dezelfde breedte en minimale hoogte heeft als de uiteindelijke kaart.

Dit geeft direct een stabiele pagina, progressieve inhoud en één gedeelde servercontext. Het voorkomt de huidige lege clientstart en de herhaalde context-/dashboardqueries via een API-call na hydratatie.

### Niet gekozen: huidige clientfetch behouden en alleen skeletons toevoegen

Dit verbetert alleen de indruk. De browser moet nog steeds eerst hydrateren voordat de eerste dashboardrequest start en de bestaande dubbele contextqueries blijven bestaan.

### Niet gekozen: één nieuwe database-RPC voor de volledige pagina

Een brede RPC kan de totale requesttijd verminderen, maar levert geen progressieve widgetinhoud en vergroot de security- en onderhoudsoppervlakte. De bestaande typed loaders en RLS blijven daarom leidend.

## Dashboardarchitectuur

### Bootstrap

De dashboardpagina leest URL-state voor het geselecteerde dashboard en de bewerkmodus. Eén serverfunctie levert een `DashboardShellView` met:

- toegankelijke dashboards voor de switcher;
- geselecteerd dashboard;
- gevalideerde en geautoriseerde widgetdescriptors;
- vertaalde catalogusmetadata voor widgets die de gebruiker mag toevoegen;
- één afgeleide actor-, tenant- en administratiecontext voor de loaders.

De functie maakt geen tweede aanroep naar `listPersonalDashboards()` via `getDashboardView()`. Context en Supabase-client worden binnen deze readflow doorgegeven in plaats van per helper opnieuw opgebouwd.

### Widgetdata

Iedere widgetloader krijgt uitsluitend de server-afgeleide context en een typed catalogusentry. Alle loaderpromises worden direct na de bootstrap gestart en parallel aan afzonderlijke async Server Components doorgegeven.

Een widgetresultaat is een discriminated union met minimaal:

- `ready`: geautoriseerde inhoud;
- `empty`: geldige bron zonder resultaten;
- `error`: lokale, veilige foutstatus zonder technische details of PII.

Een loaderfout wordt binnen de betreffende widget afgehandeld en maakt de pagina niet onbruikbaar. Salaris-, document- en medewerkersdata blijven achter hun bestaande permissions en RLS. De browser ontvangt geen loadercontext, role-ID's of ongefilterde rijen.

### Laadstatus en voltooiing

Een kleine clientprovider beheert uitsluitend presentatievoortgang. Iedere opgeloste widget meldt één van de statussen `ready`, `empty` of `error`. De provider bewaart geen HR-data.

De algemene indicator toont tijdens het laden bijvoorbeeld **7 van 10 widgets geladen**. `ready`, `empty` en `error` tellen alle drie als afgerond, zodat één fout de voltooiing niet oneindig blokkeert. Na afronding toont de indicator een korte, rustige status **Dashboard bijgewerkt**.

Bij de eerste render staat op iedere widgetpositie meteen een skeletoncontour. De contour gebruikt dezelfde gridspan en een stabiele minimale hoogte om layoutverschuiving te voorkomen.

### Vernieuwen

De knop **Vernieuwen** start een nieuwe read-generatie voor alle zichtbare widgets. De voortgang wordt teruggezet, de widgetcontouren worden opnieuw actief en de loaders halen actuele data op met `no-store`-semantiek. De mutatie-API voor de dashboardindeling wordt niet aangeroepen.

Tijdens vernieuwen is de knop disabled en toont hij een laadicoon. Na afloop blijft een eventuele widgetfout lokaal zichtbaar met een knop **Opnieuw proberen** voor alleen die widget. Een tweede algemene vernieuwactie blijft altijd mogelijk.

## Dashboardeditor en widgetkiezer

De bestaande inline lijst met technische knoppen wordt vervangen door een knop **Widget toevoegen** die een toegankelijke dialog opent.

De dialog bevat:

- zoekveld op titel en omschrijving;
- categorie-tabs voor Core HR, Dienstverband, Documenten, Beloning en Organisatie & tijd;
- per widget een kaart met icoon, vertaalde titel, korte omschrijving, visualisatiebadge en standaardbreedte;
- een duidelijke toevoegknop;
- status **Al toegevoegd** voor widgets die al in het conceptdashboard staan;
- een lege staat wanneer de zoekopdracht binnen een categorie niets vindt.

De gebruiker kan meerdere widgets toevoegen voordat de dialog wordt gesloten. De bestaande expliciete **Opslaan**- en **Annuleren**-semantiek blijft gelden; toevoegen in de dialog muteert alleen het lokale concept.

De huidige dashboardlijst in bewerkmodus toont eveneens vertaalde titels. Ruwe widgetcodes blijven uitsluitend interne identifiers.

## HR-admin widgetinstellingen

De instellingenhub toont de kaart **Dashboardwidgets** alleen met `settings:read` en `dashboard-widget:write`. De bestaande configuratietabellen blijven de bron van waarheid:

- `dashboard_widget_configs` voor actief/inactief;
- `dashboard_widget_role_access` voor toegestane rollen.

De beheerpagina groepeert widgets volgens dezelfde vijf categorieën als de widgetkiezer. Iedere kaart toont de vertaalde titel en omschrijving, status, visualisatietype en rolkeuzes. Opslaan blijft server-side gevalideerd; tenant, actor en toegestane rollen worden niet uit clientinput vertrouwd.

Een inactieve widget of widget zonder geldige roltoegang verdwijnt uit de widgetkiezer én uit dashboardresponses. Bestaande opgeslagen configuratie blijft in de database staan, maar wordt niet gerenderd of opnieuw opgeslagen zolang de gebruiker geen toegang heeft.

## Medewerkerinstellingen-pop-up

De kaart **Medewerkers** in `/settings` wordt een button met dezelfde visuele kaartstijl als de overige instellingenitems. Zij opent een native/toegankelijke dialog met:

- **Medewerkerinstellingen**;
- uitleg dat instellingen voor personeelskaarten en medewerkerbeheer later op deze plek komen;
- badge **Komt later**;
- knop **Sluiten** en ondersteuning voor Escape/backdrop-sluiten.

Er komt geen lege route, API of databaseconfiguratie voor deze tijdelijke functie.

## Foutafhandeling en toegankelijkheid

- De pagina toont nooit een leeg hoofdvlak: bootstrap heeft een route-level fallback en widgets hebben eigen skeletons.
- Widgetfouten tonen een vertaalde, neutrale melding en lekken geen query- of databasefout.
- De algemene voortgang gebruikt `role="status"` en kondigt wijzigingen niet agressief aan.
- Dialogs hebben focusbeheer, Escape-sluiten, een zichtbare titel en bruikbare toetsenbordvolgorde.
- Zoek- en categoriefilters hebben labels; visualisatiebadges zijn aanvullende informatie en nooit de enige betekenisdrager.
- Alle zichtbare teksten staan in paritaire NL/EN-namespaces.

## Teststrategie

### Unit- en componenttests

- bootstrap gebruikt één context/readflow en selecteert het juiste dashboard;
- widgetpromises starten parallel en een loaderfout blijft widgetlokaal;
- voortgang telt `ready`, `empty` en `error` exact één keer;
- vernieuwen reset alleen de read-generatie en muteert geen layout;
- widgetkiezer groepeert en zoekt op vertaalde metadata en toont geen ruwe codes;
- toegevoegd/verwijderd blijft conceptstate tot expliciet opslaan;
- medewerkerkaart opent de tijdelijke dialog en navigeert niet naar `/employees`;
- beheerpagina bewaart actief/inactief en rolkeuzes via de bestaande beveiligde API.

### Volledige verificatie

- Vitest, strict TypeScript, ESLint, i18n-pariteit en productiebuild;
- Supabase SQL-/RLS-regressietests voor widgetconfiguratie en roltoegang;
- browsercontrole op `localhost:3000` bij desktop en 390px;
- meting van eerste zichtbare dashboardstructuur, progressieve widgetafronding en refreshflow;
- controle dat één geforceerde widgetfout de overige widgets en de algemene voltooiing niet blokkeert;
- publieke preview met een geldige hostspecifieke sessie waar beschikbaar.

## Buiten scope

- echte medewerkerinstellingen achter de tijdelijke pop-up;
- nieuwe HR-databronnen of fictieve widgetdata;
- drag-and-drop;
- automatische periodieke refresh of polling;
- wijzigingen aan de betekenis van bestaande rollen, permissions of tenantgrenzen;
- vrije natuurlijke-taalwidgets uit de latere Liquid Display-engine.
