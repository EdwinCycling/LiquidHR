# Instellingen, modules, roosters, feestdagen en kalender

Status: goedgekeurd ontwerp op 2026-07-18.

## 1. Doel en samenhang

Deze uitbreiding brengt vier nauw verbonden onderdelen onder één HR-adminervaring:

1. één instellingenhub die losse beheerpagina's uit het hoofdmenu groepeert;
2. tenantbrede activering van uitsluitend optionele modules;
3. een afzonderlijke, effective-dated roosterplanning van één tot vier repeterende weken naast de urenafspraak van het dienstverband;
4. één brede medewerkerskalender die roosterstatus, feestdagen, reminders en HR-wijzigingen projecteert en later verlof, verzuim en urenregistratie kan opnemen.

De bouwvolgorde blijft `schema → service/API → UI`. Tenant- en administratiegrenzen worden server-side en met RLS afgedwongen. De kalender projecteert brongegevens en wordt geen tweede administratieve waarheid.

## 2. Afbakening in verticale slices

De implementatie bestaat uit drie afzonderlijk testbare slices:

1. instellingenhub en tenantbrede optionele modules;
2. urenafspraak, roosterpatronen en feestdagenbeheer;
3. geïntegreerde medewerkerskalender en toekomstige dagcontext.

Iedere slice werkt documentatie, i18n en verificatiebewijs bij voordat de volgende slice wordt afgerond.

## 3. Instellingenhub

### 3.1 Navigatie

Het hoofdmenu bevat één HR-adminitem **Instellingen** dat `/settings` opent. Losse beheerlinks zoals Rollen en rechten, Vrije velden en Stamtabellen verdwijnen uit het hoofdmenu, maar hun bestaande routes blijven bestaan. De instellingenhub linkt naar volledige pagina's; hij bevat geen verkleinde formulieren of modals.

Persoonlijke voorkeuren voor taal, thema en klok blijven onder het persoonlijke profiel. Persoonlijke instellingen en HR-beheer worden niet samengevoegd.

### 3.2 Indeling

De hub toont alleen onderdelen waarvoor de actor lees- of schrijfrechten heeft en groepeert ze als volgt:

- **Organisatie en toegang:** administraties, afdelingen, rollen en rechten;
- **HR-inrichting:** stamtabellen, vrije velden, uren en roosters, kalender en feestdagen;
- **Platform en uitbreidingen:** actieve modules, HeRa en toekomstige integraties.

Een tegel bevat een herkenbaar pictogram, titel, korte omschrijving en optioneel een status. De volledige tegel is toetsenbord- en muisklikbaar.

## 4. Tenantbrede optionele modules

### 4.1 Functionele grens

Moduleactivatie geldt voor de hele tenant en uitsluitend voor extra modules. Core HR, medewerkers, dienstverbanden, autorisatie, instellingen en het basisrooster zijn verplicht actief en komen niet als schakelaar op de modulepagina.

De eerste registry onderscheidt:

- bestaande optionele modules die activeerbaar zijn: `HERA`, `DOCUMENTS` en `REMINDERS`;
- toekomstige modules die zichtbaar zijn als **Binnenkort** en nog niet activeerbaar zijn: Verlof, Verzuim, Activa, Workflows en Opleidingen.

De registry is codegestuurd voor naam, beschrijving, pictogram, status en route. De database bewaart alleen tenantafwijkingen voor werkelijk activeerbare modulecodes.

### 4.2 Gedrag

Een uitgeschakelde module:

- verdwijnt uit navigatie en instellingenlinks;
- wordt bij directe pagina- en API-toegang server-side geweigerd;
- behoudt alle bestaande gegevens;
- kan later zonder datamigratie opnieuw worden ingeschakeld.

Moduletoegang is aanvullend op permissions. Een actieve module verleent geen rechten en een permission omzeilt geen uitgeschakelde module.

### 4.3 Data en autorisatie

