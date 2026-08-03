# Talent fase 3 — oplevering, testset en overdracht

## Doel van deze overdracht

P3.0, P3.1, P3.2 en P3.4 zijn gebouwd in de lokale/testfase. Dit document is het functionele handoff-document voor de drie fixtureaccounts en voorkomt dat de volgende taak per ongeluk P4, P5 of P6 start.

De volgorde van de uitgevoerde slice was:

`schema -> RLS/permissions -> service/API -> UI -> tests -> browsergate`

P3.3 en P3.5 zijn op verzoek `GEPARKEERD`. P3.6/LMS is eveneens geparkeerd en wordt niet gebouwd zonder nieuw productbesluit. P4, P5 en P6 zijn alleen roadmap en zijn in deze taak niet gebouwd.

## Actuele besluitupdate 2026-08-03

Snapshot/restore via een providerbranch is op verzoek geschrapt uit de actieve scope. LMS/P3.6 wordt niet gebouwd zonder nieuw besluit. De eerdere Supabase-timeout is voor de gerichte Talentvergelijking aangepakt met scope-indexen, RLS-short-circuiting en lazy rapportopties. `TALENT-NEXT-01` is nu als eerste functionele uitbreiding gebouwd.

## Release-close status 2026-08-03

Functioneel is P3 in de testfase afgerond voor medewerker, manager en HR Admin. De resterende punten hieronder zijn release-hardening of expliciete eigenaar-/kostenbesluiten; ze zijn geen ontbrekende P3-schermflow.

- De drie-rollen releasegate is opnieuw uitgevoerd: 0 echte axe-violations, keyboard-focus op alle toegestane routes en alle negatieve route-, mutatie-, cross-tenant- en self-bound checks geslaagd.
- De interactieve periodefilter is met HR Admin in de Codex-browser toegepast op 2026-01-01 t/m 2026-03-31; alleen de historische records bleven zichtbaar. De aansluitende CSV-export gaf `200` en een download-response.
- De medewerkerlanding gebruikt nu `/dashboard/start`. Een directe medewerker-navigatie naar `/departments` eindigt op `/geen-toegang`; de eerdere rechten/serverfout is daarmee voor deze route opgelost.
- De nieuwe rapportknop `Filters toepassen` voorkomt dat snelle datumwijzigingen elkaar overschrijven. De gekozen filters worden doorgegeven aan lijst, API en CSV-export.
- Tijdens een latere brede herhaling gaf Supabase meerdere bestaande statement-timeouts op brede Talentqueries. Daardoor is het manager-/medewerker-specifieke interactieve rapportbewijs nog niet stabiel opnieuw vastgelegd; dit is een omgevings-/database-hardeningpunt, niet als geslaagde drie-rollenrapporttest claimen.

## Functionele oplevering

### P3.1 — meldingen en opvolging

Talent heeft een eigen minimale meldingenstroom. Een melding bevat alleen gebeurtenistype, korte titel, korte samenvatting, status en een optionele bronverwijzing. Evidence-inhoud, tokens en extra HR-details komen niet in de melding.

De gebruiker kan een melding als gelezen markeren, afhandelen of negeren. Dezelfde gebeurtenis wordt binnen tenant en ontvanger niet dubbel aangemaakt. HR ziet de tenantbrede lijst; manager en medewerker zien alleen hun eigen ontvangerslijst. Een melding verandert nooit de autorisatie.

### P3.2 — doelgesprekken en check-ins

Een doel kan nu een gesprekshistorie hebben met drie expliciete soorten tekst:

- `EMPLOYEE_REFLECTION`: alleen de medewerker schrijft en leest deze eigen reflectie;
- `MANAGER_OBSERVATION`: manager of HR kan een observatie toevoegen binnen de toegestane scope;
- `FOLLOW_UP`: manager of HR kan een vervolgactie met titel en datum vastleggen.

Check-ins hebben RLS, audit, een immutable identiteit en versioning. Een manager kan niet buiten de directe medewerkersscope werken. Er is geen automatische score, beoordeling, promotieadvies of loopbaanbesluit.

### P3.4 — rapportagegeschiedenis

