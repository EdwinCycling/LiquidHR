# LOGIC_AND_WORKFLOW.md — Interne logica & workflow-automatisering

> Doel: validatie, custom hooks/services, state management, utilities, error handling en integratiepatronen reproduceren — generiek, los van het specifieke boekhoud/CRM-domein van de bron-app.

---

## 1. Data Validatie & Schema's

- **Zod** is de enige validatie-library, gebruikt aan **beide kanten**: hetzelfde schema valideert clientside formulierinvoer én serverside API-body's. Geen aparte backend-only validatielaag (Joi, class-validator, etc.) ernaast.
- Schema's leven naast de route/module die ze gebruikt (niet in één centrale `schemas/`-god-map) — co-locatie houdt schema en gebruik dicht bij elkaar.
- `zod-to-json-schema` wordt ingezet waar een JSON-schema nodig is buiten TypeScript-context (bv. tool-definities voor een AI-model die een gestructureerde output moet retourneren).
- Validatiefouten van een API-route komen terug als `{ error: message }` met status 400, zodat de client dezelfde foutstructuur kan tonen als bij een 500.

---

## 2. Custom Hooks & Services

- **Hooks-conventie**: klein en gericht, in `lib/hooks/` als ze op meerdere plekken worden hergebruikt (bv. een `useEscToClose`-hook voor het sluiten van panelen/modals op Escape), anders lokaal naast de component. Geen brede "god-hooks" die meerdere verantwoordelijkheden combineren.
- **Services zijn pure TypeScript-modules** in `lib/<domein>/`, zonder JSX en zonder React-imports — dit maakt ze los unit-test-baar en herbruikbaar tussen server components, API-routes en cron-handlers.
- **Eén-schrijfweg-pattern voor kritieke domeinlogica**: als een operatie gevoelig is (financieel, onomkeerbaar, audit-plichtig), bestaat er precies één functie die de bijbehorende tabellen muteert (bv. een `postX()`/`applyX()`-achtige engine-functie). Alle aanroeppaden — UI, import, AI-extractie, cron — gaan door diezelfde functie. Dit voorkomt dat losse code-paden de business-invariant (bv. "twee kolommen moeten altijd optellen tot nul") stiekem kunnen omzeilen.
- **Audit-laag**: één centrale `writeAudit()`-achtige functie die elke mutatie logt (wie, wat, wanneer, oud/nieuw), aangeroepen vanuit de schrijf-functies zelf, niet los per route herhaald.

---

## 3. State Management

- **Geen Redux/Zustand/globale client-store.** State-strategie is gelaagd:
  1. **Server state** = de database, opgehaald per request/server component. Dit is de bron van waarheid, geen client-side spiegel ervan.
  2. **URL/query-params** voor filter/sort/paginatie-state op lijstpagina's — deelbaar via link, overleeft een refresh, en dwingt de server-gedreven fetch-aanpak af (zie BLUEPRINT.md §4).
  3. **React Context** alleen voor iets dat écht app-breed en session-lang is (bv. huidige tenant/administratie-context, scopes/entitlements) — doorgegeven vanuit een server layout naar client components als props/context-provider, niet los opnieuw gefetcht per component.
  4. **Lokale component state** (`useState`) voor UI-only state (modal open/dicht, actief tab, form-draft vóór submit).
- **Cookies** voor cross-request state die de server nodig heeft vóór render (actieve tenant/administratie-keuze, locale) — zo weet de server component bij de eerste render al welke context te tonen, zonder client-side flash-of-wrong-content.

---

## 4. Helper Utilities

Gegroepeerd in `lib/` op onderwerp, niet in één `utils/`-vuilnisbak:
- `lib/utils.ts` — echt generieke helpers (bv. `cn()` voor className-merging via `clsx`/`tailwind-merge`).
- `lib/format-date.ts` — datumformattering, met een vaste output-conventie (dd-mm-jj-stijl voor de gebruiker, nooit rauwe ISO-strings in de UI).
- `lib/labels.ts` — centrale enum→leesbare-tekst mapping (voorkomt dat elke component zelf een switch-statement voor labels herschrijft).
- `lib/logger.ts` — één logging-ingang voor server-side logs, consistente structuur.
- Financiële/afrondingshelpers (indien van toepassing) in een eigen module, altijd symmetrisch afronden en via die ene helper — nooit een losse `Math.round()` her en der.
- PDF-generatie via een React-naar-PDF-renderer-library, in een eigen `lib/<domein>/pdf/`-submap wanneer het een groter onderdeel is.

**Regel:** een utility die ergens voor de tweede keer nodig is, verhuist naar `lib/`; een utility die maar één keer gebruikt wordt, blijft lokaal.

---

## 5. Error Handling & Logging

- **API-routes**: elke route vangt DB/service-fouten af en retourneert een consistente `{ error: string }`-body met passende HTTP-status. Geen ongevangen exceptions die een kale stack trace naar de client lekken.
- **React error boundaries**: een `error.tsx` (route-segment-niveau) en een `global-error.tsx` (root-niveau) vangen render-fouten op en tonen een herstelbare fallback-UI in plaats van een witte pagina.
- **Interne error-tabel**: mutaties/achtergrondprocessen die falen (bv. een cron-job, een AI-extractie) loggen naar een eigen `app_errors`-achtige tabel + een intern beheerscherm, zodat een operator zonder externe tooling kan zien wat er structureel misgaat. Dit is een lichter alternatief voor een externe error-tracker (Sentry e.d.) als je die niet wil opzetten; voeg een externe tracker toe zodra volume/ernst dat rechtvaardigt.
- **Rate-limiting**: een centrale `lib/rate-limit.ts`-helper voor publieke/gevoelige endpoints (bv. portaal-achtige publieke formulieren), niet los per route uitgevonden.

