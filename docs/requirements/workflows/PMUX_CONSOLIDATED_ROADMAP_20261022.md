# PMUX — Geconsolideerde roadmap (22 oktober 2026)

## Productbesluit

De komende Process Automation-ontwikkeling bestaat uit drie productwaves: **PMUX-05 — Slimme formulieren en gegevens**, **PMUX-06 — Deadlines, uitval en procesregie** en **PMUX-07 — ESS, Focus en productfinish**. PMUX-04 blijft een afzonderlijke security- en releasegate en is geen productwave.

Deze roadmap vervangt de oude PMUX-deelreeks als actieve planning. PMUX-02A/02B, PMUX-03A/B/C en PMUX-05A/B blijven historische capability- en acceptance-labels voor bestaand werk; ze vormen geen nieuwe toekomstige projectsplitsing. De oude P0–P10-uitvoeringsfasen in de [Process Automation Blueprint](LIQUID_PROCESS_AUTOMATION_BLUEPRINT.md) zijn historisch. De blueprint blijft referentie voor product- en architectuurprincipes.

## Wave 05 — Slimme formulieren en gegevens

**Eerstvolgende en actieve wave.** Rond de bestaande Processtudio, Formulierenstudio, getypeerde conditiecontracten, compiler, bindingcatalogus en formulier-RPC af tot één veilige configuratie-ervaring.

- Formulierveld zichtbaar maken en verplicht stellen op basis van dezelfde getypeerde `ConditionNode`, zonder tweede evaluator.
- Herstel het concept-save-contract: een wijziging aan bronwaarden kan de nieuwe zichtbare veldprojectie teruggeven; definitief indienen controleert de dan geldige verplichte velden.
- Verwijder verborgen waarden uit de actieve antwoordset zonder immutable revisies of audit te wijzigen.
- Veldrechten per `(stap, deelnemer, veld)` zijn lokaal toegevoegd aan de bestaande typed velddefinitie. Compiler en bestaande server-RPC's begrenzen de stapinstelling tot het participantrecht; ontbrekende/duplicaat-onveilige tuples worden verborgen. Live gebruik blijft geblokkeerd tot TEST-migratie, role/tenant-readback en browseracceptatie.
- Maak bestemming duidelijk als vrij procesveld, HR-domeinwaarde, domeinvoorstel of berekende waarde. De bestaande developer-owned bindingcatalogus blijft de enige bron van toegestane bindingen.
- Bied synthetische formulierpreview per rol, stap en scenario en rond mobiele weergave op 390px af.
- Behoud draft revisions, optimistic concurrency, autorisatie, immutable publicaties en bestaande domeinservices.

**Huidige status op de PMUX-branch (23-10-2026):** PMUX-05A/B/C gebruiken ConditionNode, bestaande compiler/evaluator, participant actorcontrole en serverprojecties. Migratie `20261022203000_pmux05_form_condition_draft_save.sql` herstelt conditionele conceptsave en filtert verborgen waarden uit actieve antwoorden. Nieuwe migratie `20261023054930_pmux05_step_participant_field_access.sql` koppelt effectieve toegang aan de servergelezen actieve stap en deelnemer, zonder bestaande participantrechten te verhogen. Beide migraties zijn lokaal in PGlite uitgevoerd; geen remote toepassing. **LOKAAL GREEN / REMOTE ACCEPTANCE OPEN:** exacte SQL/testomvang, TypeScript, ESLint, i18n en grenzen staan in [PMUX-05C local evidence](../../quality/acceptance/runs/PMUX-05C-20261023-LOCAL.md). Live TEST-migratie/readback, authenticated actor-/tenantproeven, browser/390px en PMUX-04 releasegates blijven open.

## Wave 06 — Deadlines, uitval en procesregie

### PMUX-06A — Stap-SLA's en deadlines

**Status (23-10-2026): LOKALE IMPLEMENTATIE GEREED; REMOTE ACCEPTATIE OPEN.** HR Admin kan de bestaande SLA per stap instellen; deadlineberekening en materialisatie gebruiken de gepinde immutable procesversie, stapactivatie en actieve HR-groeptijdzone. Mijn werk, Focus, dashboard en procesdetail gebruiken één deadlineprojectie. Werkdagen blijven geblokkeerd zolang geen eenduidige werkdag-/feestdagenkalender bestaat; ook legacy gepubliceerde werkdag-SLA's blokkeren activatie met begrijpelijke uitleg. Zie [PMUX-06A requirement](PMUX-06A_SLA_DEADLINES.md) en [lokale acceptatie](../../quality/acceptance/runs/PMUX-06A-20261023-LOCAL.md). De migratie is alleen lokaal met PGlite getest; echte TEST-readback en desktop-/390px-browseracceptatie blijven OPEN.

