# LiquidHR Test Acceptance Matrix

**ACTIVE — REQUIRED FOR LOCAL AND BROWSER ACCEPTANCE**

## Latest integration run — 2026-08-23

- Target: TEST project `wnpfloqpjvaacobppbpk`, exact worktree `work/r2-r3-integration`, baseline `abfa0bbb7db628f588faa3d4818a4f4663f27b46`, integration HEAD `479b5b3156b59e99333ca486d2fc2237a31f09ed`.
- Integrated scope: Authorization Coverage, Startpage, Organization/Departments, Continuous Appraisal, Star Performers, 9-grid, Absence Core, Absence Insights, HR Calendar + Leave, Process Automation lifecycle and Company Documents. Employment labor-condition is excluded.
- Environment preflight: check `Test-Path apps/hr-suite/.env.local` before starting browser/API acceptance; inspect only required key names, never values; use only canonical TEST fixture-auth; do not copy or commit `.env.local`; reset TEST fixture passwords only when authenticated acceptance requires it; never use production accounts/data.
- Technical gates: `219/219` test files and `857/857` tests, strict TypeScript, i18n `33` equal NL/EN namespaces, ESLint `0 errors / 8 warnings`, Webpack build with `224` generated static pages/routes and `git diff --check` green.
- Schema/migration scope: 9-grid `20260823110000_fix_talent_review_start_rpc_rls.sql` and Company Documents `20260823073015_company_document_soft_delete_rls.sql` are included as code and were already applied on TEST; no remote migration was run in this integration.
- Browser evidence: `/login` HTTP 200 with 0 relevant console-errors. All ten protected sanity routes returned HTTP 307 to `/login?next=...` anonymously, with normal routing and no relevant console-errors.
- Authenticated acceptance: `BLOCKED BY ENVIRONMENT` because the canonical fixture-auth reset was rejected by the safety control; no password or account mutation was performed. 390x844 is `NOT EXECUTED — TOOLING LIMITATION` because the installed agent-browser has no viewport resize command.
- Acceptance classification: **TECHNICAL GREEN / AUTHENTICATED BROWSER ACCEPTANCE BLOCKED BY ENVIRONMENT**. This is not release evidence and does not authorize merge/push/deploy.

Dit document is de centrale bron voor alle Codex/agent browser- en functionele acceptance.

## Testomgeving

LiquidHR draait voor deze ontwikkel- en acceptatieworkflow op een testomgeving. Accounts, medewerkers en functionele records zijn testdata. In deze omgeving zijn testrecords creëren, wijzigen en verwijderen, tijdelijke CRUD-records, fixtures gebruiken, testdata corrigeren, reseeden, migreren, transformeren en opnieuw opbouwen toegestaan. Testdata is geen acceptance-blokkade: gebruik eerst geschikte bestaande data en voeg zo nodig testdata toe, corrigeer of ruim die op.

Gebruik nooit productiegegevens en muteer nooit productie. Log of commit geen secrets/credentials. Database- en schemamutaties blijven reproduceerbaar en de testomgeving moet bruikbaar achterblijven.

## Canonieke testcontext

- HR-groep: **Planeten** (`6ba6f1df-e376-40f2-abff-ffdf000172e1`)
- **TEST HR** — `TENANT_ADMIN`, `hradmin.fixture@liquidhr.test`; standaardtarget **DEMO-035 Noah Hendriks** (`c6b1c7a9-c250-3d19-b1a0-87e317e80b13`). Gebruik voor HR-brede CRUD, settings/admin en employee administration.
- **TEST MANAGER** — `DIRECT_MANAGER`, `manager.fixture@liquidhr.test`; eigen medewerker **DEMO-028 Yara Meijer** (`9048f02b-4fdc-3c4c-e1aa-fd339660029c`). Directe Planeten-scope: DEMO-032 Maya Bos, DEMO-035 Noah Hendriks, DEMO-037 Omar Kaya, DEMO-042 Sophie De Vries en DEMO-047 Milan Visser. Standaardtarget is DEMO-035. Neem nooit aan dat DEMO-001 of een willekeurige medewerker binnen scope valt.
- **TEST EMPLOYEE** — `EMPLOYEE`, `employee.fixture@liquidhr.test`; eigen medewerker **DEMO-035 Noah Hendriks** (`c6b1c7a9-c250-3d19-b1a0-87e317e80b13`). Gebruik voor self-service; standaardtarget is zichzelf.

DEMO-035 is de primaire fixture omdat de medewerker actief is, een `auth_user_id` heeft, de canonical Test Employee is en binnen de actuele manager-scope valt. Daarmee kunnen HR-, Manager- en Employee-scenario's tegen één stabiele fixture worden getest. Voor notifications, publish en recipient materialization moet expliciet een employee met `auth_user_id` worden gekozen.

