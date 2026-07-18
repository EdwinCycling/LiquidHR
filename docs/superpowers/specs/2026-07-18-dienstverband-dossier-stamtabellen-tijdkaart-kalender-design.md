# Dienstverband, dossier, stamtabellen, tijdkaart en HR-kalender — ontwerp

Datum: 18 juli 2026
Status: goedgekeurd in gesprek

## 1. Doel en samenhang

Liquid HR maakt de dienstverbandflow af en bouwt daarop vier samenhangende functies:

1. administratiegebonden functies, functiegroepen en versieerbare salaristabellen;
2. een beveiligd documentendossier per medewerker;
3. een medewerker- en dienstverbandkaart die alle gegevens door de tijd begrijpelijk toont;
4. een grote maandkalender met HR-wijzigingen per medewerker.

De bestaande domeintabellen blijven de bron van waarheid. Een afgeleid, beveiligd wijzigingenleesmodel projecteert relevante ingangs-, eind- en vervaldata naar de tijdkaart en kalender. Er komt geen tweede historieadministratie en geen generieke event-sourcinglaag.

De uitvoering bestaat uit vijf afzonderlijk testbare verticale slices in deze volgorde:

1. dienstverbandflow;
2. functies en salaristabellen;
3. documentendossier en reminderdoelgroepen;
4. medewerker- en dienstverbandtijdkaart;
5. HR-maandkalender.

## 2. Bestaande architectuur die leidend blijft

- `Employee` is een blijvende tenantbrede persoonsidentiteit.
- `Employment` is een administratiegebonden arbeidsrechtelijke relatie; parallelle dienstverbanden blijven toegestaan.
- `IncomeRelationship` is een afzonderlijke fiscale IKV en wordt tijdsgebonden aan een dienstverband gekoppeld.
- Arbeidsvoorwaarden, rooster, salaris en kostenverdeling blijven onafhankelijke tijdlijnen.
- Tenantgrenzen zijn absoluut. Administratiecontext wordt bij iedere aanvraag opnieuw gevalideerd.
- Autorisatie bestaat altijd uit een permission én geldige scope. RLS is de uiteindelijke databasegrens.
- Iedere mutatie gebruikt één toegestane schrijfweg en wordt geaudit.
- Zichtbare tekst komt uit de NL- en EN-taalbestanden.
- De implementatievolgorde is per slice `schema → API-route → UI`.

## 3. Afgewogen architectuuropties

### 3.1 Losse modules zonder gezamenlijk tijdmodel

Dit is lokaal eenvoudig, maar zou tijdlijnlogica dupliceren tussen het dienstverbanddetail, de medewerkerkaart en de kalender. De gebruiker krijgt dan verschillende interpretaties van dezelfde historie. Deze aanpak is afgewezen.

### 3.2 Bestaande domeintabellen met één beveiligde wijzigingenprojectie

Dit is de gekozen aanpak. Iedere bron blijft eigenaar van haar eigen gegevens. Een getypeerde projectieservice vertaalt geldigheidsdata naar uniforme, permission-gefilterde `HrChangeEvent`-records. De tijdkaart en kalender consumeren hetzelfde contract.

### 3.3 Volledig event-sourced HR-model

Dit zou alle bestaande mutatiepaden vervangen en is disproportioneel, moeilijk omkeerbaar en onnodig voor de gevraagde functionaliteit. Deze aanpak is afgewezen.

## 4. Slice 1 — dienstverbandflow volledig maken

### 4.1 Gebruikersflow

De begeleide flow bestaat uit tien stappen:

1. persoon zoeken via de bestaande identity matching;
2. een bestaande medewerker kiezen of een nieuwe persoonskaart aanmaken;
3. basisgegevens van het dienstverband vastleggen;
4. een IKV aanmaken of een geldige bestaande IKV koppelen;
5. functie en organisatieplaatsing kiezen;
6. arbeidsvoorwaardengroep kiezen;
7. rooster en FTE vastleggen;
8. salaris, schaal en trede vastleggen wanneer de actor salarisrechten heeft;
9. kostenverdeling van exact 100% vastleggen;
10. ketenadvies, impactkeuzes en een volledige controle bevestigen.

