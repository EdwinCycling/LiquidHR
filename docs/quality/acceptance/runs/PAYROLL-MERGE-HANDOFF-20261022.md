# PAYROLL-MERGE-HANDOFF — lokale Payroll + D1-integratie

- Datum: 22-10-2026
- Worktree: `PAYROLL-MERGE-20261022`
- Branch: `integration/PAYROLL-MERGE-20261022`
- Code-HEAD getest: `283a777073095a3e1912f76223a994462fc76f5b`
- Merge-commit: `35606e1ccae5dc0eba72bb53d92f744503d66240`
- Verdict: **HOLD VOOR MAIN-INTEGRATIE — tests groen; productiebuild/security open**

## Bronnen en commitlijn

| Bron | HEAD bij controle | Behandeling |
| --- | --- | --- |
| lokale `main` | `602ba2376ab453248f4d5f7121b2d35cb227b2d4` | Basis van de nieuwe integratieworktree |
| `integration/PAYROLL-D1-20261022` | `bfcfce6a398dcc56cf652aa958fda55d22b942a1` | Geïntegreerd als tweede merge-parent |
| `work/BRANCH-SPLIT-PAYROLL-20261021` | `86386eed7dc41a8e11c8469614bb4d5706719fd9` | Ancestor van D1; geen dubbele cherry-pick |
| `work/BRANCH-SPLIT-PMUX-20261021` | `0b3934c486b11ff68d915045b7d81a240fe05d26` | Niet geïntegreerd; owner-branch blijft intact |

Merge-base van lokale main en D1 is `14803473c1157285b52cc234fbb6ac70860e9eb1`. De branches hadden respectievelijk 6 main-only en 23 D1-only commits. Merge commit `35606e1c` heeft main `602ba237` en D1 `bfcfce6a` als parents. De Payroll-featurecommit `86386eed` zit al in de D1-geschiedenis.

De lokale main-basis bevatte al de oudere PMUX-02A-commits `1a2490e5` en `06adf35b`. De huidige PMUX-ownerbranch op `0b3934c4` is niet gemerged; de PMUX-browser-/TEST-readback blijft OPEN. PMUX-status en overige main-statussen zijn in AA behouden zonder de owner-branch te wijzigen.

## Integratiecorrecties

- Het `/payroll/runs`-conflict combineert de bestaande main-loaderoptimalisatie `f2685663` met D1's afzonderlijke lijst-/werkplekfoutstates en Suspense-laadstatus. Beide dataverzoeken starten parallel.
- De drie AA-conflicten gebruiken de nieuwere D1-status als basis. Main-only PMUX-02A en route-evidence zijn behouden; PAYRUN-routeperformance blijft PARTIAL.
- De gecombineerde suite vond een producttaalfout in het bestaande main-label “Technical key / Technische sleutel”. Het label is vertaald als “Internal reference / Interne referentie”; de proces-editorasserties bleven behouden. Fixcommit: `283a7770`.
- Relatieve wijzigingsomvang tegenover lokale main: 64 paden, 4.762 toevoegingen en 251 verwijderingen, inclusief de D1-functionaliteit en overdrachtsdocumentatie.

## Kwaliteitsbewijs op de kandidaat

- Payroll/D0/K2 gericht: **19 bestanden, 165 tests PASS**.
- Producttaal en proces-editorcorrectie: **2 bestanden, 4 tests PASS**.
- Finale volledige suite op `283a7770`: **710 bestanden PASS, 4 SKIP; 3.487 tests PASS, 8 SKIP, 0 FAIL**; 199,41 seconden.
- TypeScript `tsc --noEmit`: **PASS** op `283a7770`.
- i18n-pariteit: **43 NL/EN-namespaces PASS**.
- ESLint op gewijzigde appbestanden: **0 errors, 8 warnings**; waarschuwingen zijn ongebruikte parameters/helpers in twee bestaande testbestanden en `PayrollSetupRepository` in `liquid-hr-source-provider.ts`. De later gewijzigde proces-editor-test slaagde ook apart voor ESLint.
- De eerste suite-run op het mergecommit had één producttaalfailure; de bovenstaande copy-fix en gerichte regressie zijn gevolgd door de finale groene full suite.
- Gerichte tests en Vitest slaagden met `TEMP`/`TMP` in deze worktree omdat de sandbox-systeem-Tempmap eerst `EPERM` gaf bij tijdelijke bestandsherschikkingen. Geen timeoutlimieten of assertions aangepast.

## Open build-/securitygate

`npm run build --workspace @liquid-hr/hr-suite` is niet geslaagd. De geïnstalleerde Next.js `16.4.0` stopte met een security-upgradebericht. De officiële Next.js-update van 14 oktober 2026 zegt dat `16.4.1` de gepatchte 16.4-versie is; de update beschrijft kritieke RCE-problemen en een server-action-DoS voor getroffen App Router-configuraties. Zie [de officiële Next.js-security-update](https://nextjs.org/blog/nextjs-security-update-october-14-2026).

Dezelfde buildpoging meldde daarnaast een Turbopack-fout bij het maken van `.next/node_modules/sharp`-junction (`Access denied`, `EPERM`) in deze Windows-sandbox. Installatie gebruikte Node `22.14.0`; `@sparticuz/chromium@149.0.0` meldt een engine-eis van `^22.17.0 || >=24.0.0`. `npm ci` meldde 12 dependency-advisories (1 critical, 9 high, 2 moderate). Geen dependencies zijn bijgewerkt. De buildgate is daarom **OPEN**, niet PASS.

De buildgenerator wijzigde tijdelijk alleen `apps/hr-suite/lib/workforce-tools/mcp/focus-widget-resource.ts`; die kandidaatkopie is teruggezet naar de committed versie. `apps/hr-suite/next-env.d.ts` bleef byte-identiek (SHA-256 `1B59D4C6B83807DB275D43F3CF2CC8E9323F465FAB764EEA091CC5BECD5BAD37`). De oorspronkelijke main-worktree heeft geen build aangeraakt.

## Bewijsgrenzen en overdracht

- Geen live Core/PDF-read, Payroll-run, FINALIZED-status, databasewrite, grantwijziging, push, merge naar `main` of deployment uitgevoerd. De eerder bewezen Mars PDF-byte/hash en D0-acceptatie blijven historische evidence; deze slice heeft ze niet opnieuw gelezen.
- D0-live Manager/foreign-tenant-negatives, PMUX-browser/readback en productie-/hosted-PDF-bewijs blijven afzonderlijke OPEN-punten.
- Voorgestelde volgorde: voer een afzonderlijk geautoriseerde update naar gepatchte Next.js `16.4.1` uit op een gekozen kandidaat; gebruik Node die aan de pakketengines voldoet en een runtime die de build-junction ondersteunt; voer production build en door de dependencywijziging geraakte regressies uit; laat daarna de bestaande mergecoördinatie de lokale merge naar main beoordelen.
- **Geen main-integratie voorstellen zolang de security-/productiebuildgate open is.** Er is geen push, merge naar main, remote databasewrite of deployment uitgevoerd.
