# LiquidHR Guided Recruitment — uitvoerbaar implementatieplan

**Datum:** 2026-08-13

**Status:** plan gereed; er is nog geen productcode, migratie, featurebranch, remote write of deployment uitgevoerd.

**Doel:** Guided Recruitment als één veilige V1-vertical slice opleveren: schema/RLS/grants, API, HR- en deelnemer-UX, publieke vacature/intake, Guided Recruitment, instellingen, privacy/retentie, Core HR/Journeys-koppelingen, tests, documentatie en browserbewijs.

**Modeltoewijzing:** hoofdonderdeel 1 door **Sol**; hoofdonderdelen 2 en 3 door **Luna High**.

**Werkstroom:** één feature, één branch en één worktree gedurende alle drie hoofdonderdelen: `feature/recruitment` in `.worktrees/recruitment`.

## Bronnen en vastgestelde uitgangssituatie

Dit plan normaliseert de volgende bronnen; bij verschil geldt de requirementsdocumentatie en daarna de bestaande LiquidHR-architectuur, terwijl Stitch alleen richting geeft aan compositie, informatiedichtheid en interactie:

- `C:\Users\Edwin\Downloads\LIQUIDHR_GUIDED_RECRUITMENT_PRODUCT_REQUIREMENTS(1).md`
- `C:\Users\Edwin\Downloads\LIQUIDHR_GUIDED_RECRUITMENT_GOOGLE_STITCH_UX_BRIEF(1).md`
- `C:\Users\Edwin\Downloads\stitch_liquidhr_recruitment_module (8).zip`
- `C:\Users\Edwin\Downloads\stitch_liquidhr_recruitment_module (9).zip`
- RC-007 uit `C:\Users\Edwin\Downloads\stitch_liquidhr_recruitment_module (7).zip`, omdat die referentie niet in (8) of (9) zit.
- Repositorybronnen: `AGENTS.md`, `docs/README.md`, `docs/delivery/CURRENT_CONTEXT.md`, `CODING_STANDARDS.md`, de vijf architectuurdocumenten, de HR-groep-/autorisatie-/custom-field-requirements en de bestaande implementaties voor modules, permissions/RLS, reminders, documenten, Employee/Employment en Journeys.

Gecontroleerde basis bij het maken van dit plan:

- Lokale `main`, `last-good`, `backup/last-good` en de lokale trackingref `origin/main` wijzen op `f51c8220162e6a3f67fecb8a4bce797da92dbead`. Een live `git ls-remote` kon door ontbrekende Git-credentials niet worden bevestigd en moet bij uitvoering opnieuw worden geprobeerd.
- De hoofdwerkboom bevat alleen de niet-getrackte worktreecontainer `.codex-worktrees/`; die mag niet worden verwijderd, gestaged of overschreven.
- De zichtbare applicatieversie staat in `apps/hr-suite/lib/app-version.ts` en is op deze basis `1.20260812.3`; `package.json` is niet de productversie.
- Er luistert bij deze planopname niets op poort 3000.
- `.mcp.json` bevat een Supabase-koppeling, maar de Supabase-MCP was in deze plansessie niet callable. Uitvoering mag pas remote migreren als de gekoppelde dev/test-projectidentiteit en authenticatie read-only zijn bevestigd.
- Er is geen bestaande recruitmentmodule, rate limiter, botchallenge of malwarescanner. Er zijn wel herbruikbare patronen voor private Storage/signed URLs, requestcontext, HR-groep-scope, concrete Journey-deelnemerprojecties, reminders en Employee/Employment/Journeys.
- De bestaande persoonlijke reminder ondersteunt al `administration_id = null`; Recruitment hergebruikt dit tenantbrede persoonlijke-reminderpad en voegt alleen een getypepte recruitment-deeplink toe. Er komt geen tweede remindertabel.

## Bindende architectuurkeuzes

