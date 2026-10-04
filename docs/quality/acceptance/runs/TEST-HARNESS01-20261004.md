# TEST-HARNESS01 — lokale acceptatie — 2026-10-04

## 1. Executive Summary

**Status: lokale browsermatrix 6/6 GREEN; onafhankelijke LUNA MAX-review is afgerond zonder resterende auth-/origin-/context-/role-switch-beveiligingsblocker; lokale production build en SHA-close-out volgen. Hosted acceptatie ontbreekt, dus NOT RELEASE-READY.** Browser-Origin en Host waren 127.0.0.1, maar Next.js 16.3.6 gaf request.nextUrl.origin terug als localhost. Daardoor weigerde de test-loginroute een geldige same-origin HR Admin-login met 403 TEST_LOGIN_FORBIDDEN. De route gebruikt nu de feitelijke request-host en bestaande URL-resolutie en vergelijkt die nog steeds exact met browser-Origin. De vaste HR Admin-allowlist, lokale Test Auth-gates en fail-closed voorwaarden zijn behouden.

De regressietest reproduceerde eerst rood en slaagde na de fix. De volledige lokale browsermatrix is groen: 3 persona's × 2 viewports = 6/6 cellen, met toegestane en geweigerde serverprobes, contextasserties en terugkeer naar HR Admin voor Manager en Medewerker. Iedere cel gebruikte een geïsoleerde browsercontext. De accountwissel wist identity-scoped contextcookies; tenant en HR-groep worden daarna opnieuw gecontroleerd. Voor de medewerker blijft de administratie server-afgeleid en moet een eventuele actieve selectie binnen de server-toegankelijke set vallen.

Geen migration of wijziging aan businessrecords. De goedgekeurde lokale TEST-authflow gebruikte bestaande accounts en centrale configuratie; waarden zijn niet gelezen of getoond. Geen push, merge of deployment.

| ID | Area | What broke | Why | Fix | Regression | Result |
|---|---|---|---|---|---|---|
| HARNESS01 | lokale Next-runtime | Node-opties/process-identiteit niet geïsoleerd. | Bootstrapopties liepen door naar workers; ownership niet bewezen. | Config veilig laden, bootstrap isoleren en metadata controleren. | Runtimecontract, readiness, vrije poort, owner-only stop. | GREEN |
| HARNESS02 | PowerShell-runner | JSON met null-velden werd afgewezen. | Redactor accepteerde geen null. | Null veilig toestaan; output beperken. | Echte browser-envelope en contractchecks. | GREEN |
| HARNESS03 | browserrunner | Login-POST werd als eindbestemming gezien. | Alleen routeverandering werd gecontroleerd. | Wacht op POST, confirmation en eindbestemming. | Echte login- en rolwisselketen. | GREEN |
| AUTH01 | login/OTP-handoff | Interne bestemming ging niet veilig door redirects. | Geen gevalideerde, kortlevende handoffbestemming. | Relatieve safe path en korte HttpOnly-cookie. | Redirect allow/deny en cookie-clear tests. | GREEN |
| ORIGIN01 | POST /api/auth/test-login | HR Admin-login gaf 403 TEST_LOGIN_FORBIDDEN. | Next normaliseerde request.nextUrl.origin van 127.0.0.1 naar localhost; Origin/Host bleven 127.0.0.1. | Vergelijk met Host-gebaseerde request-origin. | Pre-fix rood; fix 303; mismatch blijft 403. | GREEN |
| ORIGIN02 | rolwissel/Payroll capability | Loopbackrequest kon worden afgewezen. | Zelfde request.nextUrl.origin-vergelijking. | Veilige origin-resolver; guards behouden. | Loopback- en negatieve Origin-tests. | GREEN |
| CONTEXT01 | Test Auth-/rolwisselcontext | Contextselectie van de HR Admin kon bij een nieuwe persona blijven gelden; de striktere runnercontrole ving dit op. | Contextcookies waren niet aan de voorafgaande identiteit gebonden; daarnaast controleerde de runner vóór de rolwissel al met de doelpersona-verwachting. | Wis de drie actieve contextcookies bij de bestaande lokale Test Auth- en rolwissel; valideer eerst de bron-HR Admin en daarna alleen de doelcontext. | Cookie-expiry regressies; HR Admin, Manager en Medewerker inclusief terugkeer opnieuw getest. | GREEN |
| MOBILE01 | rolwisselmenu | Mobiele interactie vóór hydration. | Runner nam aan dat menu al open was. | Wacht op bevestigde UI-state. | Desktop en iPhone-rolwissels groen. | GREEN |
| FIXTURE01 | context/employee-route | TEST UUID en medewerkerroute pasten niet bij defaults. | UUID-regex te strikt; medewerker heeft geen startdashboardrecht. | UUID 1-8 en instelbare employee-route. | Contextmatrix en management-deny groen. | GREEN |

