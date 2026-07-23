# Verlof aanvragen door HR-admin vanuit de medewerkerskalender

Status: **LEIDEND** voor de HR-admin-aanvraagflow
Implementatiestatus: **GEDEELTELIJK GEREALISEERD** — de HR-admin/managerflow, directe goedkeuring, FIFO-boekingen, saldo-preview en kalenderprojectie zijn aanwezig; ESS, notificaties en volledige toekomstige-opbouwprojectie volgen later.
Scope: één HR-admin-aanvraagflow vanuit `/hr-calendar`; ESS/selfservice en de medewerkersaanvraag volgen later.

## 1. Doel en grenzen

Een geautoriseerde HR-admin kan vanuit een aangeklikte medewerkerdag verlof inplannen. De actie werkt altijd op precies één `Employment` van de medewerker. Een medewerker met meerdere parallelle dienstverbanden mag nooit één gecombineerd verlofsaldo of één gecombineerde aanvraag krijgen.

Deze fase bevat:

- aanvragen via een actieve voorrangsregelbundel;
- aanvragen zonder voorrangsregelbundel, rechtstreeks op één verloftype;
- berekening van de op te nemen tijd op basis van de effectieve roostering;
- een bevestigingspreview met totaal en detail per verloftype;
- een atomische, geauditeerde boeking via de centrale verlofengine.

Deze fase bevat niet:

- een ESS-aanvraagpagina;
- medewerker-selfservice, managergoedkeuring of chatbotacties;
- rechtstreeks schrijven vanuit de kalender buiten de centrale, geautoriseerde booking-engine;
- fictieve verloftypen of saldo's in productie. Een expliciete demo-fixture voor Lina Bakker bestaat uitsluitend voor de lokale/remote testcontrole.

## 2. Autorisatie

### 2.1 Canonieke permission

Voeg de afzonderlijke permission `leave:request` toe. Deze permission staat los van `leave:write` (configuratie) en `leave:read` (catalogus/saldo lezen). De aanvraagroute controleert daarnaast de bestaande kalender- en managementscope:

- actor heeft `hr-calendar:read` om de kalendercontext te gebruiken;
- actor heeft `leave:request` voor de aanvraagactie;
- actor heeft effectieve scope op de doelmedewerker en diens dienstverband;
- de actuele administratiecontext komt server-side uit de sessie.

De huidige systeemrol `TENANT_ADMIN` (in de HR-admin-UI aangeduid als **HR-admin/Hoofdbeheerder**) krijgt `leave:request` standaard. De HR-admin configureert in de autorisatie-instellingen tenantbreed welke managementrollen dit recht krijgen. Een manager mag dus aanvragen wanneer zijn rol het recht heeft én zijn bestaande medewerkersscope de medewerker toestaat. Een rolselectie verandert geen organisatiescope en verleent geen toegang tot een andere tenant of administratie.

`self:leave:request` bestaat in deze fase niet. ESS krijgt later een eigen besluit en permission.

Een aanvraag door een medewerker zelf vanuit de kalender is niet toegestaan. Medewerkers krijgen geen `leave:request` en kunnen deze HR-adminactie niet omzeilen met een selfpermission.

### 2.2 Zichtbaarheid en afdwinging

De harmonica-actie wordt alleen zichtbaar voor actors met het recht, maar de server valideert altijd opnieuw. Een gemanipuleerde `employeeId`, `employmentId`, priority-rule-id of leave-type-id levert geen data of boeking buiten de actuele tenant-, administratie- en managementscope op.

## 3. Start vanuit de medewerkerskalender

1. De actor klikt op een dagcel van een medewerker in `/hr-calendar`.
2. De bestaande site-/harmonica-menu opent voor die medewerker en datum.
3. Onder **Medewerker** en boven **Acties** staan, wanneer geautoriseerd, exact deze acties:
   - **Verlof aanvragen via voorrangsregels**;
   - **Verlof aanvragen zonder voorrangsregels**.
4. De gekozen dag is vooraf geselecteerd in het formulier.
5. De aanvraagpagina of het side-panel toont altijd medewerker, administratie, dienstverband en datumcontext.