- **Eigendom:** elk recruitmentobject is begrensd door `tenant_id` én `hr_group_id`. Een vacature, kandidaat, sollicitatie, pipeline, bibliotheekconfiguratie en scorekaart is nooit administratie-eigendom. Alleen de expliciete hire-conversie mag daarnaast een gekozen `administration_id`, `employee_id` en optioneel `employment_id` vastleggen.
- **Autorisatie:** de canonieke permissions worden exact `recruitment-vacancy:read`, `recruitment-vacancy:write`, `recruitment-vacancy:publish`, `recruitment-candidate:read`, `recruitment-candidate:write`, `recruitment-assessment:read`, `recruitment-assessment:write`, `recruitment-settings:manage`, `recruitment-participation:read` en `recruitment-participation:write`. HR-routes controleren permission + HR-groep server-side; RLS herhaalt dezelfde grens. UI-verberging is alleen UX.
- **Deelnemers:** een medewerker krijgt uitsluitend een actor-veilige projectie voor een concrete actieve deelname aan één niet-terminale sollicitatie/interview. `DIRECT_MANAGER`, `employee:read` of een algemene recruitmentpermission wordt nooit als impliciet recht toegevoegd. Een terminale overgang zet alle deelnames in dezelfde database-transactie op `REVOKED`; een heropening herstelt ze niet.
- **Statusmodel:** normale pipelinefases zijn configureerbaar, minimaal één actief en vacature-overstijgend per HR-groep. Alleen `AFGEWEZEN` en `AANGENOMEN` zijn terminale uitkomsten. Terugtrekken is geen derde uitkomst in V1. Faseverplaatsing en terminale overgang lopen via versioned, idempotente RPC's; geen directe clientwrites.
- **Kandidaat versus sollicitatie:** `recruitment_candidates.id` is een eigen UUID. Genormaliseerde e-mail levert alleen een duplicaarsignaal en krijgt geen unieke constraint. CV, motivatie, antwoorden, gesprekken, beoordelingen, notities en historie horen bij `recruitment_applications`; twee sollicitaties van dezelfde kandidaat blijven inhoudelijk gescheiden.
- **Custom fields:** hergebruik de bestaande veldtypen, options, validators en managerpatronen. Breid de definitiecontext gecontroleerd uit met `RECRUITMENT_APPLICATION`, maar sla antwoorden en een onveranderlijke vraag-/optiesnapshot op in recruitmenttabellen; gebruik nooit `employee_custom_field_values` voor kandidaten.
- **Guided content:** systeemcontent is immutable en versieerbaar; HR-groepen kunnen systeemitems activeren/deactiveren en eigen items CRUD'en. Sets combineren alleen interviewvragen, criteria en voorbereiding, niet sollicitatievragen. Kenmerk-ID's zijn stabiel voor een latere Talent-koppeling maar hebben in V1 geen runtime-afhankelijkheid van Talent.
- **Beoordelingen:** iedere beoordelaar heeft een eigen scorekaart. Scores van anderen zijn voor de beoordelaar verborgen totdat de eigen kaart is ingediend. Correcties zijn nieuwe auditeerbare revisies; er is geen totaalscore, advies, ranking, matchpercentage of AI.
- **Publiek:** een publicatie heeft een niet-geheim UUID plus leesbare slug en is bereikbaar buiten de ingelogde shell via `/vacancies/[publicId]/[slug]`. De publieke readroute retourneert precies één gepubliceerde vacature; de writeroute maakt uitsluitend een sollicitatie aan en kan nooit lijsten. Gesloten/gearchiveerde publicaties accepteren geen intake.
- **Publieke beveiliging:** gebruik het bestaande env-contract `NEXT_PUBLIC_TURNSTILE_SITE_KEY`/`TURNSTILE_SECRET_KEY`, database-backed rate limiting op gehashte netwerk-/formulierkenmerken, honeypot/timingcontrole en fail-closed documentverwerking. CV's gaan server-side naar een private `recruitment-documents`-bucket/quarantaine, met magic-byte/MIME/allowlist/max-sizecontrole en een geconfigureerde remote malwarescanner achter `RECRUITMENT_MALWARE_SCAN_URL`/`RECRUITMENT_MALWARE_SCAN_API_KEY`; voeg alleen de variabelenamen aan `docs/architecture/ENVIRONMENT_AND_AI_RULES.md` toe, nooit waarden. Alleen `CLEAN`-bestanden krijgen kortlevende signed URLs via een geautoriseerde HR/deelnemerroute. Er komen geen publieke Storage-policies of interne object-URL's in responses.
- **Integraties:** afwijzen kan via de bestaande persoonlijke reminderengine morgen/eigen datum/geen reminder plannen en blokkeert nooit op een reminderfout. Hire zoekt/beslist expliciet over bestaand/nieuw/rehire Employee, vereist naast recruitmentrechten ook de bestaande `employee:match` en voor mutatie `employee:write`/geldige Employee-scope, kopieert alleen naam, privé-e-mail en telefoon, bewaart conversieactor/-tijd en kopieert nooit CV of recruitmentinhoud. Journeys start uitsluitend ná Employee/Employment-link via de bestaande Journey preview/activate-service en alleen als module + permission dit toestaan.
- **Privacy:** bewaartermijn is per HR-groep 1–3650 dagen, standaard 28, met waarschuwing boven 365. Wijziging herberekent `retention_due_at` voor bestaande terminale, nog niet geanonimiseerde sollicitaties. Een dagelijkse, met secret beveiligde retention-entrypoint voert dezelfde auditeerbare anonimiseer-/deletekernel uit; geen tweede scheduler-engine. Handmatige verwijdering is HR-only en laat alleen niet-herleidbare aggregates bestaan.
- **UI:** bestaande LiquidHR-shell, PageHeader/Card/Form/DropdownSelect/Dialog, CSS-variabelen, Segoe UI Variable/Aptos en routing winnen van Stitch. Geen nieuwe suite-shell, geen appbrede restyle, geen hardcoded hex. Beheerbare stamdata is lijst-eerst met zoeken/filteren/sorteren, klikrij en modal. Op 390×844 wordt Kanban een fasefilter + verticale lijst zonder horizontale pagina-overflow.
- **i18n:** alle zichtbare tekst staat in paritaire `apps/hr-suite/messages/nl/recruitment.json` en `apps/hr-suite/messages/en/recruitment.json`, plus gelijke wijzigingen in bestaande navigation/settings/error-namespaces. Nederlands is standaard.
- **Remote database:** geen Docker, lokale Supabase-stack, helpercontainer of brede `db push`. Maak migratiebestanden met `npx.cmd supabase migration new ... --workdir apps/hr-suite`; vergelijk daarna lokale en remote historie en pas alleen de nieuwe benoemde migraties via de gekoppelde dev/test-Supabase-MCP toe. Voer SQL/pgTAP-contracten transactioneel uit en ruim fixtures aantoonbaar op.

## Domein- en interfacekaart

De precieze timestamp-prefix van een migratie wordt uitsluitend door `supabase migration new` gemaakt; daarna is het gegenereerde pad het vaste, te reviewen bestand. Verwachte suffixen:

- `apps/hr-suite/supabase/migrations/*_guided_recruitment_foundation.sql`
- `apps/hr-suite/supabase/migrations/*_guided_recruitment_security_and_public_intake.sql`
- `apps/hr-suite/supabase/migrations/*_guided_recruitment_guided_content.sql`
- `apps/hr-suite/supabase/migrations/*_guided_recruitment_retention_and_analytics.sql`

Fundamentele tabellen en verantwoordelijkheden:

| Tabel/contract | Verantwoordelijkheid en harde constraint |
| --- | --- |
| `recruitment_settings` | Eén HR-groepconfiguratie voor bewaartermijn, publieke branding en publicatie-defaults. |
| `recruitment_pipeline_stages` | HR-groepbrede, geordende normale fases; ten minste één actief via atomic reorder/deactivate-kernel. |
| `recruitment_vacancies`, `recruitment_vacancy_sections` | Gestructureerde vacature plus exact zes vaste, ordenbare/verbergbare contentblokken; geen page builder. |
| `recruitment_vacancy_questions` | Koppeling naar herbruikbare custom-fielddefinitie plus publicatie-/intakesnapshot van label, type, opties en required-status. |
| `recruitment_publications` | UUID, unieke slug, OPEN/CLOSED/ARCHIVED, timestamps en JobPosting-ready velden; slug is leesbaar, UUID is identiteit maar geen geheim. |
| `recruitment_candidates` | HR-groepidentiteit, genormaliseerde e-mail en expliciete mogelijke-duplicaatindicator; geen auto-merge en geen unieke e-mail. |
| `recruitment_applications`, `recruitment_application_answers` | Vacaturegebonden dossier, actieve fase óf terminale uitkomst, immutable antwoorden/snapshots, bron en retentiedata. |
| `recruitment_documents` | Applicatiegebonden metadata, private objectkey, checksum, scanstatus en scannerresultaat zonder publieke URL. |
| `recruitment_participations` | Concrete application/interview assignment, capability en `ASSIGNED/ACTIVE/REVOKED`; terminale status maakt toegang onmiddellijk ongeldig. |
| `recruitment_interviews`, `recruitment_interview_participants` | Eén of meer gesprekken, datum, titel, deelnemers, gekozen set en gekopieerde voorbereiding; geen calendar integration. |
| `recruitment_library_items`, `recruitment_library_item_states` | Immutable systeemitems en HR-groep-eigen items voor APPLICATION_QUESTION/INTERVIEW_QUESTION/CRITERION/PREPARATION. |
| `recruitment_characteristics` | Stabiele systeem-ID's/codes voor criteria en latere Talent-link, zonder V1-koppeling. |
| `recruitment_sets`, `recruitment_set_items` | Geordende systeem- of HR-groepssets met interviewvragen, criteria en voorbereiding. |
| `recruitment_assessments`, `recruitment_assessment_scores` | Eén kaart per beoordelaar/interview, DRAFT/SUBMITTED/CORRECTED en revisiehistorie; score 1–5 met ankers. |
| `recruitment_events` | Append-only domeinhistorie voor fase, terminale acties, deelnamerechten, beoordelingcorrectie en conversie; payload bevat minimale PII. |
| `recruitment_public_intake_limits` | Kortlevende gehashte counters/idempotency voor rate limiting; nooit rauwe IP-adressen. |