## 2. Coverage

| Onderdeel | Uitgevoerd bewijs |
|---|---|
| Persona's | HR Admin, Manager, Medewerker |
| Viewports | Desktop 1440 × 900; iPhone 16 393 × 852 |
| Browsercellen | 6/6 GREEN; per cel nieuwe browsercontext |
| Routes | HR Admin/Manager: /dashboard/start; Medewerker: /personal-settings |
| Wisselingen | HR Admin naar Manager en Medewerker via bestaande rolwisselaar; terugkeer naar HR Admin |
| Context | Tenant/HR-groep alle persona's; HR Admin/Manager exacte administratie; medewerkeradministratie server-afgeleid en consistent met de toegankelijke set |
| API-autorisatie | Per persona toegestane en geweigerde directe probe |
| Lokale runtime | Automatische vrije loopbackpoort; alleen eigen server gestopt |
| Omgeving | Centrale goedgekeurde lokale TEST-config; waarden niet getoond |

De medewerker gebruikt een bestaande toegankelijke route omdat /dashboard/start door bestaande autorisatie wordt geweigerd. Dit voegt geen permission toe en omzeilt geen routebeveiliging.

## 3. Role Matrix

| Persona | Desktop | iPhone 16 393 × 852 | Context en wisseling |
|---|---|---|---|
| HR Admin | GREEN — /dashboard/start | GREEN — /dashboard/start | Tenant, HR-groep en opgegeven administratie matchen. |
| Manager | GREEN — /dashboard/start | GREEN — /dashboard/start | Bestaande rolwissel; context matcht; terugkeer HR Admin bevestigd. |
| Medewerker | GREEN — /personal-settings | GREEN — /personal-settings | Tenant/HR-groep matchen; geen actieve administratie en een lege server-toegankelijke set; terugkeer HR Admin bevestigd. |

## 4. Functional Results

- Bij de mislukking waren browser-URL, Origin en Host http://127.0.0.1:3001; request.nextUrl.origin was http://localhost:3001. FormData werd geparseerd en persona was hr-admin, de vaste allowlisted account. De veilige diagnostiek vergeleek alleen origin-overeenkomst, personaSubmitted en status/foutcode; geen formuliertekst of headers opgeslagen. Deze mismatch veroorzaakte de 403.
- De pre-fix regressietest verwachtte 303 en kreeg 403. Na reparatie retourneerde de route 303. Geen algemene fallback toegevoegd.
- HR Admin en Manager openden /dashboard/start; Medewerker opende /personal-settings.
- Manager en Medewerker wisselden via de echte UI/serverroute vanaf HR Admin en keerden terug naar dezelfde HR Admin-context.
- De lokale Test Auth-login en rolwissel wissen tenant-, HR-groep- en administratiecookies van de vorige identiteit. De runner controleerde daarna opnieuw tenant/groep en de server-afgeleide administratiescope; bij terugkeer matchte de HR Admin-administratie exact.
- Alle zes browsercellen GREEN; nul page errors en nul console errors per cel.
- Onveilige absolute/protocol-relative redirectbestemmingen vallen terug op het vaste dashboardpad.

## 5. Negative/Security Results

- Same-origin blijft exact gecontroleerd. Origin/Host-mismatch blijft 403 en roept geen Supabase-client aan.
- Test-login accepteert alleen de bestaande allowlisted HR Admin-persona. Ongeldige persona faalt vóór Supabase-authenticatie.
- Live deny probes: HR Admin test-login met ongeldige persona 403; Manager GET /api/roles 403; Medewerker GET /api/roles 403.
- Live allow probes: HR Admin GET /api/context en /api/roles 200; Manager en Medewerker GET /api/context 200.
- Handoffbestemming blijft relatief, kortlevend en HttpOnly; cookie verwijderd na OTP-confirmatie. Geen token in URL of resultaatlog.
- Contextcookies zijn geen authenticatiebewijs en worden bij de expliciet lokale accountwissel verwijderd; de normale Supabase-session, rol-allowlist en server-side autorisatie blijven leidend.
- Tests bewijzen Test Auth standaard uit, gesloten zonder expliciete flag/canoniek TEST-project, buiten development en met Vercel Production/Preview/lokale Vercel-markers.
- Geen directe request naar Vercel Preview/Production. Niet-lokale uitschakeling bewezen door code en tests, niet door hosted evidence.