Bij één actief geldig dienstverband wordt dit automatisch gebruikt. Bij twee of meer geldige dienstverbanden verschijnt eerst een compacte dienstverbandkeuze met de relevante kenmerken. De gebruiker wordt niet met die keuze belast wanneer er maar één geldig dienstverband is.

## 4. Aanvraag via voorrangsregels

### 4.1 Regelbundel kiezen

De engine zoekt voor het gekozen dienstverband, de actuele administratie en de gekozen datum de actieve priority-rulebundels die bij het effectieve verlofprofiel passen.

- **Geen bundel:** de actie toont een duidelijke blokkade en verwijst naar HR-adminconfiguratie; er wordt niets geboekt.
- **Eén bundel:** de naam van die bundel wordt direct getoond en automatisch gekozen.
- **Meerdere bundels:** de actor kiest één bundel. De lijst bevat alleen geldige, actieve bundels uit het profiel van dit dienstverband.

Een datumreeks die over een wijziging van de effectieve bundel heen gaat, wordt per kalenderdeel beoordeeld. Wanneer niet één consistente bundel kan worden gebruikt, moet de preview de splitsing tonen of de aanvraag blokkeren; stil één regel voor de hele periode toepassen is niet toegestaan.

### 4.2 Totaal en detail van de bundel

Het formulier toont bovenaan het beschikbare totaal van alle verloftypen in de gekozen bundel. De gebruiker kan **Toon detail** openen om per verloftype minimaal te zien:

- naam en kleur;
- beschikbare uren/minuten of **Onbeperkt**;
- opbouwjaar en vervaldatum van positieve buckets wanneer relevant;
- de volgorde waarin de engine later afboekt.

De totalen zijn een server-side projectie; de browser telt geen losse buckets op. Bij een bundel met een onbeperkt type wordt het bundeltotaal als **Onbeperkt** weergegeven en blijft de detailweergave leidend.

## 5. Aanvraag zonder voorrangsregels

Deze route toont alle actieve verloftypen uit de actuele administratie/catalogus. De actor kiest rechtstreeks één type; er is geen automatische doorschuiving naar een ander type. Per type toont de preview:

- saldo nu;
- saldo einde kalenderjaar inclusief toekomstige opbouw;
- de geldende jaarlimiet, of **Onbeperkt** wanneer het type onbeperkt is;
- vervaldatum en relevante opbouwjaar-buckets wanneer van toepassing.

Wanneer het gekozen type onvoldoende beschikbaar saldo of resterende jaarlimiet heeft, wordt de aanvraag volledig geweigerd. Een onbeperkt type heeft geen saldo- of jaarlimietcontrole, maar gebruikt wel dezelfde rooster- en tijdvalidatie. Een gedeeltelijke boeking is niet toegestaan.

## 6. Periode en tijdkeuze

### 6.1 Eén geselecteerde dag

Voor de vooraf geselecteerde dag kiest de actor één van deze opties:

- **Volledige dag:** alle netto geplande minuten van die dag volgens het effectieve werkpatroon;
- **Voormiddag:** de geconfigureerde halve-dagduur;
- **Namiddag:** dezelfde geconfigureerde halve-dagduur;
- **Specifieke uren:** een start- en eindtijd binnen de effectieve planning.

De halve-dagduur is per administratie instelbaar en heeft standaard 240 minuten (4 uur). Bij een administratie met een negenurige volledige werkdag kan HR-admin dit bijvoorbeeld op 270 minuten (4,5 uur) instellen. De labels voormiddag en namiddag zijn functionele keuzes; de exacte kloktijden bepalen de duur niet. De configuratie mag nooit boven de netto geplande volledige dag uitkomen.

De totale tijd is berekend en zichtbaar in uren en minuten. De actor kan het resultaat niet als een los saldo- of grootboekveld manipuleren. Specifieke uren moeten met een gepland werksegment overlappen; een periode buiten het rooster, een negatieve duur of een nulduur wordt geweigerd.

### 6.2 Meerdere dagen