`tenant_modules` bevat minimaal `tenant_id`, `module_code`, `is_enabled`, `enabled_at`, `enabled_by`, `disabled_at`, `disabled_by`, `created_at` en `updated_at`. De tabel krijgt een samengestelde primary key op tenant en modulecode, RLS en tenantgebonden foreign keys.

De datamigratie schakelt `HERA`, `DOCUMENTS` en `REMINDERS` voor alle bestaande tenants in. Daardoor verdwijnt na uitrol geen bestaande functionaliteit. Nieuwe tenants krijgen dezelfde drie expliciete standaardregels bij tenantinrichting.

Canonieke permissions:

- `modules:read`;
- `modules:write`.

Iedere wijziging wordt via één serverroute of serveraction uitgevoerd en geaudit.

## 5. Urenafspraak en rooster als eigen tijdlijnen

### 5.1 Domeingrens

De bestaande `employment_schedules` blijft de effective-dated **urenafspraak**: gemiddelde uren en dagen per week, deeltijdfactor en tijd-voor-tijdopbouw. De fysieke tabelnaam wordt in deze slice niet hernoemd om migratierisico en brekende koppelingen te voorkomen.

De daadwerkelijke dagindeling wordt een afzonderlijke **roostertijdlijn**. Een rooster heeft een eigen begin- en einddatum en een cyclus van één, twee, drie of vier weken. Urenafspraak en rooster zijn functioneel gekoppeld, maar historisch onafhankelijk.

### 5.2 Datamodel

`employment_work_patterns` bevat minimaal:

- tenant-, administratie-, medewerker- en dienstverband-ID;
- `name`;
- `cycle_weeks` met databaseconstraint `1..4`;
- `anchor_date` als eerste maandag van cyclusweek 1;
- `valid_from` en optioneel `valid_until` als halfopen periode;
- berekende en opgeslagen `average_minutes_per_week` voor betrouwbare vergelijking;
- auditvelden en optioneel `change_set_id`.

`employment_work_pattern_days` bevat per patroon:

- `week_index` met constraint `1..4` en maximaal `cycle_weeks`;
- ISO-weekdag `1..7`;
- `is_working_day`;
- optionele `starts_at` en `ends_at`;
- `break_minutes`;
- `scheduled_minutes`;
- optionele korte `note`;
- unieke sleutel op patroon, cyclusweek en weekdag.

Een werkdag vereist positieve netto minuten. Een niet-werkdag heeft nul minuten en geen tijden. Nachtdiensten vallen buiten deze slice; `ends_at` moet later zijn dan `starts_at` op dezelfde kalenderdag.

### 5.3 Tijd- en ureninvariant

Voor iedere gepubliceerde roosterperiode moet `average_minutes_per_week` exact gelijk zijn aan de geldige urenafspraak, omgerekend naar minuten. Schrijven gebeurt via één transactionele databasefunctie die:

1. tenant-, administratie-, medewerker- en dienstverbandrelaties controleert;
2. relevante tijdlijnrecords vergrendelt;
3. overlap in de roostertijdlijn verhindert;
4. alle dagregels en totalen opnieuw berekent;
5. de urenafspraak over de volledige overlap controleert;
6. rooster en optionele urenwijziging atomair publiceert;
7. audit- en HR-wijzigingsrecords schrijft.

Een losse wijziging mag alleen wanneer de invariant daarna geldig blijft. Anders retourneert de server een typed mismatchfout en biedt de UI een gecombineerde wijziging aan.

### 5.4 Migratie van bestaande gegevens

Bestaande maandag- tot en met zondaguren worden per actieve `employment_schedules`-regel omgezet naar een éénweeks patroon. Wanneer alleen daguren bekend zijn, blijven begin- en eindtijd leeg en worden de geplande minuten uit de uren afgeleid. De migratie is idempotent en bewaart de oorspronkelijke urenafspraak ongewijzigd.

### 5.5 UI

