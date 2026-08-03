# LiquidHR Talent — uitvoeringsplan fase 3

## Status en uitgangspunt

**Status:** P3.0, P3.1, P3.2 en P3.4 uitgevoerd in de lokale/testfase; P3.7-documentatie en release-eigenaarschap blijven open.  
**Datum:** 3 augustus 2026  
**Bron:** `01-LiquidHR-Workforce-Talent-Product-Blueprint-v2.0.md` en de M2-contracten/traceabilitydocumenten.

De actuele uitvoeringsgrens is: bouw P3.0, P3.1, P3.2 en P3.4 af; laat P3.3 en P3.5 expliciet `GEPARKEERD`; voer P3.6 alleen uit na een afzonderlijk productbesluit; voer P4, P5 en P6 niet uit binnen deze opdracht. De concrete testset, roltest en nieuwe-chatinstructie staan in `docs/delivery/TALENT_P3_TESTPLAN_AND_HANDOFF_20260803.md`.

M2 levert de beveiligde basis voor capabilityregistraties, kwalificaties, assessments, Team Talent, vergelijking, import/rollback, ontwikkeldoelen en rapportage/export. Fase 3 bouwt daarop voort. Iedere nieuwe slice volgt de vaste volgorde **schema → RLS/permissions → service/API → UI → tests** en sluit aan op bestaande employees, employments, functieprofielen, capabilities, audit en notificatiepatronen.

De fase-2-release-hardening blijft een aparte technische gate: representatieve performance, snapshot/restore en volledige axe/keyboard-herhaling moeten vóór productie-release worden bewezen. Dat blokkeert het fase-3-ontwerp, maar niet het uitwerken van een volgende testfase-slice zolang de nieuwe slice geen ongeteste productieclaim maakt.

## Fase 3 in gewone gebruikersflow

Na M2 heeft de medewerker een veilige plek voor eigen talentgegevens, doelen en assessments. In fase 3 maken we daar een begrijpelijke werkcyclus van. Eerst controleert HR of de bestaande basis klaar is voor gebruik: rollen, scope, audit, performance, toegankelijkheid en herstel worden opnieuw doorlopen. Dat is P3.0. Pas daarna komt er nieuwe gebruikersfunctionaliteit.

In P3.1 krijgt iemand alleen een kleine, veilige herinnering wanneer er echt iets te doen is: een doel staat open, een assessment wacht, een import is afgerond of een kwalificatie loopt af. De melding vertelt niet meer dan de ontvanger mag weten. De gebruiker kan de melding lezen en afhandelen; een melding verandert nooit de rechten.

In P3.2 wordt een doel een terugkerend gesprek tussen medewerker en manager. De medewerker ziet de eigen voortgang en schrijft de eigen terugblik. De manager voegt een eigen observatie en vervolgactie toe. Die twee teksten blijven gescheiden, zodat een prive-observatie niet per ongeluk als medewerkertekst verschijnt. HR kan de workflow beheren en auditen, maar er ontstaat geen automatische beoordeling of loopbaanscore.

P3.3 staat op de parkeerplaats. We bouwen in deze fase geen nieuwe documentkoppeling, downloadstroom of evidence-retention in. De bestaande M2-evidencegrens blijft gelden: alleen metadata, geen evidence-inhoud.

P3.4 is de vierde stap en gaat over terugkijken. De gebruiker kan bijvoorbeeld de ontwikkeling van een doel over een periode bekijken, filteren op status of geldigheid en zien waar de informatie vandaan komt. Een manager ziet alleen de eigen scope en een medewerker alleen de eigen historie. Het scherm legt uit welke populatie is gebruikt en welke gegevens ontbreken. We voegen geen geheim totaalcijfer toe: iedere samenvatting moet uitlegbaar zijn en dezelfde kolommen gebruiken in scherm, API en export.

P3.5 staat eveneens op de parkeerplaats. In deze fase voegen we geen delegatie, vervanging, goedkeuring of escalatieroute toe. Managers blijven werken binnen de bestaande directe medewerkersscope; tijdelijke overdracht komt pas terug na een afzonderlijk productbesluit.

P3.6 is alleen nodig als er productmatig wordt besloten om Talent te verbinden met leren of een opleidingscatalogus. Dan koppelen we naar de bestaande bron of een duidelijke adapter; we bouwen geen tweede competentiecatalogus. Een mogelijke opleiding blijft een informatieve optie die de gebruiker zelf bevestigt. Het systeem neemt geen promotie-, geschiktheids- of loopbaanbesluit.

