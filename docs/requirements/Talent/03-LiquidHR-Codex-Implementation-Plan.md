# LiquidHR Workforce & Talent Management
## Codex Implementation Plan v1.0

> **Voor agentic workers:** voer dit plan taak voor taak uit. Gebruik per taak een aparte reviewbare wijziging. Begin nooit aan een volgende taak zolang de test- en reviewgate van de huidige taak niet is geslaagd.

**Auteur:** Edwin Dingjan  
**E-mail:** edwin@editsolutions.nl  
**Datum:** 31 juli 2026

**Doel:** de Talent Foundation uit Product Blueprint v2.0 gecontroleerd toevoegen aan de bestaande LiquidHR-applicatie, zonder bestaande HR-functionaliteit te beschadigen en zonder fase 2-functionaliteit te bouwen.

**Architectuur:** domain-first uitbreiding binnen de bestaande LiquidHR-conventies. Eerst repositoryanalyse en securityfundament, daarna stamgegevens en functiehuis, vervolgens profielversies, UI, read-only Workforce/My Talent en ten slotte hardening.

**Technologiestack:** wordt feitelijk vastgesteld in Stap 0. Codex mag geen framework, ORM, state library of testtool introduceren zonder repositorybewijs en expliciete technische noodzaak.

---

## Globale constraints

### Ownershipregel voor de testfase

Het functiehuis en de Talent Foundation zijn tenant-owned. `employees` blijft de tenantbrede persoon; `employments` en concrete employee-organization-plaatsingen blijven administration-owned en verwijzen naar dezelfde tenant-owned functiebron. In de testfase bestaat uitsluitend demo-data. Nieuwe implementatiestappen verwijderen daarom oude administrationele compatibilitykolommen en filters zodra bestaande demo-relaties veilig zijn genormaliseerd; een parallelle catalogus of blijvende writeable compatibilitylaag is niet toegestaan. Een administratie-afdeling is alleen toegestaan via expliciete `scope_type = 'ADMINISTRATION'` met verplichte administratie-FK.

- Product Blueprint v2.0 is autoritatief.
- UI-001 tot en met UI-013 zijn ondersteunende conceptreferenties.
- Geen AI, import, assessment, approval, review, publish, profile comparison, Team Talent analytics, Skills Matrix, 9-grid, succession of LMS in fase 1.
- HR Admin beheert; Manager en Medewerker zijn read-only binnen scope.
- Functiefamilie is optioneel; Functiegroep → Functie is voldoende.
- Senioriteit is optioneel per functie en tenantconfigureerbaar.
- Eén tenantbreed dynamisch Talent Level Model; vergrendeld na eerste gebruik.
- Eén generieke Capability-entiteit met vijf UI-typen.
- Eén logisch functieprofiel per functie met datumgebonden versies.
- Functiefamilies, functiegroepen, functies, senioriteiten, levels, capabilities en profielen zijn tenant-owned; employments, plaatsingen en alle juridische/financiële uitvoering zijn administration-owned.
- Een persoon heeft één tenantbrede employee-ID en kan meerdere administrationele employment-ID's hebben die naar dezelfde tenantfunctie verwijzen.
- Ownership en access scope blijven gescheiden; de administratiecookie mag tenant-owned catalogi niet vernauwen.
- Geen fictieve dashboarddata.
- Alle beheeracties auditbaar.
- Tenantisolatie en server-side autorisatie zijn release blockers.
- Tests worden gericht uitgevoerd na iedere taak; volledige regressie op milestonegrenzen.

---

# Milestone 0 — Baseline en ontwerp

## Taak 0.1 — Werkruimte veiligstellen

**Doel:** voorkomen dat architectuurwerk of implementatie de actieve ontwikkeltak vervuilt.

- [ ] Controleer `git status` en leg alle bestaande lokale wijzigingen vast of stash deze volgens de projectconventie.
- [ ] Maak een afzonderlijke featurebranch of geïsoleerde worktree voor Talent Foundation.
- [ ] Noteer huidige commit-SHA en actieve releaseversie.
- [ ] Draai de bestaande snelle baseline-tests en noteer reeds aanwezige failures.
- [ ] Commit geen gegenereerde build-artifacts of secrets.

**Gate:** schone, reproduceerbare werkruimte en vastgelegde baseline.

## Taak 0.2 — Repositoryanalyse

**Input:** Product Blueprint, AI Architecture Instructions en Acceptance Test Pack.