Publieke SQL-wrappers worden `SECURITY INVOKER` als RLS voldoende is. Alleen kleine atomic kernels zijn `SECURITY DEFINER`, staan in een niet-blootgesteld schema, valideren `auth.uid()`, tenant, HR-groep, permission, verwachte versie en idempotency, zetten een vaste `search_path`, en krijgen uitsluitend de minimaal benodigde `EXECUTE`-grant. `anon` krijgt alleen de twee strikt begrensde publicatie/intakewrappers; nieuwe `public`-tabellen krijgen geen impliciete grants.

## Uitvoeringsregels voor alle drie hoofdonderdelen

- Begin ieder hoofdonderdeel met een failing test of SQL-contract voor de kritieke logica en bewijs RED vóór implementatie; maak GREEN met de kleinst mogelijke wijziging.
- Werk schema → repository/service → API route → UI. UI mag nooit direct een state transition of autorisatiebeslissing uitvoeren.
- Stage steeds expliciete paden; gebruik in de featureworktree niet `git add -A`. Bewaar alle bestaande worktrees en overige gebruikerswijzigingen.
- Een hoofdonderdeel gaat alleen door na zijn stop/go-gate. Een falende securitytest, remote migration, advisor, typecheck, i18n-check, build of browserrol is een stop; geen worktree/branch verwijderen en geen deployment starten.
- Testfixtures zijn deterministisch gemarkeerd (`TEST-RECRUITMENT-*`), bevatten geen echte persoonsgegevens, mogen voor browserinspectie blijven staan en worden na security/retentietests transactioneel verwijderd met expliciete nulrij-asserties.
- Geen merge, push, preview of productie-uitrol in deze drie hoofdonderdelen. Na de afsluitende lokale featuregate wacht integratie op het aparte, expliciete commando **Feature samenvoegen**.

## 1. Architecture & Secure Domain Foundation — Sol

**Doel:** één duurzame, remote geteste recruitmentkern neerzetten voordat er product-UI ontstaat: featureworktree, requirements in de repo, module/permissions, HR-groepmodel, state machine, RLS/grants, publieke intakeboundary, private documenten, integratiecontracten en TypeScript-domein/API-grenzen.

**Feature- en remote preflight**

- Inventariseer read-only: `git status --short --branch`, `git worktree list`, `git branch --all --verbose`, `git stash list`, `git rev-parse main`, `git rev-parse last-good`, `git rev-parse origin/main` en, als credentials beschikbaar zijn, `git ls-remote origin refs/heads/main`.
- Behoud `.codex-worktrees/`. Voeg uitsluitend de lokale regel `.codex-worktrees/` toe aan `.git/info/exclude`, bevestig dat daardoor de root schoon is en stop als er nog andere wijzigingen zijn.
- Maak de branch via het officiële commando `powershell -ExecutionPolicy Bypass -File .\scripts\new-feature.ps1 -Name 'Recruitment'`; bevestig basis `last-good`. Ga daarna terug naar `main` en plaats diezelfde branch met `git worktree add .worktrees/recruitment feature/recruitment` in de genegeerde worktreemap. Alle volgende commando's draaien vanuit `C:\Users\Edwin\Documents\Apps\LiquidHR\.worktrees\recruitment`.
- Bevestig via de Supabase-MCP read-only het gekoppelde dev/test-project, de remote migratiehistorie en de huidige advisors. Stop als het project niet ondubbelzinnig het afgesproken LiquidHR dev/test-project is, als auth ontbreekt of als remote historie onverwacht afwijkt; gebruik geen lokale stack of `db push` als uitwijkroute.
- Maak de aangeleverde requirements duurzaam als `docs/requirements/recruitment/GUIDED_RECRUITMENT_PRODUCT_REQUIREMENTS.md` en `docs/requirements/recruitment/GUIDED_RECRUITMENT_UX_REFERENCE.md`. Bewaar alle requirement-ID's, leg de bronversie vast en noteer expliciet dat Stitch normalisatie vereist.

**TDD-contracten vóór schema**

- Maak `apps/hr-suite/lib/recruitment/domain.test.ts`, `apps/hr-suite/lib/recruitment/permissions.test.ts`, `apps/hr-suite/lib/recruitment/public-security.test.ts`, `apps/hr-suite/lib/recruitment/migration-contract.test.ts` en `apps/hr-suite/supabase/tests/recruitment_foundation_contract.sql`.
- Test eerst: normale fase versus precies twee terminale uitkomsten; geen unieke kandidaat-e-mail; applicatie-eigendom van dossierdata; fase-minimum; andere HR-groep/tenant altijd nul; deelnemer alleen concrete actieve applicatie; terminale overgang/reopen trekt rechten in en herstelt ze niet; scorezichtbaarheid; retentionherberekening; anon kan niet selecteren; public read levert maximaal één OPEN-publicatie; public write kan niet listen/read; upload faalt gesloten zonder bot- en scannerbewijs.
- Draai RED: `npm.cmd test --workspace @liquid-hr/hr-suite -- lib/recruitment/domain.test.ts lib/recruitment/permissions.test.ts lib/recruitment/public-security.test.ts lib/recruitment/migration-contract.test.ts`. De nieuwe tests moeten om de ontbrekende implementatie falen, niet door testconfiguratie.

**Schema, RLS, grants en modulecatalogus**

- Genereer de eerste twee migraties met:
  - `npx.cmd supabase migration new guided_recruitment_foundation --workdir apps/hr-suite`
  - `npx.cmd supabase migration new guided_recruitment_security_and_public_intake --workdir apps/hr-suite`
- Voeg de tabellen uit de domeinkaart toe met samengestelde tenant/HR-groep-FK's, relevante partial/covering indexes, `created_at/updated_at`, optimistic `version` en CHECK-constraints. Voeg `RECRUITMENT` toe aan de bestaande module-check, modulecatalogus en disabled-by-default tenantmodule-seed.
- Voeg alle tien permissions aan de canonieke permissioncatalogus en passende systeemrollen toe. Houd `recruitment-settings:manage` apart van operationele vacancy/candidate/assessmentrechten.
- Zet RLS aan op iedere blootgestelde tabel in dezelfde migratie. HR-policy's eisen tenanttoegang, concrete HR-groeptoegang en exacte permission. Deelnemerpolicy's lezen uitsluitend via de actor-projectie. Writes voor pipeline, transitions, assessments, publicatie, privacy en conversion lopen via geteste RPC's.
- Maak een private Storage-bucket `recruitment-documents`; geen `anon`/`authenticated` directe object-list/read/write. Serverroutes gebruiken een server-only client pas na context-/intakevalidatie. Voeg een quarantine → CLEAN/REJECTED-scanstate en kortlevende signed-downloadwrapper toe.
- Breid bestaande custom-fielddefinities en validators gecontroleerd uit met `RECRUITMENT_APPLICATION`; maak application-answer snapshots in recruitmenttabellen. Breid `apps/hr-suite/lib/reminders/reminder-service.ts` en zijn test alleen uit met een veilige `/recruitment/applications/<guid>`-actionroute; de persoonlijke reminder zelf blijft de bestaande tenant-/optionele-administratie-RPC.
- Werk de modulebestanden bij: `apps/hr-suite/lib/modules/module-catalog.ts`, `module-catalog.test.ts`, `schemas.ts`, `schemas.test.ts`, `module-service.ts`, `apps/hr-suite/app/(dashboard)/settings/modules/page.tsx`, `apps/hr-suite/messages/nl/settings.json` en de EN-tegenhanger. Pas de bestaande Journey-migratiecontracttest aan zodat `RECRUITMENT` in de toegestane moduleconstraint staat zonder Journey-gedrag te veranderen.

