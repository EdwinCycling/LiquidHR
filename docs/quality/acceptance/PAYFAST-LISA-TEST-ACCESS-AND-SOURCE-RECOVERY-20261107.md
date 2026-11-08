# PAYFAST Lisa — TEST-account, bronherstel en afrondingsprocedure (7 november 2026)

> **Operationele opdracht / geen PASS-claim.** LiquidHR blijft één GitHub `main`, één bestaande lokale HR Suite op poort 3000 en de twee bestaande Supabase-TEST-projecten (Core `wnpfloqpjvaacobppbpk`; Payroll Lab `jhgeriucbkfarxiudzfy`). Alle medewerkers zijn synthetisch. Gebruik geen nieuwe medewerkers, database of Vercel-app. Geen FINALIZED-run, betalingen of aangiften.

## 1. Actuele HEAD en geïsoleerde wijziging

- Laatst gecontroleerde `origin/main`: `8c580cda76cd2ea641ddaafe13a7b55213d89833` met de ESS-pro-forma van PAYFAST-01.
- Codex rapporteert lokale commit `0ff689d7` uit `payfast-lisa-readonly-20261106` met de alleen-lezenweergave van openingscumulatieven en **3/3** gerichte regressietests, lint/i18n/TypeScript PASS. **Niet naar origin/main gepusht; volledige build nog niet uitgevoerd.**
- Verifieer commit/worktree lokaal; `git fetch origin`; merge/rebase zonder verlies van ander werk. Doe een schone build in een geschikte checkout ná commit; laat beschermd `next-env.d.ts`, WVP-worktree en `.tool-home` onaangeraakt. Geen force-push. Bewijs uiteindelijke GitHub SHA.
- De remote main bevat mogelijk al de bestaande `PayrollOpeningCumulativePanel`; bepaal de **concrete diff** van `0ff689d7` en voorkom dubbel codewerk.

## 2. De bestaande lokale TEST-login — geen wachtwoorden in terminal of chat

**Werk vanuit één echte browsercontext.** Bij een browser zonder sessie levert `/payroll/settings` terecht HTTP 307 → `/login`. Dat is **geen Payroll-bug**. Cookies van een browser van de gebruiker zijn niet vanzelf beschikbaar in Codex-browser.

1. Controleer dat de bestaande HR Suite op `http://localhost:3000` loopt. **Niet** naast de bestaande server nog een start op 3010 afdwingen; doe geen proces-kill.
2. Open in exact de browsercontext waarin de acceptatie wordt uitgevoerd: `http://localhost:3000/local/sign-in`. Deze lokaal afgeschermde pagina heeft een bestaande **Test HR Admin**-knop die naar `/api/local/sign-in` post met `account=hr-admin`; geen nieuwe Auth-user nodig. Als de route niet beschikbaar is, stop en meld uitsluitend runtime-/scopefout.
3. Selecteer in de applicatie **De Sterren holding → Planeten → Jupiter BV**. Controleer desnoods `http://localhost:3000/local/personas`, waar de bestaande payroll-persona's en hun readiness worden getoond.
4. **Verifieer actor-autorisatie server-side vóór writes:** actieve `HR_ADMIN` of `TENANT_ADMIN` plus `salary:read` én `salary:write`, geldige Jupiter Payroll-administratie en dezelfde tenant-/HR-groep-/administratiescope. `HR Admin`-label alleen is niet voldoende; de echte actieve permissions moeten kloppen.
5. Voor ESS-test wissel vanuit de bevoegde lokale Test HR Admin-context rechtstreeks naar `payroll-lisa`, mits haar bestaande Auth-link/role-switch READY is. Open `http://localhost:3000/my-salary/pro-forma`; verwacht **uitsluitend Lisa-selfscope**. De HR Admin-sessie en Lisa-ESS-sessie mogen niet worden verwisseld bij het opslaan van Payroll-instellingen.
6. Eventuele credentialgegevens staan uitsluitend onder `%LOCALAPPDATA%\LiquidHR\TestRuntime\payroll-test-personas.env`. **Niet uitlezen, printen, kopiëren of loggen.** Gebruik het bestaande scherm en TEST-runtime; wijzig geen grants of Auth-users om een verkeerde sessie te maskeren.
7. Canonieke persona-inventaris: [PAYROLL-TEST-PERSONAS.md](PAYROLL-TEST-PERSONAS.md), [machinecatalogus](PAYROLL-TEST-PERSONAS.json). Sommige historische notities in die Markdown zijn ouder dan de machinecatalogus: bij tegenspraak eerst actuele live local persona-readiness en dan de code of logs beoordelen.

**LET OP:** wanneer Codex de browser niet kan overnemen, kan de gebruiker zelf inloggen, maar dat bewijst nog niet dat een onafhankelijke Codex/browsercontroller dezelfde cookies heeft. Geef dan exact die beperking terug, zonder nieuwe login-/fixtureinfrastructuur te bouwen.

## 3. Lisa Test — reeds bewezen gegevens