Een concept mag server-side worden opgeslagen zodat de flow hervatbaar is. Een concept maakt nog geen actieve HR-records aan en is alleen zichtbaar voor de maker en bevoegde HR-gebruikers binnen dezelfde administratie.

Publicatie gebruikt één beveiligde databasefunctie. Alle gekozen onderdelen slagen of geen enkel onderdeel wordt gepubliceerd. De functie vergrendelt de relevante medewerker en het dienstverband, valideert tenant, administratie, permissions, datums, IKV-koppeling, tijdlijnoverlap en kostenverdeling opnieuw en schrijft auditrecords in dezelfde transactie.

### 4.2 Nieuwe persoon vanuit de flow

Een exacte tenantgebonden BSN-match blijft blokkerend. Bij gewogen kandidaten kiest de invoerder expliciet een bestaande persoon of motiveert het aanmaken van een nieuwe persoon. Het bestaande `identity_match_decisions`-model en de beveiligde BSN-opslag worden hergebruikt. Persoonsaanmaak en dienstverbandpublicatie zijn afzonderlijke geaudite stappen: een geldige persoonskaart mag blijven bestaan wanneer de gebruiker de dienstverbandflow daarna afbreekt.

### 4.3 Basis, IKV en organisatie wijzigen

De bestaande dienstverbanddetailroute krijgt mutatievormen voor:

- basisgegevens en contractperiode;
- IKV aanmaken, koppelen en de effectieve koppeling wijzigen;
- functie, afdeling, directe manager en organisatieplaatsing.

De gecombineerde mutatie-interface wordt uitgebreid met de domeinen `EMPLOYMENT`, `INCOME_RELATIONSHIP` en `ORGANIZATION`. Ieder domein heeft een eigen payloadschema en permission. Een combinatie met salaris vereist zowel de contract-/organisatiepermission als `salary:write`.

Een wijziging van de contractperiode die bestaande tijdblokken buiten het dienstverband zou plaatsen wordt geweigerd met een typed conflict. De UI toont welke blokken eerst gecorrigeerd moeten worden.

## 5. Slice 2 — functies, functiegroepen en salaristabellen

### 5.1 Eigendom en permissions

Alle stamgegevens zijn administratiegebonden. Er is geen automatische overerving vanuit een parentadministratie. Nieuwe permissions:

- `job-catalog:read`;
- `job-catalog:write`;
- `salary-structure:read`;
- `salary-structure:write`.

Salarisbedragen vereisen daarnaast `salary:read` of `salary:write`. Een gebruiker met alleen `job-catalog:read` mag functies en schaalcodes zien, maar geen bedragen uit salaristabellen.

### 5.2 Functiemodel

`job_groups` bevat per administratie een stabiele functiegroep met code, naam, omschrijving en actiefstatus.

`jobs` bevat per administratie een stabiele functie-identiteit met code en verwijzing naar een functiegroep.

`job_revisions` bevat de tijdsgebonden functienaam, omschrijving en optionele standaardschaal voor een halfopen periode `[valid_from, valid_until)`. Revisies van dezelfde functie overlappen niet.

Een organisatieplaatsing verwijst naar de concrete functie-identiteit. De dienstverbandprojectie bepaalt de geldige functierevisie op de peildatum. Het bestaande vrije `job_title` blijft tijdens de migratie als historische snapshot beschikbaar, maar nieuwe plaatsingen kiezen een functie. Een gecontroleerde optie “afwijkende weergavenaam” mag de snapshot vullen zonder een tweede functie te creëren.

### 5.3 Salarisstructuur