P3.7 is het moment waarop fase 3 releaseklaar wordt gemaakt. Alle routes, API's, RLS-regels, rollen, toegankelijke bediening, performance, audit en herstel worden nog één keer samen getest. Pas als de bewijsstukken compleet zijn en een eigenaar de resterende risico's accepteert, kan een productie-release worden overwogen.

## Fase-3-volgorde

### P3.0 — release-hardening en traceability

**Doel:** M2 reproduceerbaar vrijgeven en de resterende release-risico's sluiten.

- herhaal de drie-rollenmatrix voor alle M2-routes, API's en mutaties;
- leg een representatieve testdataset en query-baselines vast;
- voer snapshot/restore en migratie-rollback uit in een veilige niet-productieomgeving;
- herhaal axe, keyboard-only, focus, labels, fout- en lege-toestandcontroles;
- werk Blueprint-traceability en delivery-status bij.

**Testgate:** geen ongeautoriseerde route, scope of DTO; baseline, herstelbewijs en toegankelijkheidsbewijs zijn opgeslagen.

### P3.1 — notificaties en opvolging

**Doel:** gebruikers gericht informeren over doelen, assessments, importresultaten en relevante vervaldatums.

- hergebruik de bestaande notificatie-infrastructuur;
- definieer gebeurtenis, ontvanger, tenant-scope, deduplicatie, voorkeuren en bewaartermijn;
- maak notificaties nooit een bron van autorisatie of gevoelige evidence-inhoud;
- ondersteun lezen, markeren als afgehandeld en een veilige audittrail.

**Testgate:** geen cross-tenant notificatie, geen dubbele gebeurtenis bij retry, en ontvangers zien alleen een minimaal toegestane samenvatting.

### P3.2 — doelgesprekken en check-ins

**Doel:** ontwikkeldoelen bruikbaar maken als terugkerende manager-medewerkerworkflow.

- voeg check-inmomenten, gespreksnotities en opvolgacties toe met expliciete eigenaar;
- scheid medewerkertekst, managerobservatie en HR-auditdata;
- behoud status- en versioningguards van M2.7;
- sta geen automatische beoordeling, score of loopbaanadvies toe.

**Testgate:** self-bound medewerkerdata, directe managerscope, HR-beheer en afgeschermde notities zijn per route en RLS bewezen.

### P3.3 — evidence- en documentkoppeling

**Status:** GEPARKEERD op verzoek. Geen schema-, API- of UI-uitvoering in fase 3.

**Doel:** gecontroleerde metadatarelaties naar documenten bieden zonder evidence-inhoud onbedoeld bloot te stellen.

- gebruik het bestaande documenten-/dossiermodel als bron; maak geen tweede documentwereld;
- leg alleen metadata, doelrecord, eigenaar, status, bewaartermijn en toegangscontext vast;
- ontwerp signed URLs en downloadrechten als afzonderlijke server-side beslissing;
- maak retention, archivering en intrekking expliciet.

**Testgate:** geen evidence-inhoud in lijst- of export-DTO's, geen IDOR op documentreferenties, en verlopen/revoked toegang werkt.

### P3.4 — rapportagegeschiedenis en filters

**Doel:** gebruikers inzicht geven in ontwikkeling over tijd zonder verborgen KPI's.

- voeg expliciete historische tijdsfilters en status-/geldigheidsweergave toe;
- maak bron, populatie, scope en ontbrekende gegevens zichtbaar;
- hergebruik de M2-report-service en exportaudit;
- voeg aggregaten alleen toe na een afzonderlijk productbesluit met uitlegbare definitie.

**Testgate:** dezelfde allowlists gelden voor scherm, API en export; manager- en medewerkerfilters blijven gescopeerd.

### P3.5 — managerworkflow en delegatie

**Status:** GEPARKEERD op verzoek. Geen schema-, API- of UI-uitvoering in fase 3.

**Doel:** gecontroleerde ondersteuning van managers bij doelen, assessments en opvolging.

- modelleer tijdelijke delegatie of vervanging alleen met begin/einddatum en audit;
- gebruik bestaande managementscope; geen vrije medewerkerselectie buiten die scope;
- maak goedkeuringen en escalaties expliciet, idempotent en intrekbaar;
- voorkom self-approval en privilege-escalatie.

**Testgate:** scopewijziging werkt direct, verlopen delegatie geeft 403, en elke actie is herleidbaar naar actor en reden.

### P3.6 — leren en capabilitycatalogus

**Doel:** een eventuele koppeling tussen capabilitygaps en leren voorbereiden.

