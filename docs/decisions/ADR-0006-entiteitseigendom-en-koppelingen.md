# ADR-0006: Entiteitseigendom en koppelingen tussen tenant en administratie

> **Actuele scope vanaf 2026-08-05:** de ownershipmatrix in dit ADR is vervangen voor het nieuwe doelmodel door [ADR-0009 — HR-groepen als zichtbaarheids- en inrichtingsgrens](ADR-0009-hr-groepen-als-zichtbaarheids-en-inrichtingsgrens.md) en [HR-groepen: scope, inrichting en domeingrenzen](../requirements/multitenancy/HR_GROEP_SCOPE_EN_INRICHTING.md). De historische migratiebesluiten hieronder worden niet stil verwijderd.

**Status:** Geaccepteerd  
**Datum:** 2026-07-31  
**Vervangt:** uitsluitend de algemene default uit ADR-0001, punt 4; de tenantgrens, expliciete access-scope en overige ADR-0001-besluiten blijven geldig.

## Context

ADR-0001 zegt dat stamtabellen standaard administratiegebonden zijn. Dat is veilig als default voor juridische en financiële data, maar te grof voor een holding/tenant met meerdere BV's. Functies, functiegroepen, niveaus en capabilitycatalogi moeten over de BV's heen dezelfde bron blijven. Contracten, payroll, verlof en verzuim blijven juist gekoppeld aan de werkgever die juridisch verantwoordelijk is.

De huidige code maakt de functiecatalogus (`jobs`, `job_groups`, `job_revisions`) en afdelingen administratiegebonden. Dat staat haaks op de gewenste één-persoon/veel-employments/één-tenantcatalogusstructuur en kan duplicatie of verschillende betekenissen per BV veroorzaken.

## Besluit

1. `tenant_id` is altijd de absolute data- en RLS-grens.
2. Functies, functiegroepen, functiefamilies, functieniveaus, senioriteiten, capabilities, talent/performance-templates, talent pools, opleidingscatalogi, Cloud Tags en niet-juridische afdelingen zijn tenant-owned.
3. Juridische administratiegegevens, employments, contracten, salaris/payroll, CAO/pensioenregelingen, verlofboekhouding, verzuimdossiers, declaraties, roosters, feestdagen en kostenboekhouding zijn administration-owned.
4. Een persoon (`employees`) is tenant-owned. Een employment is administration-owned en verwijst naar de persoon en een tenant-owned functie.
5. Een employee-organization-record is een administrationele plaatsing/tijdlijn; de functie-FK daarin verwijst naar de tenantfunctie en mag niet een tweede functiecatalogus creëren.
6. Een gemengde entiteit gebruikt een expliciet `scope_type` met databasecheck. Een lege `administration_id` betekent nooit vanzelf tenantbreed.
7. Ownership bepaalt de brondata; access scope blijft afzonderlijk geregeld via permissions, managementscope, actieve context en RLS.
8. Bestaande administratiegebonden functiegegevens worden naar tenant-eigendom gemigreerd met behoud van IDs, dry-runconflictrapportage en een backwards-compatible rollout. Er wordt geen tweede Talent-functiehuis gebouwd.

## Gevolgen

- De functiecatalogus en Talent Foundation worden zichtbaar/beheerbaar vanuit tenantcontext, niet alleen vanuit de actieve administratie.
- Assignment-, employment-, salary-, leave- en absence-routes blijven administratiegebonden en controleren daarnaast dat de gekozen functie binnen dezelfde tenant bestaat.
- De jobcataloguspermission moet tenant-owned catalogusbeheer onderscheiden van administratiegebonden plaatsingsrechten.
- Afdelingen moeten expliciet als tenantbreed of juridisch administratiegebonden kunnen worden vastgelegd; de huidige administratiefilter is niet voldoende.
- Queries, joins, indices, FKs, RLS policies, API-services, UI-filters en tests moeten hun ownership van elkaar kunnen onderscheiden.
- Bestaande Cloud Tags blijven de ene tenantcatalogus; Talent en Star Performers maken geen parallelle tags.

## Migratie-eisen

- inventariseer dubbele codes/namen over administraties voordat unique constraints worden verplaatst;
- behoud `jobs.id`, `job_groups.id`, `job_revisions.id`, `employees.id` en `employments.id`;
- bepaal per bestaande afdeling expliciet `TENANT` of `ADMINISTRATION`;
- valideer dat iedere employment/plaatsing naar een functie uit dezelfde tenant verwijst;
- voer schema, API en UI in die volgorde uit;
- genereer `packages/db/types.ts`, draai Supabase advisors en voer twee-administratie/cross-tenant tests uit vóór activatie.

## Afweging

Een administratiegebonden kopie van het functiehuis lijkt lokaal eenvoudiger, maar maakt een functiewijziging voor dezelfde persoon afhankelijk van de BV, vergroot migratie- en rapportagerisico en creëert parallelle functies. Tenant-owned functiecatalogi met administrationele employmentkoppelingen behouden één betekenis zonder juridische gegevens samen te voegen.