`salary_scales` blijft de stabiele schaalidentiteit per administratie.

`salary_scale_revisions` bevat per schaal een volledige versie met label, bronnotitie, `valid_from`, `valid_until` en publicatiestatus. Gepubliceerde revisies zijn inhoudelijk onveranderlijk. Correcties verlopen via een nieuwe revisie of een expliciete, geaudite correctie voordat de revisie in een salarisrecord is gebruikt.

`salary_scale_steps` bevat geordende treden binnen exact één revisie:

- `step_code` en `step_name`;
- `sequence_number`;
- voltijdbedrag;
- valuta;
- optioneel uurbedrag;
- optionele markering voor instroom-, uitloop- of reguliere trede.

Schalen hebben geen vast aantal treden. Een revisie moet minimaal één trede hebben en tredecodes en volgorden zijn uniek binnen die revisie. De hele revisie heeft één ingangsperiode; losse treden hebben geen afwijkende geldigheidsperiode.

`employment_salaries.salary_scale_step_id` verwijst naar de onveranderlijke trede binnen een gepubliceerde revisie. Daardoor blijft het historische overeengekomen schaalbedrag herleidbaar wanneer een latere tabelversie ingaat.

### 5.4 Beheer-UX

Het beheer toont functies en salaristabellen uitsluitend voor de actieve administratie. Een nieuwe salaristabel kan leeg worden gestart of vanuit de laatst gepubliceerde revisie worden gekopieerd. De eerste versie ondersteunt handmatige invoer, rij toevoegen/verwijderen, toetsenbordnavigatie, controle op oplopende volgorde en publicatie. Import blijft buiten scope, maar kan later dezelfde revisie-API gebruiken.

## 6. Slice 3 — documentendossier en reminders

### 6.1 Dossiergrens en opslag

Iedere medewerker heeft logisch één dossier. Ieder documentrecord is echter expliciet administratiegebonden en kan optioneel aan een dienstverband zijn gekoppeld. De dossierpagina combineert alleen documenten uit administraties waartoe de actor toegang heeft.

Bestanden staan in een private Supabase Storage-bucket. `employee_documents` bewaart alleen een niet-publieke storage-key. Downloaden en inline bekijken verlopen via een beveiligde serverroute die na autorisatie een kort geldige signed URL maakt.

Upload bestaat uit één gecontroleerde serviceflow: invoer valideren, toegang controleren, bestand opslaan, metadata schrijven en bij falen het gedeeltelijk opgeslagen bestand opruimen. Toegestane bestandstypen en maximale grootte worden server-side vastgelegd. De eerste versie ondersteunt PDF, gangbare afbeeldingen en Office-documenten; uitvoerbare bestanden en archieven worden geweigerd.

### 6.2 Metadata

`employee_documents` bevat minimaal:

- tenant, administratie, medewerker en optioneel dienstverband;
- categorie;
- titel en omschrijving;
- genormaliseerde tags;
- oorspronkelijke bestandsnaam, storage-key, MIME-type, grootte en checksum;
- toegevoegd op en door welke auth-user en, indien beschikbaar, medewerker;
- vervaldatum;
- verwijderdatum, verwijderaar en verwijderreden;
- gekoppelde vervalreminder.

Tags worden in versie 1 als een begrensde, genormaliseerde `text[]` opgeslagen. Een aparte tagstamtabel is pas nodig zodra tags organisatiebreed beheerd of gerapporteerd moeten worden.

`document_categories` is administratiegebonden en bevat code, naam, omschrijving, actiefstatus, standaard selfzichtbaarheid, standaard doelgroepregels en of een vervaldatum gewenst of verplicht is. Een categorie wijzigt bestaande documentdoelgroepen niet stil.

### 6.3 Verwijderen en bewaring