**Strict TypeScript-grenzen**

- Maak `apps/hr-suite/lib/recruitment/domain.ts`, `schemas.ts`, `errors.ts`, `repository.ts`, `service.ts`, `permissions.ts`, `projection-domain.ts`, `projection-service.ts`, `public-security.ts`, `document-service.ts` en `index.ts`.
- Leg daarin expliciet vast: `RecruitmentActorContext`, `ApplicationState`, `ApplicationProjection`, `ParticipantProjection`, `TerminalTransitionInput`, `HireConversionInput`, `AssessmentRevision`, `PublicVacancyProjection` en `PublicApplicationInput`. Gebruik `z.guid()` voor database-GUID's; nooit `any`.
- Houd repositoryqueries centraal en HR-groepgebonden. Servicefuncties moeten module + permission afdwingen en databasefoutcodes naar stabiele API-foutcodes vertalen. De public-securitylaag bevat adapters voor botchallenge en malwarescan, hashed-key rate limiting, MIME/signature/sizevalidatie en fail-closed resultaten.
- Maak `apps/hr-suite/lib/recruitment/employee-link-service.ts`, `journey-handoff-service.ts` en `reminder-adapter.ts` als dunne adapters boven bestaande services. Verzwak `identityMatchSchema` niet: recruitmentmatching gebruikt naam + genormaliseerde privé-e-mail/telefoon als expliciete signalen en vereist een menselijke keuze; Employee-identiteitsmatching op BSN/geboortegegevens blijft intact.

**Remote toepassing en bewijs**

- Review ieder gegenereerd migratiebestand en pas via de Supabase-MCP alleen deze twee nieuwe migraties, in volgorde, toe op het gekoppelde dev/test-project. Voer geen brede push uit.
- Voer `apps/hr-suite/supabase/tests/recruitment_foundation_contract.sql` via remote SQL uit binnen `BEGIN ... ROLLBACK`. Gebruik vier actors: HR met rechten, concrete deelnemer, niet-betrokken medewerker en actor uit andere HR-groep/tenant. Assert terminal transition + reopen, RLS-nulrijen, anon write-only, scanner-fail-closed en fixture cleanup.
- Draai Supabase security- en performance-advisors. Los nieuwe findings in scope op; documenteer bestaande unrelated findings apart. Genereer daarna de officiële remote types opnieuw naar `packages/db/types.ts` en controleer dat uitsluitend bedoelde schemawijzigingen zichtbaar zijn.

**Afsluitend gate van hoofdonderdeel 1**

- **Deliverable/exit:** `feature/recruitment` draait in één worktree; requirements zijn duurzaam; module, permissions, schema, RLS/grants, atomic kernels, private documentboundary en strict TypeScript-contracten zijn GREEN op linked dev/test, zonder product-UI.
- **Tests/security:** remote SQL/pgTAP voor cross-tenant, cross-HR-groep, participant/no-participant, terminal/reopen, anon, grants, uploadquarantaine en cleanup; daarna `npm.cmd test --workspace @liquid-hr/hr-suite -- lib/recruitment lib/modules lib/reminders`, `npm.cmd run type-check --workspace @liquid-hr/hr-suite`, `npm.cmd run lint --workspace @liquid-hr/hr-suite`, `npm.cmd run check:i18n --workspace @liquid-hr/hr-suite`, `npm.cmd run build --workspace @liquid-hr/hr-suite -- --webpack` en `git diff --check`.
- **Browser UX evidence:** start `npm.cmd run dev --workspace @liquid-hr/hr-suite -- --port 3000`; bewijs alleen de module-/routeboundary: RECRUITMENT uit = geen nav/toegang, aan + geen permission = `/geen-toegang`, juiste permission = route-shell bereikbaar, publieke onbekende/gesloten UUID = veilige 404/closed-state. Controleer desktop en 390×844, netwerkresponses en console zonder PII/fouten.
- **Commit/branch checkpoint:** stage uitsluitend de genoemde foundation-, module-, type- en requirementpaden en commit lokaal als `feat: establish secure recruitment foundation`; blijf op dezelfde `feature/recruitment`-branch/worktree, niet pushen/mergen/deployen.
- **Model:** Sol.
- **Stop/go:** alleen GO als linked remote project bewezen is, migraties/advisors/types groen zijn, alle rollen nul/juist projecteren en een goedgekeurde botchallenge + remote malwarescanconfiguratie beschikbaar is. Zonder scannerconfiguratie blijft public upload fail-closed en is hoofdonderdeel 2 NO-GO.
- **Specdekking:** PR-001, PR-003–004, PR-009–010; CAN-001–003; APP-001–002; ASM-001–003 (contract); FORM-002–003 (veld-/snapshotcontract); PUB-002–003 en PUB-010–012; AUTH-001–004; PRIV-001–003; RET-001–006 (model); DEL-001–004 (kernelcontract); plus de securityvoorwaarden voor rate limiting, bot/spam, veilige upload en write-only intake.

## 2. Core Recruitment Experience — Luna High

**Doel:** op de veilige kern de complete dagelijkse recruitmentflow bouwen: vacature, publicatie, publiek solliciteren, handmatige kandidaat, vacancy-first pipeline, kandidaatdetail, faseverplaatsing, afwijzen/reminder, aannemen/Core HR/Journeys en responsieve kern-UX.

**API eerst, opnieuw test-first**

- Voeg failing service- en routetests toe in `apps/hr-suite/lib/recruitment/vacancy-service.test.ts`, `application-service.test.ts`, `terminal-transition.test.ts`, `hire-conversion.test.ts`, `public-intake.test.ts` en naast elke nieuwe route als `route.test.ts`.
- Bouw daarna HR-routes onder:
  - `apps/hr-suite/app/api/recruitment/vacancies/route.ts`
  - `apps/hr-suite/app/api/recruitment/vacancies/[vacancyId]/route.ts`
  - `apps/hr-suite/app/api/recruitment/vacancies/[vacancyId]/form/route.ts`
  - `apps/hr-suite/app/api/recruitment/vacancies/[vacancyId]/publication/route.ts`
  - `apps/hr-suite/app/api/recruitment/vacancies/[vacancyId]/applications/route.ts`
  - `apps/hr-suite/app/api/recruitment/applications/[applicationId]/route.ts`
  - `apps/hr-suite/app/api/recruitment/applications/[applicationId]/stage/route.ts`
  - `apps/hr-suite/app/api/recruitment/applications/[applicationId]/reject/route.ts`
  - `apps/hr-suite/app/api/recruitment/applications/[applicationId]/reopen/route.ts`
  - `apps/hr-suite/app/api/recruitment/applications/[applicationId]/hire/route.ts`
  - `apps/hr-suite/app/api/recruitment/applications/[applicationId]/documents/[documentId]/route.ts`