- Werknemer `64ad3a23-f59a-4ed0-af41-26dda20ff067`, dienstverband `b7391845-77d4-407c-bfe6-555a8a3d463b`; Jupiter BV `8483abc9-f275-c80b-5a23-fedc54ce9f0a`; HR-groep Planeten `6ba6f1df-e376-40f2-abff-ffdf000172e1`.
- Bestaand salaris € 5.500,00 bruto per maand; 40 uren/week, 100%.
- Bestaande immutable FINALIZED run **oktober 2026** `57ac6c10-7a02-49c4-a588-2ca244e621d9`: bruto **€ 5.500,00**, belastbaar loon **€ 5.304,88**, loonheffing **€ 1.477,33**, netto **€ 3.827,55**, totale werkgeverskosten **€ 7.519,59**. Het zijn oktoberuitkomsten, **geen** november-conceptbedragen.
- Oktoberbronhash `e9f2964f8992ed3885017026bd7cff0ad4126b4569bcfb2e29c048108b5f90b0`; inputhash `dfd858d93560081c50efd8a1874468883b3ff46762c3fc8680d5fa1f05357447f`; resultaathash `599f13183f6e4d400f9ec63e11f1cb7078f855fc2ace52db67b16848cdede06a`.
- **Oktober cumulatief bewezen:** bruto €55.000,00, vakantiereserve €4.400,00, eindejaarsreserve €0,00.
- **Nog niet als historisch feit vastgesteld:** cumulatief fiscaal loon, cumulatief ingehouden loonheffing, cumulatief SV-loon, cumulatief Zvw-loon. Niet tienmaal de oktobermaandwaarden gebruiken zonder bronbewijs.
- November-2026 bronhash in de laatste gedocumenteerde SOURCE_GAP `cc0073363786c3880d045a7bc25d962958af0c30bdbd350dc50f15b03079b7d3`; geen input-/resultaat-hashes, geen trace.

## 4. In één geautoriseerde beheerflow naar november READY

1. Open onder **HR Admin** `/payroll/settings`, controleer de bestaande Jupiter-configuratie, versions en opening cumulatives. Bestaande productacties zijn `savePayrollEmployerConfigurationAction` en `savePayrollOpeningCumulativeAction`, server-side via `requireComponentLibraryAccess(true)`.
2. Voor Lisa: controleer effectieve functie/organisatie, arbeidsvoorwaarden, salaris+urenset, cao-classificatie, pensioentoewijzing, werknemersverzekering/IKV, fiscale context, werkgeversinstellingen en pensioen-deelmaandmethode.
3. Edwin heeft expliciet toestemming gegeven om gedeelde **synthetische Jupiter TEST**-instellingen te wijzigen, ook wanneer andere TEST-medewerkers hierdoor veranderen. Kies onderling consistente gedocumenteerde TEST-aannames, voer de wijzigingen via reguliere geautoriseerde UI/services door en leg het verwachte effect op andere Jupiter-testcases vast. **Geen aparte cross-employee impact-HOLD.**
4. Voor de zeven cumulatieven gebruik eerst waar mogelijk de bestaande historische geautoriseerde payroll-snapshots, aangetoonde actuele bronperioden en echte opgeslagen traces. Als vier oude waarden daaruit **niet** zijn te reconstrueren, definieer een **nieuwe expliciete synthetische TEST-opening** met volledige periode, `asOfDate`, TEST-provenance en consistent berekende waarden; rapporteer dat dit een scenario-aanname is en **niet** historisch geverifieerd. Respecteer bestaande normalisatie-/conflictvalidatie van de productservice. Als deze dienst zich verzet tegen nieuwe opening na een historische FINALIZED-run: **niet** omzeilen, maar rapporteer exacte blocker en bouw eventueel een afzonderlijk geautoriseerd TEST-correctiepad met tests.
5. Na iedere bronwijziging read-only snapshot en `SOURCE_GAP` opnieuw controleren. Verwachte uitkomst: exact `sourceReady` voor bestaande novemberperiode, geen verlopen arbeidsvoorwaardenset of ontbrekende pensioen-/cumulatiefbron.
6. Via bestaande `/payroll/runs` één **CONCEPT**-berekening. Rapporteer werkelijk bruto, werknemerverzekerings-/pensioeninhoudingen, fiscaal loon, loonheffing, netto, werkgeverskosten, bron-/input-/resultHash en tracecount. **Niet** finaliseren.
7. Met `payroll-lisa` voer de ESS-pro-formascenario's uit: +€100 bruto bonus, +2 extra uren, +5% salaris en 32 contracturen. Vergelijk baseline versus scenario en bewijs **0 writes** bij ESS-pro-forma.
8. Leg het bewijs vast in `docs/quality/acceptance/runs/`: SHA, actieve persona/scope (geen secrets), bronstatus en exacte lacunes, hashes, test-/buildstatus en bewijs van selfscope/geen mutaties.

## 5. Verplichte stopredenen

**Wel stoppen** bij echte autorisatie/RLS-fouten, onoplosbare broninconsistentie, ongeldige fiscale/pensioenmethode of conflict met immutable FINALIZED. **Niet stoppen** alleen vanwege de synthetische impact op andere Jupiter-medewerkers, een oude HOLD-tekst, of omdat een andere worktree bestaat. Geen directe SQL-writes, geen nieuwe medewerkers, geen tweede rekenengine, geen finale loonrun, betalingen of aangiften.

De aanwezigheid van de lokale pro-forma UI of van een geslaagde 3/3-componenttest bewijst nog **geen** berekende novemberrun.
