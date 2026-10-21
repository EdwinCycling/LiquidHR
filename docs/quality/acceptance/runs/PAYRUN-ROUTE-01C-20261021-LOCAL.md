# PAYRUN-ROUTE-01C — Security, persona en testgate — 2026-10-21

**Eindverdict: SECURITY HOLD.** De twee historische 403→200-fouten zijn niet tot test-ID's te herleiden. De laatst gerapporteerde Test HR Admin-sessie had Jupiter-context en kreeg daar /payroll/runs 200 met een niet-lege interface, in strijd met de Mars-afspraak. Verdere Payroll-reads zijn gestopt.

## 1. De twee 403→200-afwijkingen

De PAYRUN-ROUTE-01/01B-rapporten bewaren alleen de aggregate suite-uitkomst, niet de 15 testnamen of de oorspronkelijke foutregels. Gerichte codezoekactie vond twee plausibele origin-guardtests, maar geen bewijs dat dit de historische failures waren:

- apps/hr-suite/app/api/context/administration/route.test.ts — “rejects a foreign origin before loading context”. POST /api/context/administration met een cross-origin formulier verwacht 403. De handler retourneert JSON 403 vóór loadActiveContext; geen redirect, rolcheck of Payroll-resource wordt bereikt.
- apps/hr-suite/app/api/context/select/route.test.ts — “rejects a cross-origin native form before reading accessible contexts”. POST /api/context/select met een cross-origin formulier verwacht 403. De handler retourneert JSON 403 vóór loadAccessibleContextOptions; geen redirect, rolcheck of Payroll-resource wordt bereikt.

Beide testbestanden zijn gericht uitgevoerd: **2 bestanden, 11 tests geslaagd**. Dit zijn directe handlertests, geen browserharness; 200 door redirectvolgen of gewijzigde testverwachting trad hier niet op. De routes zijn ongewijzigd in codekandidaat 82558de1. Deze resultaten sluiten de historische afwijkingen niet af, omdat de testcase-identiteit ontbreekt.

De lokale servercode bouwt administratie-opties op uit de geauthenticeerde actorcontext en accepteert een administratiecookie alleen als die optie daarin voorkomt. Een onbekende administratie leidt tot een contextselectiefout. De lokale migraties zetten RLS aan voor user_access en user_hr_group_access met SELECT-beleid voor uitsluitend actieve rijen van auth.uid(). De twee origin-guardtests stoppen vóór deze queries; hun RLS-gedrag is dus niet getest. Live grant-rijen of RLS-resultaten zijn niet uitgelezen.

## 2. Persona en browserroute

apps/hr-suite/AGENTS.md bevat geen afwijkende Payroll-personaregels. PAYROLL-TEST-PERSONAS.json beschrijft de bestaande employee-persona's in Jupiter. De aanvullende canonieke PAYROLL-TEST-PERSONAS.md legt vast dat de vaste Test HR Admin Mars-gebonden is en geen Jupiter-toegang heeft. PAYTEST-AUTH-01 (13-10-2026) rapporteerde dat dezelfde bedoelde Admin-context alleen Mars bood en dat Jupiter niet selecteerbaar was.

PAYRUN-ROUTE-01B rapporteert daarentegen een normale lokale Test HR Admin-login met actieve Jupiter-context. De oorzaak daarvan is niet bewezen. Een cookie alleen kan volgens de huidige contextcode geen administratie toevoegen; de contextbuilder moet Jupiter voor die sessie als toegankelijk hebben berekend, of de sessie/role-switch was niet de contractuele Admin. De bewaarde run stelt de feitelijke Auth-identiteit en role-switchstatus niet vast. Er is geen contextwissel, role-switch of grantwijziging uitgevoerd om dit te maskeren.

In die eerder gerapporteerde verkeerde context gaf /payroll/runs HTTP 200 en een niet-lege UI: 6 periodeopties, 38 medewerkeropties en 14 opgeslagen runs. De meting was circa 24,97 seconden. Er zijn geen responsewaarden of namen in het rapport opgenomen; daardoor is niet aantoonbaar dat de 200 geen buiten-scope Payroll- of persoonsgegevens bevatte. De meting telt niet als Mars-browseracceptatie. Sinds de Jupiter-context werd ontdekt zijn geen Payroll-reads of cross-administratieprobes uitgevoerd. Filters, foutstates, negatieve rolcontroles en een geldige Mars-routeprestatie blijven open. Browseracceptatie is **BLOCKED** totdat de bedoelde bestaande Mars-identiteit/context read-only vaststaat.

