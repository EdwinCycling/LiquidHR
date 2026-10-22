# PMUX-04R5B2 — autonome TEST-auth en browsercontrole

Datum: 22 oktober 2026  
Uitkomst: **PARTIAL / HOLD**. De ondersteunde lokale HR Admin-login en de echte HR Admin-schermen werkten. Een geverifieerde Edwin-owner-login is niet autonoom beschikbaar in deze runtime; Manager en Employee zijn daarom niet gewisseld.

## Herkomst en bescherming

- Worktree: `C:\Users\Edwin\.codex\worktrees\branch-split-pmux-20261021\LiquidHR`
- Branch: `work/BRANCH-SPLIT-PMUX-20261021`
- HEAD: `39ac2b367170bf714bfd53cbd36a3f9a617d7275`
- De geregistreerde PMUX-worktree is via `git worktree list --porcelain` bevestigd. De werkboom bevatte al `M apps/hr-suite/next-env.d.ts`, `M docs/quality/acceptance/runs/PMUX-04-20261021-TEST-ACCEPTANCE.md` en een untracked R4-index. Die zijn niet aangepast.
- De bestaande Codex In-App Browser op `127.0.0.1:3011` is gebruikt. Geen Chrome-extensietab, poort 3010, Payroll-runtime, andere worktree of remote database is gebruikt.

## Login- en automatiseringspad

- `docs/delivery/TEST_ACCEPTANCE_MATRIX.md` noemt `TALENT_HR_ADMIN_PASSWORD`, `TALENT_MANAGER_PASSWORD` en `TALENT_EMPLOYEE_PASSWORD` voor losse Playwright-sessies. De standaard `fixtures:talent-auth` is geen login-only helper: `scripts/set-talent-fixture-passwords.mjs` roept `auth.admin.updateUserById` aan en stelt wachtwoorden en `email_confirm` in. Dit script is niet uitgevoerd.
- De bestaande `/local/sign-in` is een beperkte, ondersteunde HR Admin-fixturelogin. De knop gebruikt server-side `TALENT_HR_ADMIN_PASSWORD`, roept de normale `signInWithPassword` aan en controleert daarna de echte claims en geverifieerde fixturemail. Deze route is via de normale UI gebruikt; geen wachtwoord of sessiewaarde is gelezen, ingevoerd of gewijzigd.
- De legacy `scripts/local-test-acceptance.mjs` verwacht een aparte headless Playwright-browser en `/api/auth/test-login`. Die route retourneert in deze branch bewust `404 LOCAL_PERSONA_SWITCH_REQUIRED`; de bijbehorende unit test bevestigt dat. Deze runner voldoet dus niet aan de vereiste IAB-flow en levert geen alternatieve owner-login.
- `/login` biedt de normale e-mail/wachtwoord- en Google-aanmelding. `/local/sign-in` maakt geen Edwin-owner-sessie. In de actuele code is geen owner-wachtwoordvariabele of owner-loginhelper aanwezig. De bestaande documentatie vermeldt dat Edwin alleen met een ingesteld wachtwoord via uitnodiging of herstelactie kan aanmelden.
- `/local/personas` en `POST /api/auth/test-role-switch` verifiëren server-side de claims, `auth.uid()`-gebruiker, bevestigde e-mail en allowlist. Alleen een bestaande owner-sessie voor `edwin@editsolutions.nl` krijgt de Manager- en Employee-targets. De `hr-admin`-ownerkey is beperkt tot de Payroll-targets. De HR Admin-fixture kan dus niet via de bestaande switcher naar Manager of Employee.

**Exact ontbrekende authenticatiestap:** een bestaande, geverifieerde Supabase-sessie voor `edwin@editsolutions.nl` in deze afzonderlijke IAB-context, aangemaakt via de normale login. De owner moet daarin een bestaand wachtwoord of Google-login voltooien. Er is geen veilige autonome owner-route gevonden. Geen fixturewachtwoorden ingesteld, geen test-loginendpoint omzeild en geen account, rol of grant gewijzigd.

