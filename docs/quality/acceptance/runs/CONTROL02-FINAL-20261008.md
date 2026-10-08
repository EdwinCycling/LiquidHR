# CONTROL02 final debug — 8 oktober 2026

Status: **PARTIAL / NOT MERGE-READY / NOT RELEASED**.

## Bewezen correcties

De smalle kandidaat 20261008150542 behandelt alleen twee lokale variabelen en is onvoldoende. De definitieve kandidaat 20261008154011_control02_test_final_writer_runtime_guards.sql vervangt uitsluitend execute_control02_test_payroll_finalization_action en record_payroll_import_finalization_event, plus bestaande beperkte grants. Geen migration-time datawijzigingen of Core-table/constraintwijzigingen.

Canonical LF SHA-256: `715061C071F8F5E2E95AC341F7C80D36E7780B4F22ED351A67F3264BD31AB46D`.

- Alle lokale writer-/eventvariabelen hebben v_-prefix; tabelkolommen gebruiken expliciete aliassen. Completion-proofs voor eerder gemaakte Employee/Employment blijven aantoonbaar gekoppeld aan plan, action en checkpoint.
- Ontbrekende match.action/employment.action worden fail-closed geweigerd; NULL mag geen IN-lijstcontrole omzeilen.
- CREATE/LINK/NO_CHANGE controleren Employment-scope, status en periode vóór writes. Overlappende Employment/IKV-perioden worden vóór INSERT geweigerd volgens de bestaande exclusion-constraint.
- CREATE_DRAFT_EMPLOYMENT controleert de definitieve opgeslagen contractvoorwaarden ná INSERT, inclusief niet-NULL target. Een testtrigger die contract_type wijzigt bewijst deze readbackfence.
- Lease-expiry gebruikt clock_timestamp, ook als dezelfde transactie eerder begon. Writer en recorder controleren actor, lease-owner/token, attempt en event-state. Completion-events verlangen expliciet readbackVerified; ontbrekende proofvelden worden geweigerd.
- Source-reference, source/archive/XSD/schema/contractversies, core-state versies en dependency-proofs blijven onderdeel van de bestaande fences.

## Werkelijke PostgreSQL-verificatie

23 casussen PASS op echte PostgreSQL 17.10 met synthetische transactionele rollbackfixtures. [Resultaten](CONTROL02-20261008-postgres-results.json); [runner en beperkingen](../../../../apps/hr-suite/lib/payroll-import/finalization/postgres-fixtures/README.md).

CREATE_DRAFT_EMPLOYMENT, CREATE_INCOME_RELATIONSHIP, LINK_INCOME_RELATIONSHIP, REUSE_EMPLOYEE, REUSE_EMPLOYMENT, NO_CHANGE, completion, half-open einddatum, dependency, retry en recovery zijn positief uitgevoerd. Negatieven omvatten ontbrekende beslisactie/contractbevestiging, foutieve versie/state-token/scope, ontbrekende dependency, stale/wrong-owner lease, post-INSERT contractmutatie, overlappende tweede IKV en ontbrekend readbackVerified. De bestaande completed Employee/Employment-proofroute maakt geen duplicaten.

De narrow-baseline gaf zes falende casussen in twintig tests: ontbrekende beslisactie, onvoldoende Employment-periodevalidatie, leaseverloop binnen dezelfde transactie, ontbrekende readback van nieuwe Employmentvoorwaarden en onverklaarde Core-overlap. De writerfouten zijn gezamenlijk gecorrigeerd; de overlap blijft een expliciete domeinblokkade. Tekstcontracttests blijven aanvullende controle.

De snapshot omvat 19 tabellen, gebruikte enums en 123 PK/UNIQUE/CHECK/exclusion-constraints. Foreign keys, volledige Supabase-trigger/RLS/JWT-context zijn niet gekloond; dit is geen volledige remote auth/concurrency/E2E-sign-off.

## Concrete resterende blocker