- [ ] Lees alle repository-instructies.
- [ ] Maak een kaart van routes, modules, database, auth, tenantcontext, permissions, design system, tests en CI.
- [ ] Zoek bestaande implementaties van employees, employment, functions, function groups, tags, audit en settings.
- [ ] Zoek half-afgebouwde Talent-code en bepaal of hergebruik veilig is.
- [x] Classificeer iedere gevonden entiteit als tenant-owned, administration-owned of expliciete scopevariant volgens `docs/requirements/multitenancy/ENTITEIT_EIGENAARSCHAP_EN_KOPPELMODEL.md`.
- [ ] Controleer specifiek dat bestaande `jobs`, `job_groups`, `job_revisions` en functie-plaatsingen niet dezelfde scope krijgen: catalogus tenant, plaatsing administratie.
- [ ] Leg twee-administratiecases vast: één persoon met twee employments en één gedeelde tenantfunctie.
- [ ] Leg concrete bestandspaden vast in `talent-file-map.md`.
- [ ] Leg verschillen met de Blueprint vast in `talent-gap-analysis.md`.
- [ ] Leg het technische ontwerp vast in `talent-technical-design.md`.

**Gate:** geen implementatie voordat de file map, gap analysis en technical design intern consistent zijn.

## Taak 0.3 — Test- en securityontwerp

- [ ] Map alle kritieke acceptance tests naar testlagen en concrete bestanden.
- [ ] Definieer tenant- en roltestfixtures.
- [ ] Definieer negatieve RLS/API-testcases.
- [ ] Definieer migratie- en backfillstrategie voor bestaande functies.
- [ ] Controleer dat geen bestaande employee/function-relatie wordt gedupliceerd.

**Gate:** securitydesign en migratieplan zijn uitvoerbaar en bevatten geen open productvragen.

### Milestone 0 review

- [ ] Geen codefunctionaliteit toegevoegd.
- [ ] Bestaande stack en conventions zijn feitelijk vastgesteld.
- [ ] Alle productconcepten hebben een technische eigenaar/module.
- [ ] De implementatievolgorde hieronder is aangepast aan echte repositoryafhankelijkheden zonder productscope te wijzigen.

---

# Milestone 1 — Tenant, permissions en auditfundament

## Taak 1.1 — Centrale Talent-permissions

**Doel:** één betrouwbare autorisatielaag voor alle volgende taken.

- [ ] Schrijf failing tests voor HR Admin, Manager, Medewerker en cross-tenant scenario’s.
- [ ] Implementeer centrale permission checks volgens bestaande architectuur.
- [ ] Scheid tenantbrede cataloguspermissions van administrationele employment-/plaatsingspermissions.
- [ ] Voeg expliciete checks toe voor manage configuration, read profile, read own Talent en manager scoped read.
- [ ] Zorg dat UI en server dezelfde conceptuele permissions gebruiken, maar server autoritatief blijft.
- [ ] Draai gerichte permissiontests.

**Resultaat:** volgende features gebruiken geen losse rolstrings.

## Taak 1.2 — Audituitbreiding

- [ ] Onderzoek bestaande auditservice en eventschema.
- [ ] Schrijf tests voor create/update/activate/inactivate en denied privileged action.
- [ ] Breid audit uit met objecttype, object-ID, actor, tenant, before/after en correlation ID.
- [ ] Maak audit append-only en uitsluitend voor HR Admin leesbaar.
- [ ] Test dat gevoelige profielteksten niet onnodig in operationele logs belanden.

## Taak 1.3 — Feature- en routebescherming

- [ ] Voeg module/feature gating toe volgens bestaande conventie.
- [ ] Bescherm Settings → Talent voor HR Admin.
- [ ] Bescherm Workforce Talent voor HR Admin en Manager.
- [ ] Bescherm My Talent voor de ingelogde medewerker.
- [ ] Test directe URL- en API-toegang, niet alleen navigatiezichtbaarheid.

### Milestone 1 gate

- [ ] Alle negatieve rol- en tenanttests slagen.
- [ ] Geen service-role secret in clientcode.
- [ ] Auditbasis is beschikbaar voor volgende commands.
- [ ] Bestaande auth-regressietests slagen.

---

# Milestone 2 — Talent Level Model en Senioriteit

## Taak 2.1 — Datamodel Talent Level Model

- [ ] Voeg migratie toe voor één model per tenant en geordende levels.
- [ ] Voeg unieke en tenantconsistente constraints toe.
- [ ] Schrijf database-tests voor één model per tenant, unieke levels en sorteervolgorde.
- [ ] Voeg status `configurable` en `in_use` toe.
- [ ] Voeg indices toe voor tenant/model queries.

