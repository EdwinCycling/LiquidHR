# PMUX-06A.1 — Canonieke werkkalender

Datum: 25 oktober 2026. Status: lokaal en Core TEST PASS voor de goedgekeurde Jupiter-publicatie en P9-acceptatie. Migratie `20261025131521`, kalender versie 1, echte P9-start en directe Admin/Employee-autorisatie zijn bewezen in [de definitieve acceptatie](../../quality/acceptance/runs/PMUX-06A1-20261025-CORE-TEST.md). Geen deployment; andere scopes en jaren vragen eigen expliciete kalenderpublicaties.

## Productcontract

HR Admin beheert de werkkalender via Instellingen → Werkkalenders. De bestaande permission `process-definition:write` bepaalt beheerrechten; er worden geen gewone rollen of permissions verruimd. Manager en Employee krijgen geen beheer-API of beheerscherm. Tenant-, HR-groep- en administratiescope worden server-side en via RLS begrensd.

Een HR-groep kan een standaardkalender hebben. Een administratie kan die expliciet overschrijven. Een bestaande maar ongeldige/uitgewerkte administratieafwijking valt nooit stil terug op de groepsstandaard. Een ontbrekende kalender blokkeert werkdag-SLA's; minuten, uren en gewone kalenderdagen blijven beschikbaar.

## Bestaande voorzieningen hergebruiken

- `holiday_calendars` en `holidays` zijn het canonieke feestdagenregister per HR-groep. De bestaande providerimport en handmatige invoer blijven de enige importpaden; geen tweede Nederlandse feestdagenberekening.
- Een officiële feestdag is niet automatisch een vrije dag. HR Admin selecteert expliciet de werkelijk vrije bronfeestdagen en bevestigt de beoordeling van de hele geldigheidsperiode. Ontbrekende bronjaren zijn zichtbaar in de editor.
- Individuele werkpatronen en bedrijfsactiviteiten bepalen geen organisatiebrede proceskalender: die kunnen per medewerker verschillen en een activiteit betekent niet automatisch een sluitingsdag.
- De bestaande `process_definition_content()` leest zowel de gepubliceerde content-wrapper als legacy top-level definities. De bestaande PMUX-06A-materialisatie en kopie naar werkitems blijven het runtimepad.

## Kalender en revisies

Elke publicatie bevat naam, ISO-weekdagen 1–7, expliciete geldigheidsperiode, de HR-groeptijdzone op het publicatiemoment, geselecteerde bronfeestdagen, afwijkende sluitingsdagen en extra werkdagen. De wijzigingsreden is verplicht. De beheerinterface biedt laden van bestaande feestdagen, expliciete selectie, afwijkingen, historie en een deadlinevoorbeeld via de canonieke SQL-berekening.

Publicaties zijn immutable. Geselecteerde feestdagen worden als datum/naam/herkomst-ID gekopieerd naar de kalenderrevisie; latere wijzigingen of verwijdering in het bronregister wijzigen die revisie niet. Eén datum heeft één keuze: een dubbel gekozen feestdag/afwijking wordt geweigerd.

De nieuwste publicatie gaat direct gelden voor nieuwe stapactivaties. De geldigheidsperiode moet zowel de lokale activatiedatum als de berekende deadline bevatten. Buiten de periode volgt `SLA_WORKDAY_CALENDAR_OUT_OF_RANGE`; er is geen automatische jaarverlenging of kalenderdagfallback. HR Admin moet tijdig een nieuwe, passende publicatie vastleggen.

## SLA-berekening

- De klok begint op `process_step_instances.activated_at`, onafhankelijk van de business-ingangsdatum van een aanvraag.
- De activatiedatum telt niet mee. Voor twee werkdagen vanaf maandag wordt woensdag geteld; vanaf vrijdag of zaterdag normaal dinsdag.
- Expliciete dagafwijkingen hebben voorrang op het weekpatroon. Geselecteerde bronfeestdagen zijn expliciete vrije dagafwijkingen.
- De lokale wandkloktijd blijft behouden in de gepubliceerde IANA-tijdzone. Weekenden, geselecteerde vrije dagen en jaargrenzen worden doorlopen binnen de expliciete dekking.
- DST-gaten en overlaps volgen dezelfde PostgreSQL `AT TIME ZONE`-semantiek als bestaande kalenderdag-SLA's. Er wordt geen tweede tijdzone-engine in JavaScript gebouwd.
- `businessDays:true` is alleen geldig met de bestaande eenheid `DAYS`. De compiler valideert dit structureel. Kalenderbeschikbaarheid is scopeconfiguratie en wordt fail-closed bij runtime gecontroleerd, zodat definities overdraagbaar blijven.

## Lopende processen en audit

Bij activering bewaart de stap de gebruikte `work_calendar_version_id` en één deadline. Het bestaande werkitem ontvangt exact die deadline. Een kalenderpublicatie, wijziging in het feestdagenregister of wijziging in de HR-groeptijdzone herberekent niets.

Dit geldt ook voor lopende cases: reeds geactiveerde stappen houden hun kalenderrevisie en deadline; later geactiveerde stappen gebruiken de dan geldende kalender. Er is geen automatische backfill of herberekenactie. Dat beleid staat zichtbaar vóór publicatie.

De oude P7-trigger die op updates opnieuw rekende en zijn private weekdagcalculator worden verwijderd. De bestaande PMUX-06A-trigger is het enige actieve materialisatiepad. Directe wijziging van een opgeslagen deadline of kalenderbinding wordt geweigerd. Kalenderpublicatie en kalenderbinding/deadline op een stap worden geaudit; gewone procesevents en bestaande audit blijven intact.

## Verificatie en acceptatiegrens

Gerichte PGlite-tests dekken weekdagen/weekenden, gekozen en niet-gekozen feestdagen, extra werkdagen, opeenvolgende sluitingen, jaargrens, beide DST-overgangen inclusief gaten/overlaps, ontbrekende/ongeldige/uitgewerkte kalender, scopeweigering, RLS, privileges, revisies, audit, werkitemkopie en onveranderde gewone deadlines. API- en componenttests toetsen expliciete selectie, serverafleiding van scope en beheerweigering. NL/EN hebben gelijke keys.

De bestaande browserrunner toetst alleen deze feature en de bestaande P9-flow. De P9-start gebruikt een vaste product-API-idempotentiesleutel en een voorafgaande controle op bestaande cases. Geauthenticeerde kalenderpublicatie, migratie en P9-start op Core TEST wachten op afzonderlijk akkoord voor de exacte [TEST-write-proposal](../../quality/acceptance/runs/PMUX-06A1-20261025-TEST-WRITE-PROPOSAL.json).

Zie [architectuurbesluit](../../architecture/ADR-PMUX-06A1-WORK-CALENDAR.md) en [acceptatie](../../quality/acceptance/runs/PMUX-06A1-20261025-LOCAL.md).