Vanuit de bevestigingsstap kan de actor overschakelen naar een reeks met een start- en einddatum, inclusief beide datums. Voor een reeks zijn voormiddag, namiddag en specifieke uren niet beschikbaar: iedere datum gebruikt de volledige geplande dag.

De engine berekent per datum de netto geplande minuten. Niet-werkdagen en feestdagen worden overgeslagen en leveren geen verlofminuten op; een reeks met uitsluitend niet-geplande dagen wordt geweigerd. De preview toont de overgeslagen dagen, de opgesplitste geplande dagen en het totaal voordat wordt bevestigd.

## 7. Beschikbaarheid, limieten en afboekvolgorde

Iedere preview toont twee verschillende saldo's, zowel voor het priority-bundeltotaal als in het detail per verloftype:

- **Saldo nu:** de actuele beschikbare uren/minuten op dit moment, inclusief geldige overhevelingen en mutaties tot vandaag;
- **Saldo einde kalenderjaar:** een server-side prognose voor 31 december (of het eerdere einde van het dienstverband), inclusief toekomstige opbouw die volgens de effectieve regels nog wordt toegekend en toekomstige bekende opnames.

Het saldo einde kalenderjaar is een prognose en wordt nooit stil gebruikt om vandaag meer op te nemen dan op de aangevraagde datum beschikbaar is. De boekingscontrole gebruikt de beschikbaarheid op iedere aangevraagde datum; geplande toekomstige opbouw telt pas mee zodra zij op die datum volgens de engine is toegekend. Beide saldo's blijven zichtbaar voordat de actor bevestigt.

De preview controleert op de volledige aangevraagde periode:

1. geldig dienstverband en geldig verlofprofiel;
2. actieve verlofregel/bundel op iedere datum;
3. actuele beschikbare buckets en relevante jaarlimieten;
4. vervaldatums vóór de aangevraagde opname;
5. voldoende totaal voor een priority-bundel of voldoende saldo voor één direct gekozen type.

Bij een priority-bundel volgt de latere boeking de vastgelegde volgorde van de bundel en daarbinnen FIFO op de dichtstbijzijnde vervaldatum. Als het totaal tekortschiet, wordt de hele aanvraag afgewezen zonder gedeeltelijke `TAKEN`-transactie.

Een geprognosticeerde toekomstige opbouw is uitsluitend onderdeel van **Saldo einde kalenderjaar**. Zij is geen direct opneembaar saldo totdat de engine haar op de aangevraagde datum heeft toegekend.

## 8. Bevestigen en registreren

De bevestiging toont minimaal:

- medewerker, dienstverband en administratie;
- één dag of start-/einddatum;
- keuze volledige dag/voormiddag/namiddag/specifieke uren, wanneer van toepassing;
- totaal op te nemen tijd;
- gekozen priority-bundel of direct verloftype;
- detail van de voorgestelde typen/buckets;
- eventuele waarschuwing over vervaldatum, limiet of ontbrekende planning.

Na bevestiging schrijft uitsluitend de centrale verlofengine. De boeking is atomair: aanvraagrecord, afboekallocaties en `TAKEN`-transacties slagen samen of helemaal niet. De oorspronkelijke opbouw- en correctietransacties blijven immutable.

Iedere boeking bevat actor, tijdstip, bron (`HR_ADMIN_CALENDAR`), doel-`employment_id`, selectiegegevens, totalen en een auditverwijzing. Een dubbel bevestigde browseractie mag geen dubbele boeking opleveren; daarvoor is een idempotency key verplicht.

Een bevestigde aanvraag van HR-admin of een daarvoor geautoriseerde manager is direct goedgekeurd. De confirmfunctie schrijft daarom meteen de geauditeerde `TAKEN`-transacties; er is in deze fase geen aparte `PENDING`- of managergoedkeuringsstap.

## 9. Voorgestelde technische contracten

De precieze namen worden bij schema-ontwerp vastgesteld, maar het contract bestaat uit:

