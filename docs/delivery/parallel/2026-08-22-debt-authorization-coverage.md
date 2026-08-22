# Authorization Coverage acceptance — 2026-08-22

**Status:** `GREEN` — acceptance retry lokaal gesloten
**Baseline:** `abfa0bbb7db628f588faa3d4818a4f4663f27b46`
**Worktree:** `.codex-worktrees/debt-authorization-coverage`
**Branch:** `work/debt-authorization-coverage`
**Runtime:** poort `3106`
**TEST-project:** `wnpfloqpjvaacobppbpk` (`Planeten`)

## Scope

De openstaande Coverage-slice is beperkt tot:

- TEST HR maakt één unieke `R2-AUTH-<runid>` tenantrol aan;
- Coverage opent met de echte permissionmatrix;
- één gecontroleerde selectie wijzigt, wordt opgeslagen en geeft een HTTP-status;
- reload bewijst persistente readback;
- dialog focus/Escape/close, dirty-close, pending, error en double-submit;
- desktop, `390x844`, Default en LinkedHR;
- Manager en Employee blijven mutation-denied;
- testrol wordt aan het einde gedeactiveerd/hersteld.

Geen schema-, RLS-, securitycontract-, remote migration-, push-, merge- of deployactie is uitgevoerd.

## Bekend vooraf bewezen

Deze resultaten zijn als bestaande baseline-evidence behouden en in deze run niet opnieuw als authenticated browserbewijs geclaimd:

- HR role create;
- cleanup/deactivate;
- Manager `POST /api/roles` → `403`;
- Employee `POST /api/roles` → `403`.

De resterende baseline-openstaande acceptance was Coverage inspection/save en echte readback.

## Runtime- en browsercontrole

- De opgegeven worktree/branch bestonden niet in de checkout; de lokale worktree en branch zijn vanaf exact de baseline aangemaakt.
- Geen `apps/hr-suite/.env.local` in deze worktree of hoofdcheckout.
- Geen lokale `TALENT_HR_ADMIN_PASSWORD`, `TALENT_MANAGER_PASSWORD` of `TALENT_EMPLOYEE_PASSWORD` beschikbaar; er is geen wachtwoord gelogd, gevraagd of gewijzigd.
- De exacte worktree is op poort 3106 gestart met Next/Webpack.
- Playwright bereikte `http://127.0.0.1:3106/login`, maar de middleware gaf HTTP `500` vóór login/render omdat de Supabase URL en publishable key ontbreken.
- Snapshot bevatte alleen de errorlaag; de browserconsole registreerde de ontbrekende Supabase-configuratie en ontwikkelserverfouten.
- Daardoor is geen authenticated TEST HR-session beschikbaar gesteld en zijn de volgende mutaties bewust niet uitgevoerd: role create, Coverage read, permission PUT/save, reload/readback, Manager/Employee negative rerun en cleanup.
- Er is geen testrol of ander remote testrecord door deze run aangemaakt; cleanup was daarom niet nodig. De lokale server, browser en tijdelijke cache zijn afgesloten/verwijderd.

## In-scope authorization-fix

Code-inspectie van de Coverage-flow vond vier concrete authorization/domain-interactiondefecten:

1. de Coverage-save had geen pending-guard en kon dubbel submitten;
2. een save-fout sloot de dialog alsnog omdat de promise-uitkomst niet werd gecontroleerd;
3. de foutmelding stond alleen achter de overlay en was in de open dialog niet zichtbaar;
4. Escape/X/backdrop kon dirty permissionwijzigingen stil verliezen; direct unmounten omzeilde bovendien focus-restore.

Alleen `apps/hr-suite/components/organization/authorization-manager.tsx` is aangepast: pending/error-state, single-submit guard, zichtbare dialog-error, bestaande `ConfirmDialog` voor dirty close en een authorization-lokale close lifecycle die focus-restore laat uitvoeren. De generieke Foundation/Dialog, API, service, permissions, RLS en database zijn niet gewijzigd.

De vier nieuwe organization-labels zijn paritair toegevoegd in `messages/nl/organization.json` en `messages/en/organization.json`. De gerichte regressietest staat in `components/organization/authorization-manager.test.tsx`.

## Lokale verificatie

- Gerichte Vitest: **7/7 groen** — Coverage componenttest (matrix load, pending, double-submit, success/focus, error, dirty-close) plus bestaande authorization-view-tests.
- Strict TypeScript: **groen** (`npm.cmd run type-check --workspace @liquid-hr/hr-suite`).
- i18n: **groen**, 33 NL/EN-namespaces met gelijke sleutels.
- Gerichte ESLint en daarna workspace-lint: **groen**.
- `git diff --check`: **groen**; alleen bestaande LF/CRLF-conversiewaarschuwingen.
- Volledige suite, productiebuild en authenticated browseracceptance: **niet uitgevoerd / geblokkeerd**, omdat deze slice geen schema-, infrastructuur- of releasewijziging is en de lokale Supabase-runtimeconfiguratie ontbreekt.

## Open handoff