De bestaande Talentrapportage heeft nu periodefilters `Periode vanaf` en `Periode tot en met`. Doelen en capabilityregistraties worden alleen getoond wanneer hun geldigheidsperiode overlapt met de gekozen periode. Dezelfde filters gaan mee naar API, CSV-export en exportaudit. De bestaande rolallowlists en scope blijven leidend.

## Database- en API-resultaat

Toegevoegd en remote toegepast:

- `talent_notifications`, inclusief tenant-FK, recipient-FK, statuscheck, deduplicatie-index, audittrigger, RLS en authenticated-only toegang;
- `talent_goal_check_ins`, inclusief goal/employee-FK's, entry-typecheck, follow-upvelden, versioning, audittrigger, RLS en scopepolicies;
- `create_talent_notification(...)` als SECURITY INVOKER RPC voor veilige deduplicerende aanmaak;
- aanvullende FK-indexen voor de nieuwe tabellen;
- API's voor meldingen, meldingstatus, check-inlijst, check-in aanmaken en check-in wijzigen.

De remote contractproef `apps/hr-suite/supabase/tests/talent_phase3_contract.sql` slaagt. De advisors tonen geen nieuwe securitywaarschuwing voor deze twee tabellen. De nieuwe indexen kunnen in de kleine testtenant als `unused_index`-informatie verschijnen; dat is geen reden om de FK-indexen voor productiegebruik te verwijderen.

## Testset in de database

De seed is idempotent en gebruikt de tenant- en fixtureaccounts op basis van slug/e-mail, niet op hardgecodeerde IDs.

| Onderdeel | Testdata | Functioneel doel |
|---|---|---|
| Capability verleden | `ADAPTABILITY`, 2026-01-01 t/m 2026-06-30, HR ingevoerd | verlopen/historie zichtbaar maken |
| Capability nu | `COACHING`, vanaf 2026-07-01, manager ingevoerd | actuele scope en bron tonen |
| Capability toekomst | `LEADERSHIP`, 2027-01-01 t/m 2027-12-31, HR ingevoerd | toekomstige geldigheid testen |
| Doel verleden | `P3 historisch reflectiedoel`, 2026-01-01 t/m 2026-03-31, `COMPLETED` | historische periodefilter |
| Doel nu | `P3 huidig ontwikkeldoel`, 2026-07-01 t/m 2026-12-31, `ACTIVE`, 45% | doelgesprek en opvolging |
| Doel toekomst | `P3 toekomstig leerdoel`, 2027-01-01 t/m 2027-06-30, `DRAFT` | toekomstige periodefilter |
| Check-ins | employee reflection, manager observation en follow-up op het actuele doel | scheiding van tekst en scope |
| Extra echte write | medewerker heeft via de UI een aanvullende reflection opgeslagen | self-write en herladen testen |
| Meldingen medewerker | `Open ontwikkeldoel`, `Geldigheid controleren` | eigen opvolging |
| Meldingen manager | `Assessment opvolgen`, `Import afgerond`, `Opvolgactie gepland` | directe teamscope opvolgen |

Naast deze P3-set blijven de bestaande M2-doelen en capabilityrecords in de demo-tenant staan voor regressietesten. De fixture-wachtwoorden staan uitsluitend lokaal in `.env.talent-auth.local` en worden niet in documentatie of logs opgenomen.

## Drie-rollen-testplan in Codex-browser op poort 3000

### Voorbereiding

1. Open `http://localhost:3000/login` in de interne Codex-browser.
2. Gebruik per ronde één fixtureaccount uit `.env.talent-auth.local`; kopieer geen wachtwoord naar deze handoff.
3. Wacht na inloggen tot de gebruikersnaam in de header zichtbaar is. Sluit eventueel de algemene product-updatepopup met `Sluiten`, zodat knoppen niet door de popup worden geblokkeerd.
4. Controleer na iedere route dat de pagina-inhoud zichtbaar is; een redirect of HTTP 200 alleen is geen bewijs van een geauthenticeerde flow.
5. Laat de meldingen na een controle bij voorkeur open staan. Als een melding als gelezen/afgehandeld wordt gemarkeerd, noteer dat in de testnotitie of seed de fixture opnieuw.

### Medewerker — `employee.fixture`

