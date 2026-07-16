# ENVIRONMENT_AND_AI_RULES.md — Onzichtbare configuratie

> Doel: env-vars, AI-instructieregels, Supabase-workflow, deployment-pipeline en package-management reproduceren. Geen echte waarden/secrets — alleen namen en doel.

---

## 1. Project Rules voor AI (samenvatting, generiek deel)

De bron-app gebruikt een `CLAUDE.md`-bestand (project-instructies, gelezen bij elke sessie) + een `AGENTS.md`-bestand per app. Kernpunten die generiek herbruikbaar zijn voor een nieuwe app:

- **"Dit is niet het framework dat je uit je training kent"-waarschuwing** — bij een snel-evoluerend framework (bv. een net uitgekomen Next.js-major) expliciet vermelden dat de AI-training verouderd kan zijn en dat lokale docs (`node_modules/<pkg>/dist/docs/`) leidend zijn boven getraind geheugen.
- **Rolverdeling PM ↔ AI expliciet vastleggen**: de opdrachtgever denkt en communiceert functioneel (mensentaal), de AI vertaalt dat zelfstandig naar architectuur/implementatie/CI-CD/security/testing en krijgt daarvoor eenmalig de benodigde toegang (API-keys/tokens), zodat de opdrachtgever niet steeds met techniek belast wordt.
- **Kernmotto vooraan**: één zin die de stijl-filosofie samenvat (in dit geval "It takes a genius to keep it simple") — functioneel én technisch leidend bij elke afweging.
- **Expliciete escalatieregels**: wanneer een AI-agent zelfstandig mag doorbouwen (samenhangend, klein, omkeerbaar) versus wanneer eerst overleg verplicht is (nieuwe architectuur, moeilijk omkeerbaar, security/auth-wijziging, meerdere ongerelateerde dingen tegelijk).
- **Stijl-SOP**: bondig, geen overbodige samenvattingen, altijd het instructiebestand lezen bij sessiestart, technische besluiten/functionele besluiten/sessiehistorie in aparte log-bestanden bijhouden (ADR/FDR/journal-patroon).
- **Wanneer het instructiebestand zelf wijzigen**: alleen bij echte scope-shift (nieuwe app, tech-stack-wijziging, autonomieniveau, commercieel model) — nooit bij een gewone feature.
- **Kwaliteitsregels als harde lijst**: geen `any`, secrets nooit in code, input-validatie verplicht op elke API-route, financiële/kritieke logica 100% unit-getest, RLS-checklist verplicht na elke migratie (RLS aan + policy in dezelfde migratie, security-advisor draaien vóór commit).
- **Git-conventie**: altijd vanuit de juiste working directory (bij een monorepo: root of de specifieke app-map, expliciet vastgelegd), nooit een heredoc voor commit-messages (leesbaarheids-/tooling-reden).

---

## 2. Environment Variables Template

> Namen + doel, **geen waarden**. Verzameld door te greppen op `process.env.*`-gebruik in de bron-app — pas de lijst aan naar wat de nieuwe HR-app daadwerkelijk nodig heeft; dit is een startpunt, niet een verplichte 1-op-1 kopie.

### Supabase
| Variabele | Doel |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project-URL, client + server |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publieke publishable key, RLS-scoped client |
| `SUPABASE_SECRET_KEY` | Secret key, **alleen server-side**, omzeilt RLS — nooit client-side importeren |

### App-URLs
| Variabele | Doel |
|---|---|
| `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_BASE_URL` | Canonieke app-URL, gebruikt in links/redirects/e-mail-templates |
| `VERCEL_URL` | Automatisch door hostingplatform gezet, preview-deploy-URL |
| `VERCEL_GIT_COMMIT_SHA` | Voor deploy-verificatie (vergelijk gedeployde commit met verwachte) |

### AI
| Variabele | Doel |
|---|---|
| `GEMINI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` | API-key voor de gekozen AI-model-provider |
| `GEMINI_BATCH_ENABLED` | Feature-flag voor batch-API-gebruik (kostenbesparing bij niet-realtime taken) |

