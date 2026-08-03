# ADR-0007: Talent fase 2 — eigendom en gegevensbescherming

**Status:** VASTGESTELD VOOR M2.3/M2.4 — veilige defaults gekozen  
**Datum:** 2026-08-02  
**Bron:** `docs/requirements/Talent/analysis/talent-phase2-implementation-plan-20260802.md`  
**Vervangt:** geen; werkt ADR-0006 uit voor fase 2 Talent

## Context

Fase 1 bevat alleen tenantbrede Talentconfiguratie, functieprofielen en read-only Workforce-/Mijn-Talentprojecties. Fase 2 voegt persoonsgebonden capabilityregistraties, kwalificaties, assessments, evidence, doelen en exports toe. Die gegevens kunnen gevoeliger zijn dan de bestaande functiecatalogus en mogen niet worden gemodelleerd als een tweede employee-, functie- of auditwereld.

De bestaande repositorycontracten zijn:

- `tenant_id` is de absolute RLS-grens;
- `employees` en het Talent-functiehuis zijn tenant-owned;
- `employments`, plaatsingen, payroll, salaris, verlof en verzuim zijn administration-owned;
- `requirePermission()` is de servergrens, RLS de databasegrens;
- `audit_logs` is de enige bestaande auditbron;
- fase-1 gebruikt `talent:read`, `talent:manage`, `talent:manager-read` en `self:talent:read`.

De fase-2-tabellen bestaan nog niet. Dit ADR is daarom een ontwerpcontract; het autoriseert geen migratie.

## Besluitvoorstel

1. De bestaande ownershipmatrix uit ADR-0006 blijft leidend. De nieuwe persoonlijke Talentbronrecords zijn tenant-owned via `tenant_id + employee_id`; zij krijgen niet automatisch een `administration_id`.
2. Een eventuele verwijzing naar een dienstverband is provenance of operationele context, nooit de eigendomsgrens. Een `employment_id` mag pas worden toegevoegd nadat is vastgesteld dat de bron juridisch administratiegebonden moet zijn.
3. Assessmentcycli, templates, beleid en uitkomsten zijn tenant-owned. De actuele managementscope wordt voor iedere manageractie server-side en via RLS bepaald uit de bestaande effective-dated `employee_organizations`-relatie.
4. Self-, manager- en HR-data worden als afzonderlijke dataprojecties ontworpen. Een manager krijgt geen brede tabeltoegang tot persoonlijke Talentdata; medewerkerdata wordt self-bound zonder clientaangeleverde `employeeId`.
5. Evidence, private managernotities en niet-vrijgegeven scores zijn afzonderlijke vertrouwelijkheidsgrenzen. Evidence-inhoud wordt niet in capabilityrecords of auditwijzigingen gekopieerd.
6. `audit_logs` blijft de enige auditbron. Voor fase 2 moet het auditcontract vóór M2.1 worden uitgebreid met een herleidbare correlation ID en expliciete fase-2-acties, zonder een tweede Talent-audittabel.
7. Fase-2-permissions worden per verticale slice als expliciete migration/seed toegevoegd. Er worden geen rolnaamchecks in componenten of services toegevoegd.
8. Er wordt geen generieke `notifications`-tabel of automatische notificatieflow voor fase 2 gebouwd zolang de notificatiekeuze uit M2.0 niet is vastgesteld. Bestaande reminders en `hr_change_events` zijn niet automatisch hetzelfde contract.

## Datagrens

De standaardregel is deny-by-default:

- response-DTO's bevatten alleen velden die de rolmatrix voor de concrete actor en target toestaat;
- auditdata bevat actor, tenant, object, actie, tijd en correlation ID, maar geen volledige evidence-inhoud, private notitie of onnodige antwoordtekst;
- archiveren bewaart historie; hard delete is alleen toegestaan voor ongebruikte, niet-historische testrecords;
- een ontbrekende of verlopen geldigheid maakt een record niet stilzwijgend actueel;
- een toekomstige berekende match, percentage of dashboardscore wordt niet opgeslagen of getoond zonder afzonderlijk productbesluit.

## Gevolgen

- M2.1 is op expliciete uitvoeringsinstructie gestart met uitsluitend de veilige defaults: self blijft `DRAFT`, HR bepaalt release/archive, evidence blijft een referentie zonder inhoud en records zijn tenant-owned. Assessmenten, private managerdata, Team Talent, import, doelen en notificaties zijn niet onder deze uitzondering gebouwd.
- Het huidige auditmodel is functioneel herbruikbaar, maar nog niet voldoende als volledig fase-2-contract: correlation ID, fase-2-acties en denied-actionbeleid ontbreken.
- Een read-only auditbaseline heeft bovendien een bestaande privilege-afwijking vastgesteld. Die is inmiddels gehard in `20260802173000_harden_audit_log_data_api_grants.sql` en remote toegepast als `20260802131815_harden_audit_log_data_api_grants`: `anon`/`public` hebben geen tabelgrants op `public.audit_logs`; `authenticated` heeft alleen `SELECT`. RLS blijft daarnaast de row-level grens.
- De bestaande manager-scopehelper blijft de bron voor scope; `requirePermission()` alleen bewijst geen toegang tot een specifieke medewerker.

## Reviewuitkomst

Voor M2.3/M2.4 zijn de zichtbaarheid van score, evidence en manageruitkomst, de veilige archiveringsdefault, de minimumgroep voor toekomstige aggregaten en de afwezigheid van automatische notificaties expliciet vastgelegd in FDR-0003. De exacte permissions zijn remote seeded en de M2.0/M2.1/M2.2/M2.3-contractproeven worden per slice uitgevoerd. Een toekomstige uitbreiding met retention, notificaties, aggregaten of exports vereist een nieuw besluit.