De dienstverbanddetailroute krijgt één tab **Uren & rooster** met:

- links de urenafspraaktijdlijn;
- rechts de roostertijdlijn;
- maximaal vier visuele weekkaarten;
- gemiddelde roosteruren versus afgesproken uren;
- een expliciete afwijkingsstatus;
- acties om een week of dag te kopiëren;
- een gecombineerde publicatieflow voor samenhangende wijzigingen.

De editor rekent intern in gehele minuten. Weergave naar uren is locale-aware en veroorzaakt geen floating-pointafronding.

Canonieke permissions:

- `work-schedule:read`;
- `work-schedule:write`.

## 6. Feestdagenbeheer

### 6.1 Scope en bron

Feestdagen zijn administratiegebonden. De pagina `/settings/holidays` importeert per kalenderjaar en ISO 3166-1 alpha-2-landcode een momentopname via Nager.Date. De gekozen bron documenteert ruim 150 landen, feestdagtypen en een publieke API zonder rate limit: <https://date.nager.at/api>.

De externe API wordt uitsluitend server-side aangeroepen met timeout, responsegroottebegrenzing en Zod-validatie. De kalender leest altijd de lokaal opgeslagen momentopname en is niet afhankelijk van live beschikbaarheid van de leverancier.

### 6.2 Datamodel

`holiday_calendars` bevat tenant, administratie, jaar, landcode, provider, importstatus, geïmporteerd door/op en timestamps. De unieke sleutel is administratie, jaar en landcode.

`holidays` bevat minimaal:

- tenant-, administratie- en kalender-ID;
- datum en de door de provider geleverde naam;
- optionele lokale of door de klant aangepaste weergavenaam;
- `source` als `API` of `MANUAL`;
- stabiele externe sleutel voor API-items;
- feestdagtypen en optionele subdivisiecodes;
- `is_active`;
- timestamps en actorvelden.

Handmatige feestdagen hebben geen externe sleutel en worden nooit door import overschreven.

### 6.3 Importflow

De beheerder kiest jaar en land, vraagt een preview op en bevestigt daarna de import. De server toont toevoegingen, wijzigingen en reeds aanwezige regels. Bevestiging voert één transactionele upsert uit. Een mislukte fetch of validatie verandert geen opgeslagen data.

Herimport:

- werkt API-items idempotent bij;
- verwijdert handmatige items niet;
- activeert door de klant uitgesloten API-items niet stil opnieuw;
- bewaart provider, importmoment en auditspoor.

De klant kan lokale feestdagen toevoegen, wijzigen en verwijderen en geïmporteerde feestdagen activeren of uitsluiten. Feestdagen wijzigen het dienstverband of rooster nooit automatisch.

Canonieke permissions:

- `holidays:read`;
- `holidays:write`.

## 7. Geïntegreerde medewerkerskalender

### 7.1 Route en bronnen

De bestaande `/hr-calendar` blijft als compatibele route bestaan en presenteert in de navigatie **Kalender**. De server projecteert begrensd en getypeerd:

- rooster en niet-werkdagen;
- medewerkergebonden reminders;
- dienstverband- en HR-wijzigingen;
- documentvervaldata en opvolgacties;
- feestdagen;
- later verlof, verzuim en andere geactiveerde modules.

Er komt geen generieke schrijftabel die deze bronnen dupliceert. Een `CalendarProjection` normaliseert resultaten naar dag-, medewerker- en gebeurtenisrecords met bronroute en capabilities.

### 7.2 Selectie en URL-state

URL-state ondersteunt minimaal:

- `month`;
- zoekterm op naam of personeelsnummer;
- afdeling en optionele medewerker;
- bron- en typefilters;
- pagina;
- paginagrootte `10`, `25` of `all`.

`all` toont maximaal 100 medewerkers. Bij meer dan 100 meldt de pagina dat zoeken of filteren nodig is. Selectie, telling en paginering gebeuren server-side voordat kalenderdetails worden geladen.