- aanvraagrecord met tenant-, administratie-, medewerker- en dienstverbandgrens, periode, tijdkeuze, mode, actor, de status `APPROVED` en idempotency key;
- allocation-records per verloftype/bucket voor de uitlegbare FIFO-verdeling;
- één server-side previewfunctie die de berekende minuten, saldo's, limieten, gekozen bundel en detail teruggeeft;
- één server-side confirmfunctie die de aanvraag valideert tegen dezelfde peildatum en atomair boekt;
- API-routes voor preview en bevestiging die beide `requirePermission('leave:request', employeeId)` gebruiken;
- RLS, grants, audittriggers, bronverwijzingen en indexes in dezelfde migratie als de nieuwe tabellen.

De browser ontvangt alleen de geautoriseerde projectie. Zij voert geen balanssom, FIFO, roosterberekening of autorisatiebeslissing uit.

## 10. Schermreferenties

De aangeleverde screenshots zijn layoutreferenties, geen seeddata:

1. aanvraagpaneel met geselecteerde dag, tabs voor met/zonder voorrangsregels, typekeuze, tijdkeuze, totale tijd en bevestiging;
2. ingeklapte priority-detailkaart met bundeltotaal en **Bevat X kalendertypes / Toon detail**;
3. uitgeklapte detailkaart met saldo per verloftype.

Voor de implementatie zijn daarnaast nog nuttig: een screenshot van het harmonica-menu met beide acties, de directe aanvraag zonder voorrangsregels en de uiteindelijke bevestigings-/foutstaat. De optie **Functiegroep informeren?** wordt bewust niet gebouwd; notificatie van collega's hoort bij een latere mail/notificatiestap. De drie huidige schermen zijn voldoende om het datacontract en de eerste formulierindeling vast te leggen.

## 11. Acceptatiecriteria

- Alleen een actor met de configureerbare rolpermission ziet én kan de twee kalenderacties gebruiken.
- De standaardtoekenning is HR-admin (`TENANT_ADMIN`); aanvullende managementrollen zijn tenantbreed beheerbaar via de bestaande rechtenmatrix.
- Een geautoriseerde manager boekt direct goedgekeurd binnen zijn bestaande scope; een medewerker kan deze kalenderactie nooit uitvoeren.
- Eén actief dienstverband geeft geen extra keuze; parallelle dienstverbanden geven een expliciete keuze en nooit een samengevoegd saldo.
- Geen, één en meerdere actieve priority-bundels geven respectievelijk blokkade, automatische keuze en expliciete keuze.
- Eén dag ondersteunt volledige dag, voormiddag, namiddag en specifieke uren; een reeks ondersteunt alleen volledige geplande dagen.
- Voormiddag en namiddag gebruiken dezelfde per administratie ingestelde halve-dagduur, standaard 4 uur.
- De tijd komt server-side uit effectieve roostering, werkpatroon, pauzes en kalenderdagen.
- Bundeltotaal en detail per verloftype tonen zowel saldo nu als saldo einde kalenderjaar en worden vóór bevestiging gecontroleerd.
- Onvoldoende saldo, limiet, verlopen bucket, ontbrekende planning of ongeldige employment blokkeert de hele boeking.
- Boekingen zijn atomair, idempotent, per `Employment`, FIFO volgens de gekozen bundel en volledig geaudit.
- NL/EN-teksten zijn paritair; geen zichtbare hardcoded strings.

## 12. Beslispunten vóór implementatie

Er zijn geen resterende functionele beslispunten uit deze requirements. De ontbrekende schermreferenties zijn alleen visuele input voor de latere UI-uitwerking.

## 13. Uitvoeringsstap

Dit document wordt toegevoegd als **stap 8** na de bestaande opbouw-, catalogus-, opvolger-, priority-, jaarafsluit- en auditstappen. De uitvoering blijft `schema → API → UI`:

1. schema, permission, RLS, audit, aanvraag- en allocation-records;
2. pure rooster-/tijdkeuze-, balance-, priority/FIFO- en idempotentiecontracten;
3. preview- en confirm-API's met employment- en managementscope;
4. kalenderharmonica, formulieren, detailkaart, bevestiging en foutstaten;
5. testgate, poort-3000-browsercontrole en publieke preview.

Geen ESS-aanvraag wordt in deze stap gebouwd.