## Taak 2.2 — Level Model services

- [ ] Schrijf failing tests voor initialiseren, levels toevoegen, herschikken en opslaan vóór gebruik.
- [ ] Implementeer command/queryservices.
- [ ] Schrijf failing test dat een gebruikt model niet kan wijzigen.
- [ ] Implementeer atomair locken bij eerste relevante capabilitykoppeling.
- [ ] Test directe API-aanroep tegen locked model.

## Taak 2.3 — Niveaumodel UI

**UI-reference:** UI-009.

- [ ] Bouw lijst/editweergave met dynamisch aantal levels.
- [ ] Voeg loading, empty, error en locked states toe.
- [ ] Verwijder mockupgrafieken zonder echte persoonlijke data.
- [ ] Voeg duidelijke impacttekst en status Configurable/In Use toe.
- [ ] Voeg componenttests toe voor toevoegen, verwijderen, herschikken en locked controls.

## Taak 2.4 — Senioriteit datamodel en seed

- [ ] Voeg senioritytabel of equivalent model toe.
- [ ] Maak idempotente tenantseed Junior, Medior, Senior.
- [ ] Voeg naam-, volgorde-, status- en tenantconstraints toe.
- [ ] Test meerdere tenants en herhaald uitvoeren van seed.

## Taak 2.5 — Senioriteit service en UI

**UI-reference:** UI-010.

- [ ] Implementeer list/create/update/status commands.
- [ ] Implementeer impactquery voor gekoppelde functies.
- [ ] Bouw beheerweergave met sortering en status.
- [ ] Bouw geen “standaard senioriteit”-radio; dit is geen productrequirement.
- [ ] Test inactiveren met en zonder actieve relaties.

### Milestone 2 gate

- [ ] Niveaukeuze is nergens hardcoded op 1–5.
- [ ] Model lock is database-/serviceniveau afdwingbaar.
- [ ] Junior/Medior/Senior zijn bewerkbare tenantdata.
- [ ] Volledige relevante testset en migratietest slagen.

---

# Milestone 3 — Capability Library

## Taak 3.1 — Generiek capabilityschema

- [ ] Voeg Capability-model toe met types Competency, Skill, Knowledge, Language en Certificate.
- [ ] Voeg category relation en status toe.
- [ ] Voeg typespecifieke gecontroleerde velden toe volgens technische ontwerpkeuze.
- [ ] Voeg genormaliseerde unieke naamconstraint per tenant/type toe.
- [ ] Voeg capability level content toe voor Competency, Skill en Knowledge.
- [ ] Test dat Language en Certificate geen Talent Level kunnen opslaan.

## Taak 3.2 — Categories en bestaande Cloud Tags

- [ ] Hergebruik bestaande tags; creëer geen parallel tagsysteem.
- [ ] Implementeer categories met status en typescope.
- [ ] Test category inactivation en bestaande relaties.
- [ ] Test tagrelaties en tenantisolatie.

## Taak 3.3 — Capability commands en queries

- [ ] Implementeer create/update/activate/inactivate.
- [ ] Implementeer typebewuste validaties.
- [ ] Implementeer search, filters, paginering en usage count.
- [ ] Implementeer duplicate warning/error.
- [ ] Test impactmelding bij inactivering met profile references.

## Taak 3.4 — Bibliotheeklijsten

**UI-reference:** UI-003 als landing, UI-004 als detailrichting.

- [ ] Bouw één bibliotheekcontainer met afzonderlijke typenavigatie.
- [ ] Bouw tabellen/kaarten volgens bestaand Design System.
- [ ] Voeg filters voor status, category en tags toe.
- [ ] Voeg echte tellingen en empty states toe.
- [ ] Test autorisatie en URL-filterstate.

## Taak 3.5 — Competency detail en levelcontent

- [ ] Bouw algemene detailsectie.
- [ ] Bouw dynamische levelaccordions op basis van tenantmodel.
- [ ] Bouw gebruikslijst met echte profile references.
- [ ] Verwijder analytics/trends zonder bron.
- [ ] Test locked level model versus bewerkbare indicatorcontent.

### Milestone 3 gate

- [ ] Eén generiek model bedient alle vijf UI-typen.
- [ ] CEFR en certificate semantics zijn gescheiden van Talent Levels.
- [ ] Duplicaten en inactieve selecties zijn geblokkeerd.
- [ ] Geen demo-capabilities in productie.