| Stap | Route/actie | Verwachte uitkomst | Waarom |
|---|---|---|---|
| 1 | `/my-talent` | Eigen profiel en twee eigen open meldingen: open doel en geldigheid controleren | self-bound Talent en minimale opvolging |
| 2 | `/my-talent/goals` | `P3 huidig ontwikkeldoel` zichtbaar; open `Check-ins openen` | actuele doelworkflow |
| 3 | Actueel doel: lees check-ins | Eigen reflectie zichtbaar; managerobservatie en follow-up zijn niet zichtbaar | afscherming van managertekst |
| 4 | Actueel doel: vul `Notitie` in en kies `Check-in opslaan` | Nieuwe employee reflection wordt opgeslagen en blijft zichtbaar na herladen | self-write, RLS en auditpad |
| 5 | `/my-talent/reports` | Verleden, nu en toekomst staan in de basislijst; periodevelden zijn aanwezig | rapportagehistorie |
| 6 | Rapportage: vul 2026-01-01 t/m 2026-03-31 in, klik `Filters toepassen`; herhaal voor 2026-07-01 t/m 2026-12-31 en 2027-01-01 t/m 2027-06-30 | Alleen de overlappende doel-/capabilityregels blijven over | datumoverlap en self-scope |
| 7 | Klik `CSV exporteren` | CSV-download bevat alleen eigen toegestane gegevens | scherm/API/export gelijk houden |
| 8 | `/workforce/talent` en `/settings/talent` | `/geen-toegang` | server-side routegrens |

### Manager — `manager.fixture`

| Stap | Route/actie | Verwachte uitkomst | Waarom |
|---|---|---|---|
| 1 | `/workforce/talent` | De drie manager-meldingen verschijnen: assessment, import en opvolgactie | directe teamscope en opvolging |
| 2 | `/workforce/talent/goals` | Noah Hendriks en het actuele P3-doel zijn zichtbaar | manager ziet directe scope |
| 3 | Actueel doel: open `Check-ins openen` | Managerobservatie en follow-up zichtbaar; employee reflection blijft afgeschermd | tekstscheiding en privacy |
| 4 | Voeg een managerobservatie of follow-up toe; laad opnieuw | Nieuwe entry blijft zichtbaar voor manager/HR, niet als employee reflection | manager-write en entry-typebeleid |
| 5 | `/workforce/talent/reports` | Doelen/capabilities uit de eigen scope; geen tenantbrede vrije medewerkerselectie | rapportage met scopegrens |
| 6 | Herhaal de drie periodefilters met `Filters toepassen` en CSV-export | Historische, actuele en toekomstige regels filteren; export blijft managergescopeerd | P3.4 en exportaudit |
| 7 | `/settings/talent` en `/settings/talent/import` | `/geen-toegang` | HR-only beheer en import |

### HR Admin — `hradmin.fixture`

| Stap | Route/actie | Verwachte uitkomst | Waarom |
|---|---|---|---|
| 1 | `/settings/talent` | Alle vijf P3-meldingen zijn zichtbaar, zonder extra gevoelige inhoud | tenantbreed beheer |
| 2 | Markeer één melding als gelezen en laad opnieuw | Statuswijziging blijft bewaard; andere meldingen blijven staan | opvolgstatus en idempotentie |
| 3 | `/settings/talent/goals` | Historisch, actueel en toekomstig doel zijn zichtbaar | HR-beheer over tenantdata |
| 4 | Actueel doel: open check-ins | employee reflection, manager observation, follow-up en de extra echte reflection zijn zichtbaar | HR-audit- en beheerscope |
| 5 | `/settings/talent/reports` | Alle drie perioden, statusfilters en CSV-export beschikbaar | tenantrapportage |
| 6 | `/settings/talent/assessments`, `/settings/talent/comparison` en `/settings/talent/import` | Bestaande M2-beheerflows blijven bereikbaar | regressie van de fase-2-basis |

## TALENT-NEXT-01 functionele oplevering

De eerste spiderwebslice is gebouwd als read-only ontwikkelverkenning. De medewerker kiest op `/my-talent/role-explorer` een andere actieve functie en ziet zichzelf tegenover de functievereisten. De manager gebruikt `/workforce/talent/role-explorer` en kan alleen medewerkers uit de directe scope kiezen. HR Admin gebruikt `/settings/talent/role-explorer` en kan tenantbreed een medewerker en doelrol kiezen.