- Bouw publieke, strikt begrensde routes onder `apps/hr-suite/app/api/public/recruitment/vacancies/[publicId]/route.ts` en `apps/hr-suite/app/api/public/recruitment/vacancies/[publicId]/applications/route.ts`. De multipartwriter verifieert status, UUID/slug, challenge, rate limit, honeypot/timing, veldsnapshot, idempotency en scanner voordat hij application-data definitief maakt. Confirmation is on-screen; geen kandidaataccount, portal of e-mail.
- Gebruik `Cache-Control: no-store` voor privacygevoelige HR/deelnemerresponses en geen kandidaat-PII in logs/auditpayloads. Public GET mag alleen expliciet gepubliceerde velden en JobPosting JSON-LD leveren.

**Vacature- en publicatie-UX**

- Maak HR-pagina's:
  - `apps/hr-suite/app/(dashboard)/recruitment/page.tsx`
  - `apps/hr-suite/app/(dashboard)/recruitment/vacancies/new/page.tsx`
  - `apps/hr-suite/app/(dashboard)/recruitment/vacancies/[vacancyId]/edit/page.tsx`
  - `apps/hr-suite/app/(dashboard)/recruitment/vacancies/[vacancyId]/page.tsx`
  - `apps/hr-suite/app/(dashboard)/recruitment/applications/[applicationId]/page.tsx`
- Maak componenten onder `apps/hr-suite/components/recruitment/`: `recruitment-overview.tsx`, `vacancy-list.tsx`, `vacancy-editor.tsx`, `vacancy-sections-editor.tsx`, `application-form-editor.tsx`, `publication-panel.tsx`, `pipeline-board.tsx`, `application-card.tsx`, `application-detail.tsx`, `terminal-action-dialog.tsx`, `hire-dialog.tsx` en gedeelde identity/statuscomponenten.
- De vacancy editor ondersteunt functietitel, optionele bestaande functie, locatie, werkmodus, uren, salaris + zichtbaarheidskeuze en exact zes vaste rich-textblokken die alleen ordenen/verbergen. De application-form editor gebruikt zoekbare keuzecomponenten en herbruikbare custom-fieldtypes; geen generieke page builder.
- Voeg publieke pages buiten de dashboardshell toe in `apps/hr-suite/app/vacancies/[publicId]/[slug]/page.tsx` en een confirmationstate binnen dezelfde flow. Zorg dat root preferences bij anonieme bezoekers veilig terugvallen op standaard NL/theme; lek geen ingelogde branding/context. Render geldige `JobPosting` JSON-LD alleen voor OPEN-publicaties.
- Neem de LiquidHR-shell op via `apps/hr-suite/app/(dashboard)/layout.tsx`, `apps/hr-suite/components/layout/sidebar.tsx`, `apps/hr-suite/messages/nl/navigation.json` en EN. Toon “Sollicitaties” alleen bij actieve RECRUITMENT-module én een HR-readpermission of een actuele concrete deelname met `recruitment-participation:read`; die deelname ontsluit uitsluitend `/recruitment/assigned`. Voeg geen “Recruitment Suite”, Talent Pool, Reports of Assessments-hoofdnavigatie uit Stitch toe.

**Pipeline, kandidaat en terminale acties**

- Desktop is vacature-first met compacte metrics, filters en Kanban; 390×844 gebruikt een fasefilter en verticale cards. Iedere card toont alleen naam, rol/vacaturecontext, fase, bron, tijd-in-fase en volgende actie. Meerdere sollicitaties van dezelfde kandidaat blijven aparte cards.
- Candidate/application detail heeft overzicht, sollicitatie, gesprekken, beoordelingen en historie als tabs/URL-state, maar toont in dit hoofdonderdeel Guided-tabinhoud nog als beveiligde lege state tot hoofdonderdeel 3. CV-download loopt uitsluitend via de signed route en alleen met kandidaatread of concrete deelnamercapability.
- Fase-drag/drop en mobiele faseactie sturen `expectedVersion` + idempotency naar de atomic transition-RPC. De backend weigert normale verplaatsing na terminal status.
- Afwijzen vereist reden, heeft optionele interne notitie en reminderkeuze morgen/eigen datum/geen. De terminale DB-transactie sluit de sollicitatie en revoke't deelnemers; pas na commit wordt best-effort de bestaande persoonlijke reminder aangemaakt met minimale naam + veilige deep link. Een reminderfout wordt zichtbaar gemeld maar rolt afwijzen niet terug. Optionele contacttekst wordt alleen gekopieerd/geopend in een externe mailclient.
- Heropenen is HR-only, auditeerbaar, zet een normale fase maar herstelt geen deelnemers. Oude deelnemerdeeplinks blijven nuldata/`/geen-toegang`.

**Hire, Employee/Employment en Journeys**

- Breid `apps/hr-suite/lib/employment/employment-service.ts` niet afzwakkend uit met een expliciete recruitment-matchquery en tests; signalen zijn naam, genormaliseerde privé-e-mail en telefoon. Matchen vereist `employee:match`, creëren/koppelen vereist `employee:write` en eventuele Employment-mutaties blijven onder de bestaande administratie-/Employee-scope. Toon mogelijke matches, maar vereis de HR-keuze bestaand/nieuw/rehire.
- Breid `apps/hr-suite/components/employees/employee-create-wizard.tsx` via een kleine recruitment-candidate-selectiecomponent uit; bouw geen tweede employee wizard. Vanuit Employee-aanmaak kan HR een kandidaat kiezen, minimale gegevens overnemen of volledig nieuw starten. Een afgewezen historie verandert nooit.
- De `hire`-kernel maakt/legt eerst de gekozen Employee-link en eventueel Employment-link vast, zet daarna atomair `AANGENOMEN`, revoke't deelnemers en schrijft actor/tijd/conversielinks. CV, antwoorden, notities en beoordelingen gaan nooit naar Core HR.
- Toon na geslaagde hire de bestaande Journey startopties. Roep `apps/hr-suite/lib/journeys/runtime-service.ts` via de recruitmentadapter aan; Journey-module/permission, preview en idempotency blijven leidend. Geen Journey starten vóór een geldige Employee-link.

**i18n en gerichte verificatie**

- Maak `apps/hr-suite/messages/nl/recruitment.json` en `apps/hr-suite/messages/en/recruitment.json`; registreer de namespace in `apps/hr-suite/lib/i18n/server.ts`. Alle publicatie-, validation-, upload-, closed-, duplicate-, reject-, hire- en Journey-teksten hebben exact gelijke sleutels.
- Draai bij iedere slice de dichtstbijzijnde tests; daarna remote integratie met disposable HR, concrete participant, unrelated employee en cross-HR-group fixtures. Bevestig bij reject/hire dat participant SELECT/RPC direct nul/forbidden is, ook met een reeds bekende URL.

**Afsluitend gate van hoofdonderdeel 2**