### 7.3 Desktopinterface

De kalender is ontworpen voor laptop, desktop en grote tablet. Een afzonderlijke telefoonweergave valt buiten scope. Op smallere breedtes blijft het raster bruikbaar door horizontaal scrollen, een vaste medewerkerkolom en een vaste dagkop.

De maandweergave bevat:

- vorige maand, volgende maand en Vandaag;
- zoek- en bronfilters;
- legenda;
- vaste medewerkerkolom met avatar, klikbare naam, personeelsnummer en gemiddelde uren per week;
- één kolom per kalenderdag;
- visuele markering van vandaag, weekenden en feestdagen.

Een niet-werkdag krijgt een rustige grijze balk. Een werkdag blijft in de basis leeg. Hover, focus of klik toont begin- en eindtijd, pauze, netto uren en cyclusweek. Wanneer bestaande gemigreerde data geen tijden bevat, toont de popover alleen het aantal uren.

HR-wijzigingen, reminders en acties gebruiken kleine brongebonden markeringen in dezelfde cel. Alleen reminders die aan de medewerker, diens document of diens dienstverband zijn gekoppeld verschijnen in de medewerkersrij. Algemene HR-reminders staan één keer in een compacte maandagenda boven het raster.

Feestdagen krijgen een subtiele kolommarkering en naam in dagkop en popover. Een feestdag kan tegelijk met geplande werkuren bestaan.

### 7.4 Dagcontext en toekomstige urenregistratie

De kalender reserveert twee stabiele interacties:

- dagkopselectie met `date` opent een dagpaneel voor algemene feestdagen, acties, reminders en gebeurtenissen;
- medewerker-dagselectie met `employeeId`, `date` en `scheduledMinutes` opent dezelfde context voor één medewerker.

Deze context kan later linken naar `/employees/{employeeId}/time-registration?date=YYYY-MM-DD`. Een toekomstige medewerkerdetailpagina beheert gewerkte uren, correcties en dagtotalen. Deze slice legt alleen getypeerde context en navigatiecontracten vast en maakt geen fictieve urenregistratierecords of mutatieknoppen.

Voor toekomstige overlays geldt de renderprioriteit: verlof/verzuim boven roosterstatus; gebeurtenissen blijven afzonderlijke markeringen. Niet-geactiveerde of niet-gebouwde bronnen leveren geen lege of fictieve dataset.

## 8. Services, API's en foutcodes

Services blijven klein en brongebonden:

- module registry en tenantmodule-resolver;
- urenafspraak- en roosterprojector;
- feestdagenprovider, preview en importservice;
- kalenderaggregator die alleen getypeerde projecties combineert.

Routes en serveractions beginnen met module-, permission- en contextcontrole, valideren input met gedeelde Zod-schema's en retourneren `{ data }` of `{ error: code }`.

Minimaal benodigde typed foutcodes:

- `MODULE_DISABLED`;
- `WORK_PATTERN_PERIOD_OVERLAP`;
- `WORK_PATTERN_HOURS_MISMATCH`;
- `WORK_PATTERN_DAY_INVALID`;
- `HOLIDAY_PROVIDER_UNAVAILABLE`;
- `HOLIDAY_PROVIDER_RESPONSE_INVALID`;
- `HOLIDAY_IMPORT_STALE`;
- `HOLIDAY_PERIOD_INVALID`;
- `CALENDAR_SELECTION_TOO_LARGE`.

Een kalenderbron die faalt mag niet stil als een geldige lege bron worden getoond. De pagina toont een brongebonden foutstatus terwijl de overige veilige bronnen beschikbaar kunnen blijven.

## 9. Autorisatie, RLS en audit

