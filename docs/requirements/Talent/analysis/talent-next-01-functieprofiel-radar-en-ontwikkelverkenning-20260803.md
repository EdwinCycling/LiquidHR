# TALENT-NEXT-01 — functieprofiel-radar en ontwikkelverkenning

## Status

Eerste read-only slice gebouwd op 3 augustus 2026 als zelfstandig Talent-item. Dit is geen start van P4, P5 of P6. De slice bevat de drie rolroutes, server-side scopecontrole, een spiderweb naast een exacte toegankelijke tabel en de gerichte Supabase-performancecorrectie.

## Functioneel idee

Maak van de bestaande functieprofielen, capabilityregistraties, niveaus, geldigheid en ontwikkeldoelen een uitlegbare ontwikkelverkenning:

- een medewerker kiest een beschikbare andere functie en ziet een spider/radardiagram met de eigen actuele capabilities tegenover de vereisten van die functie;
- een manager ziet per direct teamlid een radar van de huidige rol en een gekozen doelrol, plus een teamoverzicht van capability-gaten;
- HR kan dezelfde vergelijking tenantbreed gebruiken voor profielbeheer, datakwaliteit en ontwikkelgesprekken;
- de gebruiker ziet naast de visualisatie altijd de bron, peildatum, geldigheid en ontbrekende gegevens.

De radar is een leesvorm, geen totaalscore. Een capability zonder actuele vrijgegeven registratie blijft `UNKNOWN` of `MISSING`, niet automatisch nul. Er wordt geen promotie-, selectie-, belonings- of geschiktheidsbesluit uit afgeleid.

## Waarom dit logisch aansluit

De huidige Talentmodule heeft al de benodigde bouwstenen: functieprofielversies, capabilityvereisten, niveau-model, individuele records, vergelijking, doelen, check-ins en rapportage. Het nieuwe item voegt vooral een begrijpelijke gebruikersweergave en een ontwikkelactie toe, zonder een tweede functie- of skillswereld te maken.

Actuele HR-productpatronen bevestigen drie bruikbare richtingen:

