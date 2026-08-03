# Talent fase 2 — M2.0 contracten en gegevensbescherming

**Status:** CONCEPT — M2.0-baseline afgerond; M2.1 is onder veilige defaults uitgevoerd  
**Datum:** 2026-08-02  
**Plan:** `talent-phase2-implementation-plan-20260802.md`

## 1. Scope en grens

M2.0 levert het contract vóór nieuwe fase-2-tabellen:

1. rol- en accessmatrix;
2. dataclassificatie en dataminimalisatie;
3. status-, datum-, herkomst-, vertrouwelijkheids- en archiveringssemantiek;
4. voorgestelde canonieke permissions;
5. audit-, scope-, notificatie- en schema-contract;
6. acceptatietests en traceability.

Er worden in deze M2.0-baseline zelf geen fase-2-tabellen, seed, API-route, UI, i18n-namespace of generated DB type toegevoegd. Wel is de bestaande `public.audit_logs`-Data API-grens gehard. De SQL-proef in `apps/hr-suite/supabase/tests/talent_phase2_m2_0_contract.sql` bewaakt deze baseline. Na expliciete opdracht is M2.1 vervolgens uitgevoerd met de veilige defaults uit FDR-0003; de overige fase-2-domeinen blijven geblokkeerd tot hun productbesluiten zijn bevestigd.

## 2. Bestaande contractinventaris

| Onderdeel | Bestaande bron | M2.0-beoordeling |
|---|---|---|
| Tenantgrens | `tenant_id`, ADR-0006, bestaande RLS-helpers | Hergebruiken; geen client-tenant vertrouwen. |
| Persoon | `employees` | Eén tenantbrede persoon; geen Talent-employee dupliceren. |
| Werkgevercontext | `employments`, `employee_organizations` | Alleen gebruiken voor expliciete administrationele provenance en actuele managerscope. |
| Serverautorisatie | `requirePermission()` in `lib/auth/permissions.ts` | Verplicht vóór service/query; bewijst zelf-scope of manager-targetscope niet zelfstandig. |
| Manager-scope | `internal_security.current_employee_id()` plus effective-dated `employee_organizations` | Hergebruiken in RLS, services en negatieve tests. |
| Audit | `public.audit_logs` plus `internal_security.audit_hr_change()` | Enige auditbron behouden; correlation ID en fase-2-acties ontbreken nog. |
| Notificaties | Geen generieke `notifications`-tabel; wel reminders en `hr_change_events` | Geen automatische fase-2-notificaties vóór M20-07. |
| Talentbasis | `talent:read`, `talent:manage`, `talent:manager-read`, `self:talent:read` | Bestaande permissions behouden; niet hergebruiken als brede persoonlijke-recordpermission. |
| Auditpermission | `talent-audit:read` staat in het securitydesign maar is niet in de huidige migration/seed aangetroffen | Discrepantie vóór auditviewer oplossen; nu niet stilzwijgend toevoegen. |

## 3. Rol- en accessmatrix

`HR Admin` betekent technisch `TENANT_ADMIN`; componenten en services vergelijken alleen canonieke permissioncodes.

| Fase-2-onderdeel | HR Admin | Manager | Medewerker |
|---|---|---|---|
| Eigen capabilityregistraties | Tenantbreed lezen/beheren | Lezen binnen actuele managerscope, volgens vrijgavebeleid | Alleen eigen lezen; eigen concept opslaan indien M20-01 dit toestaat |
| HR-kwalificaties | Tenantbreed beheren | Lezen binnen scope, zonder private evidence tenzij beleid dit toestaat | Eigen vrijgegeven kwalificaties |
| Self-assessment | Cyclus beheren; resultaten lezen volgens audit-/beleidsscope | Geen selfdata van anderen buiten cyclusbeleid | Eigen antwoord invullen en vrijgegeven eigen resultaat lezen |
| Manager-assessment | Cyclus beheren; volledige geautoriseerde auditprojectie | Eigen team beoordelen binnen `OPEN` cyclus | Eigen vrijgegeven uitkomst; geen private managernotitie |
| Team Talent / Skills Matrix | Tenantbreed binnen permission en filters | Alleen actuele eigen scope | Geen teamoverzicht |
| Vergelijking | Binnen expliciete functiegroep en minimumgroepsbeleid | Alleen geautoriseerde scope en minimumgroepsbeleid | Niet beschikbaar |
| Import/bulkmutatie | Preview, commit en rollback | Niet in fase 2A | Niet beschikbaar |
| Doelen/POP | Beleid, beheer en audit | Eigen team ondersteunen volgens beleid | Eigen doelen en voortgang |
| Export | Alleen allowlisted tenantdata, auditbaar | Alleen allowlisted scope, auditbaar | Alleen eigen data wanneer geactiveerd |

Deze matrix is het M2.0-contract; de concrete permission-seed en eventuele beleidsuitzonderingen blijven geblokkeerd tot de review van ADR-0007/FDR-0003.

## 4. Dataclassificatie

Dit is een productmatige vertrouwelijkheidsindeling, geen juridische kwalificatie.