Heropen uitsluitend met de canonical TEST-auth/runtimeconfiguratie beschikbaar in deze worktree. Voer daarna de volledige Coverage acceptance uit via echte browser/API-interactie, inclusief HTTP-status en readback na reload, beide negatieve persona's, desktop/390x844 en Default/LinkedHR. Maak geen rol buiten die gecontroleerde run en deactiveer de unieke testrol altijd aan het einde.

## Acceptance retry — initial environment blocker 2026-08-22 (historical)

De retry is gestopt vóór runtime/browser-start bij de verplichte Stap 0. De expliciet aangewezen canonical bron
`C:\Users\Edwin\Documents\Apps\LiquidHR\apps\hr-suite\.env.local` bestond niet (`Test-Path = False`). Het doelbestand
in deze worktree is daarom niet aangemaakt (`Test-Path = False`). De `.env.local` uit andere tijdelijke worktrees is niet
als vervanging gebruikt.

Omdat de canonical TEST-env ontbreekt, zijn in deze retry geen fixture-wachtwoorden gewijzigd, geen dev-server gestart,
geen browser/API/persona-acceptance uitgevoerd en geen TEST-data aangemaakt. De open Coverage acceptance blijft daarmee
`BLOCKED BY ENVIRONMENT`; er zijn geen nieuwe HTTP-statussen, readbacks, responsive/theme-resultaten of cleanup-acties.

Deze blokkade is historische evidence van vóór het herstel van de canonical TEST-env en wordt vervangen door de GREEN
closure hieronder.

## Acceptance retry — GREEN closure 2026-08-22

De eerdere environment-blocker is opgelost. De standaard canonical TEST-env is zonder inhoud te tonen gekopieerd naar de
exacte worktree (`apps/hr-suite/.env.local`) en met `Test-Path` gecontroleerd. De canonical fixture-auth preflight meldde
alleen updates voor `hr-admin`, `manager` en `employee`; er zijn geen andere accounts gewijzigd.

### Live HR Coverage evidence

- TEST HR maakte de unieke tenantrol `R2-AUTH-20260822-1954` aan met een echte `POST /api/roles` → `201`.
- De echte permissionmatrix laadde in Coverage met de vier autorisatiepunten: `authorization:read`,
  `authorization:write`, `user:invite` en `user:read`.
- Alleen `authorization:read` is geselecteerd en opgeslagen. De echte `PUT /api/roles/{roleId}/permissions` gaf `200`;
  twee directe saves leverden exact één PUT op. De Coverage-save bleef pending-guarded en sloot alleen na succesvolle response.
- Na volledige browser-refresh bleef de role staan op `1 / 4, 25%`; heropenen toonde `authorization:read` checked.
- Schone Escape sloot de dialog en herstelde focus naar de opener. Een dirty Escape toonde de discard-confirmatie;
  `Verder bekijken` hield de dialog open en `Wijzigingen verwerpen` sloot zonder de persistente selectie te veranderen.
- De gerichte regressiesuite dekt pending, single-submit, success/focus, error en dirty-close; alle 10 tests zijn groen.

### HTTP-, persona- en layout-evidence

- `POST /login` → `200` voor TEST HR.
- `GET /api/roles` → `200` voor echte matrix-/cleanup-readback.
- TEST Manager `POST /api/roles` → `403`.
- TEST Employee `POST /api/roles` → `403`.
- Cleanup via `PATCH /api/roles/{roleId}` met `isActive: false` → `200` en `updated: true`.
- Na refresh verdwenen de tijdelijke role en Coverage-kolom uit de actieve matrix; de pagina toonde 3 rollen en 0 actieve
  tenantrollen. De doelpagina eindigde met 0 console-errors en 0 warnings; een losstaande `storage://`-avatarfout tijdens
  persona-dashboardwissels viel buiten deze authorization-slice en is niet aangepast.
- Desktop `1280x720`: Default/Liquid Navy en LinkedHR representatief gecontroleerd, inclusief Coverage-dialog.
- Mobiel `390x844`: LinkedHR representatief gecontroleerd, inclusief Coverage-dialog, Escape en focus-restore.
- Alle gecontroleerde viewports hadden geen horizontale overflow (`scrollWidth === clientWidth`).

### Productfix en afsluiting

De gevraagde `R2-AUTH-<runid>`-vorm bevatte een hyphen, terwijl de bestaande UI- en Zod-validatie alleen underscores
accepteerden. Dit was een echte authorization/domain-validatiebug en is gericht opgelost in de role-codevalidatie en het
bijbehorende HTML-pattern, met een gerichte schema-test. Er zijn geen generieke Foundation-componenten, API-contracten,
permissions, RLS, schema's of securitycontracten gewijzigd.

De tijdelijke TEST-role is aan het einde gedeactiveerd en deactiveer-readback is na refresh gecontroleerd. De lokale
server, browsercontext en tijdelijke tooling-cache zijn na de laatste checks afgesloten/verwijderd; de canonical env blijft
alleen lokaal en is niet gelogd of gecommit. Nieuwe productfix, gerichte test en dit handoff-document worden lokaal op deze
branch gecommit; er is niet gepusht, gemerged of gedeployed.