## Permission-first acceptance

Bepaal voor iedere feature eerst de capability/permission, daarna de persona die deze werkelijk bezit. Voer een positieve test met die persona uit en minimaal één negatieve rol- of scope-test wanneer authorization relevant is. Een ontbrekende actie bij een persona die volgens permissions geen toegang hoort te hebben is geen productdefect.

Voor Reminders bezit TENANT_ADMIN `reminder:read` en `reminder:write` en is dit de positieve HR-CRUD-persona. DIRECT_MANAGER bezit momenteel deze permissions niet en mag geen HR Reminder CRUD verwachten; dat is een authorization-negative scenario. EMPLOYEE wordt uitsluitend volgens aanwezige self-permissions en het featurecontract getest.

## Test authentication

Canonical passwords komen uitsluitend uit de lokale testomgeving. Gebruik alleen deze env-key-namen:

- `TALENT_HR_ADMIN_PASSWORD`
- `TALENT_MANAGER_PASSWORD`
- `TALENT_EMPLOYEE_PASSWORD`

Als fixture-login nodig is, is `npm run fixtures:talent-auth` de standaard preflight. Het script laadt `apps/hr-suite/.env.local` expliciet. Passwords, access tokens, refresh tokens en andere secrets worden nooit gelogd, in source gezet of gecommit.

Voor Playwright mag tijdelijk lokaal een authenticated `storageState`/session worden gemaakt, uitsluitend in een ignored/temp-locatie. StorageState en cookies worden nooit gecommit. Iedere persona krijgt een eigen session; hergebruik geen HR-session voor Manager- of Employee-authorizationtests.

AGENT ACCEPTANCE MOET NIET STOPPEN OP “GEEN SESSIE” ZOLANG DE CANONICAL TEST AUTH VIA DE GOEDGEKEURDE LOKALE TEST-ENV BESCHIKBAAR IS.

## Lokale runtime

Voor echte browseracceptance: gebruik exact de actieve worktree, controleer `git rev-parse HEAD` en `git status --short`, zorg dat `apps/hr-suite/.env.local` aanwezig is zonder die te committen, start vanuit deze worktree met `npm run dev`, en gebruik `http://localhost:3000`. Controleer dat poort 3000 niet een andere worktree serveert. Gebruik bij auth-problemen een fresh Testrol-session.

De eerste sanity gate is `/dashboard/start`: HTTP 200, normale render, geen PGRST303 en geen relevante console-errors. Zonder die gate volgt geen featureclaim.

## CRUD- en UX-contract

Mocked fetch-tests zijn geen eindacceptance voor CRUD. Waar ondersteund bewijst echte browseracceptance CREATE, READ/refresh, EDIT en DELETE tegen de lokale Next-app, echte API-routes, test-Supabase en echte permissions. Rapporteer HTTP-statussen; ruim tijdelijke records waar praktisch op.

Controleer waar relevant desktop en 390px, Default en LinkedHR, loading/error, dirty form, confirm dialog, permissions, overflow en keyboard/focus. Gebruik voor 390px expliciet `width: 390` en `height: 844`. Als de in-app browser niet kan resizen, gebruik Playwright en rapporteer dat niet als RED.

Toegestane statuswaarden: `GREEN`, `RED`, `NOT APPLICABLE`, `BLOCKED BY ENVIRONMENT` en `NOT EXECUTED — TOOLING LIMITATION`. Gebruik `RED` uitsluitend bij een aantoonbaar productfalen.

## Technische gates

Na lokale functionele acceptance: gerichte tests, relevante bestaande tests, bij cross-cutting werk de volledige hr-suite, TypeScript, i18n, lint, build en `git diff --check`. Vercel-preview is aanvullende deployment/sanity-gate en vervangt geen lokale echte API-acceptance.

## 390px Reminder acceptance

Gebruik TEST HR voor DEMO-035 / Noah Hendriks (`c6b1c7a9-c250-3d19-b1a0-87e317e80b13`) op viewport 390×844. Bewijs minimaal: employee detail opent; Reminders opent; Add opent als full-screen drawer/sheet; geen horizontale overflow; titel, datum en omschrijving zijn bruikbaar; Save en Cancel zijn bereikbaar; ActionMenu is bereikbaar indien een reminder aanwezig is; ConfirmDialog past binnen de viewport; keyboard/focus maakt de layout niet onbruikbaar; en er zijn geen relevante console-errors. Gebruik echte app/API, geen fetch mocks. Een tijdelijk record mag worden aangemaakt en verwijderd.