## 6. Mobile/Responsive Results

Exact 393 × 852 voor iPhone 16 en 1440 × 900 voor desktop. Alle zes persona-/viewportcellen slaagden inclusief rolmenu-interacties; nul page errors en nul console errors per cel. Geen screenshots of browseropslagbestanden aangemaakt. Dit is functionele viewport-evidence, geen pixel-voor-pixel review.

## 7. Data/DB Readback

- Servercontext gelezen via GET /api/context; tenant en HR-groep matchten alle persona's.
- HR Admin/Manager selecteerden en lazen de opgegeven administratie exact terug; die selectie stond ook in hun server-toegankelijke set. De medewerker had geen actieve administratie en een lege server-toegankelijke set. De runner forceerde geen medewerkeradministratie.
- Na iedere identiteitsovergang werd eerst de bestaande context gewist; een 409 vóór tenant-/HR-groepselectie werd veilig hersteld met alleen de goedgekeurde context. De finale contextassertie draaide onder de nieuwe identiteit.
- Terugkeer naar HR Admin bevestigde de administratie.
- Bestaande TEST-accounts gebruikt. Geen businessrecords aangepast/aangemaakt, geen migration of directe database-table-readback.
- Centrale config alleen door launcher voor goedgekeurde runtime gelezen. Waarden niet getoond, gekopieerd of vastgelegd.

## 8. Quality Gates

| Gate | Resultaat |
|---|---|
| Gerichte Vitest-regressies | 8 bestanden, 80 tests geslaagd; inclusief context-cookie expiratie in Test Auth en rolwissel |
| Harness-contextregressies | 12 Node-tests geslaagd: exact context, expliciete null, server-toegankelijke administratie en fail-closed lege/ongeldige IDs |
| Gerichte ESLint | alle gewijzigde TypeScript/TSX- en runnerbestanden geslaagd |
| Strict TypeScript | `npm exec -- tsc --noEmit --incremental false` geslaagd |
| Standaard type-checkscript | EPERM bij schrijven tsconfig.tsbuildinfo; compilercontrole slaagde met incremental uit |
| i18n | check:i18n geslaagd; 41 NL/EN namespaces |
| Node-syntax | node --check runner geslaagd |
| PowerShell-syntax | PowerShell 7.6.5 en Windows PowerShell 5.1 geslaagd |
| Runtimecontract/browsermatrix | launchercontractchecks geslaagd; finale browsermatrix na alle codefixes 6/6 GREEN, auto-poort 3001, runtime niet hergebruikt, eigen proces STOPPED |
| Diff-check | geslaagd vóór definitieve documentatieclose-out |
| Volledige suite | Niet uitgevoerd; begrensde scope met 92 gerichte Vitest- en harness-regressies conform AA-TEST |
| Production build/finale review | LUNA MAX-review afgerond zonder resterende securityblocker; production build op kandidaatcommit nog vastleggen |
## 9. Fixed During Run

### ORIGIN01 — 127.0.0.1 versus localhost bij test-login

- **ID:** ORIGIN01
- **Module/route:** POST /api/auth/test-login.
- **Persona:** HR Admin.
- **Symptom:** browserlogin gaf 403 TEST_LOGIN_FORBIDDEN.
- **Classification:** auth-origin security/correctness defect.
- **Technical root cause:** browser-Origin/Host waren 127.0.0.1; Next.js 16.3.6 canonicaliseerde request.nextUrl.origin naar localhost.
- **Why previous tests missed it:** fixtures gebruikten localhost aan beide kanten; geen IP-loopback URL.
- **What changed / how fixed:** resolveRequestOrigin met Host en bestaande URL-resolutie, maar nog steeds exacte Origin-match.
- **Files/migrations:** test-login route/test en request-origin utility/tests; geen migration.
- **DEV data/configuration changed:** nee.
- **Regression test:** verzoek dat voor fix 403 gaf; Host/Origin-mismatch blijft 403.
- **Retest result:** pre-fix rood; daarna 303 en live HR Admin-login groen.
- **Downstream areas rechecked:** redirect, allowlist, same-origin-negative, signOut/signIn en browsermatrix.
- **Security/privacy impact:** same-origin en fail-closed behouden; geen algemene versoepeling.
- **Behavior:** bestaande lokale login hersteld; geen nieuwe persona of permission.
- **Commit SHA:** volgt in sectie 14.
- **Prevention lesson:** test loopback-IP en localhost apart; vergelijk Origin, Host en framework-origin als aparte waarden.