---

# Milestone 4 — Job Architecture

## Taak 4.1 — Reuse/migratie bestaande functions en groups

- [x] Voer het goedgekeurde migratieplan voor de ownershipfundering uit.
- [x] Migreer `jobs`, `job_groups`, `job_revisions` en `job_group_jobs` naar tenant-owned eigendom zonder bestaande IDs te vervangen.
- [x] Verwijder administratie als cataloguseigenaarschap uit canonical keys, filters, RLS en consumers; behoud administratie alleen op employment-/plaatsingskoppelingen.
- [ ] Maak een dry-runrapport voor dubbele codes/namen over administraties en laat conflicten expliciet oplossen.
- [x] Voeg uitsluitend ontbrekende scopevelden/relaties toe.
- [x] Behoud bestaande identifiers en employment references.
- [ ] Schrijf backfill-tests en data-integriteitschecks.
- [ ] Maak dry-run rapportage voor productieachtige dataset.

## Taak 4.2 — Optionele Job Family

- [ ] Voeg family alleen toe indien niet veilig herbruikbaar uit bestaande structuur.
- [ ] Modelleer Job Family tenant-owned; een family mag functies uit meerdere administraties omvatten.
- [ ] Zorg dat job_group.family_id nullable is.
- [ ] Test volledige flows zonder één familyrecord.
- [ ] Bouw instellingen voor aan/gebruik volgens product- en repositoryconventie.

## Taak 4.3 — Job Group services en UI

- [ ] Implementeer create/update/status en impact.
- [ ] Voeg uniqueness in juiste family-context toe.
- [x] Lees en schrijf de catalogus vanuit tenantcontext; gebruik administratiecontext uitsluitend voor plaatsingsimpact en toegangsfiltering.
- [ ] Bouw lijst/detail/empty state.
- [ ] Blokkeer delete met actieve functions.
- [ ] Test tenantisolatie en inactieve family.

## Taak 4.4 — Job Function en optionele senioriteit

- [ ] Voeg nullable seniority relation toe.
- [ ] Voeg zakelijke uniqueness group + name + seniority toe.
- [x] Koppel een tenant-owned functie aan administrationele employments/plaatsingen via tenantconsistente foreign keys.
- [ ] Implementeer samengestelde presentatienaam zonder basisnaam te muteren.
- [ ] Implementeer create/update/status en impact op employments.
- [ ] Test gelijknamige functies met verschillende senioriteit en functie zonder senioriteit.

## Taak 4.5 — Function House Explorer

**UI-reference:** UI-005 en UI-012.

- [ ] Bouw tree die zonder families bij Job Groups begint.
- [ ] Voeg optionele family-root toe wanneer gebruikt.
- [ ] Toon senioriteit als function property, niet als verplichte boomlaag.
- [ ] Implementeer lazy loading/search ancestor context.
- [ ] Bouw detailpaneel met profile link en relation counts.
- [ ] Test grote boom, empty tenant en gelijknamige functies.

### Milestone 4 gate

- [ ] Bestaande employee-functionrelaties zijn intact.
- [ ] Tenant zonder families werkt volledig.
- [ ] Senioriteit is optioneel en niet in naam hardcoded.
- [ ] Geen cross-tenant of orphan relations.

---

# Milestone 5 — Job Profiles en datumversies

## Taak 5.1 — Logisch profile en initial draft

- [ ] Voeg één-op-één profile relation per function toe.
- [ ] Maak bij nieuwe function één initial Draft volgens gekozen transactionele flow.
- [ ] Backfill profiles voor bestaande functions zonder actieve inhoud te verzinnen.
- [ ] Test unique profile per function.

## Taak 5.2 — Profile version schema

- [ ] Voeg Draft/Active/Inactive status toe.
- [ ] Voeg geldigheidsperiode toe.
- [ ] Voeg contentvelden/gestructureerde secties toe.
- [ ] Voeg non-overlap integriteitscontrole toe.
- [ ] Test historische, huidige en toekomstige versies.

## Taak 5.3 — Profile capability requirements

- [ ] Voeg relation toe met importance Required/Important/Optional.
- [ ] Voeg typebewuste levelvelden toe.
- [ ] Blokkeer duplicate capability binnen version.
- [ ] Blokkeer inactieve capability voor nieuwe relation.
- [ ] Test dynamisch levelmodel en CEFR.

## Taak 5.4 — Draft bewerken