De spiderweb heeft twee lijnen: de gestippelde functievereiste en de gevulde actuele vrijgegeven registratie. Naast de SVG staat altijd een exacte tabel met capability, type, functievereiste, actuele registratie, duiding, bron en geldigheid. Er wordt geen score, ranking of automatisch loopbaanbesluit berekend. Ontbrekende of niet-actuele data wordt expliciet als `GAP` of `UNKNOWN` behandeld; gevoelige evidence-inhoud en privénotities worden niet getoond.

De Supabase-timeout is gericht aangepakt. Nieuwe tenant-/scope-indexen ondersteunen de route, dure manager-scopechecks worden alleen uitgevoerd wanneer nodig en rapportage vraagt niet langer automatisch de volledige capability- en medewerkerskeuzelijsten op. De browserroute voor de drie rollen is daarna opnieuw geladen en levert een vergelijking zonder statement-timeout.

## Spiderweb-testplan met de drie fixtures

| Rol | Route | Testactie | Verwachte uitkomst |
|---|---|---|---|
| Medewerker | `/my-talent/role-explorer` | Kies `TEST-CUSTOMER · v1 · Binnendienst!` en klik `Spiderweb bekijken`. | Alleen de eigen medewerker staat in scope (`Zichtbare medewerkers: 1`); radar, tabel en statusregels verschijnen. Een andere medewerker-ID in de URL geeft geen vergelijking. |
| Manager | `/workforce/talent/role-explorer` | Kies een directe medewerker, bijvoorbeeld `Lucas De Boer · DEMO-029`, kies `TEST-PLANNER · v1 · Binnendienst!` en klik `Spiderweb bekijken`. | De directe managerscope blijft zichtbaar (`Zichtbare medewerkers: 22`); de gekozen medewerker en vier vereisten verschijnen. Een medewerker buiten de scope kan niet via de keuze of URL worden toegevoegd. |
| HR Admin | `/settings/talent/role-explorer` | Kies `Edwin Testbeheerder · DEMO-001`, kies `TEST-MANAGER · v1 · Binnendienst!` en klik `Spiderweb bekijken`. | Tenantbrede lijst verschijnt (`Zichtbare medewerkers: 58`); radar en tabel tonen de vier managervereisten. HR ziet geen evidence-inhoud, alleen bronstatus en geldigheid. |

Controleer per rol ook: de URL bevat `employeeId` en `profileVersionId` na de keuze, de tabel en radar tonen hetzelfde aantal capability-assen, de legenda is niet alleen op kleur gebaseerd, en de status blijft begrijpelijk bij ontbrekende registratie. Test vervolgens met toetsenbord: focus op beide selecties, naar de knop tabben, activeren met Enter en de tabel zonder muis kunnen lezen.

## Uitgevoerde technische checks

- Vitest: 120 testbestanden, 446 tests geslaagd.
- Strict TypeScript-check geslaagd.
- ESLint geslaagd zonder warnings.
- i18n-pariteit geslaagd: 26 namespaces.
- Productiebuild geslaagd: 152 pagina's.
- Remote Talent P3-contractproef, RLS/policies/indexen en advisors gecontroleerd.
- Codex-browser op poort 3000: drie fixtureaccounts opnieuw getest op toegestane routes, meldingen, doelen/check-ins en negatieve routegrenzen; HR Admin heeft de interactieve periodefilter en CSV-export doorlopen.
- Nieuwe drie-rollen axe/keyboard-releasegate: 0 echte violations, keyboard-focus op alle toegestane routes, één thematische `color-contrast`-controle als `incomplete` die handmatige eigenaaracceptatie nodig heeft.
- De standaard medewerkerlanding en directe `/departments`-deny zijn opnieuw in de browser gecontroleerd.

De eerdere M2-gate blijft referentiebewijs voor de grote-dataset-baseline, applicatieve rollback, axe en keyboard-focus. Voor de nieuwe P3-UI is een volledige nieuwe axe/keyboard-herhaling nog een formeel release-hardeningpunt; deze taak claimt die herhaling niet opnieuw.

## Wat nog openstaat