- Iedere nieuwe publieke tabel krijgt RLS en policies in dezelfde migratie.
- Tenantmoduleflags zijn alleen tenantgebonden; roosters en feestdagen controleren tevens de actieve administratie.
- Een centrale security-definerhelper `tenant_module_enabled(tenant_id, module_code)` controleert `auth.uid()` en wordt opgenomen in de RLS-policies van de bestaande HeRa-, document- en remindermoduletabellen. Directe Supabase-datatoegang kan een uitgeschakelde module daardoor niet omzeilen.
- UI-verberging is uitsluitend UX. Directe route-, service- en databasetoegang blijven geblokkeerd.
- Moduleactivering, roosterpublicatie, urenafspraakwijziging, feestdagimport en handmatig feestdagenbeheer worden centraal geaudit.
- Kalenderprojectie retourneert uitsluitend medewerkers en bronnen waarvoor de actor permission én scope heeft.
- Salaris- of andere gevoelige velden worden niet indirect via kalenderpayloads ontsloten.

## 10. Test- en verificatiestrategie

Kritieke rooster-, module- en autorisatielogica wordt test-first ontwikkeld.

Minimale dekking:

- pure tests voor cyclusweekbepaling over maand- en jaargrenzen voor cycli van één tot vier weken;
- minutentotalen, pauzes, gemiddelde weekuren en mismatchdetectie;
- migratieproeven voor bestaande éénweekse daguren;
- overlap-, gecombineerde wijziging- en rollbacktests;
- module-resolutie voor actief, uitgeschakeld, core en binnenkort;
- negatieve tenant-, administratie-, module- en permissiontests;
- feestdagpreview, import, herimport, uitsluiten en handmatige regels;
- kalenderprojectie zonder dubbele reminders of gebeurtenissen;
- selectie en paginering voor 10, 25 en maximaal 100 medewerkers;
- URL-state en directe medewerker-/dagcontext;
- toetsenbordtoegang voor tegels, popovers en dagcellen;
- paritaire Nederlandse en Engelse i18n-sleutels;
- Supabase security- en performance-advisors en opnieuw gegenereerde `packages/db/types.ts`;
- volledige Vitest-, i18n-, strict-TypeScript-, ESLint- en productiebuildgate;
- browsercontrole op poort 3000 en een actuele publieke preview op laptop- en desktopbreedte.

## 11. Buiten scope

- werkelijke invoer of goedkeuring van gewerkte uren;
- verlof- en verzuimmeldingen of saldiberekening;
- nachtdiensten die over twee kalenderdagen lopen;
- drag-and-drop roosterplanning;
- automatische roosterwijziging op een feestdag;
- een afzonderlijke mobiele kalenderweergave;
- activering van modules die als Binnenkort zijn gemarkeerd;
- schoolvakanties en automatische periodieke feestdagensynchronisatie.

## 12. Acceptatiecriteria

1. HR-admins vinden alle inrichting via één Instellingen-item en volledige detailpagina's.
2. Alleen optionele tenantmodules zijn schakelbaar; core blijft verplicht en moduleblokkering werkt in UI, server en databasepad.
3. Een dienstverband ondersteunt een afzonderlijk rooster van één tot vier repeterende weken met eigen geldigheidsperiode.
4. Gepubliceerde gemiddelde roosteruren sluiten exact aan op de geldige urenafspraak.
5. Feestdagen kunnen per administratie, land en jaar veilig worden geïmporteerd en lokaal worden aangevuld.
6. De kalender toont maximaal 100 geselecteerde medewerkers, roosterstatus, feestdagen, gekoppelde reminders en toegestane HR-wijzigingen zonder brondata te dupliceren.
7. Medewerkernaam, dagkop en medewerker-dagcel leveren de afgesproken navigatie- en contextinteracties.
8. Toekomstige verlof-, verzuim- en urenregistratiebronnen kunnen worden toegevoegd zonder het rooster- of kalendercontract te vervangen.
9. Alle nieuwe tabellen, routes en mutaties voldoen aan RLS, permissions, audit, i18n en de volledige releasegate.