---

## 6. AI-instructie-conventies (generieke regels, domeinspecifieke regels weggelaten)

Uit de CLAUDE.md-achtige AI-instructiebestanden van de bron-app, gefilterd op wat generiek herbruikbaar is voor een nieuwe app:

- **"It takes a genius to keep it simple"** als kernmotto — zowel functioneel als technisch. Dreigt iets complex te worden → stop, meld expliciet, stel een eenvoudiger variant voor, laat de opdrachtgever een functionele concessie doen. Dit is een expliciete escalatie-regel, geen vage richtlijn.
- **Samenhang telt, niet bestandsaantal**: één coherent concept (schema → route → UI → types → test → migratie) mag in één keer doorgebouwd worden tot een stuk of 7 bestanden, ook zonder tussentijds overleg — pas erna melden.
- **Altijd vooraf overleggen** bij: nieuwe architectuur/cross-cutting patroon, moeilijk omkeerbare stappen (data-migratie met verlies, security/auth-model-wijziging), meerdere ongerelateerde dingen tegelijk, of twijfel over de aanpak zelf.
- **Volgorde is altijd schema → API route → UI**, nooit andersom.
- **Geen `any`, secrets altijd via env-vars.**
- **Bestandsgrootte-richtlijnen per laag** (zie BLUEPRINT.md §8) als signaal om te splitsen, niet als harde limiet.
- **Style-SOP**: bondig antwoorden, geen overbodige samenvattingen van zonet uitgevoerd werk, technische besluiten vastleggen in een ADR-achtige log, functionele besluiten in een FDR-achtige log, sessiehistorie in een journal-bestand.
- **Wanneer het instructiebestand zelf aanpassen**: alleen bij een echte scope-shift (nieuwe app, tech-stack-wijziging, autonomieniveau, commercieel model) — niet bij een gewone feature, extra veld of nieuwe query.

---

## 7. Package.json Scripts (essentieel voor de workflow)

Root-niveau (monorepo-orchestratie):
```
dev, dev:<app>            → dev-server per app starten
build, build:<app>        → productie-build
lint, type-check          → over alle workspaces
migrate                   → delegeert naar de app met de DB-migraties
```

App-niveau (voorbeeld uit de bron-app, generiek herbruikbaar patroon):
```
dev                        → next dev
dev:preview                → next dev op een alternatieve poort (parallelle preview naast een hoofd-dev-server)
build / start               → next build / next start
lint / type-check           → eslint / tsc --noEmit
test / test:watch           → vitest run / vitest (watch-mode)
migrate / migrate:dry       → eigen migratie-runner-script (Management-API-gebaseerd, geen Docker nodig)
build:check                 → guard-script vóór deploy
check:i18n                  → controleert NL/EN-sleutel-pariteit in messages/
check:unbounded              → grept de codebase op .select() zonder .limit()/.range()
check:cron                  → detecteert secret-drift tussen cron-config en env
push                        → ketent alle check:*-scripts + build:check + git push + post-deploy-check in één commando
```

**Patroon om over te nemen:** een `push`-script dat *alle* guard-scripts ketent vóór de daadwerkelijke `git push` — dwingt af dat kwaliteitschecks niet "vergeten" kunnen worden, zonder een aparte CI-pipeline nodig te hebben voor een solo/klein team.

---

## 8. Externe Integraties (patroon, niet de specifieke business-toepassing)

- **E-mail (transactioneel)**: één provider-SDK, eigen afzenderdomein met SPF/DKIM per klant/tenant waar relevant. Inkomend: een webhook-endpoint dat routeert op basis van het `to`-adres (bv. slug-gebaseerde routing: alles na een `-` in het lokale deel bepaalt de bestemmingsmodule). Uitgaand: verstuurd namens de eigen/klant-identiteit, nooit met een gedeeld generiek "no-reply"-adres als dat vermijdbaar is.
- **AI-model-provider**: één centrale `MODELS`-constante met logische namen (bv. `MODELS.flash`, `MODELS.smart`, `MODELS.pro`) die naar de daadwerkelijke model-ID's wijst — de rest van de codebase gebruikt nooit een los model-ID-stringliteral. Bij een modelwissel pas je één plek aan. Classificatie-achtige taken altijd met een strak JSON-only-prompt-contract ("antwoord alleen in JSON, geen uitleg, bij twijfel 'unknown', verzin niets").
- **Betalingen/downloads/PDF's**: gegenereerd server-side, nooit clientside samengesteld uit ruwe data (voorkomt manipulatie en zorgt voor consistente opmaak tussen scherm en export).
- **Algemeen principe**: elke externe integratie krijgt een eigen `lib/<provider>/`-map met een dunne wrapper rond de SDK; de rest van de app importeert die wrapper, nooit de SDK direct — zo blijft een providerwissel gelokaliseerd tot één map.