## 3. EPERM, taalassertie en CONTROLLED-gate

De eerdere full-suitepoging op kandidaatcode stopte vóór collectie: Vitest meldde 707/707 bestanden gefaald en nul uitgevoerde tests door EPERM bij Vite SSR-tempbestandrenames. De bewaarde rapportage noemt de sandbox-tempmap maar niet elk tijdelijk bestandsnaam. TEMP en TMP wijzen naar een sandbox-managed AppData\Local\Packages\sandbox...\AC\Temp; de ACL geeft CodexSandboxUsers alleen lezen/uitvoeren. De runnerconfiguratie bevat geen temp-directoryoverride: apps/hr-suite gebruikt Vitest 4.1.10 via vitest run en vitest.config.ts stelt alleen node-omgeving en clearMocks in.

Met TEMP/TMP/TMPDIR gericht naar een toegestane, taak-eigen Codex-scratchmap voerde Vitest wel tests uit: de twee origin-guardbestanden 11/11 en de taaltest hieronder 2/2. De fout trad op bij Vite-tempbestanden in de sandbox-tempmap; met dezelfde Vitest-configuratie slaagden de kleine tests op een toegestane scratchmap. Dit wijst op de sandbox-temp/renamegrens, niet op een algemeen defect in de worktree of runnerconfiguratie. De full suite is niet opnieuw geprobeerd; herstel daarvan is niet bewezen en de gate blijft **ENVIRONMENT-GATED**. Er zijn geen permissies verruimd en geen sandboxbeveiligingen aangepast.

Gerichte codezoekactie vond apps/hr-suite/lib/i18n/product-language-regression.test.ts als directe match voor de genoemde producttaalassertie. Afzonderlijke uitvoering: **1 bestand, 2 tests geslaagd**: “keeps ordinary NL and EN product copy free of internal test, development, and package labels” en “keeps arrangements copy and ordinary Payroll navigation business-facing”. De oorspronkelijke suite-uitvoer bewaart niet welke enkele assertion faalde; de historische fout is daarom niet aantoonbaar opgelost.

AA-TEST.md vraagt voor deze CONTROLLED-gate een relevante volledige suite en build op de finale code. De build op exact code-SHA 82558de1 was eerder geslaagd; deze taak veranderde geen productcode. De full-suite- en geldige browsergates zijn niet groen. Bestaand PAYRUN-gerichte bewijs blijft 3 bestanden/11 tests; deze taak voegde alleen de gerichte beveiligings- en taalchecks hierboven toe.

## 4. Integriteit, SHA's en wijzigingen

Codekandidaat 82558de1dd1f0439c99866de261b35cbf01b85b6 wijzigt zes Payroll-bestanden: salarisruns-worklist concurrency van 3 naar 6, route/loading/error/access/retry-UI, de bijbehorende test en NL/EN-copy. De patch raakt geen berekening, review, finalisatie, PDF-generator, migratie of audittracepad. Deze taak heeft geen berekening, review, finalisatie, runaanmaak, PDF-mutatie, databasewrite, push, PR, merge of deployment uitgevoerd.

Bestaande FINALIZED-runs, snapshots, bedragen, hashes en audittraces zijn door deze taak niet gewijzigd. Dit is aangetoond via de beperkte code-/bestandsdiff en het ontbreken van writes; actuele waarden en hashes zijn niet opnieuw uit de databases gelezen, mede om geen Payroll-data vanuit de verkeerde Jupiter-context op te halen.

- Branch: work/BRANCH-SPLIT-PAYROLL-20261021.
- Code- en bewezen build-SHA: 82558de1dd1f0439c99866de261b35cbf01b85b6.
- HEAD vóór dit rapport: 52b41c06d3da328f5f63d4ca84549f7e00af9310.
- Alleen dit rapport, docs/AA/AA-CURRENT.md en docs/AA/AA-OPEN.md worden voor deze closeout gewijzigd.
- Geen codefix toegepast: geen bewezen oorzaak die veilig te herstellen was zonder de ontbrekende testcase- en persona-scope op te helderen.

**Closeout:** SECURITY HOLD voor de onopgehelderde 403→200-afwijkingen en de Jupiter-context; browseracceptatie BLOCKED; volledige suite ENVIRONMENT-GATED. Geen releaseactie.