## Werkelijke IAB-resultaten

| Scherm / actie | Feitelijk resultaat |
| --- | --- |
| `/local/sign-in` | Bestaande HR Admin-fixture authenticeerde via normale Supabase-auth. |
| Contextkeuze | `De Sterren holding · Planeten`; werkadministratie `Jupiter BV`. |
| `/local/personas` | Serverpagina meldde `TENANT_ADMIN`, beheerdersrolcontrole “zou toegang geven” en lokale bevoegdheidscontrole “toegestaan”. De actuele keuzelijst bevatte vier Payroll-targets; `manager` en `employee` ontbraken. Geen target geselecteerd. |
| `/settings/process-automation` | Processtudio laadde met 24 definities. Een bestaande gepubliceerde Interne overplaatsing werd alleen-lezen bekeken. |
| Formulierenstudio | `Interne overplaatsing` v41 met gekoppeld formulier `Gegevens interne overplaatsing` werd alleen-lezen bekeken; formulier-, veld- en participantrechten waren zichtbaar. Geen concept geopend of opgeslagen. |
| Browserconsole | Geen console-errors waargenomen op de bekeken Processtudio-/Formulierenstudio-route. |
| 390×844 | `window.innerWidth=390`, `innerHeight=844`. Een scrollcontainer in de processtudio rapporteerde `clientWidth=375`, `scrollWidth=447`; de mobiele view toont een horizontale scrollbar. |

De echte Manager- en Employee-schermen, hun scopes en hun beheerweigering zijn niet getest. Er is geen procesdefinitie gepubliceerd of gestart en geen aanvraag aangemaakt.

## Screenshot-evidence

Echte IAB-captures zijn in deze Codex-run inline getoond voor `/local/personas` (desktop en mobiel), de Processtudio (desktop en mobiel) en de Formulierenstudio (desktop en mobiel). De 1440×900- en 390×844-viewportwaarden zijn via de browser gecontroleerd. De eerdere vijf PNG-bestanden zijn niet gewijzigd.

De IAB-screenshot-API levert captures inline, zonder ondersteunde lokale bestandspadfunctie. Een tijdelijk loopback-transport werd door de geïsoleerde browsercontext geweigerd (`EACCES`); het is gestopt en heeft geen bestand geschreven. De eerdere data-URL-route is niet gebruikt. **Nieuwe screenshots als bestanden: NOT STORED.** De Employee-, Manager- en toegangsweigeringcaptures blijven **NOT CAPTURED**.

## Gerichte tests

- Auth-/role-switchercomponenttests: **8 files, 65 tests passed** (`local/sign-in`, `test-role-switch`, bevestiging, personas, persona-switcher, auth guards en logincomponenten).
- Afzonderlijke controle `POST /api/auth/test-login`: **1 file, 1 test passed**; de route weigert anonieme fixturetoegang met 404.
- Samen: **9 gerichte testbestanden, 66 tests passed**. Tests zijn lokaal en gemockt; ze bewijzen geen echte Manager-/Employee-sessie.
- Geen TypeScript-, ESLint- of i18n-run: er is geen productcode gewijzigd.

## Gate

- HR Admin fixture-login en zichtbare beheerpagina’s: **GO, binnen de huidige TEST-identiteit en scope**.
- Autonome Edwin-owner-login: **HOLD**.
- Echte Manager-/Employee-rolwisselingen en scopes: **OPEN / NOT PROVEN**.
- Screenshotbestanden: **HOLD** (inline captures beschikbaar in deze Codex-run, geen nieuwe PNG’s op disk).
- Volledige PMUX-04-security- en E2E-acceptatie: **OPEN / HOLD**.

Er zijn geen migraties, TEST-procesmutaties, aanvragen, remote businesswrites, push, merge of deployment uitgevoerd.