TEST-project wnpfloqpjvaacobppbpk: bestaande batch ca8d6435-d953-44f3-ba68-77ec8d9e6d7c, plan e497300e-0921-418f-a2e1-b5f7bb1f84c6. Employee 100023 (5762d5a3-1289-4ded-a6ba-8f23065ee626) en Employment 1 (c6aa752b-3a77-4a24-9197-58c607a7588a) bestaan. Laatste authoritative readback: 2 completed / 1 failed / 4 pending; batch STAGED; nul IKVs en links. Deze ronde schrijft niets naar TEST.

Rij 1 koppelt twee IKVs aan hetzelfde concept-Employment:

| IKV | Start | Einddatum bron |
| --- | --- | --- |
| 1 | 2026-01-01 | geen |
| 2 | 2026-01-15 | 2026-12-31 |

De live employment_income_relationships_no_overlap constraint sluit overlappende daterange(valid_from, valid_until, '[)') per tenant/employment uit. De positieve tweede-IKV-test gebruikt twee expliciet afzonderlijke Employments; dit is uitsluitend een synthetische fixture. De echte batchmapping is behouden. Geen stilzwijgende tweede Employment, broncorrectie of zwakkere Core-regel.

INDEFINITE is geen aangenomen standaard: beide opgeslagen persoonsbeslissingen bevatten employmentByIncomeRelationship.contractType=INDEFINITE en confirmed=true (7 oktober 2026, 13:42:17.714Z en 13:43:33.016Z). De UI start zonder contracttype wanneer de beslissing ontbreekt. De bron XML bewijst dit type niet; de expliciete opgeslagen bevestiging is de grondslag.

## Codebehoud en integratie

Oorspronkelijke worktree control02-final-20261007 heeft HEAD 38ccbcac6423824a1dba7075f022f68771edf087 en MERGE_HEAD 2dd5cd43975f4da1c6e88992926f303ff2798c50. Geen reset, merge-abort, checkoutforce of verwijdering van merge-metadata. Git werkt in dit pad met passende filesystemtoegang; de sandbox writable roots omvatten dit pad niet.

Vooraf: 122 bestandskopieën met individuele hashes, binary staged/unstaged patches, originele index/merge-metadata en geverifieerde complete Git-bundle. Daarna: alternate-index snapshot c0cad9c2ca30c365cf2d2f33de1347f3fe80a180 op backup/control02-final-debug-20261008 en final-history.bundle. Het oorspronkelijke indexbestand en de merge blijven behouden. De canonieke beschermde .env.local blijft buiten alle checkpoints/commits en bestaat.

Schone integratieworktree control02-closeout-20261008, branch codex/control02-closeout-20261008 vanaf actuele remote main 249c737941d682cb834e313097a9df009549c11b. CONTROL02-patch integreerde zonder conflicts; andere wijzigingen zijn alleen gearchiveerd. Draft PR blijft zichtbaar PARTIAL. Geen main-merge, Production-write of deploy.

## Gates

- Echte PostgreSQL: 23/23 PASS.
- CONTROL02 API/ledger/writer unitregressie: 30 bestanden / 188 tests PASS.
- Strict TypeScript non-incremental: PASS.
- NL/EN i18n: PASS, 41 namespaces.
- Volledige suite: 587 bestanden PASS, 4 skipped; 2.613 tests PASS, 8 skipped. Bestaande React act-waarschuwingen zichtbaar; geen failures.
- Changed-area ESLint: 0 errors, 5 bestaande service-test unused-variable warnings; git diff --check PASS.
- Productiebuild: wordt op de schone codecommit via de officiële launcher uitgevoerd; exacte uitkomst staat in de Draft PR.
- Definitieve TEST-migration: wacht op checksumgebonden toestemming.
- Volledig herstel bestaande batch, authoritative completionreadback en duplicatevrije remote retry: BLOCKED op bevestigde IKV/Employment-overlap.
- Remote auth/scope/concurrency, finale desktop en 390px: OPEN; lokale unit-/PostgreSQL-negatieven vervangen deze gates niet.

De volgende inhoudelijke stap is een expliciet domeinbesluit over de conflicterende bevestigde mapping. Binnen de bestaande Core-regel moet de toewijzing werkelijk geldig zijn; een wijziging van die regel valt buiten deze CONTROL02-opdracht. Daarna kan dezelfde batch via normale herstelacties worden afgerond, met behoud van historische events en bestaande Employee/Employment.
