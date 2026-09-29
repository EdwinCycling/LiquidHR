# AA-OP — Codex Operating Model

Status: **LEIDEND**  
Eerste opzet: 2026-09-29

## 1. Canonieke repository en baseline

- Repository: `EdwinCycling/LiquidHR`.
- Canonieke branch: `main`.
- Start een nieuwe productwave pas nadat de bedoelde baseline op `origin/main` is bevestigd.
- Lees vóór implementatie de relevante AA-documenten en domeinrequirements.
- Scan de actuele code eerst; bouw nooit een tweede versie van iets dat al bestaat zonder die bestaande laag te begrijpen.

## 2. Branches en worktrees

Voor substantiële Codex-runs:
- branchnaam: `work/<RUN-ID>-<YYYYMMDD>`;
- externe worktree, bijvoorbeeld `C:\Users\Edwin\.codex\worktrees\<run>\LiquidHR`;
- geen Codex-worktrees onder de canonical repository;
- worktree start exact vanaf de afgesproken baseline;
- leg baseline SHA, branch en worktree in het runrapport vast.

Parallelle runs:
- mogen onafhankelijk werken als de scopes voldoende gescheiden zijn;
- mergen niet zelf naar `main`;
- doen geen version bump;
- deployen niet;
- muteren gedeelde remote schema's alleen wanneer dit expliciet bij die wave hoort en convergenceconflicten zijn voorkomen.

## 3. Geen containerworkarounds

Gebruik voor LiquidHR:
- Node/npm;
- Vitest;
- TypeScript;
- ESLint;
- bestaande scripts;
- geautoriseerde remote Supabase tooling;
- Vercel tooling/browser waar passend.

Gebruik **geen**:
- Docker;
- Docker Desktop;
- docker compose;
- lokale containerized Supabase;
- devcontainers;
- WSL/containerworkarounds.

## 4. Environment en secrets

- `apps/hr-suite/.env.local` wordt nooit handmatig geopend, geprint, gekopieerd, verwijderd, aangepast of gelogd.
- Normale frameworkprocessen mogen het bestand als runtimeconfig laden.
- Als een externe worktree runtimeconfig nodig heeft, gebruik een tijdelijke in-memory/direct-load aanpak die secrets niet toont of persistent kopieert.
- Publieke envwaarden mogen alleen gericht worden doorgegeven wanneer dat expliciet nodig is.
- Nooit brede administratorrechten vragen als een normale user-level oplossing bestaat.

## 5. Implementatiepatroon

Voor iedere feature:
1. bevestig actuele baseline;
2. lees AA + relevante requirements/ADR/FDR;
3. inventariseer bestaande code, tabellen, routes en tests;
4. definieer concrete scope en non-goals;
5. implementeer minimaal binnen bestaande architectuur;
6. voeg relevante tests toe;
7. voer risicogestuurde gates uit volgens AA-TEST;
8. update domeindocumentatie/acceptance evidence waar nodig;
9. commit een schone, afgebakende feature;
10. STOP wanneer scope bewezen is.

Geen opportunistische redesigns of unrelated cleanup in dezelfde run.

## 6. Defecten tijdens een run

Gebruik:
`reproduce → root cause → minimale fix → regressietest → retest`.

- Geen workaround zonder root cause als die workaround security/data-integrity raakt.
- Geen “even alles herbouwen” voor een lokaal defect.
- Een niet-reproduceerbare incidentele dev-runtimefout wordt gedocumenteerd en alleen gefixt als bewijs een productoorzaak aanwijst.
- Stop test-looping zodra gewijzigd gedrag en relevante regressies bewezen GREEN zijn.

## 7. Supabase en migrations

Voor schemawijziging:
- inspecteer huidige remote migration history;
- controleer of het gewenste object al bestaat;
- schrijf een nieuwe forward-only migration;
- pas alleen nieuwe migrations toe;
- lees resultaat terug;
- controleer relevante RLS/grants/policies/RPC's;
- draai relevante advisors;
- genereer/verifieer types na schemawijziging;
- leg afwijkingen/bestaande advisorwarnings vast zonder projectbrede schoonmaak tenzij in scope.

Geen history-edit/reapply om cosmetische lokale bestandsnamen gelijk te trekken.

## 8. Context en scope

Iedere servermutatie/-query die klantdata raakt controleert waar relevant:
- tenant;
- HR-groep;
- administratie;
- rol/capability;
- subject/employee/team/case scope.

Een forged clientparameter mag nooit autorisatiescope verruimen.

## 9. Documentatie tijdens een wave

- Detailrequirements blijven onder `docs/requirements`.
- Product-/architectuurbesluiten gaan naar ADR/FDR wanneer duurzaam.
- Acceptance evidence gaat naar `docs/quality/acceptance/runs`.
- AA-documenten alleen wijzigen wanneer expliciet gevraagd of wanneer de run de actuele baseline/roadmap formeel verandert.
- Absolute lokale machinepaden horen niet in definitieve acceptance reports.

## 10. Stopcriteria

Een gewone featurebranch:
- targeted/relevante gates GREEN;
- bekende limitations expliciet;
- schone commit;
- geen deploy/version bump;
- STOP.

Een featurebranch wordt niet eindeloos opengehouden door nice-to-haves die buiten de afgesproken Definition of Done vallen.