- **Deliverable/exit:** een HR-gebruiker kan een gestructureerde vacature maken/publiceren, publieke of handmatige sollicitaties ontvangen, vacancy-first organiseren, detail bekijken, fase wijzigen, afwijzen/heropenen, aannemen en optioneel een bestaande Journey starten; kandidaat krijgt alleen on-screen bevestiging.
- **Tests/security:** gerichte Vitest route/service/componenttests; remote tests voor public write-only, challenge/rate limit, scanstatus/signed URL, duplicate signal/no auto-merge, cross-scope, optimistic concurrency, reject/hire atomic revoke, reminder non-blocking, minimale Core HR-overdracht en Journey preconditions. Draai daarnaast typecheck, lint, `check:i18n`, webpack-build en `git diff --check`.
- **Browser UX evidence:** op `localhost:3000` met echte linked-dev/testdata bewijs RC-001–012, RC-018–022 en RC-030; desktop plus minimaal 390×844 voor de publieke sollicitatie, vacancy-/pipelinekern en kandidaatdetail. Bewijs HR Admin, gebruiker zonder permission, gesloten publicatie en niet-betrokken medewerker; leg screenshots, console zonder fouten, relevante 2xx/4xx-responses en geen horizontale overflow vast.
- **Commit/branch checkpoint:** stage expliciet alleen core recruitment-, i18n-, shell-, Employee/Employment- en Journey-adapterpaden en commit lokaal als `feat: build core recruitment experience`; blijf op `feature/recruitment`, niet pushen/mergen/deployen.
- **Model:** Luna High.
- **Stop/go:** alleen GO als de volledige publieke uploadketen inclusief echte scanner op dev/test is bewezen, terminale revocation direct werkt, cross-scope nul blijft, beide talen paritair zijn en alle kernflows mobiel bruikbaar zijn. Een SSO/redirect of alleen HTTP 200 is geen browserbewijs.
- **Specdekking:** PR-001–010; CAN-001–003; APP-001–002; VAC-001–006; PUB-001–012; FORM-001–003; IN-001–004; OPS-001–004; PIPE-001–005; REJ-001–009; REM-001–005; HIRE-001–007; JY-001–002; EMP-001–006; AUTH-001–004 en de publieke securityvoorwaarden. RC-dekking: RC-001–012, RC-018–022 en RC-030.

## 3. Guided Recruitment, Settings & Full Verification — Luna High

**Doel:** de begeleide selectielaag, beheerinstellingen, deelnemerervaring, privacy/retentie, analytics en volledige releasewaardige verificatie afronden, vervolgens één lokale featuregate uitvoeren zonder merge/push/deployment.

**Guided content en beheer — schema/API vóór UI**

- Schrijf eerst failing tests in `apps/hr-suite/lib/recruitment/library-service.test.ts`, `set-service.test.ts`, `interview-service.test.ts`, `assessment-service.test.ts`, `participant-projection.test.ts`, `retention-service.test.ts`, `analytics-service.test.ts` en `apps/hr-suite/supabase/tests/recruitment_guided_contract.sql`.
- Genereer en implementeer:
  - `npx.cmd supabase migration new guided_recruitment_guided_content --workdir apps/hr-suite`
  - `npx.cmd supabase migration new guided_recruitment_retention_and_analytics --workdir apps/hr-suite`
- Seed versioned, immutable LiquidHR-content: circa 25 sollicitatievragen, 80–100 interviewvragen, 40–50 selectiecriteria met 1–5 ankers, 30–40 voorbereidingsitems en 10–15 sets. Systeemcontent wordt nooit door tenantadmins gewijzigd; per-HR-groep state bepaalt actief/inactief. Eigen content is volledig HR-groepbegrensd en auditeerbaar.
- Voeg services en routes toe voor `/api/recruitment/library`, `/api/recruitment/library/[itemId]`, `/api/recruitment/sets`, `/api/recruitment/sets/[setId]`, `/api/recruitment/interviews`, `/api/recruitment/interviews/[interviewId]`, `/api/recruitment/assessments`, `/api/recruitment/assessments/[assessmentId]`, `/api/recruitment/assigned`, `/api/recruitment/settings`, `/api/recruitment/privacy`, `/api/recruitment/analytics` en waar nodig expliciete `/submit`- en `/correct`-subroutes.
- Een gesprek kiest optioneel één set en kopieert de op dat moment geldende voorbereiding/vragen/criteria naar een interviewsnapshot. Meerdere gesprekken blijven los. `INTERVIEW_MODE` toont focus, deelnemers, voorbereiding en relevante vragen zonder calendar integration.
- Assessment submit is atomic. Voor submit kan een beoordelaar alleen de eigen draft lezen; na submit toont de actorprojectie transparante gemiddelden per kenmerk en per-reviewer drilldown volgens permission, nooit totaal/advies/ranking. Correctie bewaart oude revisie, reden, actor en tijd.

**Settings en lijst-eerst-UX**

- Maak `apps/hr-suite/app/(dashboard)/settings/recruitment/page.tsx` met secties Pipeline, Bibliotheek, Sets, Publicatie en Privacy. Voeg de kaart aan `apps/hr-suite/app/(dashboard)/settings/page.tsx` toe onder `recruitment-settings:manage` + actieve module.
- Maak onder `apps/hr-suite/components/recruitment/settings/` de managers `pipeline-stage-manager.tsx`, `library-manager.tsx`, `set-manager.tsx`, `publication-settings.tsx` en `privacy-settings.tsx`. Pipeline, library en sets volgen lijst-eerst: zoeken/filteren/sorteren, klikrij en modal met bewaren/annuleren; archiveren/deactiveren is expliciet.
- Pipelinebeheer laat toevoegen, hernoemen, ordenen en activeren toe, maar blokkeert het deactiveren van de laatste actieve fase. Geen pipeline per vacature en geen workflow-engine.
- Publicatie-instellingen beperken branding tot bestaand bedrijfslogo/kleur en veilige defaults. Privacy toont standaard 28, grens 1–3650, waarschuwing >365, impactpreview en atomische herberekening voor bestaande terminale dossiers.

**Deelnemer-, assessment- en analytics-UX**

- Maak `apps/hr-suite/app/(dashboard)/recruitment/assigned/page.tsx` en `apps/hr-suite/app/(dashboard)/recruitment/assigned/[applicationId]/page.tsx`; deze pages laden uitsluitend de actorprojectie. Maak `participant-application.tsx`, `interview-mode.tsx`, `assessment-scorecard.tsx`, `characteristic-score-row.tsx`, `fit-overview.tsx` en `recruitment-analytics.tsx`.
- Op 390×844 is de participant scorecard één kolom, met vaste context, duidelijke 1–5 ankers, autosave/draftfeedback en een expliciete submitbevestiging. Andere scores zijn vóór submit niet aanwezig in HTML/JSON, niet alleen verborgen met CSS.
- De Fit-weergave toont per kenmerk gemiddelde + reviewerdrilldown en vergelijkt alleen sollicitanten binnen dezelfde vacature. Er is geen posthirevergelijking en geen overall score.
- Analytics toont eenvoudige totals/status/stage, bron, doorlooptijd en conversie globaal/per vacature. Queries blijven ook bij één pipelinefase correct en publiceren alleen niet-herleidbare aggregates.

**Privacy, retentie en verwijdering**

