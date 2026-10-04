# AA-OP — Codex Operating Model

Status: **LEIDEND**
Eerste opzet: 2026-09-29

## 1. Canonieke repository en baseline

- Repository: `EdwinCycling/LiquidHR`.
- Canonieke branch: `main`.
- Start een nieuwe productwave pas nadat de bedoelde baseline op `origin/main` is bevestigd.
- Lees vóór implementatie de relevante AA-documenten en domeinrequirements.
- Scan de actuele code eerst; bouw nooit een tweede versie van iets dat al bestaat zonder die bestaande laag te begrijpen.
- Start een run met een korte statusclassificatie: wat is BEDOELD, GEBOUWD, GETEST en RELEASED.
- Corrigeer expliciet wanneer een prompt of ouder document meer claimt dan repo/acceptance evidence ondersteunt.

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

Voor de centrale lokale TEST-runtime op Windows:
- gebruik `%LOCALAPPDATA%\LiquidHR\TestRuntime\.env.local` uitsluitend als runtimebron;
- start vanuit de repositoryroot met `scripts/start-test-worktree.ps1`;
- het script controleert centrale config-aanwezigheid, workspace-dependencies, loopback-poort en bij Production-modus de bestaande build;
- de config wordt alleen door het child-proces geladen. Kopieer of print geen waarden en commit geen configbestand;
- het script installeert, bouwt, stopt of verwijdert niets. Herstel ontbrekende dependencies apart vanaf de repository-lockfile;
- zie `docs/delivery/TEST_RUNTIME_AND_VERCEL_PREVIEW.md` voor commando's en Preview-scheiding.

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

### Subagents bij grotere runs

Bij substantiële, goed afgebakende runs mogen subagents expliciet worden ingezet wanneer parallelisering of onafhankelijke controle aantoonbaar waarde toevoegt, bijvoorbeeld voor implementatie, security/scope-review, database/migration-review, UI-consistentie, teststrategie of domeinregelcontrole. De hoofdagent blijft orchestrator: verdeelt werk, beoordeelt resultaten, lost conflicten op, laat fixes uitvoeren en rapporteert pas daarna geïntegreerd. Laat niet meerdere agents hetzelfde werk dupliceren zonder duidelijke reden.

**Vaste modelkeuze:** wanneer de runtime/modelselector subagents ondersteunt, gebruikt iedere subagent **LUNA MAX**. Gebruik geen automatische, lagere of alternatieve subagentconfiguratie. Als LUNA MAX niet beschikbaar/selecteerbaar is, vervang dit niet stilzwijgend door een ander model; meld de beperking aan de orchestrator en ga alleen verder wanneer de taak zonder subagent verantwoord kan worden uitgevoerd.

### Grotere geïntegreerde bouwslagen — standaard vanaf 2026-10-04

Voor een substantieel, samenhangend productdoel is **één grotere featurewave met parallelle gespecialiseerde LUNA MAX-agents** de voorkeur boven een lange reeks losse voorbereidings-, acceptatie- en herhaalprompts. Houd de bestaande canonieke repository/één productversie en één orchestrator; extra subagents vormen geen zelfstandig integratie- of releasespoor.

De orchestrator formuleert vóór de bouw één eindgebruikersresultaat, 3–6 gescheiden bouw-/QA-scopes, expliciete bestand-/schema-eigenaars en één geïntegreerde Definition of Done. Agents implementeren, testen en repareren parallel. Een onafhankelijke reviewer kijkt gericht naar integratie, auth/scope, migraties en waar passend fiscale bronjuistheid. Voeg geen tweede laag agents toe wanneer dat alleen overhead oplevert.

**Gated dependency, niet gated hele bouwronde:** markeer per onderdeel `BUILDABLE NOW`, `NEEDS SHARED CONTRACT`, `NEEDS EXTERNAL FIXTURE` of `RELEASE GATE`. Bouw de onafhankelijke onderdelen door en houd verboden writes en publieke interfaces fail-closed. Een ontbrekende authentieke testidentiteit, secret-provenance of extern besluit rechtvaardigt niet het eindeloos heropenen van dezelfde diagnose en **nooit** een bypass, fictief bewijs of een onbevoegde Core-wijziging.

Na vastgestelde root cause en één concrete herstel-/bewijsroute registreert de orchestrator hardnekkige externe afhankelijkheden in [AA-OPEN](AA-OPEN.md) met eigenaar, ID, bestaande evidence, exacte heropeningsaanleiding en afsluitproef; sluit de ontwikkelslice als `PARTIAL` of `ENVIRONMENT-GATED` wanneer de code wel zinvol af is. Dit is geen `GREEN`- of merge-/releaseautorisatie. Een aantoonbaar kritisch security-/integriteitsdefect in het nieuwe onderdeel wordt wel onmiddellijk opgelost of technisch geïsoleerd.

Push een gecontroleerd afgebakende featurebranch / Draft PR wanneer dat onderdeel veilig reviewbaar is, ook bij correct geregistreerde externe gates, **zonder** daardoor merge-ready te claimen. Blijf in één geïntegreerde wave wanneer hetzelfde team de volgende onafhankelijke functionaliteit verantwoord kan ontwikkelen. Maak alleen een extra werkbranch bij een werkelijke overlap-/integratiegrens, niet voor iedere analyse, bugfix of subagent.

Bij iedere Codex-overdracht: (a) daadwerkelijk geleverd en gerichte test-/bugfixresultaten, (b) expliciete onderscheidingen BEDOELD/GEBOUWD/GETEST/RELEASED, (c) alleen relevante AA-OPEN-ID's met concrete benodigde beslissing, (d) **"Wat levert deze ronde ons op?"** en (e) **"De beoogde volgende mijlpalen"**, met concrete volgorde en impact op andere parallelle sporen. Geen onderzoekslus als standaardvervolgstap.

Voor Payroll geldt aanvullend `AA-PAYROLL.md`.

Framework-generated bestanden zoals `next-env.d.ts` zijn geen productwijziging. Commit onbedoelde generated drift niet; herstel die vóór checkpoint/release.

## 6. Defecten tijdens een run

Gebruik:
`reproduce → root cause → minimale fix → regressietest → retest`.

- Geen workaround zonder root cause als die workaround security/data-integrity raakt.
- Geen “even alles herbouwen” voor een lokaal defect.
- Een niet-reproduceerbare incidentele dev-runtimefout wordt gedocumenteerd en alleen gefixt als bewijs een productoorzaak aanwijst.
- Stop test-looping zodra gewijzigd gedrag en relevante regressies bewezen GREEN zijn.
- Wanneer een concreet vastgestelde externe fixture, goedkeuringsbeslissing of omgevingsafhankelijkheid het **laatste** verplichte bewijs verhindert: registreer één item in `AA-OPEN.md` met eigenaar, bestaand bewijs, echte blocker, heropeningsvoorwaarde en afsluitproef. Rond de feature eerlijk af als PARTIAL/ENVIRONMENT-GATED. Heropen dezelfde diagnose niet bij ieder vervolgbericht; gewone reproduceerbare productbugs blijven wel in de normale fix/retestcyclus.

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