### ORIGIN02 — rolwissel en Payroll capability

- **ID:** ORIGIN02.
- **Module/route:** POST /api/auth/test-role-switch en Payroll capability API.
- **Persona:** bestaande rolwisselactor en capability persona volgens routecontract.
- **Symptom:** geldige lokale same-originrequests konden worden afgewezen.
- **Classification:** server origin-validation defect.
- **Technical root cause:** routes vergeleken Origin met request.nextUrl.origin.
- **Why previous tests missed it:** fixtures gebruikten localhost.
- **What changed / how fixed:** resolveRequestOrigin met Host; exacte Origin-match en andere guards behouden.
- **Files/migrations:** rolwissel- en Payroll capability routes/tests; geen migration.
- **DEV data/configuration changed:** nee.
- **Regression test:** IP-loopback en negatieve originroute-tests.
- **Retest result:** gerichte tests en volledige rolwisselmatrix groen.
- **Downstream areas rechecked:** actor/persona, capability en contextautorisatie.
- **Security/privacy impact:** geen bypass of permissionverbreding.
- **Behavior:** lokale loopback hersteld; overige guards ongewijzigd.
- **Commit SHA:** volgt in sectie 14.
- **Prevention lesson:** gebruik één geteste origin-resolver voor same-originroutes.

### CONTEXT01 — contextgrens bij identiteitswissel

- **ID:** CONTEXT01.
- **Module/route:** POST /api/auth/test-login, POST /api/auth/test-role-switch en local-test-acceptance.mjs.
- **Persona:** HR Admin als bron; Manager en Medewerker als doel.
- **Symptom:** Een rolwissel liet context van de vorige identiteit in de browser staan. De scherpere medewerkercontrole wees bovendien uit dat de runner de doelcontext al controleerde vóórdat de HR Admin-bronsessie naar de doelpersona was gewisseld.
- **Classification:** identity-context isolatie en acceptatievolgorde.
- **Technical root cause:** actieve tenant-, HR-groep- en administratiecookies werden niet gewist wanneer de lokale testauthflow van Supabase-identiteit wisselde; de runner gebruikte voor de initiële HR Admin-context al de medewerkerverwachting.
- **Why previous tests missed it:** de eerdere comparator behandelde `administrationId: null` als optioneel en gaf geen aparte bron-/doelsessiecontrole.
- **What changed / how fixed:** beide lokale identity-switchresponses wissen de drie contextcookies. De runner valideert eerst HR Admin als bron en daarna tenant/groep en de administratiecontext onder de nieuwe identiteit. HR Admin en Manager moeten exact de gekozen administratie zien; Medewerker volgt de server-toegankelijke set, en null is alleen geldig als die set leeg is.
- **Files/migrations:** context-cookiehelper, twee authroutes/tests en browserrunner/contextregressies; geen migration.
- **DEV data/configuration changed:** nee; uitsluitend lokale contextcookies op identity-switchresponses.
- **Regression test:** 31 gerichte authroute-tests bevestigen cookie-expiry; context-helpertests weigeren een admin buiten de toegankelijke set en weigeren null wanneer de set niet leeg is.
- **Retest result:** alle zes persona-/viewportcellen GREEN. HR Admin en Manager matchten de administratie exact. Medewerkercontext had geen actieve administratie en een lege toegankelijke set. Beide rolwissels keerden terug naar HR Admin met de exacte context.
- **Downstream areas rechecked:** login, OTP-handoff, employee-route, tenant/HR-groep, API-probes, terugkeer naar Admin en servercleanup.
- **Security/privacy impact:** contextselectie van de bronidentiteit wordt niet doorgegeven; bestaande Supabase-auth, allowlists, same-origincontrole en serverautorisatie blijven leidend.
- **Behavior:** uitsluitend lokale Test Auth- en rolwisselcontext wordt na identiteitswisseling herstart.
- **Commit SHA:** volgt in sectie 14.
- **Prevention lesson:** koppel contextcookies aan de identiteit; test broncontext en doelcontext als aparte fases.