- start alleen na expliciete Blueprint-/productbeslissing over LMS of opleidingscatalogus;
- definieer een adapter of referentiemodel in plaats van een tweede catalogus;
- houd aanbevelingen informatief en door de gebruiker bevestigbaar;
- schrijf geen automatische loopbaanbeslissingen of scores.

**Testgate:** capability- en opleidingsdata blijven afzonderlijk geautoriseerd; een ontbrekende externe koppeling geeft een veilige lege toestand.

### P3.7 — productie-readiness

**Doel:** fase 3 gecontroleerd naar release brengen.

- volledige contract-, unit-, API-, RLS-, browser-, toegankelijkheids- en regressiesuite;
- performance op representatieve dataset met vastgelegde grenswaarden;
- migratie-, backup-, restore- en rollbackbewijs;
- security-advisorbeoordeling, DTO-review, auditreview en documentatie-update;
- releasebewijs koppelt GitHub-commit, deployment en `READY`-status wanneer deployment expliciet wordt gevraagd.

**Testgate:** geen releaseclaim zonder alle bewijsstukken en expliciete eigenaar voor resterende risico's.

## Aanbevolen start

Start met **P3.0** als korte hardening-slice. Daarna volgen P3.1 notificaties, P3.2 doelgesprekken en P3.4 historische rapportage/filters. P3.3 en P3.5 blijven geparkeerd. P3.6 blijft conditioneel totdat een LMS- of opleidingsbesluit is genomen; daarna sluit P3.7 de fase af.

## Voorlopige roadmap fase 4 t/m 6

Deze drie fasen zijn een richtinggevend voorstel en nog geen uitvoeringsopdracht. Per fase volgt eerst een productbesluit, daarna dezelfde volgorde: schema, RLS/permissions, service/API, UI en tests.

### P4 - dagelijkse adoptie en zelfservice

In P4 maken we Talent onderdeel van het normale werk. De medewerker ziet op een startpagina wat vandaag aandacht nodig heeft: een open doel, een check-in, een assessment of een veilige herinnering. De manager krijgt een compact overzicht van het eigen team en kan vanuit die context een gesprek of opvolgactie openen. HR ziet tenantbrede voortgang en uitzonderingen zonder verborgen score.

Functioneel testen we dat een gebruiker alleen eigen taken en toegestane teaminformatie ziet, dat herinneringen niet dubbel verschijnen, dat een afgehandelde actie verdwijnt uit de open lijst en dat een lege of onvolledige dataset begrijpelijk blijft. P4 gaat dus over gebruik en opvolging, niet over nieuwe gevoelige documenttoegang of delegatie.

### P5 - koppelingen en uitwisseling

In P5 verbinden we Talent alleen met bronnen die de organisatie echt gebruikt, bijvoorbeeld een opleidingscatalogus, LMS, agenda of een goedgekeurde documentprovider. Talent blijft de eigenaar van de eigen status en autorisatie; een externe bron wordt geen tweede functie- of capabilitycatalogus. De gebruiker ziet of een koppeling actief is, welke gegevens zijn ontvangen en wanneer die voor het laatst zijn bijgewerkt.

Functioneel testen we veilige synchronisatie, herhaalbaarheid bij een retry, tenantisolatie, minimale gegevensuitwisseling en een nette lege toestand wanneer een externe bron niet beschikbaar is. P3.3 en P3.5 worden hierbij niet automatisch heropend; documentdownloads of delegatie krijgen alleen een apart besluit.

### P6 - assistentie, governance en schaal

In P6 kan een assistieve laag voorstellen doen op basis van gestructureerde Talentdata, bijvoorbeeld een mogelijke leeractiviteit bij een vastgesteld capabilitygat. Het voorstel blijft zichtbaar als voorstel, bevat de gebruikte bron en vereist menselijke bevestiging. Het systeem schrijft nooit zelfstandig een score, promotie, beoordeling of personeelsbesluit.

Daarnaast maken we de module geschikt voor bredere inzet: bewaartermijnen, auditinzage, exportcontrole, performance op grote tenants, monitoring en releasebeheer worden organisatiebreed herhaald. Functioneel testen we bronherleidbaarheid, menselijke bevestiging, weigering zonder rechten, tenantisolatie en terugdraaibaarheid. AI blijft optioneel en wordt pas gebouwd na een expliciet product- en governancebesluit.

## Buiten scope tenzij opnieuw besloten

AI-loopbaanadvies, automatische geschiktheidsscores, succession, 9-grid, verborgen ranking, automatische promotie- of beloningsbesluiten, ongerichte bulktoegang tot evidence en een tweede employee-, functie-, capability- of opleidingscatalogus.
