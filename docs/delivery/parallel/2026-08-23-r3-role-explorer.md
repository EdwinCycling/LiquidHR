# R3 — Role Explorer handoff

Datum: 2026-08-23
Baseline: `7ef5e39dae8995eafbefcd8f2c0d9eb950c75e21`
Branch: `work/r3-role-explorer`
Worktree: `.codex-worktrees/r3-role-explorer`
Lokale poort: `3125`

## Resultaat

Role Explorer is route-eigen bruikbaar gemaakt als read-only career/role exploration tool:

- huidige medewerker-, job-, profielversie- en peildatumcontext is zichtbaar;
- actieve target profile/version-selectie gebruikt de bestaande URL-contracten `employeeId` en `profileVersionId`;
- employee self blijft auth-bound en gebruikt alleen `profileVersionId` in de URL;
- current versus target wordt als context en per capability weergegeven;
- statussemantiek is expliciet: `MATCH`, `GAP`, `MISSING_EVIDENCE` en `UNKNOWN`;
- bron, geldigheid, reden en volgende actie zijn zichtbaar;
- de tabel is de primaire betrouwbare weergave; radar wordt alleen getoond als alle assen semantisch vergelijkbare numerieke niveaus hebben;
- ontbrekende medewerkers, profielen, requirements en bronrecords hebben expliciete empty states;
- desktop en 390px gebruiken passende weergaven, met gestapelde mobiele capabilitykaarten;
- minimale `roleExplorer...` NL/EN-keys zijn toegevoegd zonder reformat.

De bestaande comparison-service is niet gewijzigd. Er zijn geen schemawijzigingen, migraties, RLS-wijzigingen of remote writes uitgevoerd.

## Gewijzigde scope

- `apps/hr-suite/lib/talent/role-explorer-service.ts`
- `apps/hr-suite/lib/talent/role-explorer-schemas.test.ts`
- `apps/hr-suite/lib/talent/role-explorer-service.test.ts`
- `apps/hr-suite/app/api/talent/role-explorer/route.ts`
- `apps/hr-suite/components/talent/talent-role-explorer.tsx`
- de drie Role Explorer page wrappers;
- `apps/hr-suite/messages/nl/talent.json` en `apps/hr-suite/messages/en/talent.json`.

De API-route autoriseert HR via `talent:manage` en Manager via `talent-comparison:read`; self blijft server-side aan de authenticated employee context gebonden.

## Acceptance matrix

| Controle | Resultaat | Bewijs / beperking |
|---|---|---|
| HR positive | PASS | `/settings/talent/role-explorer`; 58 medewerkers en 6 actieve targetprofielen. Geselecteerde deep-link behield `employeeId=6f2e2302-748f-8684-0ce6-1b29702d5d92` en `profileVersionId=f02e688c-71c0-4434-894f-b32b67dda42c`. |
| HR API readback | PASS | Authenticated GET gaf HTTP 200 met `employees: 58`, `profiles: 6`, `axes: 4`. De oorspronkelijke HR-403 is route-eigen opgelost. |
| HR source semantics | PASS | Fixture-resultaat toont `UNKNOWN` met `Geen vrijgegeven bron` en `Geen actuele vrijgegeven registratie`; geen verzonnen ranking of score, radar bewust verborgen. |
| Manager positive permission | PASS / AMBER data | `/workforce/talent/role-explorer` opent read-only met 5 zichtbare medewerkers en huidige context. Bestaande Manager-RLS-scope levert in deze fixture 0 actieve targetprofielen, waardoor een Manager target-selectie niet verder kon worden uitgevoerd zonder scope/RLS uit te breiden. |
| Manager negative | PASS | Manager naar `/settings/talent/role-explorer` eindigt op `/geen-toegang`. |
| Employee positive | PASS | `/my-talent/role-explorer`; self-bound employee, 5 andere actieve targetprofielen, geselecteerde URL bevat alleen `profileVersionId`; current profile context blijft zichtbaar. |
| Employee negative | PASS | Employee naar `/workforce/talent/role-explorer` eindigt op `/geen-toegang`; direct API-readback gaf HTTP 403. |
| Multiple targets | PASS | HR: 6 targetprofielen; Employee: 5 targetprofielen. |
| Deep-link / refresh | PASS | HR-selectie en URL-contract bleven behouden na reload. |
| Desktop | PASS | HR, Manager en Employee Role Explorer gecontroleerd in desktopbrowser. |
| 390 × 844 | PASS | HR en Employee gecontroleerd met gestapelde capabilityweergave, zonder tabel-overflow. |
| Default / LinkedHR | PASS | `document.documentElement.dataset.theme` gecontroleerd als `liquid-navy` en `linkedhr`; Role Explorer renderde in beide themes. Preference is daarna hersteld naar `liquid-navy`. |
| Console | PASS voor positieve flows | Verse Default- en LinkedHR-sessies: 0 errors en 0 warnings. De negatieve Employee-403 is een bewuste autorisatieprobe en staat daarom niet als productregressie geregistreerd. |

## Verificatie

- gericht Vitest: 2 files, 7 tests passed;
- `type-check`: passed;
- `check:i18n`: 33 namespaces met gelijke NL/EN-sleutels;
- targeted ESLint op gewijzigde Role Explorer/API/page/testbestanden: passed;
- `git diff --check`: passed; alleen normale LF/CRLF-conversiewaarschuwingen;
- productiebuild: `npx next build --webpack` passed inclusief TypeScript, page data, 224 static pages en Role Explorer routes;
- standaard `next build`/Turbopack was niet bruikbaar in de worktree door dependency-root/symlink-resolutie. Dit is omzeild met de bestaande lokale dependency-link en Webpack-fallback; de tijdelijke link en browser npm-cache zijn verwijderd.

## Handoff state

- Geen push, merge, deploy of remote Supabase-actie uitgevoerd.
- `.env.local` is lokaal vanuit de rootcheckout naar de worktree voorbereid; niet getoond en niet gewijzigd in Git.
- Server op poort 3125 moet vóór afsluiten worden gestopt.
- Na serverstop: commit maken op `work/r3-role-explorer` en controleren dat de worktree Git-clean is.
