# Uitvoeringsplan voor Luna — HR-groepen, administraties, verlof en verzuim

Status: **STAP 1 UITGEVOERD; STAP 2–9 NOG TE DOEN**  
Datum: **2026-08-05**  
Repository: LiquidHR  
Doel: de bestaande testdatabase en applicatie ombouwen naar het afgesproken HR-groepmodel.

Dit plan is uitvoerbaar vanaf de repositoryroot. Luna voert de stappen in volgorde uit en rapporteert na iedere stap: gewijzigd, getest, geblokkeerd en nog open.

## 0. Niet-onderhandelbare werkwijze

- Lees eerst [AGENTS.md](../../AGENTS.md), [docs/README.md](../README.md), [CURRENT_CONTEXT.md](CURRENT_CONTEXT.md) en [CODING_STANDARDS.md](../../CODING_STANDARDS.md).
- Bewaar alle bestaande wijzigingen van Edwin. Gebruik geen `git reset --hard`, `git checkout --`, brede delete of ongeautoriseerde restore.
- Gebruik geen subagents tenzij Edwin dat expliciet vraagt.
- Werk steeds in deze volgorde: `schema → RLS/permissions → server/API → UI → tests → delivery-documentatie`.
- Gebruik strict TypeScript en geen `any`.
- Iedere nieuwe publieke tabel krijgt RLS, policies, indexes, grants en audit in dezelfde migratie.
- Geen productie- of remote writes zonder expliciete opdracht. De huidige data is testdata; een testmigratie mag later gecontroleerd worden uitgevoerd.
- Deactiveer-, verwijder-, merge- en splitgedrag wordt niet in deze eerste slice gebouwd.
- Alle huidige databasegegevens zijn synthetische testdata. Bouw daarom geen fallback, compatibiliteitslaag, dual-read, dual-write of legacy-pad voor bestaande records.
- Bestaande testrecords mogen in een gecontroleerde, reproduceerbare migratie worden aangepast, opnieuw gekoppeld of opnieuw geseed. Zij mogen geen belemmering vormen voor het nieuwe model.
- Oude administratie-/tenant-scopekolommen, filters, RPC-parameters en constraints mogen worden vervangen of verwijderd zodra de nieuwe testmigratie en tests dit dekken.

## Doelmodel

Lees vóór iedere technische beslissing [HR_GROEP_SCOPE_EN_INRICHTING.md](../requirements/multitenancy/HR_GROEP_SCOPE_EN_INRICHTING.md), [ADR-0009](../decisions/ADR-0009-hr-groepen-als-zichtbaarheids-en-inrichtingsgrens.md) en [FDR-0006](../decisions/FDR-0006-parallel-verzuim-per-dienstverband.md).

De primaire context is:

```text
HR-groep → eventueel administratie → onderdeel
```

Een persoon bestaat één keer binnen een HR-groep en heeft nul of meerdere dienstverbanden. Een dienstverband hoort bij één administratie, afdeling en functie. Bedrijf, locaties, afdelingen, functies, rollen, verlofregels en verzuiminstellingen zijn groepsbreed. Salaris, payroll, CAO, verlofsaldo en verzuimcasus blijven gekoppeld aan het dienstverband of de administratie zoals in de ownershipmatrix is vastgelegd.

Verzuim mag gelijktijdig bestaan op verschillende dienstverbanden en HR-groepen. Alleen overlap binnen hetzelfde dienstverband wordt geblokkeerd.

## Stap 1 — Documentatie, ADR’s en domeinbaseline

**Status: UITGEVOERD op 2026-08-05.** Deze stap is door Codex uitgevoerd. Luna moet de documenten hieronder lezen en op eventuele resterende tegenstrijdigheden controleren, maar hoeft geen tweede ontwerp voor deze baseline te maken.

### Doel

Maak de repositorydocumentatie de bron van waarheid voordat schema- of codewijzigingen beginnen.

### Te lezen en bij te werken documenten