### AUTH01 — login- en OTP-handoff

- **ID:** AUTH01.
- **Module/route:** test-login, test-role-switch en confirmation.
- **Persona:** HR Admin, Manager, Medewerker.
- **Symptom:** interne return-route ging niet door login- en confirmationstappen.
- **Classification:** auth-handoff correctness/security hardening.
- **Technical root cause:** bestemming werd niet veilig gevalideerd en behouden door login/OTP-confirmatie.
- **Why previous tests missed it:** losse routechecks bewezen geen volledige return-path.
- **What changed / how fixed:** safeNextPath; rolwissel bewaart relatieve bestemming maximaal 60 seconden in HttpOnly-cookie en wist die na confirmation.
- **Files/migrations:** authroutes/tests, loginform en rolwisselcomponent; geen migration.
- **DEV data/configuration changed:** nee.
- **Regression test:** redirect allow/deny, cookie cleanup en confirmation in gerichte suite.
- **Retest result:** browserlogin, rolwissel en terugkeer groen.
- **Downstream areas rechecked:** failure redirect, OTP, UI en return context.
- **Security/privacy impact:** geen token in URL; bestemming relatief, cookie kortlevend en HttpOnly/SameSite.
- **Behavior:** betrouwbare return-navigation in bestaande testauthflow.
- **Commit SHA:** volgt in sectie 14.
- **Prevention lesson:** test redirects als browserketen; bewaar minimale handoffdata.

### HARNESS01 — geïsoleerde runtime en owner-only cleanup

- **ID:** HARNESS01.
- **Module/route:** scripts/start-test-worktree.ps1; lokale runtime.
- **Persona:** n.v.t.
- **Symptom:** Next-workers konden bootstrapopties erven; process ownership niet bewezen.
- **Classification:** harness/runtime defect.
- **Technical root cause:** Node-opties en Next-argumenten deelden procesgrens; metadata bewees worktree, HEAD, config en PID niet samen.
- **Why previous tests missed it:** gewone dev-start test geen workerbootstrap, runtime reuse of veilige stop.
- **What changed / how fixed:** process.loadEnvFile, loopback, exacte metadata/readiness; stop alleen zelfgestarte runtime.
- **Files/migrations:** launcher/runtime-contractscript; geen migration.
- **DEV data/configuration changed:** nee; config alleen runtime-input.
- **Regression test:** preflight, contract, /login readiness, vrije poort en owner-only stop.
- **Retest result:** NOT_OWNED-server bleef intact; finale eigen server stopte automatisch.
- **Downstream areas rechecked:** poort, HEAD/config identity, redactie, reuse en cleanup.
- **Security/privacy impact:** geen configwaarde getoond; geen niet-eigen server gestopt.
- **Behavior:** veilige lokale runtime lifecycle.
- **Commit SHA:** volgt in sectie 14.
- **Prevention lesson:** test start, reuse, ambiguous refusal en stop apart.

### HARNESS02 — null-veilige result-envelope

- **ID:** HARNESS02.
- **Module/route:** scripts/test-local-acceptance.ps1.
- **Persona:** n.v.t.
- **Symptom:** JSON met nullvelden werd als ongeldig verwerkt.
- **Classification:** PowerShell-harness defect.
- **Technical root cause:** parameterredactor wees null af vóór null-afhandeling.
- **Why previous tests missed it:** fixtures bevatten geen null-properties.
- **What changed / how fixed:** redactor accepteert null en geeft alleen toegestane velden door.
- **Files/migrations:** PowerShell-wrapper; geen migration.
- **DEV data/configuration changed:** nee.
- **Regression test:** echte runner-envelope en syntaxcontrole.
- **Retest result:** RUNNER_RESULT_INVALID verdween.
- **Downstream areas rechecked:** statusmapping, redactie en cleanup.
- **Security/privacy impact:** body, headers en credentials blijven afgeschermd.
- **Behavior:** betrouwbare resultverwerking.
- **Commit SHA:** volgt in sectie 14.
- **Prevention lesson:** test null en optionele geneste velden in cross-runtime JSON.

### HARNESS03 — redirectketen in de browserrunner