De gebruikersactie “verwijderen” is een geaudite soft delete. Het document verdwijnt direct uit normale dossierqueries. Alleen een toekomstige bewaartermijn-/purgefunctie mag metadata en bestand definitief verwijderen. Herstellen is toegestaan aan gebruikers met `document:delete` zolang het fysieke bestand bestaat. Juridische bewaartermijnen en legal hold zijn een latere compliance-slice.

### 6.4 Permission- en doelgroepmodel

Nieuwe canonieke permissions:

- `document:read`;
- `document:write`;
- `document:delete`;
- `self:document:read`;
- `self:document:write`.

Salarisdocumentcategorieën vereisen aanvullend `salary:read` of `self:salary:read`.

Toegang heeft altijd twee poorten:

1. de actor heeft de vereiste permission en geldige medewerker-/administratiescope;
2. de actor valt binnen minimaal één actieve doelgroepregel van het document.

Een doelgroepregel verleent nooit zelfstandig een permission.

`document_audiences` ondersteunt:

- `EMPLOYEE`: één expliciete medewerker als ontvanger;
- `MANAGEMENT_ROLE`: actieve houders van een managementrol, begrensd door hun normale organisatiescope;
- `DEPARTMENT_BRANCH`: medewerkers of rolhouders binnen een afdeling en haar descendants, afhankelijk van de gekozen audience mode.

Meerdere regels vormen een unie. Er is geen AND-groepering in versie 1. Dit maakt “rol, organogram, persoon of combinatie” voorspelbaar: toegang bestaat als minstens één regel past en de permissionpoort ook slaagt. Selftoegang wordt expliciet als employee-audience of categorystandaard gematerialiseerd; het enkele feit dat een document over een medewerker gaat maakt het niet automatisch zichtbaar voor die medewerker.

Doelgroepresolutie gebruikt effective dating. Bij managerambiguïteit wordt geen willekeurige persoon gekozen.

### 6.5 Reminderuitbreiding

De bestaande reminderstructuur wordt uitgebreid van één `target_type` naar meerdere `reminder_target_rules`. Ondersteunde regels:

- iedereen binnen de geldige administratiecontext;
- medewerkers;
- afdelingstakken;
- managementrollen binnen hun geldige scope.

Meerdere regels vormen een unie en worden ontdubbeld naar `reminder_recipients`. Bestaande reminders worden zonder zichtbaar gedragsverschil gemigreerd naar één targetregel.

Een document kan precies één actieve vervalreminder hebben met een expliciete herinneringsdatum of een offset vóór de vervaldatum. Aanmaken en wijzigen loopt via dezelfde reminderpublicatiefunctie als Tijdhub. Wijziging van vervaldatum, offset of doelgroepen synchroniseert dezelfde reminder en materialiseert ontvangers opnieuw. Verwijderen of herstellen van een document annuleert respectievelijk heractiveert de gekoppelde reminder volgens de actuele datumregels.

## 7. Slice 4 — medewerkerkaart en dienstverbandtijdkaart

### 7.1 Medewerkerkaart

De medewerkerdetailpagina blijft de tenantbrede persoonskaart en toont bovenaan identiteits- en contactgegevens. Daaronder toont zij alle voor de actor zichtbare dienstverbanden als kaarten met:

- status en contractperiode;
- administratie;
- actuele functie en afdeling;
- actieve IKV;
- FTE;
- salaris uitsluitend bij salarisrecht;
- dossierdocumenten en eerstvolgende zichtbare vervaldatum;
- open opvolgacties.

De pagina ondersteunt een peildatum in URL-state. Zonder peildatum geldt vandaag.

### 7.2 Tijdkaart per dienstverband

De dienstverbandroute krijgt een visuele tijdkaart met banen voor:

- dienstverband;
- IKV-koppeling;
- functie en afdeling;
- arbeidsvoorwaarden;
- rooster en FTE;
- salaris;
- kostenverdeling;
- documenten, reminders en belangrijke deadlines.