- [HR-groep scope](../requirements/multitenancy/HR_GROEP_SCOPE_EN_INRICHTING.md)
- [Multitenancy](../requirements/multitenancy/MULTITENANCY_EN_MULTI_ADMINISTRATIE.md)
- [Entiteiteigendom](../requirements/multitenancy/ENTITEIT_EIGENAARSCHAP_EN_KOPPELMODEL.md)
- [Contract en dienstverband](../requirements/employment/CONTRACT_EN_DIENSTVERBAND.md)
- [Bedrijf en locaties](../requirements/employment/BEDRIJF_EN_LOCATIE_PER_DIENSTVERBAND.md)
- [Afdelingen en rollen](../requirements/organization/AFDELINGEN_EN_ROLLEN.md)
- [Verlof-engine](../requirements/leave/VERLOF_OPBOUW_ENGINE.md)
- [Verlof aanvragen](../requirements/leave/VERLOF_AANVRAAG_HR_ADMIN.md)
- [Verzuim](../requirements/absence/VERZUIM_EN_HERSTEL.md)
- [Verzuiminstellingen](../requirements/absence/VERZUIM_INSTELLINGEN.md)
- [ADR-0009](../decisions/ADR-0009-hr-groepen-als-zichtbaarheids-en-inrichtingsgrens.md)
- [FDR-0006](../decisions/FDR-0006-parallel-verzuim-per-dienstverband.md)

### Werkzaamheden

1. Markeer de oude `SEPARATE`/`COMBINED`-documentatie als historische baseline.
2. Verwijder geen historische besluiten, maar verwijs overal naar het nieuwe HR-groepdocument.
3. Corrigeer `Employee` naar HR-groep-scope.
4. Corrigeer CAO naar vast per dienstverband.
5. Corrigeer bedrijf en locaties naar HR-groep-scope.
6. Corrigeer verlofregels naar HR-groep-scope en saldo naar dienstverband-scope.
7. Corrigeer verzuim naar employment-scope met parallel verzuim over employments heen.
8. Voeg de nieuwe scope- en keuzecriteria toe aan `docs/README.md`, `CURRENT_CONTEXT.md` en `IMPLEMENTATION_STATUS.md`.

### Resultaat

De actuele documentatie staat in [HR_GROEP_SCOPE_EN_INRICHTING.md](../requirements/multitenancy/HR_GROEP_SCOPE_EN_INRICHTING.md), [ADR-0009](../decisions/ADR-0009-hr-groepen-als-zichtbaarheids-en-inrichtingsgrens.md), [FDR-0006](../decisions/FDR-0006-parallel-verzuim-per-dienstverband.md) en dit plan. Luna moet deze documenten rechtstreeks volgen.

### Klaar wanneer

- Geen leidend document zegt nog dat HR-groepen ontbreken.
- Geen leidend document blokkeert verzuimoverlap over verschillende dienstverbanden.
- De nieuwe ADR/FDR en dit plan zijn gelinkt vanuit de documentatie-index.

## Stap 2 — Code-, schema- en testinventarisatie

### Doel

Breng de huidige administratiegebonden implementatie volledig in kaart voordat er een migratie wordt geschreven. De inventarisatie is bedoeld om te bepalen wat vervangen moet worden, niet om het oude model blijvend te ondersteunen.

### Te onderzoeken code

- Context: `apps/hr-suite/lib/context/*`
- Autorisatie: `apps/hr-suite/lib/auth/*`, `user_access` en policies
- Control Plane: `apps/liquidhr-control/*`
- Administraties: `apps/hr-suite/lib/administration/*` en relevante API-routes
- Personen/dienstverbanden: `apps/hr-suite/lib/employment/*`
- Organisatie/rollen: `apps/hr-suite/lib/organization/*`
- Bedrijf/locaties: `apps/hr-suite/lib/company-data/*`
- Verlof: `apps/hr-suite/lib/leave/*`, `/api/leave` en `/settings/leave-accrual`
- Verzuim: `apps/hr-suite/lib/absence/*`, `/api/absence` en `/settings/absence`

### Inventarisatie-output

Maak een tabel met per tabel en service:

- huidige eigenaar/scope;
- gewenste eigenaar/scope;
- bestaande foreign keys en constraints;
- bestaande RLS/policies/grants;
- betrokken API-routes;
- betrokken UI-schermen;
- testbestanden die moeten wijzigen.