- Implementeer een idempotente retentionkernel en `apps/hr-suite/app/api/cron/recruitment-retention/route.ts`; voeg in root `vercel.json` alleen de dagelijkse scheduleconfig toe. De route verifieert het platformsecret en voert dezelfde HR-groepbegrensde delete/anonymize-logica uit. Deze code wordt lokaal/remote handmatig getest maar nog niet gedeployed.
- Handmatige privacyactie verwijdert/anonymiseert kandidaatidentiteit, CV-objecten, antwoorden, notities en assessments en laat alleen toegestane niet-herleidbare analytics staan. Bewijs zowel storage-objectverwijdering als nulrijen in relationele tabellen. Audit registreert categorie/actor/tijd, nooit verwijderde inhoud.
- Voeg `apps/hr-suite/supabase/fixtures/recruitment_demo.sql` toe als expliciet handmatig, idempotent dev/test-fixturebestand met fictieve `TEST-RECRUITMENT-*`-data voor alle 32 RC's. Het is geen migration en geen runtime-afhankelijkheid.

**Volledige traceerbaarheid, versie en documentatie**

- Werk `docs/README.md`, `docs/delivery/IMPLEMENTATION_STATUS.md`, `docs/delivery/CURRENT_CONTEXT.md` en de twee nieuwe recruitmentrequirements bij met gerealiseerde scope, migraties, permissions, remote testbewijs, browsermatrix, open handmatige acties en expliciete out-of-scopegrenzen.
- Pas pas na alle functionele/security/browsergates eerst `apps/hr-suite/lib/app-version.test.ts` aan en bewijs RED; verhoog daarna `apps/hr-suite/lib/app-version.ts` naar `1.<uitvoerdatum>.<volgnummer>`. Op de huidige 2026-08-13-basis is dat `1.20260813.1`; herbereken het volgnummer als vóór uitvoering al een release op dezelfde datum bestaat. Bewijs daarna GREEN.
- Registreer alle nieuwe routes/namespaces/modulecodes in bestaande contracttests. Voeg geen losse checklist toe die niet door test- of browserevidence wordt ondersteund.

**Afsluitend gate van hoofdonderdeel 3**

- **Deliverable/exit:** library/sets/interviews/scorecards/Fit, participantprojectie, alle settings, privacy/retentie en analytics zijn compleet; documentatie en productversie zijn actueel; de feature is lokaal releasewaardig maar nog niet geïntegreerd of deployed.
- **Tests/security:** remote guided/retention SQL-contract met HR, twee beoordelaars, niet-betrokken actor, cross-HR-groep en terminal/reopen; score-before-submit non-disclosure, correction audit, immutable systemcontent, last-stage guard, retention recompute, manual/cron delete, storage cleanup en aggregate non-identifiability. Daarna `npm.cmd test --workspace @liquid-hr/hr-suite -- --run`, `npm.cmd run check:i18n --workspace @liquid-hr/hr-suite`, `npm.cmd run type-check --workspace @liquid-hr/hr-suite`, `npm.cmd run lint --workspace @liquid-hr/hr-suite`, `npm.cmd run build --workspace @liquid-hr/hr-suite -- --webpack`, Supabase security/performance-advisors, officiële typegeneratie en `git diff --check`.
- **Browser UX evidence:** bewijs alle RC-001–032 met de dev/testfixture. Minimaal: HR Admin volledige desktopflow; beoordelaar A vóór/na submit; beoordelaar B isolatie; niet-betrokken manager/employee; andere HR-groep; gesloten/archived public page; en 390×844 voor public application, core pipeline/detail en participant scorecard. Controleer NL en EN, keyboard/focus, labels, foutstates, geen PII in console/network, geen horizontale overflow en directe no-data na reject/hire/deletion.
- **Commit/branch checkpoint:** stage expliciet Guided/settings/privacy/analytics/version/docs en commit lokaal als `feat: complete guided recruitment`; controleer `git status`, `git log --oneline main..feature/recruitment` en `git diff --check main...feature/recruitment`. Draai daarna vanuit de featureworktree `powershell -ExecutionPolicy Bypass -File .\scripts\finish-feature.ps1 -Message 'feat: complete guided recruitment'`; omdat de wijzigingen al bewust zijn gecommit, hoort dit alleen de volledige tests te draaien en lokale `last-good`/`backup/last-good` te markeren. Geen merge, push of deployment; behoud worktree en branch voor expliciete **Feature samenvoegen**.
- **Model:** Luna High.
- **Stop/go:** GO naar een latere integratieopdracht alleen als alle geautomatiseerde gates, remote advisors, zero-row cleanup, alle actorrollen, NL/EN en de drie mobiele flows aantoonbaar groen zijn. Bij een failure blijven branch/worktree intact en wordt `CURRENT_CONTEXT.md` bijgewerkt met exact done/open/blocked; geen versie “klaar”, merge, push of deploy.
- **Specdekking:** LIB-001–006; SET-001–005; INT-001–004; ASM-001–003; FIT-001–006; PIPE-001–005; AUTH-001–004; PRIV-001–003; RET-001–006; DEL-001–004; ANA-001–005; ST-001–006; UX-MOB-001. RC-dekking primair RC-013–017, RC-023–029 en RC-031–032, plus regressie van alle RC's uit hoofdonderdeel 2.

## Volledige MUST-traceerbaarheid

Deze tabel is de bindende acceptatiematrix. `1→2` of `1→3` betekent: contract/security in hoofdonderdeel 1, werkend gedrag en bewijs in het latere hoofdonderdeel.