### PMUX-06B — Herinneringen en escalaties

**Status (23-10-2026): PARTIAL / LOCAL IMPLEMENTATION; AUTOMATIC SCHEDULING AND REMOTE ACCEPTANCE OPEN.** De Processtudio gebruikt dezelfde typed SLA en bestaande workflow_jobs-queue. Deadlineherinneringen vooraf/op de deadline, gecontroleerde participant-escalatie en beheerflagging gebruiken bestaande reminderontvangers, autorisatie, audit en procesprojectie. Geen periodieke scheduler is aangetoond of toegevoegd; bestaande after-hooks garanderen geen toekomstige uitvoering. Zie [PMUX-06B requirement](PMUX-06B_REMINDERS_ESCALATIONS.md) en [lokale acceptatie](../../quality/acceptance/runs/PMUX-06B-20261023-LOCAL.md). Remote migratie/readback, echte scheduling/aflevering en browser/390px blijven OPEN. Overige uitval-, herverdelings- en prognosemogelijkheden zijn niet gestart.

Overige PMUX-06-capabilities — ontbrekende manager, uitdienstgetreden behandelaar, HR-uitvallijst, scopegebonden herverdeling, prognoses en inzichten — blijven gepland en zijn niet gestart.

## Wave 07 — ESS, Focus en productfinish

Na PMUX-06: volledige ESS/MSS/Focus-ervaring, mobile-first formulieren, visuele routes en processtatus, dashboard, handmatige UX-review, E2E en releasevoorbereiding. Deze wave wordt nu alleen gepland; hier wordt in PMUX-05 geen functionaliteit voor gebouwd.

HR Admin kan blokkades binnen de bestaande scope beheren. Dat geeft HR Admin geen recht om namens een andere procesdeelnemer goed te keuren.

## Afzonderlijke gate — PMUX-04

PMUX-04 blijft de aparte TEST-security- en releasegate voor bestaande synthetic flows: toegangs- en JWT-scope-negatives, bestaande actor/role-switcher, database- en RPC-readback, desktop-/390px-browserbewijs en eigenaaracceptatie. Bestaande historische acceptance-evidence blijft onveranderd; actuele open punten staan in [AA-OPEN](../../AA/AA-OPEN.md).

## Capabilitymatrix bij consolidatie

| Capability | Bestaand op de branch | UX- of contractgat | PMUX-05-doel |
| --- | --- | --- | --- |
| Conditionele procesroutes | Getypeerd conditiecontract, bestaande compiler, SQL-route-engine, evaluator en Procesproef. | Authenticated save/readback en browseracceptatie open. | Dezelfde contracten behouden; geen tweede route-engine. |
| Conditionele formuliervelden | visibilityCondition/requiredCondition, compilerchecks, bestaande serverprojectie en condition builder. | Serverdraftsave liet conditionele required-regels te vroeg falen; verborgen oude antwoorden bleven actief. | Lokaal opgelost door dezelfde evaluator/projectie te gebruiken, draft-validatie uit te stellen tot definitieve actie en verborgen antwoorden uit actieve waarden te verwijderen. Live server-, rol- en browserreadback blijven open. |
| Veldtoegang | Bestaande participant-regels en server-side actor/work-item-controle. | Ontbrak een getypeerde stap-/deelnemerregel. | Lokaal toegevoegd: `stepAccess`-matrix, participant ceiling, fail-closed ontbrekende tuples, compilercontrole en bestaande RPC-handhaving; live migratie/readback blijft open. |
| Gegevensbestemmingen | Getypeerde `PROCESS_ONLY`, `DOMAIN_READ`, `DOMAIN_PROPOSAL` en `COMPUTED`-contracten, veilige vaste catalogus, typechecks en serverbindingen. | Bestemmingsuitleg was onnodig technisch zichtbaar. | Begrijpelijke bestemmingsteksten; geen vrije tabel-, kolom- of formule-invoer. |
| Preview | Synthetische velden, dynamische condities, rol/stapselectie en desktop/390px-preview zijn aanwezig. | Browserbewijs en volledige server-/rolacceptatie open. | Zelfde preview hergebruiken en bewijs afronden. |

Geen nieuwe login-, role-switcher-, browser- of formulierinfrastructuur. Geen databasepublicatie, echte aanvraag, remote migratie of release in deze lokale roadmap slice.
