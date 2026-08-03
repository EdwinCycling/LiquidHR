# Talent fase 1 — functie-inventaris en stap-9-gate

Datum: 2026-08-02  
Bronnen: Product Blueprint v2.0, Codex Implementation Plan, Acceptance Test Pack en Requirement Traceability Matrix.

## Conclusie over het stappenplan

Stap 9, **Hardening en releasevoorbereiding**, is het laatste milestone in het opgeslagen Codex Implementation Plan. Dat betekent niet dat Talent als product klaar is: de Blueprint noemt daarna fase 2 en latere uitbreidingen. De geauthenticeerde rol- en axe-gate is inmiddels uitgevoerd; de formele release-gate blijft nog open voor handmatige contrastbeoordeling, representatieve performance en rollback.

## Stap 9 — uitgevoerd en resterend

| Onderdeel | Vastgesteld | Status |
|---|---|---|
| Security/RLS | 13 Talent-/functiehuistabellen hebben RLS; self-profile RPC's zijn niet uitvoerbaar door `anon`; de readmodel-view gebruikt `security_invoker=true`. | Uitgevoerd |
| Audit | Bestaande Talentobjecten hadden audittriggers. De functiehuis-tabellen `jobs`, `job_groups`, `job_revisions` en `job_group_jobs` hebben nu aanvullend een tenantgebonden append-only audittrigger via migratie `20260802150000_harden_talent_job_catalog_audit`. | Uitgevoerd; denied actions met de rol-gate bewezen |
| Tenantgrens | Policies controleren tenant, permission en waar nodig directe managerscope; de remote contracttest slaagt. | Databasecontract en geauthenticeerde matrix uitgevoerd |
| Performance | Workforce leest profielen en requirements in batches; de remote `EXPLAIN` voor de actieve readmodel-query toont geen N+1-patroon. | Baseline op demo-data; representatieve grote dataset nog open |
| Accessibility | De drie geïsoleerde rolcontexten rapporteerden 0 axe-violations en geslaagde keyboard-focuschecks; drie contrastchecks bleven `incomplete`. | Uitgevoerd; handmatige contrastbeoordeling open |
| Authenticated matrix | HR Admin, manager en medewerker zijn met afzonderlijke Auth-sessies getest. Manager en medewerker kregen geen settings/mutaties; de medewerker bleef self-bound. | Uitgevoerd |
| Release/rollback | Talent-modulegate en remote migratievolgorde bestaan. Een productieachtige snapshot/restore-oefening en echte rollback zijn niet uitgevoerd. | Open voor formele release |

De reproduceerbare gate staat in `apps/hr-suite/scripts/talent-release-gate.mjs` en is beschikbaar als `npm run audit:talent-release --workspace @liquid-hr/hr-suite`. Hij gebruikt afzonderlijke rolcredentials en expliciete cross-tenant/out-of-scope fixture-ID's via lokale environment variables; credentials worden niet opgeslagen of gelogd.

## Functiecontrole tegen de oorspronkelijke fase-1-Blueprint