| Requirement-ID's | Hoofdonderdeel | Bewijsartefact |
| --- | --- | --- |
| PR-001, PR-002, PR-003, PR-004, PR-005, PR-006, PR-007, PR-008, PR-009, PR-010 | 1→2 | State-machinecontract, core route/UI en browserflow zonder out-of-V1-functies. |
| CAN-001, CAN-002, CAN-003 | 1→2 | Candidate schema + duplicate-signaltest + menselijke matchkeuze. |
| APP-001, APP-002 | 1→2 | Applicatie-FK's/RLS en twee-sollicitaties-isolatietest. |
| ASM-001, ASM-002, ASM-003 | 1→3 | Eigen scorekaart, pre-submit non-disclosure en revisieaudit. |
| VAC-001, VAC-002, VAC-003, VAC-004, VAC-005, VAC-006 | 2 | Vacancy API/editor en zes-blokkencontract. |
| PUB-001, PUB-002, PUB-003, PUB-004, PUB-005, PUB-006, PUB-007, PUB-008, PUB-009, PUB-010, PUB-011, PUB-012 | 1→2 | Publicatie-RLS, OPEN/CLOSED/ARCHIVED, copy/view/stop, JSON-LD en public browserproof. |
| FORM-001, FORM-002, FORM-003 | 1→2 | Vereiste identiteit, veldconfiguratie en immutable application-answer snapshot. |
| IN-001, IN-002, IN-003, IN-004 | 2 | Publieke en handmatige intake in eerste fase met on-screen confirmation. |
| LIB-001, LIB-002, LIB-003, LIB-004, LIB-005, LIB-006 | 1→3 | Owner/state-schema, immutable system seed, eigen CRUD en stabiele characteristic-ID's. |
| SET-001, SET-002, SET-003, SET-004, SET-005 | 1→3 | Ordered set-contract, 10–15 seeds en expliciet koppelen per gesprek. |
| INT-001, INT-002, INT-003, INT-004 | 3 | Meerdere gesprekken, deelnemers/set/voorbereiding en interviewmodus. |
| FIT-001, FIT-002, FIT-003, FIT-004, FIT-005, FIT-006 | 3 | Kenmerkgemiddelden, reviewerdrilldown en vacaturegebonden vergelijking zonder totaal. |
| OPS-001, OPS-002, OPS-003, OPS-004 | 2 | Vacancy-first metrics, pipeline, cards en detailtabs. |
| PIPE-001, PIPE-002, PIPE-003, PIPE-004, PIPE-005 | 1→2→3 | HR-groepbrede stages, atomic move en lijst-eerst-instellingen met minimum één. |
| REJ-001, REJ-002, REJ-003, REJ-004, REJ-005, REJ-006, REJ-007, REJ-008, REJ-009 | 1→2 | Atomic rejection/revoke, reopen zonder herstel en optionele externe contacttekst. |
| REM-001, REM-002, REM-003, REM-004, REM-005 | 1→2 | Bestaande personal-reminderadapter, morgen/datum/geen, minimale PII en non-blocking fout. |
| HIRE-001, HIRE-002, HIRE-003, HIRE-004, HIRE-005, HIRE-006, HIRE-007 | 1→2 | Atomic hire/revoke, expliciete Employee-keuze en minimale Core HR-transfer. |
| JY-001, JY-002 | 1→2 | Journey-adapter na Employee-link, nu of later. |
| EMP-001, EMP-002, EMP-003, EMP-004, EMP-005, EMP-006 | 1→2 | Candidate search in Employee-create, minimale overname en actieve-app hiretransition. |
| AUTH-001, AUTH-002, AUTH-003, AUTH-004 | 1→2→3 | Exacte permissions, serverchecks, RLS, participantprojectie en terminale deep-linktest. |
| PRIV-001, PRIV-002, PRIV-003 | 1→3 | Dataminimalisatie, private CV-boundary en inzichtelijke privacysettings. |
| RET-001, RET-002, RET-003, RET-004, RET-005, RET-006 | 1→3 | 28/1–3650/>365-contract, herberekening en retentionkernel. |
| DEL-001, DEL-002, DEL-003, DEL-004 | 1→3 | HR-only delete/anonymize, storage cleanup en alleen niet-herleidbare aggregates. |
| ANA-001, ANA-002, ANA-003, ANA-004, ANA-005 | 3 | Globaal/per vacature, status/stage en eenvoudige bron/tijd/conversie inclusief één fase. |
| ST-001, ST-002, ST-003, ST-004, ST-005, ST-006 | 2→3 | Bestaande shell/tokens/components, correcte Stitch-normalisatie en toegankelijke states. |
| UX-MOB-001 | 2→3 | Browserbewijs op 390×844 voor public, core en participant. |

## RC-001–032 bewijsregister

| RC | Hoofdonderdeel | Genormaliseerde implementatie/evidence |
| --- | --- | --- |
| RC-001 | 2 | Vacancy-first recruitmentoverzicht in bestaande LiquidHR-shell. |
| RC-002 | 2 | Compacte vacatureslijst/filtering zonder Recruitment Suite-subnav. |
| RC-003 | 2 | Vacancy creation met gestructureerde velden. |
| RC-004 | 2 | Zes vaste contentblokken ordenen/verbergen. |
| RC-005 | 2 | Formuliervelden + application custom questions. |
| RC-006 | 2 | Publicatiepaneel met UUID/slug, copy/view/stop. |
| RC-007 | 2 | Responsieve publieke vacaturepagina. |
| RC-008 | 2 | Publiek sollicitatieformulier + neutrale privacybevestiging; geen automatische e-mailbelofte. |
| RC-009 | 2 | On-screen bevestiging zonder portal/account. |
| RC-010 | 2 | Vacancy-first desktoppipeline. |
| RC-011 | 2 | Mobiele fasefilter + verticale sollicitatielijst. |
| RC-012 | 2 | Applicatiekaart met minimale operationele metadata. |
| RC-013 | 3 | Interview aanmaken met titel/datum/deelnemers/set. |
| RC-014 | 3 | Voorbereiding kopiëren voor extern gebruik. |
| RC-015 | 3 | Interviewmodus zonder calendar integration. |
| RC-016 | 3 | Eigen assessment scorecard met 1–5 ankers. |
| RC-017 | 3 | Fit per kenmerk/reviewer, zonder overall score/advies. |
| RC-018 | 2 | Application detail met tabs en applicatiegebonden dossier. |
| RC-019 | 2 | Faseverplaatsing via atomic backendtransition. |
| RC-020 | 2 | Rejectdialog met reden/notitie/reminder. |
| RC-021 | 2 | Afwijzing voltooid; participantrechten direct ingetrokken. |
| RC-022 | 2 | Hirekeuze bestaand/nieuw/rehire met minimale transfer. |
| RC-023 | 3 | Alleen AFGEWEZEN/AANGENOMEN; Stitch-optie Teruggetrokken verwijderd. |
| RC-024 | 3 | Pipeline-instellingen lijst-eerst, HR-groepbreed. |
| RC-025 | 3 | Library itemlijst en losse create/edit-modal, niet samengevoegd formulier. |
| RC-026 | 3 | Sets beheren met toegankelijke zoek/selectiecomponenten. |
| RC-027 | 3 | Publicatie-/brandinginstellingen binnen bestaande tokens. |
| RC-028 | 3 | Privacy/retentie 28, grens, waarschuwing en impact. |
| RC-029 | 3 | Recruitmentanalytics zonder full-BI/ranking. |
| RC-030 | 2 | Employee-create kandidaatmatch/overname zonder CV-transfer. |
| RC-031 | 3 | Participantdetail toont alleen toegewezen sollicitatievelden/documenten en eigen context. |
| RC-032 | 3 | Terminal/revoked/no-participation state geeft geen data, ook niet via oude URL/API. |

## Expliciet buiten V1

Niet implementeren, ook niet als Stitch het toont: interne e-mailverzending of communicatiehistorie, kandidaatportal/account, agenda/calendar integration, uitgebreide CMS/page builder, jobboardintegraties, pipeline per vacature, generieke workflow-engine, e-offer, agency portal, talentpool, runtime AI/contentgeneratie, AI-advies, ranking/matchpercentages, automatische kandidaat- of Employee-merge, posthire scorevergelijking, aparte Recruitment Suite-shell, derde terminale status, volledige BI en automatische transfer van CV/sollicitatie-inhoud naar Core HR.

## Einddefinitie van “klaar”

Guided Recruitment is pas klaar wanneer alle MUST-ID's en RC-001–032 een groen test- of browserbewijs hebben; iedere exposed tabel RLS en expliciete grants heeft; alle cross-tenant/HR-groep/deelnemer/terminale scenario's remote zijn bewezen; de publieke uploadketen werkelijk scant en fail-closed is; NL/EN en 390×844 groen zijn; types/advisors/build groen zijn; versie en duurzame documentatie kloppen; en `finish-feature.ps1` lokaal slaagt. Daarna is uitsluitend een afzonderlijk geautoriseerde **Feature samenvoegen**-opdracht toegestaan voor merge, push en deployment.