Controleer specifiek of verzuimoverlap nu op `employee_id` of op `employment_id` wordt geblokkeerd. Een blokkade op alleen `employee_id` moet worden gemarkeerd als fout voor dit doelmodel en vervangen. Er mag geen fallback blijven bestaan voor oude records.

### Klaar wanneer

- Er is een expliciete mapping van huidige naar gewenste scope.
- Iedere bestaande administratiegebonden tabel heeft een migratiebesluit.
- Er is geen onbekende route die nog rechtstreeks tenantbrede gegevens leest.

## Stap 3 — Schema, foreign keys, RLS en testmigratie

### Doel

Leg HR-groepen en de nieuwe eigendomsgrenzen database-side vast.

### Datamodel

Voeg of wijzig minimaal:

- `hr_groups` met tenant, naam, omschrijving en auditvelden;
- HR-groepkoppeling op `administrations` met naam en administratienummer;
- groepsgebonden persoon en eventueel een technische login-/identiteitskoppeling;
- groepsgebonden bedrijf en locaties;
- groepsgebonden afdelingen, functies, roltoewijzingen en organisatiecatalogi;
- groepsgebonden verlofregels, profielen, medewerker sets en instellingen;
- groepsgebonden verzuiminstellingen;
- employment-scoped verlofsaldi, boekingen en verzuimcasussen.

### Constraints

- Een administratie hoort bij precies één HR-groep.
- Een bestaande administratie kan niet worden verplaatst via normale writes.
- Een administratie wordt niet verwijderd; deactivering wordt als latere lifecyclefase voorbereid maar niet in deze slice gebouwd.
- Een HR-groep wordt niet verwijderd zolang er administraties of historische gegevens aan gekoppeld zijn.
- Een dienstverband en zijn administratie hebben dezelfde HR-groep.
- Een afdeling, functie, locatie en roltoewijzing horen bij de geselecteerde HR-groep.
- Een CAO op een bestaand dienstverband kan niet worden gewijzigd.
- Maximaal drie actieve CAO’s per administratie.
- Verzuimoverlap wordt alleen op hetzelfde `employment_id` geweigerd.
- Verzuim op verschillende employments, administraties en HR-groepen blijft toegestaan.

### Testdata

Gebruik een gecontroleerde, idempotente migratie of seed voor de huidige testdata. Maak een expliciete mapping van bestaande administraties naar HR-groepen. Omdat alle data testdata is, mag de migratie bestaande records aanpassen, opnieuw koppelen of vervangen. Bouw geen productiecompatibiliteit en geen fallback voor het oude model.

### Verificatie

- migratie dry-run;
- RLS-policycontrole;
- foreign-key- en indexcontrole;
- Supabase advisors;
- regeneratie van `packages/db/types.ts`;
- database-integratietests;
- negatieve cross-group tests.

### Klaar wanneer

De database kan geen cross-group write accepteren en blokkeert geen legitiem parallel verzuim op twee verschillende dienstverbanden.

## Stap 4 — Context, autorisatie en Control Plane

### Doel

Maak HR-groep de eerste switch en houd administratie optioneel.

### Servercontext

Vervang de huidige contextgedachte door:

```text
tenant
hrGroups
activeHrGroup
administrationsInActiveHrGroup
activeAdministration?
```

De server moet bij iedere request controleren:

- gebruiker heeft toegang tot de tenant;
- gebruiker heeft toegang tot de HR-groep;
- gekozen administratie behoort tot de HR-groep;
- onderdeel gebruikt groeps- of administratiecontext volgens de ownershipmatrix.

### Rechten

- Edwin/Control Plane: HR-groepen aanmaken en initiële inrichting.
- HR-admin: switchen tussen toegestane HR-groepen, groepsinrichting beheren en administraties binnen de gekozen groep aanmaken.
- Niemand: bestaande administratie naar een andere groep verplaatsen.
- Normale gebruikers: alleen hun toegewezen groeps- en managementscope.

### Verificatie

- contextwissel groep A/B;
- poging om administratie van B in A te selecteren;
- HR-admin mag nieuwe administratie in actieve groep maken;
- normale gebruiker mag geen HR-groep aanmaken;
- RLS weigert gemanipuleerde group- en administration-ID’s.