| Blueprintfunctie | HR Admin | Manager | Medewerker | Beoordeling |
|---|---|---|---|---|
| Talent-ingang en contextscheiding | `/settings/talent` onder HR-inrichting; Workforce en Mijn Talent apart | Workforce-ingang, read-only | Mijn Talent, eigen context | Aanwezig |
| Talent Level Model | Model en levels bekijken, toevoegen, wijzigen en verwijderen zolang niet in gebruik | Geen beheer | Geen beheer | Aanwezig; rolmatrix uitgevoerd |
| Senioriteit | Lijst-eerst CRUD, status, volgorde en optionele koppeling aan functie | Geen beheer | Alleen zichtbaar als gekoppeld | Aanwezig |
| Capabilitybibliotheek | Competency, Skill, Knowledge, Language en Certificate; categorie, status, tags, typespecifieke velden en levelcontent | Geen beheer | Geen beheer | Aanwezig; usage/impactweergave kan rijker |
| Zoek- en filtergedrag | Capability zoeken en filteren op type/status/categorie/tag; profielzoeken | Profiel zoeken binnen directe scope | Geen bibliotheekzoeker | Gedeeltelijk: filters zijn nu client-side en niet URL-/server-side gepagineerd |
| Functiefamilies | Optioneel CRUD | Geen beheer | Niet zichtbaar als beheer | Aanwezig |
| Functiegroepen en functies | Bestaand tenant-owned functiehuis via Master Data; familie en senioriteit zijn gekoppeld | Geen beheer | Alleen via eigen functiecontext | Aanwezig als gedeelde catalogus; niet als aparte explorer binnen Talentfundament |
| Logisch functieprofiel | Draft, inhoud, requirements, kopiëren, datumversie, activeren en historie | Alleen lezen van actuele actieve profielen binnen scope | Eigen actuele actieve profiel | Aanwezig; auditweergave en fijnmazige typevelden in de editor zijn nog niet volledig zichtbaar |
| Capability requirements | Required/Important/Optional, dynamisch Talent Level, rationale, toevoegen/wijzigen/verwijderen | Alleen lezen | Alleen lezen als functievereiste | Gedeeltelijk: de UI exposeert nog niet alle Language-/Certificate-detailvelden |
| Mijn Talent | Veilige no-access/lege toestand zonder employee-context | Geen self-route in de fase-1-managerrol | Eigen functie, profielinhoud en vereisten; geen score/match/edit | Aanwezig; rolmatrix uitgevoerd |
| Manager scope | Tenantbreed lezen | Alleen directe manager-scope; geen settings of mutaties | Geen Workforce-beheer | Database/service en geauthenticeerde negatieve test uitgevoerd |
| Audit en historie | DB-audit voor Talent en functiehuis; profielversies historisch read-only | Geen auditbeheer | Geen auditbeheer | Gedeeltelijk: er is nog geen complete Talent-auditviewer met before/after/correlation in deze slice |
| Validatie en concurrency | Servervalidatie, status- en typegrenzen, optimistic concurrency voor profielversies | Geen mutaties | Geen mutaties | Gedeeltelijk: profielversies zijn hard, catalogusmutaties hebben nog geen uniforme optimistic-concurrency UX |
| Accessibility, loading/error/empty states | Basisstates en i18n aanwezig | Read-only basisstates | Neutrale empty state | Axe/keyboard uitgevoerd; drie contrastchecks handmatig open |
| Fase-1-scopeguard | Geen AI, scores, assessments, imports, pools, Team Talent of 9-grid actief | Geen assessment of teamanalytics | Geen score, match of development journey | Aanwezig en bewust buiten scope |

### Samenvatting functiecontrole

De fase-1-kern is gebouwd: tenant-owned fundament, levelmodel, senioriteit, capabilitybibliotheek, functiehuis, datumversies, manager-read-only en Mijn Talent read-only. De geauthenticeerde drie-rollen-matrix en axe/keyboard-gate zijn uitgevoerd met 0 violations. De oorspronkelijke Blueprint is echter breder dan alleen zichtbare CRUD; de formele releasekwalificatie blijft **gedeeltelijk** door de drie handmatige contrastchecks, grote-dataset-baseline en rollback-oefening. Daarnaast blijven de eerder genoemde auditviewer- en fijnmazige editoruitbreidingen functionele vervolgpuntjes.

## Rollen in de huidige fase-1-versie

### HR Admin

- Talentfundament openen via Instellingen → HR-inrichting.
- Talent Level Model en dynamische levels beheren zolang het model configureerbaar is.
- Senioriteiten beheren, inclusief naam, omschrijving, volgorde en status.
- Capabilitybibliotheek beheren voor Competency, Skill, Knowledge, Language en Certificate.
- Categorieën beheren en capabilities classificeren.
- Bestaande Cloud Tags aan capabilities koppelen.
- Typespecifieke capability-inhoud beheren, inclusief CEFR en certificaatmetadata.
- Levelindicatoren, voorbeelden en coachingnotities beheren voor Competency, Skill en Knowledge.
- Optionele functiefamilies beheren.
- Tenant-owned functiegroepen en functies beheren via de bestaande functiecatalogus.
- Functieprofielen en Draft-versies openen.
- Profieltekst, taken, verantwoordelijkheden en resultaatgebieden bewerken.
- Requirements toevoegen, wijzigen en verwijderen.
- Versies kopiëren, activeren, plannen en historische versies raadplegen.
- Workforce-profielen tenantbreed read-only controleren.
- Auditsporen worden server-/database-side vastgelegd; de volledige auditviewer is nog geen afgeronde Talent-UI.

### Manager

- Workforce → Talentprofielen openen.
- Alleen actieve en actuele functieprofielen binnen de bestaande directe managerscope zien.
- Zoeken in de geautoriseerde profielset.
- Functiegroep, functie, senioriteit, geldigheid en profielinhoud raadplegen.
- Capabilityvereisten en vereiste levels/taalniveaus lezen.
- Geen Talent Settings openen.
- Geen capability, level, senioriteit, familie, functie, profielversie of requirement muteren.
- Geen assessments, scores, matchpercentages, Team Talent analytics of successiondata in fase 1.

### Medewerker