- [ ] Bouw command voor contentupdate met optimistic concurrency.
- [ ] Bouw add/update/remove capability commands.
- [ ] Schrijf service- en componenttests.
- [ ] Bescherm active/historical versions tegen reguliere edit.

## Taak 5.5 — Nieuwe versie kopiëren

- [ ] Kopieer inhoud en requirements naar nieuwe Draft.
- [ ] Kopieer geen auditmetadata of geldigheidsperiode.
- [ ] Zorg dat herhaald command geen dubbele drafts maakt bij retry.
- [ ] Test vanaf huidige en historische versie volgens toegestane flow.

## Taak 5.6 — Activeringstransactie

- [ ] Schrijf alle failing date-effective tests.
- [ ] Implementeer validation checklist.
- [ ] Implementeer atomair sluiten vorige version en activeren nieuwe.
- [ ] Ondersteun toekomstige ingangsdatum.
- [ ] Schrijf audit-event met correlation ID.
- [ ] Test concurrency met twee gelijktijdige activaties.

### Milestone 5 gate

- [ ] Geen overlappende active periods mogelijk via UI, API of database.
- [ ] Historische query op datum is correct.
- [ ] Geen approval/review/publish status aanwezig.
- [ ] Volledige profile-domain testset slaagt.

---

# Milestone 6 — Talent Settings UX

## Taak 6.1 — Talent Configuration landing

**UI-reference:** UI-003.

- [ ] Bouw gegroepeerde kaarten voor Bibliotheek, Framework & Functiehuis en Beheer.
- [ ] Toon echte tellingen.
- [ ] Toon families alleen contextueel.
- [ ] Toon import/templates niet actief in fase 1.
- [ ] Voeg loading, partial error en empty onboarding toe.

## Taak 6.2 — Talent Configuration Dashboard

**UI-reference:** UI-002.

- [ ] Bouw configuration summary read model.
- [ ] Bouw objecttellingen met doorklikfilters.
- [ ] Bouw aandachtspunten met oplosbare querydefinities.
- [ ] Bouw recent changes uit audit.
- [ ] Bouw geen arbitraire health score.
- [ ] Test dat kaarttelling gelijk is aan doellijsttelling.

## Taak 6.3 — Profile editor/viewer

**UI-reference:** UI-006, UI-013 en UI-011.

- [ ] Bouw header met function, group, seniority, status en dates.
- [ ] Bouw secties/tabs voor algemene inhoud en capabilities.
- [ ] Bouw Add Capability-dialog met dynamic levels.
- [ ] Bouw versiehistorie en new version action.
- [ ] Bouw role-aware read-only mode.
- [ ] Verwijder import, AI, bezetting en ontwikkeladvies uit fase 1.

### Milestone 6 gate

- [ ] Iedere beheerroute heeft loading/empty/error/success.
- [ ] Geen mockupdata of out-of-scope action zichtbaar.
- [ ] Toetsenbord- en screenreaderbasis getest.
- [ ] Gerichte UI- en service-tests slagen.

---

# Milestone 7 — Workforce en Manager Read-only

## Taak 7.1 — Workforce landing

**UI-reference:** UI-001.

- [ ] Voeg Talent-ingang toe binnen bestaande Workforce.
- [ ] Zorg dat beheer niet onder Workforce terechtkomt.
- [ ] Toon actieve fase 1-modules en disabled toekomsttegels volgens projectconventie.
- [ ] Gebruik rolgeschikte copy: raadplegen voor Manager.

## Taak 7.2 — Profile search/read

- [ ] Bouw geautoriseerde zoekquery voor active profiles.
- [ ] Toon group, function, seniority en geldigheidscontext.
- [ ] Bouw read-only detail.
- [ ] Test manager binnen en buiten scope.
- [ ] Test dat Draft/historical versions niet onbedoeld zichtbaar zijn.

### Milestone 7 gate

- [ ] Manager kan niets muteren, ook niet via directe API.
- [ ] Manager ziet geen configuratiemenu’s.
- [ ] Workforce gebruikt dezelfde profile source of truth als Settings.

---

# Milestone 8 — Mijn Talent

## Taak 8.1 — Employee identity en profile resolution

- [ ] Resolveer ingelogde gebruiker naar bestaand employeerecord.
- [ ] Resolveer actuele employment/function relation.
- [ ] Resolveer active profile version voor huidige datum.
- [ ] Definieer lege toestanden voor ontbrekende mapping, function of profile.
- [ ] Test cross-employee en cross-tenant denial.