### E-mail
| Variabele | Doel |
|---|---|
| `RESEND_API_KEY` | API-key uitgaande e-mail |
| `RESEND_FROM_EMAIL` | Standaard afzenderadres |
| `RESEND_INBOUND_SECRET` | Verificatie van inkomende webhook-payloads |
| `RESEND_WEBHOOK_SECRET` | Verificatie van outbound-event-webhooks (bounces/klachten) |
| `NEXT_PUBLIC_INBOUND_DOMAIN` | Domein voor gegenereerde inbound-adressen |

### Cron / achtergrondwerk
| Variabele | Doel |
|---|---|
| `CRON_SECRET` | Gedeeld secret tussen externe scheduler en het cron-endpoint — moet identiek zijn aan beide kanten, drift = stille 401's |

### Beveiliging / bot-protectie
| Variabele | Doel |
|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Publieke CAPTCHA-site-key |
| `TURNSTILE_SECRET_KEY` | Server-side verificatie-secret |
| `UNSUBSCRIBE_SECRET` | Ondertekenen van unsubscribe-links |
| `WEBSITE_LEAD_SECRET` | Verificatie van binnenkomende leads vanaf een publieke marketingsite |

### Admin / super-admin
| Variabele | Doel |
|---|---|
| `SUPER_ADMIN_EMAILS` / `NEXT_PUBLIC_SUPER_ADMIN_EMAILS` | Allowlist voor platform-brede beheerstoegang |

### Multi-domein / whitelabel (indien van toepassing)
| Variabele | Doel |
|---|---|
| `PORTAL_BASE_DOMAINS` | Toegestane basisdomeinen voor subdomein-rewrite |
| `PORTAL_DEV_SUBDOMAIN` | Lokale ontwikkel-subdomein-simulatie |

### Development / testing
| Variabele | Doel |
|---|---|
| `RUN_DB_TESTS` | Schakelt DB-integratietests aan/uit (voorkomt dat elke lokale testrun tegen een echte DB draait) |
| `NODE_ENV` | Standaard Next.js-omgevingsvariabele |
| `BSN_HASH_KEY` | Minimaal 32 tekens; server-only HMAC-key voor tenantgebonden BSN-vingerafdrukken |
| `EMPLOYEE_PII_ENCRYPTION_KEY` | Exact 32 willekeurige bytes, base64-gecodeerd; server-only AES-256-GCM-key voor BSN en bankrekeninggegevens |

**Regel:** elke nieuwe integratie krijgt exact de env-vars die ze nodig heeft, gedocumenteerd in een `.env.example`-bestand (zonder waarden) zodat een nieuwe ontwikkelaar/agent in één oogopslag ziet wat er geconfigureerd moet worden.

---

## 3. Supabase CLI & Migraties

- **Migratiebestanden**: SQL-bestanden met een timestamp-prefix in `supabase/migrations/`, één bestand per logische wijziging.
- **Uitrol-workflow**: geen lokale Docker-vereiste — migraties worden toegepast via de Supabase Management API (een eigen migratie-runner-script) of via de Supabase MCP-tool `apply_migration` rechtstreeks tegen het remote project. Kies één methode consistent; meng niet.
- **Verplichte volgorde bij een nieuwe tabel** (in dezelfde migratie, niet als losse follow-up):
  1. `CREATE TABLE`
  2. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
  3. Minstens één `CREATE POLICY`
  4. Eventuele autorisatie-helperfuncties in een niet-`public`-schema, `SECURITY DEFINER`, `SET search_path = public, pg_temp`
- **Na elke migratie**: de security-advisor van de Supabase-tooling draaien (`get_advisors` type `security`) en alles oplossen vóór commit — dit is een harde stap, geen "later doen".
- **Types**: na elke schemawijziging TypeScript-types opnieuw genereren naar het gedeelde types-package.
- **Live zetten van een nieuwe tabel**: migratie schrijven → lokaal/preview toepassen → advisor-check → types genereren → RLS-matrix-test schrijven/aanpassen → committen → op push automatisch (of via het migratie-script) naar productie.