| Klasse | Voorbeelden | Minimale bescherming |
|---|---|---|
| T1 — Talentconfiguratie | Capabilities, levels, functieprofielen en cycle-definities | Tenant-RLS, permission, audit op mutatie; geen anon/public grants. |
| T2 — Persoonsgebonden Talent | Capabilitywaarde, herkomst, geldigheid, kwalificatievelden | `tenant_id + employee_id`, actuele self/manager/HR-scope, DTO-allowlist, geen brede managercatalogusgrant. |
| T3 — Restricted assessment | Self-/managerantwoorden, scores, release-status en evidence-metadata | Afzonderlijke response- en zichtbaarheidspolicies; geen stille overschrijving; audit zonder volledige inhoud. |
| T4 — Private evidence/notitie | Documentinhoud, signed-downloadreferentie en private managernotitie | Gescheiden opslag/projectie, expliciete evidencepolicy, geen standaard manager-/medewerkerinzage in private velden. |
| T5 — Audit/security metadata | Actor, tenant, object, actie, tijd, correlation ID en denialreden | Append-only, `audit:read`/toekomstige `talent-audit:read`, geen gevoelige broninhoud in `changes`. |

Dataminimalisatie:

- persoonlijke records bevatten alleen de capability, typegebonden waarde, herkomst, geldigheid, status en noodzakelijke evidenceverwijzing;
- geen medische oorzaak, BSN, salaris, vrije medische tekst of automatisch afgeleide matchscore;
- private note en evidence worden nooit onderdeel van een generiek `select *` of ongefilterd readmodel;
- exports gebruiken een vaste allowlist per permission en loggen filter, scope en recordaantal.

## 5. Status-, datum- en herkomstcontract

De normatieve semantiek staat in [FDR-0003](../../../decisions/FDR-0003-talent-fase-2-assessment-en-evidencebeleid.md).

- Capabilityregistratie: `DRAFT`, `RELEASED`, `EXPIRED`, `ARCHIVED`.
- Assessmentcyclus: `DRAFT`, `OPEN`, `CLOSED`, `ARCHIVED`.
- Assessmentantwoord: `DRAFT`, `SUBMITTED`, `LOCKED`, `FINALIZED`; `REOPENED` is een expliciete command-/auditactie die teruggaat naar `DRAFT`.
- Herkomst: `SELF_ENTERED`, `HR_ENTERED`, `MANAGER_ENTERED`, `IMPORTED`.
- Geldigheid: `[valid_from, valid_until)` met exclusieve `valid_until`.
- Events: UTC `timestamptz`; geen lokale browserdatum als autoritatieve opslag.
- Archiveren is de standaard voor historische records; hard delete alleen voor ongebruikte niet-historische testrecords.

## 6. Voorgestelde canonieke permissions

De volgende codes volgen de repositoryregel `resource:action` of `self:resource:action`. Ze zijn **PROPOSED** en worden niet door M2.0 ge-seed.

| Permission | Doel | Beoogde toepassing |
|---|---|---|
| `talent-record:read` | Persoonlijke Talentrecords lezen | HR tenantbreed; manager binnen scope |
| `talent-record:write` | Persoonlijke Talentrecords beheren | HR; manager alleen wanneer het concrete proces dit toewijst |
| `self:talent-record:read` | Eigen Talentrecords lezen | Medewerker |
| `self:talent-record:write` | Eigen conceptrecord opslaan | Medewerker, afhankelijk van M20-01 |
| `talent-qualification:read` | Kwalificaties lezen | HR en manager binnen scope |
| `talent-qualification:write` | Kwalificaties beheren | HR |
| `self:talent-qualification:read` | Eigen vrijgegeven kwalificaties lezen | Medewerker |
| `talent-assessment:manage` | Cyclus, beleid, lock/reopen/finalize beheren | HR |
| `talent-assessment:read` | Assessmentprojecties lezen | HR en manager volgens scope/policy |
| `talent-assessment:write` | Managerantwoord schrijven | Manager binnen actuele scope en `OPEN` cyclus |
| `self:talent-assessment:read` | Eigen vrijgegeven assessment lezen | Medewerker |
| `self:talent-assessment:write` | Eigen self-assessment schrijven | Medewerker binnen `OPEN` cyclus |
| `talent-team:read` | Team Talent/Skills Matrix lezen | HR tenantbreed; manager binnen scope |
| `talent-comparison:read` | Vergelijken binnen functiegroep | HR; manager alleen na beleid |
| `talent-import:manage` | Import preview/commit/rollback | HR |
| `talent-goal:read` / `talent-goal:write` | Doelen/POP binnen toegewezen scope | HR en manager volgens beleid |
| `self:talent-goal:read` / `self:talent-goal:write` | Eigen doelen lezen/wijzigen | Medewerker |
| `talent-export:read` | Toegestane Talentdata exporteren | Per rol allowlisted en auditbaar |
| `talent-audit:read` | Gesaneerde fase-2-audit lezen | HR; bestaande code/seedstatus eerst harmoniseren |

