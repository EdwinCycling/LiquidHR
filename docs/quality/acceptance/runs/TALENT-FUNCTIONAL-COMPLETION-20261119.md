# TALENT-FUNCTIONAL-COMPLETION — lokale acceptatie

**Datum:** 19-11-2026
**Opdrachtgever:** Edwin
**Branch:** `work/talent-functional-completion-20261119`
**Werkbasis:** `69d29bbe80a5791cf31c1d4966347f756cd10130`
**Status:** lokale implementatie PASS; geauthenticeerde personaacceptatie PARTIAL/OPEN.

## Geleverd

- Employee-selfservice leest de competenties uit het actuele functieprofiel en laat daarmee een expliciete plan-/capabilitykoppeling vastleggen. De service valideert die koppeling bij maken en wijzigen; een capability buiten het eigen profiel wordt met 403 geweigerd.
- Planresultaten zijn gepagineerd tot 20.000 rijen; bij overschrijding faalt de bron gesloten. Ook afgekorte medewerker-, capability-, profiel-, vereisten-, level-, team- en Continuous Appraisal-bronnen leveren geen stilzwijgend onvolledige totalen.
- Skillgapstatussen onderscheiden `MATCH`, `INSUFFICIENT_LEVEL`, `NOT_ASSESSED`, `MISSING_LEVEL`, `MISSING_EVIDENCE` en `EXPIRED_EVIDENCE`. Alleen vrijgegeven, actuele records met geverifieerd bewijs kunnen niveauvergelijking opleveren. Ontbrekend of verlopen bewijs wordt niet als onvoldoende niveau gerekend.
- Ontwikkelprioriteiten koppelen een plan uitsluitend wanneer zowel medewerker-ID als capability-ID overeenkomen. Continuous Appraisal-acties blijven contextacties zonder verzonnen competentierelatie.
- Rapportlinks openen de juiste rolgebonden planroute met exact medewerker- en plan-ID. API-filters blijven behouden; CSV bevat alle rapportplannen en acties, inclusief capability-ID en bronlink. De UI meldt afgekorte zichtbare lijsten en de beschikbare export.

## Synthetische TEST-data

Alleen geaggregeerde, read-only databasevragen uitgevoerd; geen medewerker- of bewijsgegevens zijn uitgelezen.

- 109 actieve medewerkers, 35 capabilities, 6 actieve en 1 concept functieprofielversie, 24 functieprofielvereisten.
- 8 niet-gearchiveerde ontwikkelplannen: 4 concept, 2 actief en 2 afgerond. Alle 8 hebben `capability_id = NULL`.
- Competentierecords: 4 vrijgegeven records met ontbrekende bewijsstatus en zonder verlopen `valid_until`, 1 conceptrecord met `NOT_PROVIDED` en 1 verlopen record. Er is geen niet-gearchiveerd TEST-record met `VERIFIED` bewijs en dus geen betrouwbare positieve of onvoldoende-niveaufixture.
- Bestaande Continuous Appraisal-gegevens bevatten gesprek-, afspraak-, actie- en opvolgstatussen.

Deze data bevestigt dat plannen zonder capability-ID niet via de bestaande Employee-zelfservicecompetentiekoppeling zijn vastgelegd; de kolom bestaat al en is nullable. De ontbrekende samenhang zit in de productflow. Er is daarom geen migratievoorstel nodig. Er zijn geen TEST-fixtures of andere databasegegevens geschreven.

De regressietests gebruiken geïsoleerde voorbeelden voor geverifieerd voldoende/onvoldoende niveau, ontbrekend niveau/bewijs, verlopen bewijs, expliciete positieve planmatches en negatieve matches bij andere medewerker of capability. Een algemene Continuous Appraisal-actie wordt niet gematcht aan een capability.

## Persona- en scopeacceptatie

| Persona | Lokale service/API-tests | Geauthenticeerde kandidaat-UI/API/RLS |
|---|---|---|
| HR Admin | De bestaande servicecontracttests bevestigen schrijven binnen de actieve HR-groep/administratie en weigering buiten de geselecteerde administratie. De rapportbronlimiet en exacte planlink zijn getest. | NOT RUN. De opgegeven kandidaat bood alleen de uitnodigingslogin; geen HR Admin-sessie beschikbaar. |
| Manager | Direct team toegestaan; medewerker buiten het directe team en andere HR-groep geweigerd. De skillgap-readpath bevat alleen de serverafgeleide directe teamscope. | NOT RUN. Geen geauthenticeerde Manager-sessie voor negatieve UI-, API- of RLS-controle. |
| Employee | Eigen plan en actuele profielcompetentie toegestaan; vervalste capability bij maken en wijzigen geweigerd. Managementroutes zijn server-side permission-guarded. | NOT RUN. De zelfserviceflow en managementrapport-denial zijn niet in een geauthenticeerde browsersessie opnieuw bevestigd. |

De anonieme opening van de TEST-kandidaat was read-only en toonde de uitnodigingslogin. Historische browseracceptatie voor ongewijzigde Talentbasismodules blijft vindbaar in de bestaande [STAR-V2-04D-2A](STAR-V2-04D-2A-LOCAL-20261018.md), [STAR-V2-04D-2B](STAR-V2-04D-2B-LOCAL-20261018.md) en [STAR-V2-04D-2D](STAR-V2-04D-2D-LOCAL-20261018.md)-evidence; die bewijst de nieuwe competentieplanflow niet.

## Checks

- Gerichte Vitest: **14 testbestanden, 62 tests PASS**. Omvat capabilitylink-positief/negatief, HR Admin/Manager-servicescope, Manager skillgap-scope, filters/CSV, exacte planlink, bronlimieten, Continuous Appraisal en routefiltering.
- Vitest-bestanden: `app/api/talent/goals/route.test.ts`, `app/api/talent/goals/[goalId]/route.test.ts`, `app/api/talent/goals/[goalId]/check-ins/route.test.ts`, `lib/talent/goal-service.capability-link.test.ts`, `goal-service.api.test.ts`, `goal-service.manager-read.test.ts`, `goal-service.controlled-authorization.test.ts`, `employee-capability-service.test.ts`, `lib/continuous-appraisal/service.test.ts`, `lib/star-performers/skill-gap-priorities.test.ts`, `v2-service.test.ts`, `v2-service.manager-skillgap.test.ts`, `v2-service.authorization.test.ts` en `insights-service.test.ts`.
- TypeScript: PASS (`npm run type-check --workspace @liquid-hr/hr-suite`).
- ESLint gewijzigde TS/TSX-bestanden: PASS.
- NL/EN: PASS, 43 namespaces met gelijke sleutels.
- `git diff --check`: PASS.
- Volledige Vitest-suite en productiebuild: NOT RUN; de gerichte Talent-gate is groen.
- Geauthenticeerde browser/API/RLS-personaacceptatie en TEST-fixtureflow: NOT RUN.

## Wijzigingen en grenzen

Er zijn geen databasewrites, fixtures, migraties, nieuwe accounts, permission/RLS-wijzigingen, push, merge naar `main` of Vercel-release uitgevoerd. De module is lokaal code-complete; live personaacceptatie en een echte TEST-plancreatie met capabilitykoppeling blijven OPEN.

**Integratieafhankelijkheid:** voor live acceptatie zijn bestaande geautoriseerde HR Admin-, Manager- en Employee-sessies op de kandidaat nodig. De huidige kandidaat toont alleen de uitnodigingslogin. Er is geen gedeelde schema- of migratieafhankelijkheid voor deze codewijziging.
