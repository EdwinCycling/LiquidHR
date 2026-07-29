# Onderzoek geheugenverbruik lokale Next.js-server

Datum: 2026-07-29  
Omgeving: Windows 11, Node `22.14.0`, LiquidHR, `@liquid-hr/hr-suite`

## Uitkomst

De gemelde 11,12 GB is niet veroorzaakt door Codex-processen of door een blijvende server-side cache in de LiquidHR-code. De actuele dev-server is een child van `next dev` en gebruikt Next `16.2.12` met Turbopack. Tijdens het laden van steeds nieuwe routes groeit de Turbopack-incremental compilergraph in deze monorepo duidelijk door. De historische 11 GB is met een verse server niet opnieuw bereikt; de best passende verklaring is een Turbopack compile/watch-storm of een opgeblazen dev-state, niet applicatiedata die door een globale Map of timer wordt vastgehouden.

De lokale standaard is daarom op Webpack gezet. De bestaande Turbopack-route blijft beschikbaar via `npm run dev:turbopack` voor gerichte diagnose. Webpack is trager bij de eerste compile, maar de geheugencurve was in de gecontroleerde proef veel lager.

## Stack

- Next.js: `16.2.12` (lockfile bevestigd)
- React en React DOM: `19.2.7`
- Node: `22.14.0`
- Turbopack: standaard aan bij Next 16; de bestaande config bevat `turbopack.root`
- Webpack: niet actief in de oude standaard; geen custom webpack-configuratie
- Experimental flags: geen projectconfiguratie aangetroffen
- Middleware: `proxy.ts`, zonder eigen timer, watcher of globale cache
- Node-compatibiliteit: Next 16 vereist minimaal Node `20.9`; Node 22 valt binnen die ondersteunde range

Next `16.2.12` bevatte volgens de officiële release-notitie alleen documentatie-/TypeScript-7-backports. Er is geen specifieke memory-fix in die patchrelease genoemd. De bekende Turbopack-discussie over 10+ GB groei en oneindig compileren beschrijft dezelfde foutklasse, maar bewijst niet dat exact deze historische PID dezelfde upstream-bug had.

## Bewijs uit de werkboom

De oorspronkelijke procesketen was:

```text
next dev --port 3000
└─ start-server.js
```

De onderzochte PID `37236` was dezelfde `start-server.js`-child en mat na een verse start ongeveer 1,34 GB. De gemelde PID `13380` met 11,12 GB was tijdens dit onderzoek niet meer actief, waardoor daar geen inspector of heap snapshot meer aan kon worden gekoppeld.

De relevante omvang van de workspace:

- 51 pagina's, 117 route handlers, 123 componenten en circa 813 bronbestanden
- `.npm-cache`: 3.215 bestanden, circa 1,10 GB
- `.playwright-cli`: 51 bestanden, circa 5,8 MB, met tijdens de proef zichtbare logschrijfactiviteit
- `.qoder`: 164 bestanden, circa 4,6 MB
- `.next/dev`: circa 4.899 bestanden en 2,62 GB gegenereerde dev-output

Omdat `turbopack.root` de repositoryroot moet omvatten om het gekoppelde workspace-package `@scope/db` te kunnen resolven, vergroot deze instelling bewust de scope van filesystem-resolving en watching. De npm-cache is tijdelijk buiten de root getest en daarna teruggezet. Dat gaf geen afzonderlijke verklaring voor de volledige groei: de routebelasting en compilergraph waren de dominante variabelen.

De code-inspectie vond geen server-side `setInterval`, polling-watcher, `globalThis`-cache, LRU-cache, singleton-Map, grote JSON-import of filesystem-watcher. De gevonden timers/listeners zijn client-side en hebben cleanup. React `cache()` wordt gebruikt voor request-scoped autorisatie/voorkeuren.

## Metingen

De working set is de primaire vergelijking; private memory is als tweede signaal opgenomen. De cache-uit-proef bevatte actieve browserbelasting die tijdens de sessie steeds nieuwe medewerker-, instellingen- en verzuimroutes opende. Daardoor is dit een realistische routeverkenning, geen idle-benchmark.