- Mijn Talent openen.
- Alleen de eigen actuele functiecontext zien.
- Eigen functiegroep, senioriteit, actuele profielversie en ingangsdatum raadplegen.
- Doel, samenvatting, organisatorische context, taken, verantwoordelijkheden en resultaatgebieden lezen.
- Capabilityvereisten als functievereisten lezen.
- Geen Talent Settings, Workforce-beheer of gegevens van andere medewerkers.
- Geen persoonlijke score, matchpercentage, progressie, skillregistratie of ontwikkelreis in fase 1.
- Bij ontbrekende koppeling een neutrale, bruikbare lege toestand zien.

## Uitbreidingsmogelijkheden — uitsluitend Talent

### Vanuit HR Admin

- Een expliciete review-/publicatieflow bovenop Draft/Active, alleen na wijziging van de fase-1-beslissing dat directe activatie niet meer volstaat.
- Volledige auditviewer met filters op actor, object, actie, periode en correlation ID, inclusief before/after-diff.
- Impactanalyse vóór inactivatie van capability, senioriteit, functie, groep of familie.
- Server-side gepagineerde bibliotheek met URL-filters, kolomsortering en opgeslagen HR-weergaven.
- Bulkbeheer met preview, validatie, conflictlijst en rollback.
- Import/export met mapping, dry-run en tenantgrens.
- Meertalige capability- en profielcontent.
- Herbruikbare profieltemplates en gecontroleerde kopieerflows.
- Persoonlijke capabilityrecords en HR-beheerde kwalificaties met bron, geldigheid en bewijs.
- Self-assessment- en manager-assessmentcycli met schaaldefinitie, open/sluitdatum en audit.
- Team Talent, Skills Matrix en profielvergelijking met expliciete definities voor match en gap.
- Talent pools met criteria, eigenaar, lidmaatschap, privacy en audit.
- Ontwikkeldoelen/POP die naar capabilities en profielverwachtingen verwijzen.
- Learning-/LMS-koppeling, certificaatverval en hernieuwingssignalen.
- Succession planning, readiness, risk en 9-grid pas met gevalideerde persoonlijke data.
- Talentrapportages/export met scopefilter, momentopname en verwijderbare persoonsgegevens.
- Observability voor queryduur, foutcodes, lege readmodels, activation-conflicts en denied actions.

### Vanuit Manager

- Team Talent read-only overzicht van de eigen actuele medewerkersscope.
- Filter op functie, senioriteit, capabilitytype, profielstatus en geldigheid binnen managerrechten.
- Teamprofielvergelijking zonder persoonsgegevens buiten de eigen scope.
- Manager-assessment met beoordelingscyclus, onderbouwing, kalibratie en audit.
- Feedback en observatie vastleggen met bron, datum en zichtbaarheid.
- Teamontwikkeldoelen en POP-acties volgen.
- Capability gaps en ontwikkelacties tonen zodra persoonlijke records bestaan.
- Team Talent pools beheren of voordragen volgens HR-beleid.
- Opvolgingskandidaten voorstellen zonder HR-publicatie- of privacygrenzen te omzeilen.
- Gespreksvoorbereiding koppelen aan functievereisten en eerdere acties.
- Gerichte notificaties voor verlopen kwalificaties, open assessments en naderende cyclussluitingen.

### Vanuit Medewerker

- Eigen Talentprofiel aanvullen met interesses, loopbaanrichting en gewenste ontwikkeling.
- Self-assessment per capability en niveau met onderbouwing/evidence.
- Eigen documenten, certificaten en geldigheid beheren waar privacy- en documentbeleid dit toestaat.
- Eigen ontwikkeldoelen/POP bekijken en bijhouden.
- Learningaanbod ontdekken dat naar capabilities en gewenste volgende functies verwijst.
- Feedback aanvragen of ontvangen met expliciete zichtbaarheid en intrekking.
- Eigen profiel vergelijken met een gewenste functie, zonder ongeautoriseerde team- of persoonsdata te tonen.
- Persoonlijke voortgang en historische snapshots bekijken, met duidelijke herkomst van iedere score.
- Carrièrepaden en volgende functies verkennen op basis van configureerbare, uitlegbare regels.
- Voorkeuren instellen voor Talentnotificaties en herinneringen.
- Inzage-, correctie- en verwijderverzoeken voor eigen Talentdata ondersteunen.

### Gezamenlijke randvoorwaarden voor elke uitbreiding

- De scheiding Instellingen → Workforce → Mijn Talent blijft intact.
- Iedere nieuwe tabel krijgt tenant-/administratie-eigendom, RLS, indexen, audit en tests in dezelfde migratie.
- Persoonlijke Talentdata blijft minimaal, herleidbaar en nooit als fictieve score zichtbaar.
- Nieuwe managerdata blijft binnen de bestaande manager-/organisatie-scope.
- AI kan later voorstellen doen, maar nooit zelfstandig brondata publiceren.
- Nieuwe workflows blijven volledig i18n-, keyboard- en WCAG 2.2 AA-klaar.