## Taak 8.2 — Mijn Talent read model

**UI-reference:** UI-007.

- [ ] Bouw read model met function, group, seniority, profile content en requirements.
- [ ] Bouw responsive read-only scherm.
- [ ] Label capabilities als functievereisten.
- [ ] Toon geen persoonlijke levelscore, match, progress of development journey.
- [ ] Test mobiel, desktop en accessibility.

### Milestone 8 gate

- [ ] Medewerker ziet alleen eigen informatie.
- [ ] Geen edit endpoint of UI voor medewerker.
- [ ] Ontbrekende data resulteert in neutrale, bruikbare empty state.

---

# Milestone 9 — Hardening en releasevoorbereiding

## Taak 9.1 — Security review

- [ ] Draai volledige negative authorization suite.
- [ ] Inspecteer alle nieuwe RPC’s/functions/policies.
- [ ] Controleer clientbundle op secrets.
- [ ] Voer tenant boundary tests uit met meerdere tenants en rollen.
- [ ] Review auditdekking.

## Taak 9.2 — Performance

- [ ] Meet list, dashboard, explorer en profile queries.
- [ ] Controleer query plans en indices.
- [ ] Elimineer N+1-patronen.
- [ ] Test representatieve datasetgroottes.
- [ ] Leg performancebaseline vast.

## Taak 9.3 — Accessibility en UX consistency

- [ ] Toets kernflows met keyboard-only.
- [ ] Controleer focus, labels, statuskleur en errors.
- [ ] Controleer copy en terminologie tegen Glossary.
- [ ] Controleer alle mockupafwijkingen tegen Blueprint.

## Taak 9.4 — Migratie en rollout

- [ ] Test migraties op productieachtige backup/snapshot.
- [ ] Maak deploymentvolgorde voor schema, backend en frontend.
- [ ] Maak feature flag rollout per tenant.
- [ ] Maak rollback-/herstelprocedure.
- [ ] Leg observability en supportdiagnostiek vast.

## Taak 9.5 — Volledige acceptatie

- [ ] Draai volledige unit/integration/component/E2E-set.
- [ ] Voer Acceptance Test Pack uit.
- [ ] Registreer iedere afwijking; geen impliciete acceptatie.
- [ ] Werk documentatie en changelog bij.
- [ ] Maak release candidate.

### Release gate

Release is uitsluitend toegestaan wanneer:

- alle kritieke acceptance tests slagen;
- geen open security severity high/critical bestaat;
- tenantisolatie bewezen is;
- profile date logic bewezen is;
- migratie herstelbaar is;
- geen fase 2-functionaliteit onbedoeld is geactiveerd;
- Product Blueprint en implementatie aantoonbaar overeenkomen.

---

# Aanbevolen commitstrategie

Gebruik kleine, semantische commits, bijvoorbeeld:

```text
feat(talent): add tenant level model schema
feat(talent): lock level model after first use
feat(talent): add configurable seniority
feat(talent): add generic capability library
feat(talent): add job function seniority relation
feat(talent): add date-effective profile versions
feat(talent): add talent settings dashboard
feat(talent): add workforce profile read access
feat(talent): add read-only my talent
security(talent): enforce tenant and role policies
test(talent): add cross-tenant authorization coverage
```

Combineer geen schema, volledige UI en unrelated refactor in één commit.

---

# Codex-efficiëntieregels

Om credits en context efficiënt te gebruiken:

1. Geef Codex per sessie één milestone of één taakcluster.
2. Laat Codex eerst relevante bestanden noemen voordat het ze wijzigt.
3. Voeg niet telkens alle mockupafbeeldingen toe; verwijs naar UI-ID en lever alleen relevante referentie.
4. Verwijs naar hoofdstukken en requirement-ID’s in plaats van de volledige Blueprint te herhalen wanneer Codex de bestanden lokaal kan lezen.
5. Laat gerichte tests draaien na iedere taak; volledige suite alleen bij milestone gate.
6. Vraag geen brede codebase-review bij iedere wijziging.
7. Laat Codex na iedere taak een korte wijzigingssamenvatting en resterende risico’s geven.
8. Stop een sessie wanneer Codex buiten scope gaat of productbeslissingen begint te verzinnen.
9. Gebruik nieuwe sessies voor duidelijk gescheiden milestones om contextvervuiling te beperken.
10. Commit werkende tussenstappen zodat herstel goedkoop blijft.

---

**Einde Codex Implementation Plan**