## Stap 5 — Bedrijf, administraties en locaties

### Doel

Maak het onderscheid tussen groepsbrede bedrijf/locaties en administratiegebonden administratiegegevens zichtbaar.

### UX

Onder de geselecteerde HR-groep:

- Bedrijf;
- Locaties;
- Administraties.

Onder een administratie:

- naam;
- administratienummer;
- externe/salariskoppeling;
- administratiegebonden gegevens.

### Regels

- HR-admin mag administratienaam en -nummer wijzigen.
- Het interne administratie-ID blijft stabiel.
- Een locatie kan door alle employments in dezelfde HR-groep worden gebruikt.
- Een employment mag nooit een locatie uit een andere HR-groep krijgen.
- Een wijziging van locatie op een employment blijft een employment-plaatsing/tijdlijn, maar verandert de eigendom van de locatie niet.

### Verificatie

- bedrijf uit groep A niet zichtbaar in B;
- locatie uit A niet selecteerbaar voor employment in B;
- administratie A-nummer wijzigen zonder bestaande foreign keys te breken;
- bedrijf en locaties zonder administratiekeuze kunnen beheren.

## Stap 6 — Personen, dienstverbanden, organisatie en rollen

### Doel

Maak personen en operationele organisatie groepsgebonden, terwijl dienstverbanden administratiegebonden blijven.

### Personen en employments

- persoon: nul of meerdere employments;
- employment: administratie, afdeling, functie en vaste CAO;
- meerdere actieve employments zijn toegestaan;
- hoofddienstverband is uitsluitend een UX-keuze;
- dezelfde persoon kan per HR-groep eigen persoons- en zakelijke e-mailgegevens hebben.

### Organisatie

- afdelingen en functies binnen HR-groep;
- plaatsing van employment naar afdeling/functie;
- meerdere leidinggevenden per afdeling;
- één leidinggevende voor meerdere afdelingen;
- aparte autorisatie als dezelfde persoon in meerdere HR-groepen leidinggevende is.

### Roltoewijzing

De roltoewijzing moet eerst HR-groep en daarna afdeling bepalen. De lijsten voor:

- toewijzen vanaf medewerker;
- toewijzen vanaf afdeling;
- afdelingen zonder leidinggevende;
- bestaande roltoewijzingen;

moeten dezelfde groepsscope gebruiken.

### Verificatie

- afdeling A verschijnt niet in groep B;
- twee leidinggevenden op één afdeling;
- één leidinggevende over twee administraties binnen één groep;
- één leidinggevende in twee groepen met aparte autorisatie;
- medewerker met meerdere employments wordt per employment correct getoond.

## Stap 7 — Verlofregels op HR-groep, saldo op dienstverband

### Doel

Voorkom dubbel beheer door verlof één keer per HR-groep in te richten.

### Datamodel en regels

- verloftypen, profielen en opbouwregels: HR-groep;
- medewerker sets: HR-groep;
- uitzonderingen: gekoppeld aan een dienstverband;
- saldo, buckets, grootboek en aanvragen: dienstverband;
- geen persoonsbreed verlofsaldo;
- CAO-filtering mag een medewerker set gebruiken, maar wijzigt de vaste CAO van het dienstverband niet.

Voorrang:

```text
dienstverbanduitzondering → medewerker set → HR-groepstandaard
```

### Dienstverbandkeuze

- bij één actief passend employment automatisch;
- bij meerdere employments keuze met afdeling/functie/administratie;
- vanuit een leidinggevende-afdeling automatisch wanneer exact één match;
- anders altijd expliciete keuze.

### Verificatie

- twee employments hebben twee saldi;
- groepsregel wordt voor alle administraties gebruikt;
- medewerker set wijkt af;
- individuele employment-uitzondering wint;
- verlof uit groep A verschijnt niet in B;
- managerflow kiest employment via afdeling/functie.

## Stap 8 — Verzuim per dienstverband, parallel toegestaan

### Doel

Ondersteun het praktijkgeval waarin iemand voor één functie hersteld is en voor een andere functie ziek blijft.