- Microsoft beschrijft skillprofielen, door gebruikers bevestigde skills, hiërarchieën en skill-gap-verkenning als basis voor leren en loopbaanontwikkeling in [People Skills en de skills-landschaprapportage](https://learn.microsoft.com/en-us/viva/insights/advanced/analyst/templates/skills-landscape).
- SAP koppelt ontwikkeldoelen aan competenties en leeractiviteiten en ondersteunt rapportage over die combinatie in [Career Development Planning](https://help.sap.com/docs/successfactors-succession-and-development/implementing-and-managing-career-development-planning/development-goals).
- Workday beschrijft skills-gaps en interne mobiliteit als toepassingen van een skillsmodel in de [Skills Cloud-datasheet](https://www.workday.com/content/dam/web/en-us/documents/datasheets/workday-skills-cloud-datasheet-enus.pdf).

Deze bronnen onderbouwen het patroon, niet een keuze voor automatische AI-inferentie in LiquidHR. Voor LiquidHR blijft de veilige variant brongebaseerd en handmatig uitlegbaar.

## Rollen en zichtbaarheid

| Rol | Kan zien | Mag doen | Niet tonen |
|---|---|---|---|
| Medewerker | eigen actuele radar en door HR vrijgegeven doelrollen | doelrol kiezen, detail van het capabilityverschil openen, een ontwikkeldoel/check-in starten | teamgegevens, managernotities, verborgen beoordelingen |
| Manager | radar per direct teamlid en teambeeld binnen bestaande scope | doelrol kiezen binnen toegestane functiefamilies, ontwikkelactie voorstellen of opvolgen | medewerkers buiten scope, HR-only concepten, privéreflecties |
| HR Admin | tenantbrede functie- en teambeelden | functieprofielen beheren, datakwaliteit en ontbrekende brongegevens controleren | evidence-inhoud en gevoelige persoonsgegevens die niet nodig zijn |

## Voorgestelde schermen

1. `/my-talent/role-explorer`: doelrol kiezen, radar huidige versus doelrol, capabilitydetail en knop `Maak ontwikkeldoel`.
2. `/workforce/talent/role-explorer`: medewerker- en doelrolkeuze binnen manager-scope, met teamfilter.
3. `/settings/talent/role-explorer`: HR-tenantbeeld, profielversie/peildatum en datakwaliteitslijst.

Voor deze eerste slice zijn de genoemde routes, keuzes, radar en tabel gebouwd. De knop voor directe doelkoppeling, een apart teamfilter en een uitgebreide datakwaliteitslijst zijn bewust doorgeschoven naar een volgende expliciete slice.

De radar moet ook als toegankelijke tabel beschikbaar zijn. Gebruik bijvoorbeeld de kolommen capability, huidig niveau, vereist niveau, bron, geldigheid en volgende actie. Kleur is nooit de enige betekenis.

## Gebouwd in deze slice

- `/my-talent/role-explorer`: medewerker kiest een actieve andere functie en vergelijkt zichzelf.
- `/workforce/talent/role-explorer`: manager kiest een medewerker uit de directe scope en een actieve doelrol.
- `/settings/talent/role-explorer`: HR Admin kiest tenantbreed een medewerker en actieve doelrol.
- De spiderweb toont functievereiste als gestippelde lijn en actuele vrijgegeven registratie als gevulde lijn.
- De tabel toont per capability type, vereiste, actuele registratie, status, bron en geldigheid; de tabel is de exacte toegankelijke tegenhanger van de visualisatie.
- Statussen blijven uitlegbaar: `MATCH`, `GAP`, `MISSING_EVIDENCE` en `UNKNOWN`; er is geen fit-score, ranking of automatische beslissing.
- Alleen actuele `RELEASED`-records worden als actuele registratie getoond. Concepten, verlopen records en ontbrekende brongegevens lekken niet als actuele evidence door.
- De native GET-keuze houdt medewerker- en profielselectie in de URL, zodat een vergelijking reproduceerbaar en deelbaar binnen dezelfde autorisatiescope is.
- De remote performancefix beperkt dure Talent-capabilityopties tot een gerichte vergelijking en laat de manager-scopecheck kortsluiten wanneer die niet nodig is.

## Technische afbakening voor een volgende uitbreiding

- Hergebruik `talent_job_profile_readmodel`, actieve profielversies, `job_profile_capability_requirements` en de bestaande comparison-service.
- Voeg alleen een read-model/API toe als de bestaande comparison-DTO niet volstaat; geen parallelle capability- of functie-entiteiten.
- Bereken geen totaalscore en sla geen afgeleide `fit_score` op zonder nieuw productbesluit.
- Leg peildatum, profielversie en recordstatus vast in de response zodat de radar reproduceerbaar is.
- Behoud server-side permissions en RLS: doelrolkeuze mag geen scopegrens of tenantgrens omzeilen.
- Koppel een ontwikkelactie aan een bestaand doel/check-in; maak geen tweede taken- of leerwereld.
- Voeg lege, onbekende, verlopen en niet-vrijgegeven situaties als expliciete testgevallen toe.

## Acceptatie in een volgende taak

- Medewerker kan alleen zichzelf vergelijken en kan een doelrol selecteren die voor hem/haar is vrijgegeven.
- Manager kan alleen directe medewerkers en geautoriseerde doelrollen selecteren.
- HR kan tenantbreed bekijken en ziet profielversie, peildatum en ontbrekende broninformatie.
- De radar en de toegankelijke tabel geven dezelfde rijen en statussen.
- Verleden, huidige en toekomstige geldigheid leveren voorspelbare resultaten op.
- Geen privéreflectie, managernotitie, evidence-inhoud of verborgen score lekt naar een onbevoegde rol.
- Bij ontbreken van actuele data verschijnt `UNKNOWN`/`MISSING`, met een concrete ontwikkelactie.

De drie basisrolflows zijn in deze slice uitgevoerd. Een vervolgslice kan de uitlegbare tabel uitbreiden met een expliciete ontwikkelactie die aan een bestaand doel/check-in wordt gekoppeld; dat is bewust nog niet toegevoegd.

## Besluit dat vóór bouw nodig is

Bevestig of de doelrolkeuze alleen als persoonlijke ontwikkelverkenning dient, of ook als formele interne-mobiliteitsworkflow. Mijn advies voor de eerste slice is alleen ontwikkelverkenning: laag risico, direct testbaar en passend bij de bestaande Talentgegevensbescherming.
