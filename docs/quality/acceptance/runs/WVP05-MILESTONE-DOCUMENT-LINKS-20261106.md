# WVP05 — documentkoppelingen aan WVP-mijlpalen

**Datum:** 6 november 2026
**Branch:** `work/wvp05-20261106`
**Basis:** `main` / `origin/main` `8c580cda76cd2ea641ddaafe13a7b55213d89833`
**Status:** [Draft PR #97](https://github.com/EdwinCycling/LiquidHR/pull/97) open en mergeable; integratie- en TEST-acceptatie OPEN
**Implementatiecommit:** `8d7de273cefbcebee5a871786298aa041dd73dc6`

## Functionele scope

De bestaande WVP-casuswerkplek kan een bestaand, toegankelijk medewerkerdocument koppelen aan een bestaande WVP-mijlpaal. De lijst toont koppelingen per mijlpaal; een ontbrekende koppeling wordt niet als ontbrekend document uitgelegd. Bevoegde HR Admins en Managers kunnen binnen bestaande casus-, team-, HR-groep-, administratie- en documentrechten koppelen en na bevestiging uitsluitend de koppeling verwijderen. Employee kan alleen toegestane eigen koppelingen lezen. Documentbestand, titelmetadata en inhoud worden niet naar de koppeling gekopieerd; het bestand blijft in de bestaande documentservice.

WVP02 Draft PR #94 en WVP03 Draft PR #95 zijn niet gewijzigd. WVP04 staat in [Draft PR #96](https://github.com/EdwinCycling/LiquidHR/pull/96), open en mergeable op base `8c580cda76cd2ea641ddaafe13a7b55213d89833`, head `a981b6b2896f001ea98cb958d839775dc98bff57`. Er is geen merge of release uitgevoerd.

## Database- en autorisatiecontract

Forward-only migration `20261106180416_wvp05_milestone_document_links.sql` maakt een relatie met alleen casus-, mijlpaal- en document-ID's, actor/tijdstempels en soft-removal. Bestaande WVP-mijlpaalcodes worden gevalideerd. Serverfuncties hercontroleren tenant, HR-groep, administratie, casus, medewerker, bestaande mijlpaal en `document:read`; case-/teamtoegang komt uit `wvp_case_access`. De unieke actieve relatie maakt toevoegen idempotent. Directe client-DML is niet verleend; RLS beperkt lezen op casus- en documentrechten. Audit schrijft alleen relatie-ID's en actie vast. Ontkoppelen verwijdert het brondocument niet; gesloten trajecten zijn niet wijzigbaar.

Migrationcode en contracttests zijn toegevoegd. Er is geen Supabase TEST-read, migration-advisor of migratietoepassing uitgevoerd. Er zijn geen databasewrites, grants, gepubliceerde definities of casusdata gewijzigd.

## Checks

| Controle | Status | Bewijs |
| --- | --- | --- |
| `git diff --check` | **PASS** | Geen whitespacefouten. |
| `node scripts/check-i18n.mjs` | **PASS** | 43 NL/EN-namespaces met gelijke sleutels. |
| WVP05 SQL/PGlite-contracttests | **NOT RUN** | Tests toegevoegd; bestaande Vitest-binary ontbreekt in root- en app-`node_modules`. Geen installatie of herstelpoging. |
| WVP-casus UI-regressietest | **NOT RUN** | Test toegevoegd voor documentweergave en Employee-beheerafscherming; Vitest niet beschikbaar. |
| TypeScript / lint | **NOT RUN** | Bestaande lokale `tsc`-/ESLint-binaries ontbreken. |
| TEST-browser/persona | **NOT RUN** | Chrome had geen LiquidHR-runtimetab. Er is geen login of role-switch gestart. |
| Supabase migration/advisors | **NOT RUN** | Migration is niet op Core TEST toegepast; dit vraagt een afzonderlijk mandaat. |

De nieuwe contracttests dekken toegestane HR Admin/Manager-mutaties, actor-/team-/HR-groep-/administratie-/tenant-/medewerkerscope, ontoegankelijke documenten, bestaande-mijlpaalvalidatie, idempotentie, Employee self-only read, RLS/directe DML, auditinhoud, ontkoppelen zonder documentverwijdering en blokkade op gesloten casussen. Dit zijn aanwezige testgevallen, geen uitgevoerde testresultaten.

## Open gates

- Securitystatus blijft **OPEN** totdat de bestaande PGlite-contracttests zijn uitgevoerd en de gegenereerde databasecontracten tegen de migrationbron zijn gevalideerd.
- Core TEST migration readback/advisors en bestaande `hr-admin`, `manager`, `employee` positieve en negatieve scopeacceptatie zijn niet uitgevoerd.
- WVP05 claimt geen wettelijke RIV-compleetheid en maakt geen wettelijke documenten.
- Geen merge, databasewrite of deployment.