Er worden geen alternatieve codes zoals `self:read`, rolnaamchecks of permissiewildcards toegevoegd.

## 7. Schema-contract vóór M2.1

Dit is een logisch schemaontwerp, geen migration.

### 7.1 Persoonlijke capabilityregistratie

Voorgestelde tabel `talent_employee_capability_records`:

- `id`, `tenant_id`, `employee_id`, `capability_id`;
- typegebonden waarde volgens capabilitytype; één server-/databasecontract valideert de combinatie;
- `source_type`, `valid_from`, `valid_until`, `status`;
- optionele evidenceverwijzing naar de bestaande geautoriseerde documentprojectie, nooit naar vrije storage-invoer;
- `created_by_user_id`, `updated_by_user_id`, `created_at`, `updated_at`, `archived_at`, `archived_by_user_id`, `version`;
- geen `administration_id` als ownershipkolom; eventuele `employment_id` blijft een expliciet te beslissen provenanceveld.

Invarianten: tenant-FK's op employee/capability/evidence, geen overlap voor dezelfde actieve claim wanneer het product dat vereist, geen update van herkomst of historische release zonder expliciet command, en RLS per actie.

### 7.2 Assessmentcyclus en responses

Minimaal gescheiden:

- `talent_assessment_cycles`: tenant, naam/code, scope, open/sluitdatum, schaalconfiguratie, result-releasepolicy, status en version;
- `talent_assessment_items`: cyclusonderdelen en broncapability/profielversie;
- `talent_assessment_responses`: subject employee, assessor employee/user, `SELF` of `MANAGER`, status, concurrencytoken en eventdatums;
- `talent_assessment_answers`: antwoord per onderdeel; geen private note/evidence in dezelfde ongefilterde rij;
- `talent_assessment_private_notes`: managernotities als afzonderlijke, strengere projectie;
- `talent_assessment_evidence`: expliciete evidencepolicy en verwijzing naar geautoriseerde bestaande documentopslag.

Een managerresponse krijgt altijd zowel `tenant_id` als `subject_employee_id` en wordt bij iedere mutation getoetst aan de actuele effective-dated scope. Een selfresponse resolveert actor via `auth.uid()` en accepteert geen `employeeId` uit URL/body als bron van waarheid.

### 7.3 Auditcontract

`audit_logs` blijft de enige bron. Voor fase 2 is vóór M2.1 nodig:

- correlation ID per samengestelde operatie;
- expliciete acties voor submit, lock, reopen, finalize, release, archive en export;
- optioneel `source_channel` voor `WEB`, `IMPORT` en gecontroleerde systeemacties;
- sanitized before/after-metadata, geen raw evidence of volledige private notities;
- append-only voor normale authenticated clients; uitzonderingen zijn afzonderlijk allowlisted en audited;
- denied-actionbeleid dat actor, tenant, objecttype, actie en reden vastlegt zonder gevoelige payload.

## 8. RLS- en API-contract

- Iedere nieuwe tabel in `public` krijgt in dezelfde migration RLS, policies, grants, FK-indexen en audittrigger.
- `anon` en `public` krijgen geen Data API-toegang tot fase-2-tabellen of RPC's.
- `authenticated` krijgt alleen de benodigde tabel-/kolomgrants; RLS bepaalt tenant, self en manager-scope.
- `UPDATE` gebruikt altijd zowel `USING` als `WITH CHECK`.
- RLS-policies zijn per actie gescheiden als lifecycle of privacy daarvan afwijkt; `FOR ALL` wordt niet als shortcut gebruikt.
- Readmodels/views gebruiken `security_invoker=true` of een niet-exposed schema.
- Self-RPC's bepalen `employee_id` uit `auth.uid()`; client-ID's worden geweigerd of genegeerd.
- Services gebruiken de cookiegebonden serverclient; een service-roleclient is niet toegestaan in Talent-read/writeflows.
- API-responses gebruiken vaste DTO's met allowlists en stabiele domeinfoutcodes; raw Supabase-/SQL-fouten lekken niet.

## 9. M2.0-gate

M2.0 is nog niet gesloten. De volgende punten blokkeren M2.1:

1. review en acceptatie van ADR-0007;
2. besluit op M20-01 t/m M20-07 in FDR-0003;
3. harmonisatie van `talent-audit:read` tussen securitydesign, migration en code;
4. ~~intrekken van de huidige brede `anon`-grants op `public.audit_logs`~~ — uitgevoerd in lokale bronmigratie `apps/hr-suite/supabase/migrations/20260802173000_harden_audit_log_data_api_grants.sql` en remote toegepast als `20260802131815_harden_audit_log_data_api_grants`;
5. akkoord op audit correlation/source-channel/denied-action-contract;
6. akkoord op de exacte phase-2 permission-seed.

Tot deze gate is beoordeeld, blijft fase 2 in ontwerp en worden geen nieuwe tabellen, permissions, routes of UI-flow geïmplementeerd. De bestaande audit-grant-hardening is een beperkte M2.0-gegevensbeschermingscorrectie en activeert geen fase-2-contract.