- **ID:** HARNESS03.
- **Module/route:** apps/hr-suite/scripts/local-test-acceptance.mjs.
- **Persona:** HR Admin en doelpersona's.
- **Symptom:** POST-endpoint of confirmation kon worden aangezien voor voltooide rolwissel.
- **Classification:** browser-harness defect.
- **Technical root cause:** runner wachtte op URL-wisseling in plaats van POST-status, confirmationstatus en eindbestemming.
- **Why previous tests missed it:** API-unit-tests testen geen complete browserredirect.
- **What changed / how fixed:** observeer POST 303, confirmation 307 en uiteindelijke route.
- **Files/migrations:** browserrunner; geen migration.
- **DEV data/configuration changed:** nee.
- **Regression test:** echte browserlogin plus rolwissel en retourflow.
- **Retest result:** redirectketen slaagde in alle relevante cellen.
- **Downstream areas rechecked:** route, role marker, context en return-to-admin.
- **Security/privacy impact:** geen responsebody, cookie of token opslaan.
- **Behavior:** betrouwbare observatie van bestaande browserflow.
- **Commit SHA:** volgt in sectie 14.
- **Prevention lesson:** controleer HTTP-redirectstappen en eindbestemming.

### MOBILE01 — menu-interactie na hydration

- **ID:** MOBILE01.
- **Module/route:** mobiele rolwisselbediening in local-test-acceptance.mjs.
- **Persona:** Manager en Medewerker op iPhone 16.
- **Symptom:** menu/rolkeuze was bij snelle browseractie nog niet interactief.
- **Classification:** browser-harness timing defect.
- **Technical root cause:** runner klikte voordat React hydration/aria-expanded de menu-openstatus bevestigde.
- **Why previous tests missed it:** eerdere handmatige/desktopruns raakten het timingvenster niet.
- **What changed / how fixed:** wacht op bewezen open-status en herhaal een klik alleen wanneer menu gesloten bleef.
- **Files/migrations:** browserrunner; geen migration.
- **DEV data/configuration changed:** nee.
- **Regression test:** mobiele rolwisselcellen in volledige matrix.
- **Retest result:** Manager- en Medewerkerwissel en retour op 393 × 852 geslaagd.
- **Downstream areas rechecked:** role selector, routebestemming en return-to-admin.
- **Security/privacy impact:** alleen UI-wachtgedrag; geen auth- of permissionwijziging.
- **Behavior:** betrouwbare bediening van bestaande mobiele UI.
- **Commit SHA:** volgt in sectie 14.
- **Prevention lesson:** synchroniseer op toegankelijke UI-state; vermijd vaste sleeps.

### FIXTURE01 — bestaande UUID en medewerkerroute

- **ID:** FIXTURE01.
- **Module/route:** runner contextvalidator en EmployeeRoute.
- **Persona:** Medewerker.
- **Symptom:** bestaande synthetische UUID werd geweigerd en /dashboard/start was voor Medewerker niet toegestaan.
- **Classification:** harness-fixturecompatibiliteit; dashboardweigering is bestaande autorisatie.
- **Technical root cause:** UUID-validator ondersteunde fixtureversie niet; startdashboard vereist een permission die de medewerker niet heeft.
- **Why previous tests missed it:** fixtures gebruikten oudere UUID-versies en vooral admin/manager-routes.
- **What changed / how fixed:** UUID-versies 1-8 geaccepteerd en aparte toegankelijke employee-route; geen permission toegevoegd.
- **Files/migrations:** browserrunner en PowerShell-wrapper; geen migration.
- **DEV data/configuration changed:** nee.
- **Regression test:** contextmatrix, personal-settings-route en geweigerde managementprobe.
- **Retest result:** beide employee-viewports en terugkeer naar HR Admin groen; /api/roles blijft 403.
- **Downstream areas rechecked:** tenant/HR-groep, server-afgeleide medewerkeradministratie en Admin-context na terugkeer.
- **Security/privacy impact:** dashboard- en API-guards blijven actief.
- **Behavior:** juiste bestaande route/context gebruikt, geen nieuw productgedrag.
- **Commit SHA:** volgt in sectie 14.
- **Prevention lesson:** test echte TEST-fixtures en kies per persona een bestaande toegankelijke route.

## 10. ENVIRONMENT-GATED