Een cursor op de peildatum markeert de waarden die op dat moment gelden. De kaart gebruikt echte bronperioden en vult geen ontbrekende historie fictief aan. Salary-lanes en salarisbedragen worden volledig weggelaten wanneer de actor geen salarisrecht heeft.

Desktop toont een horizontale tijdas met zoomen per jaar/kwartaal. Mobiel toont dezelfde gebeurtenissen chronologisch in compacte kaarten; er ontstaat geen horizontale pagina-overflow. Klikken op een segment opent een gesaneerde detailkaart met link naar de bijbehorende tab.

## 8. Slice 5 — HR-maandkalender

### 8.1 Vorm

De kalender is op groot scherm een resourcekalender:

- één rij per zichtbare medewerker;
- één kolom per dag van de gekozen maand;
- een vaste medewerkerkolom links;
- een vaste datumkop bovenaan;
- compacte wijzigingsmarkers op de juiste dag.

Op mobiel wordt dezelfde dataset als maandagenda gegroepeerd per datum en medewerker.

### 8.2 Gebeurtenissen

De eerste versie projecteert:

- start en einde dienstverband;
- IKV-koppelingen;
- functie- en afdelingswijzigingen;
- arbeidsvoorwaarden;
- rooster/FTE;
- salaris en schaal/trede;
- kostenverdeling;
- documenttoevoeging en vervaldata;
- gekoppelde documentreminders.

Iedere `HrChangeEvent` bevat een stabiele event-ID, datum, eventtype, medewerker, optioneel dienstverband, titel, gesaneerde samenvatting, bronroute en severity. Een event bevat nooit ruwe database-rijen.

### 8.3 Scope en filtering

De actieve administratie is verplicht. URL-state ondersteunt minimaal maand, zoekterm, afdeling, eventtypes en medewerker. De server projecteert uitsluitend medewerkers en events die de actor op die datum mag lezen.

Salarisevents worden niet alleen visueel verborgen, maar ontbreken volledig in de queryresponse zonder `salary:read`. Documentevents worden door dezelfde permission- en doelgroepregels gefilterd als het dossier. Klikken opent een Liquid-detailkaart en daarna de bronroute.

Het leescontract is uitbreidbaar met verlof, verzuim, jubilea, opleidingen en bedrijfsmiddelen, maar deze bronnen vallen buiten versie 1.

## 9. Wijzigingenprojectie

Een getypeerde servermodule projecteert brontabellen naar:

```text
HrChangeEvent
  id
  eventDate
  eventType
  employeeId
  employmentId?
  titleKey
  titleValues
  summaryKey?
  summaryValues?
  sourceHref
  severity
```

`titleKey` en `summaryKey` verwijzen naar taalbestanden; databasewaarden worden alleen als veilige interpolatiewaarden opgenomen. De projectie accepteert tenant, administratie, periode, filters en capabilityset. Aggregatie en union van groeiende tabellen gebeurt database-side in een begrensde RPC of view plus route-side veldsanering. De ingelogde Supabase-client en RLS blijven leidend.

De tijdkaart gebruikt dezelfde projectie met een langere periode en één dienstverbandfilter. Hierdoor hebben kalender en tijdkaart identieke gebeurtenisdefinities.

## 10. Foutafhandeling en gelijktijdigheid

- Alle routes retourneren consistente `{ error: code }`-responses.
- Databasefuncties geven typed codes voor overlap, stale state, ongeldige periode, ontbrekende permission, ongeldige doelgroep, reminderconflict en ontbrekende bronrecord.
- Publicatie- en mutatiefuncties vergrendelen de relevante dienstverband- of documentrecords.
- Een storage-upload die na bestandsschrijven faalt ruimt het bestand op; een mislukte cleanup wordt in de bestaande interne foutregistratie vastgelegd.
- Een verlopen signed URL wordt opnieuw aangevraagd en nooit langdurig opgeslagen in clientstate.
- De UI ververst na een stale-stateconflict de serverbron en behoudt waar veilig de formulierinvoer.