| Server / moment | Working set | Private memory | Context |
|---|---:|---:|---|
| Historische observatie PID 13380 | 11,12 GB | onbekend | door gebruiker gemeten |
| Verse Turbopack-start, 0 min | 1,30 GB | 1,36 GB | routebelasting gestart |
| Turbopack, 5 min | 1,48 GB | 1,53 GB | actieve browser |
| Turbopack, 15 min | 1,68 GB | 1,73 GB | nieuwe routes/formulieren |
| Turbopack, 30 min | 2,23 GB | 2,24 GB | nieuwe routegraphs |
| Turbopack, 45 min | 2,64 GB | 3,02 GB | actieve browser |
| Turbopack, 60 min | 3,04 GB | 3,72 GB | actieve browser |
| Webpack, 0 min | 1,00 GB | 1,23 GB | zelfde dev-server, verse start |
| Webpack, 5 min | 1,20 GB | 1,54 GB | terugkerende login/dashboard-requests |

De Turbopackworking set groeide in deze routeverkenning dus ongeveer 1,74 GB in een uur, niet 11 GB in een uur. Webpack bleef in de korte vergelijkingsproef rond 1,2 GB. Process handles en threads bleven in beide proeven begrensd; er was geen aanwijzing voor een OS-handle- of thread-explosie.

## Fix en preventie

Toegepast:

1. `apps/hr-suite/package.json` gebruikt nu `next dev --webpack --port 3000` als veilige geheugenstandaard.
2. `npm run dev:turbopack` blijft beschikbaar om Turbopack-problemen reproduceerbaar te onderzoeken.
3. `apps/hr-suite/next.config.ts` gebruikt `__dirname` voor een stabiele absolute Turbopack-root. Daarmee kan starten vanuit een andere working directory niet ongemerkt de parent-workspace als root kiezen.
4. `scripts/measure-next-memory.ps1` meet working set, private memory, virtual memory, handles, threads en CPU op 0/5/15/30/60-minutenpunten.

Aanbevolen werkafspraken:

- Houd npm-cache, Playwright-output en andere append-only logs buiten de Turbopack-root wanneer `dev:turbopack` wordt gebruikt.
- Gebruik `npm run dev` voor dagelijks werk met deze grote workspace; gebruik `dev:turbopack` alleen wanneer de snellere refresh expliciet nodig is.
- Bij een nieuwe geheugenspike: stop de server, verwijder of hernoem alleen de gegenereerde `.next/dev`-state, start opnieuw en vergelijk daarna met `scripts/measure-next-memory.ps1`.
- Bij opnieuw lineaire groei onder een gecontroleerde, idle workload: start met `NODE_OPTIONS=--inspect`, neem twee heap snapshots in Chrome DevTools en activeer `NEXT_TURBOPACK_TRACING=1` voor een Turbopack-trace. De officiële Next.js memory guide en Turbopack tracing guide beschrijven deze werkwijze.

## Open risico's

- De exacte allocatie van de historische PID `13380` kan niet meer worden bewezen zonder die processessie opnieuw te reproduceren; de tabel is daarom bewust gescheiden in historische observatie en nieuwe metingen.
- Turbopack is niet gerepareerd of verwijderd; een directe `next dev` of `npm run dev:turbopack` kan dezelfde compilergraph-groei blijven tonen.
- De afsluitende typecheck in de bestaande werkboom meldde twee losstaande fouten: een export in `app/(dashboard)/hera/page.ts` die in gegenereerde Next-types terechtkomt en een ontbrekende `hasActiveEmployment`-labelwaarde in de bestaande medewerkerpagina. Deze zijn niet door de geheugenonderzoekbestanden veroorzaakt.

## Bronnen

- [Next.js 16: Turbopack standaard en Webpack-opt-out](https://nextjs.org/blog/next-16)
- [Turbopack root en scope van filesystem watching](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack)
- [Next.js local-development tracing](https://nextjs.org/docs/app/guides/local-development)
- [Next.js memory usage en heap-inspector werkwijze](https://nextjs.org/docs/app/guides/memory-usage)
- [Next.js issue/discussion over extreme Turbopack memorygroei](https://github.com/vercel/next.js/discussions/77102)