De matrix gebruikte bestaande goedgekeurde lokale TEST-configuratie en accounts. Geen account, context, permission of credential is verzonnen. Tests bewijzen dat Test Auth alleen open kan in development met expliciete flag, canonieke TEST-projectref en zonder Vercel-indicatoren.

Geen directe Production-/Preview-request en geen hosted deployment uitgevoerd. Niet-lokale uitschakeling is bewezen door server-gates en tests, niet door hosted endpoint-evidence. De onafhankelijke review vond geen resterende securityblocker; de lokale production build en exacte commit-SHA volgen vóór close-out.

## 11. PRODUCT DECISIONS

Geen nieuw beleid, persona, permission, rol, database-entiteit of feature flag. De lokale Test Auth- en rolwisselroutes wissen contextcookies wanneer de identiteit verandert; de server bepaalt daarna de toegankelijke context. In deze fixture heeft de medewerker geen actieve administratiecontext en een lege toegankelijke set. /dashboard/start blijft beschermd voor Medewerkers zonder die permission. Control behoudt normale OAuth en OWNER/OPERATOR/AUDITOR-autorisatie.

## 12. NOT FIXED

1. Geen openstaand productdefect binnen de gevalideerde lokale HR Admin-, Manager- en Medewerkerflow. Hosted acceptatie is niet uitgevoerd.
2. Geen directe businessdatabase-readback; contextacceptatie gebruikte de servercontext-API. Geen data-write of migration nodig.
3. Geen screenshots/pixelvergelijking; mobiel functioneel getest op exact 393 × 852.
4. Volledige Vitest-suite niet uitgevoerd: begrensde scope met 80 gerichte Vitest-regressies en 12 harness-contexttests conform AA-TEST.

## 13. LESSONS/PATTERNS

- Vergelijk browser-Origin, Host en framework request-origin apart; loopback-IP en localhost kunnen verschillen.
- Los canonicalisatie op en laat origins niet vrij.
- Volg authredirects via response, confirmation en eindbestemming.
- Wacht op UI-state, vooral na hydration en mobiele navigatie.
- Gebruik per persona/viewport een nieuwe browsercontext; forceer geen servercontext die niet wordt blootgesteld.
- Wis identity-scoped context bij iedere toegestane persona-switch en meet daarna alleen booleans/statussen uit de doelcontext.
- Stop alleen servers waarvoor eigenaarschap bewezen is.

## 14. Commits/Remote Head

- Worktreebranch: work/test-harness01-20261004.
- Exacte start-HEAD: 6349d02538351cd01fc51f298c6e6fa0ba88006c.
- Kandidaatimplementatiecommit/geverifieerde HEAD: volgt na de lokale production build.
- Documentatieclose-outcommit: volgt na build en rapportupdate.
- Geen push, merge, remote branchwijziging, migration, deployment of app-version bump.
- Canonieke .env.local bestond; alleen bestaan gecontroleerd. Bestand en waarden zijn niet gelezen of gewijzigd.

## 15. Final Verdict

**LOCAL ACCEPTANCE GREEN / NOT RELEASE-READY.** Browsermatrix, gerichte security-/qualitychecks en onafhankelijke LUNA MAX-review zijn groen. Lokale production build moet nog op de kandidaatcommit worden bevestigd. Hosted/productieacceptatie is niet geclaimd.

## Hervatinstructies

1. Begin in de bestaande worktree; lees AGENTS.md, docs/README.md en docs/delivery/CURRENT_CONTEXT.md. Controleer branch/HEAD en behoud wijzigingen.
2. Voer eerst .\scripts\test-local-acceptance.ps1 -WorktreePath (Get-Location).Path -PreflightOnly uit.
3. Gebruik voor Payroll/API/AI een bestaande TEST-route/context, persona's, desktop en mobiel, en per persona een toegestane plus geweigerde API-probe.
4. Stel -EmployeeRoute in als de algemene route managementpermission vereist.
5. Voor CONTROL02 blijft normale OAuth en OWNER/OPERATOR/AUDITOR-autorisatie leidend; deze harness kan gedeelde runtime/browserinfrastructuur controleren maar voegt geen Control-testlogin/platformrol toe.
6. Bewaar geen screenshots, credentials, headers, bodies, tokens of cookies. Reproduceer fouten, voeg regressietests toe en herhaal relevante gates.
7. Rapporteer ontbrekend bewijs als PARTIAL, BLOCKED BY CONTEXT of ENVIRONMENT-GATED.