---

## 4. Deployment Pipeline

- **Platform**: Vercel-achtig, één project per app, root-directory ingesteld op de specifieke `apps/<naam>`-map binnen de monorepo.
- **Trigger**: push naar de hoofdbranch = automatische productie-deploy; overige branches = preview-deploy.
- **Pre-deploy guard-scripts** (voorbeeld-set uit de bron-app, aan te passen): een i18n-pariteitscheck, een ongebounded-query-check (`.select()` zonder `.limit()`), een build-check, en eventuele domain-specifieke isolatie-checks. Allemaal geketend in één `push`-script zodat ze niet vergeten kunnen worden.
- **Post-deploy verificatie**: na elke push controleren dat het hostingplatform de verwachte commit-SHA daadwerkelijk live heeft staan (voorkomt "het staat toch online?"-verrassingen bij een gefaalde build).
- **Mobiele acceptatie**: iedere testbare ontwikkelmijlpaal krijgt een publieke preview-URL en wordt naast localhost:3000 minimaal op een smalle mobiele viewport gecontroleerd. Dit maakt acceptatie vanaf iPhone en externe laptops mogelijk.
- **Env-vars**: uitsluitend via het hosting-dashboard ingesteld, nooit in de repo.
- **Bij meerdere apps in één monorepo**: elke app krijgt een eigen hostingproject, gekoppeld aan dezelfde repo maar met een andere root-directory-instelling.

---

## 5. Database Seeding

De bron-app heeft een reeks losse seed-scripts in `scripts/` (bv. `seed-rgs.mjs`, `seed-demo-kantoor.ts`, `seed-tax-facts.mjs`) — het patroon, niet de specifieke inhoud, is herbruikbaar:

- **Eén script per logisch datadomein**, uitvoerbaar als losse npm-script-achtige node-commando's, niet één allesomvattend seed-bestand.
- **Deterministisch waar mogelijk**: vaste test-IDs/namen zodat een her-seed reproduceerbaar is en niet elke keer nieuwe willekeurige data genereert (belangrijk om regressies te kunnen vergelijken).
- **Een "demo-organisatie" als vast testbed**: één representatieve, rijk gevulde testomgeving (in de bron-app: een demo-kantoor met meerdere sector-varianten) om nieuwe features/UI tegen te proberen zonder productiedata te raken.
- **Voor een HR-app**: bouw een vergelijkbaar seed-script voor bv. een demo-organisatie met medewerkers, afdelingen, verlofsaldo's, contracttypes — zodat er vanaf dag één realistische testdata is zonder handmatig klikwerk.

---

## 6. Package Management

- **npm workspaces** (geen pnpm/yarn) voor de monorepo — root `package.json` met een `workspaces`-array, elke app/package heeft zijn eigen `package.json`.
- **`npm install` eenmalig vanaf de repo-root** volstaat voor alle workspaces.
- **Node-versie**: vastgelegd via `engines.node` in het root-`package.json` (bv. `>=20`) om versie-drift tussen ontwikkelmachines te voorkomen.
- **Peer-dependency-aandachtspunten** (generiek, niet per se identiek in een nieuw project):
  - React 19 + Next.js (nieuwste major) vereist vaak dat alle UI-libraries (component-libraries, icon-sets) een compatibele major hebben — controleer dit bij elke toevoeging, oudere libraries kunnen peer-dependency-warnings of runtime-issues geven.
  - Tailwind 4 heeft een andere config-aanpak dan Tailwind 3 (CSS-based config via `@theme` in plaats van een JS-config-bestand) — mix deze niet met Tailwind-3-gerichte tutorials/voorbeelden.
  - `husky` + `lint-staged` op root-niveau, met hooks die delegeren naar de juiste app-submap (`cd apps/<naam> && ...`) — nodig omdat git-hooks vanuit de repo-root draaien, niet vanuit een workspace-map.