### Regels

- verzuiminstellingen: HR-groep;
- casus en ziekteperiode: employment;
- overlap binnen hetzelfde employment: blokkeren;
- overlap tussen verschillende employments: toestaan;
- overlap tussen verschillende HR-groepen: toestaan;
- herstel op employment 1 verandert employment 2 niet;
- vierwekenketen per employment;
- geen persoonsbrede verzuimstatus.

### Shared resolver

Gebruik dezelfde employment resolver als bij verlof:

1. geselecteerde HR-groep;
2. medewerker;
3. afdeling/functie vanuit managercontext;
4. één match automatisch;
5. meerdere matches keuze tonen;
6. geen match blokkeren;
7. server valideert opnieuw.

### Verplichte tests

1. Zelfde employment, overlappende ziekteperioden: weigeren.
2. Twee employments, overlappende ziekteperioden: accepteren.
3. Twee HR-groepen, overlappende ziekteperioden: accepteren.
4. Portier 50% hersteld, badmeester 50% ziek: accepteren.
5. Herstel op employment 1 laat employment 2 onveranderd.
6. Manager met één afdelingsmatch: automatisch kiezen.
7. Manager met meerdere matches: keuze tonen.
8. Employment uit andere groep: weigeren zonder groepsgegevens te onthullen.

## Stap 9 — Integrale verificatie, browserbewijs en handoff

### Technische verificatie

Voer na de volledige slice uit:

- gerichte unit- en integratietests;
- RLS- en negatieve autorisatietests;
- `npm.cmd run check:i18n --workspace @liquid-hr/hr-suite`;
- strict typecheck;
- gerichte en volledige lintcontrole;
- productiebuild;
- Supabase advisors;
- `packages/db/types.ts` opnieuw genereren;
- `git diff --check`.

### Browserflows op poort 3000

Controleer ingelogd met HR-admin:

1. groep A selecteren;
2. bedrijf, locaties en administraties van A bekijken;
3. naar groep B switchen;
4. bevestigen dat de inhoud volledig wisselt;
5. administratie toevoegen met naam en nummer;
6. naam en nummer wijzigen;
7. verlofregel op groepsniveau beheren;
8. medewerker met twee employments openen;
9. employment kiezen via afdeling/functie;
10. verlofsaldo per employment bekijken;
11. ziekmelding op employment 1 doen;
12. herstel op employment 1 registreren;
13. ziekmelding op employment 2 laten bestaan;
14. managerflow vanuit afdeling testen;
15. roltoewijzing met meerdere leidinggevenden testen.

Controleer ook 390px-weergave, URL-state, foutmeldingen en browserconsole.

### Handoff

Werk na afronding bij:

- [CURRENT_CONTEXT.md](CURRENT_CONTEXT.md);
- [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md);
- [docs/README.md](../README.md).

Noteer daar:

- welke migraties zijn gemaakt en uitgevoerd;
- welke tests geslaagd zijn;
- welke browserflows zijn gecontroleerd;
- welke open punten naar de latere deactivatiefase gaan;
- dat merge, push en deployment niet automatisch zijn uitgevoerd.

## Definition of Done

De slice is pas klaar wanneer schema, RLS, API, UI, tests en documentatie hetzelfde model beschrijven:

- HR-groep is de primaire switch en zichtbaarheidgrens;
- administratie is een vaste groepstoewijzing met naam en nummer;
- bedrijf en locaties zijn groepsbreed;
- verlofregels zijn groepsbreed en saldo employmentgebonden;
- verzuim is employmentgebonden en parallel over employments toegestaan;
- CAO is vast binnen een employment;
- roltoewijzingen zijn groepsgebonden;
- testdata is gecontroleerd gemigreerd;
- er is browserbewijs voor HR-admin, manager en meerdere actieve employments;
- de code bevat geen legacy fallback, dual-read, dual-write of uitzonderingspad voor de oude tenant-/administratiescope;
- bestaande testdata is geen reden om oude scope-semantiek in stand te houden;
- de nieuwe testmigratie is reproduceerbaar en alle relevante testrecords zijn naar HR-groep-scope gebracht.