## 11. Test- en verificatiestrategie

Kritieke autorisatie-, salaris- en transactielogica wordt test-first ontwikkeld.

Iedere slice bevat:

- Zod-unit-tests voor geldige en ongeldige payloads;
- pure unit-tests voor tijdprojectie, doelgroepresolutie en statusafleiding;
- route-tests voor permissions, context en foutcodes;
- database-integratietests voor transacties en overlapconstraints;
- negatieve RLS-tests met verkeerde tenant, administratie, medewerker, document, functie en salaristrede;
- expliciete tests dat contractrecht geen salarisbedrag of salarisgebeurtenis ontsluit;
- auditcontroles voor creëren, wijzigen, publiceren, verwijderen en herstellen;
- i18n-sleutelpariteit;
- ESLint, strict TypeScript en productiebuild;
- browsercontrole op localhost:3000 voor desktop en 390px;
- controle via een actuele publieke preview.

Na iedere schemamutatie worden Supabase security- en performance-advisors gecontroleerd en `packages/db/types.ts` opnieuw gegenereerd.

## 12. Documentatie en migratie

- Dit ontwerp wordt leidend naast ADR-0001 en ADR-0003.
- De requirement voor documenten wordt in slice 3 herschreven zodat rolcodevelden niet langer als autorisatiebron gelden.
- Het employmentrequirement wordt bijgewerkt voor de complete flow, functies en schaalrevisies.
- Een FDR legt de unionsemantiek van document- en reminderdoelgroepen vast.
- Bestaande salarisstappen worden gemigreerd naar gepubliceerde initiële revisies zonder historische verwijzingen te verliezen.
- Bestaande vrije functietitels blijven leesbaar; koppeling aan een functie wordt niet stil afgedwongen voor historische plaatsingen.
- Bestaande reminderdoelgroepen worden één-op-één naar targetregels gemigreerd.
- Na iedere afgeronde verticale slice worden `docs/README.md`, `docs/delivery/IMPLEMENTATION_STATUS.md` en `docs/delivery/CURRENT_CONTEXT.md` bijgewerkt.

## 13. Buiten scope

- automatische cao- of salaristabelimport;
- AI/RAG-compliance-audits;
- OCR en documentinhoudindexering;
- legal hold en definitieve bewaartermijnpurge;
- AND/negatiegroepen in documentdoelgroepen;
- verlof, verzuim, opleidingen, jubilea en bedrijfsmiddelen in de kalender;
- generatieve Liquid Display-widgets voor deze gegevens;
- drag-and-dropwijzigingen vanuit tijdkaart of kalender.

## 14. Acceptatiecriteria voor het geheel

- Een HR-gebruiker kan vanuit identity matching een nieuwe of bestaande medewerker kiezen en een volledig dienstverband atomair publiceren.
- Basis, IKV, organisatie, arbeidsvoorwaarden, rooster, salaris en kostenverdeling zijn daarna veilig door de tijd te beheren.
- Functies, functiegroepen en volledige schaal-/trederevisies zijn per administratie handmatig te onderhouden.
- Iedere zichtbare medewerker heeft één dossierweergave met alleen toegestane administraties en documenten.
- Documentdownload, verwijderen, herstellen, vervaldata en doelgroepreminders respecteren permission én doelgroep.
- De medewerkerkaart toont alle zichtbare dienstverbanden en de dienstverbandtijdkaart reconstrueert de situatie op een gekozen peildatum.
- De maandkalender toont per medewerker alle toegestane HR-wijzigingen zonder salaris- of documentmetadata te lekken.
- Tenant-, administratie-, medewerkers-, salaris- en documentisolatietests slagen.
- Alle zichtbare tekst bestaat in Nederlands en Engels.
- Lokale en publieke desktop- en mobiele browsercontroles slagen.