1. Provider snapshot/restore is bewust uitgesloten en wordt niet uitgevoerd.
2. De `axe`- en keyboardgate is technisch opnieuw uitgevoerd. De ene thematische `color-contrast`-`incomplete` heeft nog formele eigenaaracceptatie nodig; er zijn geen echte violations.
3. De interactieve periodefilter/CSV-releaseherhaling per manager en medewerker kan als extra releasebewijs worden herhaald; de gerichte Talent-timeoutfix is inmiddels doorgevoerd. HR Admin-bewijs is geslaagd.
4. De medewerker-/`/departments`-rechtenroute is opgelost: standaardlanding `/dashboard/start`, directe onbevoegde route `/geen-toegang`.
5. P3.6/LMS wordt niet gebouwd zonder een nieuw productbesluit; het staat geparkeerd.
6. P3.7 release-eigenaarsacceptatie, deploymentbewijs en formele releasebeslissing. Geen deployment is uitgevoerd.
7. P3.3 en P3.5 blijven `GEPARKEERD`; er mag geen schema/API/UI voor worden toegevoegd zonder nieuw besluit.
8. P4, P5 en P6 zijn niet gestart en worden niet meegenomen naar de volgende taak.

## Is Talent functioneel afgerond voor de drie rollen?

Ja, in de lokale/testfase is de module bruikbaar als afgeronde P3-module:

- Medewerker: eigen capabilities, geldigheid/historie, doelen, eigen reflecties, meldingen, rapportage en eigen CSV-export.
- Manager: directe teamscope, teamdoelen, managerobservaties en follow-up, meldingen, rapportage en scopegebonden CSV-export.
- HR Admin: tenantbreed Talentbeheer, kwalificaties, functieprofielen, assessments, vergelijking/import, doelen/check-ins, meldingen, rapportage en export.

Dat betekent niet dat de formele productie-release al is vrijgegeven. De thematische contrastacceptatie, eventuele extra interactieve herhaling per rol en P3.7-eigenaarsbesluit blijven releasebesluiten. Provider snapshot/restore is geen releasevoorwaarde binnen deze afgesproken scope.

## Gebouwd item: TALENT-NEXT-01

Dit gebouwde item is bewust geen P4/P5/P6-start. De uitlegbare functieprofiel-radar en ontwikkelverkenning laat de medewerker een andere vrijgegeven functie kiezen, de manager een teamlid binnen scope vergelijken en HR tenantbreed profielkwaliteit bekijken. De spiderweb toont huidig niveau tegenover vereist niveau per capability, met bron, peildatum, geldigheid en `UNKNOWN`/`MISSING`; er is geen totaalscore, verborgen ranking of automatisch loopbaanbesluit.

De volledige afbakening, rollenmatrix, privacyregels en acceptatiecriteria staan in `docs/requirements/Talent/analysis/talent-next-01-functieprofiel-radar-en-ontwikkelverkenning-20260803.md`.

## Leidende instructie voor de volgende Codex-taak

Lees `AGENTS.md`, `docs/README.md`, `docs/delivery/CURRENT_CONTEXT.md` en deze handoff. P4, P5 en P6 niet uitvoeren. Snapshot/restore of een providerbranch niet uitvoeren. LMS/P3.6 niet bouwen zonder nieuw productbesluit. P3.3 en P3.5 blijven `GEPARKEERD`. Kies voor een volgende bouwtaak een nieuw expliciet item of werk een resterend releasebewijs af. Controleer eerst de actuele lokale, remote en browserstatus; maak geen commit, push of deployment zonder expliciete opdracht.

## Historische instructie

> Lees `AGENTS.md`, `docs/README.md`, `docs/delivery/CURRENT_CONTEXT.md` en `docs/delivery/TALENT_P3_TESTPLAN_AND_HANDOFF_20260803.md`. Voer P4, P5 en P6 niet uit. P3 is functioneel afgerond in de testfase. Kies voor een nieuwe bouwtaak alleen `TALENT-NEXT-01` uit `docs/requirements/Talent/analysis/talent-next-01-functieprofiel-radar-en-ontwikkelverkenning-20260803.md`, of werk één expliciet release-hardeningpunt af. Controleer eerst de actuele lokale/remote status. Maak geen providerbranch zonder bevestigde kosten en herstelafspraak. P3.3 en P3.5 blijven `GEPARKEERD`; P3.6 blijft conditioneel op een LMS-/opleidingsbesluit.
