# PERF-V2-01 — Core TEST, engineering acceptance en integratievoorbereiding

Datum: 27-11-2026

Issue: [#102](https://github.com/EdwinCycling/LiquidHR/issues/102)

Featurebranch: `work/perf-v2-01-20261126`

Code-SHA (typecheck, volledige suite en geïsoleerde production-build): `4f78b5e146d1cfb47cd89bdd8bae6f08f5ddd550`

GitHub `main` bij pre-integratie-readback: `f8db74d5e3e8f32d66c37671bcd57971dcb23fef`

## Status en scope

- V2-code, lokale contracttests, Core TEST-schema-readback en technische gates: **PASS**.
- Gehoste acceptatie met HR Admin-, Manager-, Employee- en AB-sessies: **NOT_RUN**. Er waren geen bestaande ingelogde LiquidHR-sessies beschikbaar. Er zijn geen accounts of tenants gemaakt en geen credentials opgevraagd.
- Vercel TEST-release: **NIET UITGEVOERD**. De aparte vrijgave `RELEASE LIQUIDHR TEST` ontbreekt.
- Er is geen Payroll-schemawijziging of Payroll-migratie uitgevoerd. De twee V2-SQL-bestanden bevatten geen Payroll-verwijzingen.
- V1-securityacceptatie A13, A26 en A27 blijft afzonderlijk OPEN voor latere handmatige beoordeling.

**Statusbetekenis in de matrix:** `Code/Core` meet de lokale code-, SQL-contract- en Core TEST-schema-evidence. `Persona/browser` is de echte gehoste rolacceptatie. Een `PASS` in de eerste kolom is geen browser- of account-PASS. Er is geen volledige hosted ACCEPTANCE GREEN.

## Core TEST-migratie en readback

Doelproject: `wnpfloqpjvaacobppbpk` (Core TEST).

De aangeleverde migratiebron `20261126210000_performance_reviews_additional_reviewer_v2.sql` is vóór toepassing gecontroleerd op forward-only wijzigingen, bestaande tabellen/data, RLS/policies/grants, V1-compatibiliteit en regressietests. De inhoud is ongewijzigd toegepast onder de actuele, unieke registryversie `20261127102848` (`performance_reviews_additional_reviewer_v2`), SHA-256 `8D315B1048A7C439DD190042396DB0C830FEEBD29F6A06BCA1F270CDE7902ECC`. Een aparte advisor-correctie is geregistreerd als `20261127103840` (`performance_reviews_v2_advisor_fixes`), SHA-256 `0E45B1E73CA29951F9D24C4FE9157369E267A0781C463108F83E5D7BE6C2BD7E`. De Core TEST-migratieregistratie telt na toepassing 617 versies en bevat beide exacte entries.

Readback na migratie:

- Bestaande data bleef gelijk: 112 rondes, 87 dossiers, 85 inzendingen en 717 auditregels.
- Alle bestaande rondes hebben `additional_reviewer_enabled = false`; V2-ingeschakelde rondes: 0; V2-dossiers: 0; aanvullende beoordelaarsinzendingen: 0.
- Alle vier nieuwe publieke V2-tabellen hebben RLS en policies. `anon` heeft geen SELECT. De twee command-tabellen hebben ook geen directe authenticated SELECT. `performance_review_closures` en `performance_review_draft_archives` laten authenticated SELECT alleen via hun RLS-policies toe.
- V2 publieke RPC's zijn niet uitvoerbaar door `anon`. De rol- en dossierguards blijven server-/database-side.
- De bestaande V1-statussen en rondes zijn niet herschreven. De V2-workflow staat opt-in uit.
- De bestaande migratiehistorie bevat daarnaast oudere, niet-gerelateerde local/remote lineage-drift. Die is niet gereconcilieerd en er zijn geen andere versies toegepast of herschreven.

Advisors na de follow-upmigratie:

- **Security:** `rls_enabled_no_policy` 11 INFO (ongewijzigde projectbaseline); `anon_security_definer_function_executable` 4 WARN (baseline); authenticated security-definer RPC's 167 WARN, waarvan 11 nieuwe, expliciet gescopeerde V2-RPC's. De V2-RPC's zijn voor `anon` ingetrokken. Er bleef ook 1 bestaande leaked-password-protection WARN.
- **Performance:** ongeïndexeerde foreign keys 170 INFO (terug op baseline); `auth_rls_initplan` 1 WARN (terug op baseline); permissive policies 46 WARN (baseline); `unused_index` 723 INFO, inclusief de 8 nieuwe FK-indexen die nog geen TEST-verkeer hebben gezien.
- Advisor-remediatiepagina's: [authenticated SECURITY DEFINER-functies](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [ongebruikte indexen](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## Typen, tests en technische gates

De volledige Supabase-typegeneratie bevatte Core TEST-drift buiten V2: een ontbrekende `company_activities`-definitie, niet-gerelateerde HR/Payroll-nullabilitywijzigingen en extra niet-V2-RPC's. Die output veroorzaakte echte, niet-gerelateerde typefouten. `packages/db/types.ts` is daarom teruggebracht naar de `main`-baseline plus uitsluitend de V2-tabellen, kolommen, relatie en V2-RPC's. De V2 gegenereerde types parsen en typechecken.

- HR Suite Vitest: **849 bestanden PASS, 4 SKIP; 4.308 tests PASS, 8 SKIP**. Gecontroleerde uitvoering: 4 workers en 15s per test.
- De standaard parallelle run raakte drie 5s-timeouts in zware bestaande PGlite-/Payrolltests; elk slaagde geïsoleerd. De V2-migratietest kreeg een gerichte 15s-timeout. De gecontroleerde volledige suite en aparte payroll-kalendertest slaagden; kalendercontract: **2/2 PASS**.
- TypeScript: `npx tsc --noEmit --incremental false` **PASS**.
- ESLint: **0 fouten, 9 bestaande waarschuwingen** in niet-V2 document-/Payrolltests.
- i18n: **44 NL/EN namespaceparen PASS**.
- Geïsoleerde production-build van code-SHA `4f78b5e146d1cfb47cd89bdd8bae6f08f5ddd550`: **PASS**. De buildbroncontrole bevestigde de exacte SHA; Next compileerde, TypeScript slaagde, 369 statische pagina's werden gegenereerd, Payroll-clientgrensscan slaagde (189 browserassets), en function-trace-/PDF-runtimegates slaagden.
- Lokale Node is 22.14.0; `@sparticuz/chromium` vraagt `^22.17.0 || >=24`. De build slaagde ondanks die enginewaarschuwing. Vercel-project `liquidhr` gebruikt Node 24.x. `npm ci` rapporteerde 15 dependency-auditbevindingen (10 moderate, 5 high); geen dependency is gewijzigd.

## PERF-V2-A01 t/m A24

| ID | Code/Core-status | Persona/browser-status | Bewijs en grens |
| --- | --- | --- | --- |
| A01 | PASS | NOT_RUN | DB-default is UIT; bestaande 112 rondes bleven UIT; lokale V1/V2-fasecontracttests PASS. Gehoste V1-smoke ontbreekt. |
| A02 | PASS | NOT_RUN | Rondeflag, dossierrollen, API/RPC-validatie en lokale component-/contracttests PASS. HR Admin-selectie niet live uitgevoerd. |
| A03 | PASS | NOT_RUN | Dossiergebonden GV-override werkt zonder wijziging van formele organisatiehiërarchie; lokale test PASS. Geen HR Admin-/Manager-sessie. |
| A04 | PASS | NOT_RUN | AB-toewijzing, kandidaatselectie en dossiergebonden RLS-contract lokaal PASS. Geen AB-account gebruikt. |
| A05 | PASS | NOT_RUN | Individuele GV/AB-configuratie via geautoriseerde route/RPC en audit lokaal getest. Geen browseractie. |
| A06 | PASS | NOT_RUN | ALL/FILTERED/SELECTED preview- en apply-contracten lokaal getest. Geen echte deelnemersselectie in browser. |
| A07 | PASS | NOT_RUN | Preview is read-only; set/hash/versioncontrole lokaal getest. Geen gehoste preview. |
| A08 | PASS | NOT_RUN | Transactie-/idempotencycontract en retry lokaal PASS. Geen live concurrencyrun. |
| A09 | PASS | NOT_RUN | Ingediende feedback en gesloten rondes leveren lokale blokkades/uitzonderingen zonder mutatie. Geen hosted statusprobes. |
| A10 | PASS | NOT_RUN | PMUX-contract/PGlite doorloopt zelfreflectie → AB → GV → medewerkerbevestiging → GV-sluiting. Geen echte rolwisseling door de stappen. |
| A11 | PASS | NOT_RUN | AB-concept kan vóór submit wijzigen; ingediende bijdrage is immutable; scorevelden worden geweigerd. Lokale migratietest PASS. |
| A12 | PASS | NOT_RUN | AB schrijft geen score en heeft geen document-/attachmentmutatierecht; lokale grants/RLS-contracttests PASS. Hosted Storage-weigering ontbreekt. |
| A13 | PASS | NOT_RUN | V2-AB-tekst kan na submit niet worden herschreven; lokale DB-guardtest PASS. Dit sluit V1-A13 niet; die blijft OPEN. |
| A14 | PASS | NOT_RUN | Lokale selectietest toont AB-feedback pas na definitieve GV-submit. Geen medewerkeraccount-readback. |
| A15 | PASS | NOT_RUN | Akkoord en gemotiveerd niet-akkoord lokaal getest, inclusief redenvalidatie. Geen echte medewerkerbevestiging. |
| A16 | PASS | NOT_RUN | Alleen toegewezen GV sluit V2; employee/HR Admin-weigering en V1-eindpad lokaal getest. Geen hosted sluiting. |
| A17 | PASS | NOT_RUN | HR-only vervanging/vrijgave, motivatie, versiecheck en audit lokaal getest. Geen HR Admin-sessie. |
| A18 | PASS | NOT_RUN | Ronde-close-contract bewaart status en stopt bestaande PMUX-taken; lokale suite PASS. Core TEST-taskstatus niet live doorlopen. |
| A19 | PASS | NOT_RUN | Lokale RLS-tests begrenzen privénotities, GV/HR-concepten, andere dossiers en Storage. Geen echte AB-negatieve sessie. |
| A20 | PASS | NOT_RUN | PGlite weigert verkeerde tenant/groep/administratie/employee/role-scope; geen echte andere-tenantidentiteit gebruikt. |
| A21 | PASS | NOT_RUN | Bestaande review-service en lokale dashboard/dossier/historietests gebruiken dezelfde bron. Geen hosted projectiereadback. |
| A22 | PASS | NOT_RUN | Lokale bulk/reassign/idempotencytest houdt één open PMUX-item over. Geen gehoste queue-inspectie. |
| A23 | NOT_RUN | NOT_RUN | NL/EN-pariteit PASS (44 namespaces); viewport-, toetsenbord-, focus- en screenreaderacceptatie niet uitgevoerd. |
| A24 | PASS* | NOT_RUN | Core-migratie, RLS, full suite, typecheck, lint, i18n en production-build PASS. *A24 blijft als totaal NOT_RUN totdat echte E2E apart is bewezen. |

## GitHub-integratievoorstel

Pre-integratie-readback bevestigde GitHub `main` op `f8db74d5e3e8f32d66c37671bcd57971dcb23fef`; de featurebranch bevatte vijf gerichte commits. De code-/migratiediff buiten dit rapport was 35 bestanden, 3.438 toevoegingen en 153 verwijderingen; `git diff --check` was schoon. Dit rapport is de enige extra documentatiefile. `apps/hr-suite/vercel.json` heeft geen diff en houdt `git.deploymentEnabled: false`. De resterende lokale dirty/untracked bestanden zijn niet staged of gecommit.

Voorstel op de pre-integratiesnapshot: integreer uitsluitend de featurecommits met een gecontroleerde PR naar `main`, na hercontrole van de actuele main-SHA en PR-diff. De integratie wijzigt alleen de Development-baseline; start geen Vercel-release. De uiteindelijke main-SHA staat in de afleverstatus; de code-SHA in deze matrix blijft `4f78b5e146d1cfb47cd89bdd8bae6f08f5ddd550`.

## Vercel TEST-releasechecklist

**Huidige projectreadback:** project `liquidhr`, root `apps/hr-suite`, Node 24.x. De nieuwste READY deployment is `dpl_CwPwQJ8WEp4WTEPwtLqXuptcdbhZ`, bron-SHA `3b76be2c614d4e1abbac5f7289925ef8d75eddbd`. De huidige primaire aliassen `liquid-hr-hr-suite.vercel.app` en `liquidhr-edwinitsolutions.vercel.app`, plus de branchalias `liquidhr-git-3b76be2c614d4e1abbac5f7289-816bac-edwinitsolutions.vercel.app`, blijven eraan gekoppeld. READY fallbackdeployment: `dpl_799S2oXST6MgNzW96iBqUnhUQ1RK`, SHA `69d29bbe80a5791cf31c1d4966347f756cd10130`.

1. Gebruik na integratie de exacte actuele GitHub `main`-SHA als releasesource; voer vóór build de migration-/buildbroncontrole uit. Projectroot blijft `apps/hr-suite`; geen deploy hooks zijn geconfigureerd en `git.deploymentEnabled: false` blijft intact.
2. V2 gebruikt de al toegepaste Core TEST-versies `20261127102848` en `20261127103840`. Voer geen brede `supabase db push`, migratiereconciliatie of Payroll-migratie uit tijdens release.
3. Na afzonderlijke `RELEASE LIQUIDHR TEST`-vrijgave: deploy uitsluitend naar het bestaande `liquidhr`-project. Controleer READY, source-SHA, runtime-provenance en aliaskoppelingen.
4. Smoke met bestaande geautoriseerde identiteiten: V1-ronde zonder AB; opt-in ronde; onafhankelijke GV/AB-configuratie; individuele flip; bulk ALL/FILTERED/SELECTED-preview/apply/retry; AB-concept/indiening/privacy; GV-submit; medewerker akkoord/niet-akkoord; GV-sluiting; HR-vervanging/vrijgave; audit/historie; één PMUX-item na reassign; cross-scope negatieve API/RLS-/Storage-proeven.
5. Gebruik alleen bestaande toegestane synthetische fixtures; maak geen accounts of tenants. Registreer iedere ontbrekende browser-/securityproef als NOT_RUN.
6. Bij een mislukte release: herstel aliases naar de bestaande READY baseline/fallback en houd de reeds toegepaste additive schema-uitbreiding staan. Er is geen V2-down-migratie; de V1-app blijft schema-compatibel.

**Besluit:** releasevoorbereiding gereed; release en hosted persona-smoke blijven wachten op de expliciete vrijgave en beschikbare bestaande sessies.
