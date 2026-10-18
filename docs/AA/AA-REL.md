# AA-REL — Convergence, Release, Deployment & Cleanup

> **Convergentie-update 18-10-2026:** [AA-PAYROLL-CONVERGENCE-20261018](AA-PAYROLL-CONVERGENCE-20261018.md) bevat actuele branch-/SHA-matrix en open QA. Er is lokaal een nieuwe `integration/pay-converge-20261018` met Core-fix-cherry-picks `7adc8c21`/`d4b089e9`; dit is **geen** volledige Payroll/STAR-integratie of release. De oude `integration/pay-converge-20261004` is niet de doelbasis. Controleer commit-ancestry, resterende lokale branches, migratieversies en toolchain (Node/Windows `EPERM`) vóór gecombineerde QA.
>
> **Eén actieve LiquidHR-applicatieomgeving**, maar meerdere technische databaseprojecten; het Vercel-`production`-label bewijst op zichzelf geen gebruik van echte klantdata of volledige wettelijke payrollgereedheid. Reinigings- en migratiewrites pas na verifiëren van daadwerkelijke database-/administratiebinding, herstelbaarheid en historisch FINALIZED-behoud. Merge naar `main` en deployment blijven expliciet gescheiden GO-besluiten.

Status: **LEIDEND**
Eerste opzet: 2026-09-29

Doel: één gecontroleerde releaseflow en geen iteratiehel.

**Releasebeleid:** LiquidHR werkt **LOCAL FIRST → GITHUB CONTINUOUS → VERCEL ON DEMAND**. GitHub `main` is de Development-baseline; de bestaande Vercel `production`-deployment is de synthetische TEST-baseline. Push, PR of merge is nooit een release. De omvang van de codegate volgt het **risico van de diff**, niet de omvang van LiquidHR.

| Route | GitHub-integratie | Bewijs |
| --- | --- | --- |
| **FAST** — zuiver cosmetische UI, logo, tekst of icoon zonder contractimpact | Binnen expliciet Git-mandaat; geen Preview of Vercel-build | Gerichte lokale checks en korte visuele smoke; hosted bewijs blijft OPEN tot een release |
| **STANDARD** — afgebakende gewone feature of bugfix | Gecontroleerde GitHub-integratie; geen automatische TEST-deployment | Gerichte module-/contractchecks en toepasselijke lokale browserflow |
| **CONTROLLED** — auth-/OAuth-toestemmingssemantiek, tenant/RLS, schema, Payroll, security, brede shared core | Volledige gecontroleerde convergence- en acceptatieflow; deployment blijft afzonderlijk | Positieve/negatieve scopechecks, volledige finale relevante suite en vereiste lokale gates; gehoste gate alleen na expliciete release |

Alle routes behouden privacy, audit, RLS, secrets, migratiebescherming en een non-force integratie met exacte SHA-provenance. Een FAST-aanpassing aan enkel de **presentatie** van een consent-scherm is niet automatisch CONTROLLED; wijziging van weergegeven rechten, scopes of betekenis kan dat wel zijn.

## 1. Scheiding feature versus release

Featurebranches:
- implementeren;
- targeted/relevante tests;
- expliciet geselecteerde in-scope bestanden committen;
- geen version bump of handmatige deployment voor docs/tooling;
- mergen/pushen alleen wanneer de oorspronkelijke opdracht dat expliciet autoriseert;
- stoppen zodra scope en toepasselijke gates bewezen zijn.

**FAST/STANDARD GitHub-flow:** bevestig actuele main en diff → gerichte tests/lint/type/i18n waar relevant → één toepasselijke lokale UI-smoke → commit/integratie/push **alleen met expliciet voorafgaand Git-mandaat** → registreer alleen de Development-baseline. Geen Vercel-build, Preview of hosted smoke; niet-kritieke ontbrekende QA blijft eerlijk OPEN. Geen standaard full suite, uitgebreide screenshots of aparte closeout-run.

**CONTROLLED/formele convergence:**
- integreert expliciet geselecteerde featurecommits;
- lost integratieconflicten op;
- past alleen nieuwe migrations éénmaal toe na de vereiste aparte toestemming;
- voert gezamenlijke runtime/securityacceptatie uit;
- sluit met één complete releasegate.

## 2. CONTROLLED/formele convergence-flow

De onderstaande uitgebreide flow is **niet** automatisch van toepassing op elke FAST/STANDARD-push naar synthetische TEST.

1. bevestig baseline;
2. integreer geselecteerde branches/commits;
3. controleer migrationlineage vóór remote wijziging;
4. pas uitsluitend nieuwe migrations toe;
5. readback + typegen + RLS/grants/advisors;
6. targeted integration tests;
7. runtime/persona/securityacceptatie;
8. bij runtime-/schemawijzigingen één volledige relevante suite op de definitieve code ná de laatste wijziging; herhaal die niet na uitsluitend docs/versionmetadata;
9. strict TypeScript;
10. ESLint;
11. i18n indien relevant;
12. `git diff --check`;
13. productiebuild(s);
14. acceptance report finaliseren;
15. pas daarna releasebesluit.

Een eerder GREEN resultaat mag niet als finale **CONTROLLED/formele** releasegate worden hergebruikt wanneer daarna nog relevante schema-/runtimecode is gewijzigd. Hergebruik ongewijzigd, nog geldig bewijs bij FAST/STANDARD en test het daadwerkelijk gewijzigde oppervlak; herhaal de volledige suite niet na alleen documentatie/versiemetadata.

## 3. Versioning

- Version bump exact éénmaal per release.
- Geen versie bump op losse featurebranches.
- Bump pas nadat code- en acceptancegates GREEN zijn.
- Alleen docs/versionmetadata na bewezen GREEN code triggert niet automatisch opnieuw de volledige suite.

## 4. Main en provenance

Voor release moet bewezen worden:
- validated release SHA bekend;
- local `main` = `origin/main` = validated release SHA;
- geen force push;
- merge/push gebeurt gecontroleerd;
- release evidence vermeldt de definitieve SHA.

## 5. Release checkout

Gebruik geen extra checkout/worktree als de bestaande veilige checkout schoon en geschikt is. Een afzonderlijke releasecheckout is alleen nodig wanneer isolatie of een aantoonbaar schone releasecontext dat vereist. Deploy nooit vanuit een dirty checkout.

Als een aparte checkout noodzakelijk is, baseer die op:
- exact `origin/main`;
- clean;
- geen `.env.local`;
- geen `.next`;
- geen debugtraces/acceptance artifacts;
- geen nested worktrees;
- geen onbedoelde framework-generated drift zoals gewijzigde `next-env.d.ts`;
- sane upload footprint.

Docs-/tooling-only PR zonder runtime-, schema-, configuratie- of UI-gedrag:
- volstaan relevante document-/scriptchecks en `git diff --check`;
- geen volledige HR-suite, productiebuild, Preview of browseracceptatie vereisen;
- geen version bump;
- geen Vercel-build of deployment starten. De docs-only `ignoreCommand` is een fail-open buildfilter als een build toch wordt aangevraagd; hij is geen deployment-triggerblokkade.

## 6. Vercel

Canoniek HR-project: `liquidhr`.

- “Production” is de deploymentchannelnaam, niet een tweede businessomgeving.
- Deploy alleen het bedoelde project.
- Control Plane wordt niet automatisch gedeployed omdat HR-suite wordt released.
- Controleer deploymentstatus READY.
- Controleer bestaande canonical alias.
- Controleer waar tooling dit exposeert de commitprovenance.
- Een ontbrekend hostingmetadata-veld is evidencegap, niet automatisch productdefect.

### Baselines en Git-deploymentblokkade

- **Development-baseline:** actuele GitHub `main`-SHA en geïntegreerde ontwikkelcode.
- **Deployed TEST-baseline:** actieve Vercel deployment-ID, daadwerkelijk gebruikte source-SHA, appversie, releasedatum en release-/smokeresultaten. `main` mag vooruitlopen; een nieuwe commit is geen release.
- Houd de GitHub-repository gekoppeld. `vercel.json` gebruikt `"git": { "deploymentEnabled": false }`; volgens [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration) schakelt dit automatische Git-deployments voor alle branches uit. Gewone PR's krijgen geen Preview en docs-only commits starten geen Vercel-build.
- Vóór de eerste push van deze beleidsconfiguratie moeten de effectieve Vercel Git/Preview-projecttriggers al uitgeschakeld zijn. Controleer ook branchinstellingen, Actions/workflows, Deploy Hooks en externe callers; verifieer dat geen push/merge een deployment kan maken. Alleen `vercel.json` of `ignoreCommand` bewijst niet dat de eerste config-push veilig is. Als dit niet betrouwbaar is vastgesteld: **stop vóór push**.
- Schakel de Git-integratie niet uit. Behoud alleen expliciet geautoriseerde on-demand CLI-deploys. Een Deploy Hook of externe automation mag uitsluitend een apart geautoriseerde release kunnen starten; onbekende callers blijven een blokkade voor GREEN.

### Previewbeleid

- Gewone PR's maken geen Preview. Een Preview bestaat alleen na expliciet verzoek en toepasselijke risk-/releasegate; gebruik een commit-specifieke immutable URL.
- Vercel Preview gebruikt uitsluitend eigen Preview-scoped variabelen en geïsoleerde synthetische Core/Payroll-backends, nooit lokale of gezamenlijke TEST-config.
- Start een Preview alleen met Vercel CLI (`vercel deploy`) vanaf de expliciet gekozen schone commit; geen PR- of branch-trigger.
- Voer bij een expliciet vereiste Preview de toepasselijke browsermatrix uit, inclusief normale auth, relevante console/networkcontroles en 390 px waar van toepassing. Leg ID/URL, SHA, READY en resultaten vast.
- Behoud de mogelijkheid voor een later expliciet geautoriseerde Preview via de gecontroleerde on-demand route; zet automatische PR-triggers niet als standaard aan.
- Promoveer geen Preview met `vercel promote`: die actie bouwt opnieuw met Production-variabelen.

### Expliciete release: `RELEASE LIQUIDHR TEST`

Alleen het expliciete verzoek **“Release LiquidHR TEST.”** autoriseert een deployment. Push, merge, PR, tag of documentatie-update doen dat niet.

1. Verifieer de schone, actuele GitHub `main`, de vaste source-SHA en databasecompatibiliteit. Lees de actieve canonical TEST-deployment en leg vooraf ID, SHA, appversie en alias vast; verwijder of wijzig die baseline niet.
2. Voer de gates uit die bij de release-risico's horen. Verhoog `apps/hr-suite/lib/app-version.ts` alleen indien nodig, exact eenmaal; commit de versie en fixeer daarna de definitieve source-SHA.
3. Bouw/deploy vanuit een schone checkout van die SHA met de gekoppelde `liquidhr`-projectconfiguratie en Vercel Production-buildinstellingen. Start de deployment expliciet met de Vercel CLI (`vercel deploy --prod`); voer dit nooit uit als onderdeel van een gewone GitHub-integratie en gebruik geen andere Vercel-projecten.
4. Controleer deployment-ID, READY, project, bron-SHA waar beschikbaar, canonical alias en gerapporteerde appversie. Voer één toepasselijke hosted smoke uit.
5. Als Vercel geen betrouwbare Git-SHA-metadata geeft, registreer een controleerbaar manifest in `docs/quality/acceptance/runs/` met source-SHA en tree-SHA, deployment-ID/URL en buildlog, appversie, tijdstip, alias-readback en smoke-uitkomst. Noem dit manifestprovenance; claim geen metadata-SHA-pariteit die niet is aangetoond.
6. Werk Deployed TEST-baseline en opslagmeting bij. Start geen opschoning als deel van de release.

De exacte lokale runtime- en releasecommando's en Preview-gates staan in `docs/delivery/TEST_RUNTIME_AND_VERCEL_PREVIEW.md`.

### Function Storage, tracing en retentie

- Vercel Hobby heeft momenteel 10 GB Deployment Storage; waarschuw vanaf 60% van de toepasselijke planlimiet. Meet vóór en na elke expliciete release of afzonderlijk geautoriseerde retentiewijziging.
- Bij elke wijziging aan Chromium, Playwright of PDF-tracing: productiebuild voert `prepare-function-traces.mjs` en `check-function-trace-size.mjs` uit. Bewaar top 10, totale tracebytes en route-assets vóór/na. Houd de exacte renderer-allowlist in `function-trace-policy.mjs` en de verwachte route-index synchroon; alleen die routes mogen Chromium/Playwright bevatten. Controleer alle Chromium-`.br`-bestanden, Playwright `browsers.json`, Chromium-buildbestanden, gebruikte Work Sans-fonts en PAYRUN-logo's.
- De checker waarschuwt boven 150 MiB en faalt boven 225 MiB aan ongecomprimeerde tracebytes per functie; dat houdt marge onder Vercels maximum van 250 MB ongecomprimeerd. Tracebytes zijn geen ZIP- of Dashboard-opslagmeting.
- `vercel.json` zet Git-deployments uit voor alle branches. De docs-only `ignoreCommand` slaat alleen een niet-lege, SHA-geverifieerde set Markdown-documentatie over; ontbrekende SHAs, mislukte Git-vergelijking, lege diff of andere bestanden laten een aangevraagde build doorgaan. Deze filter vervangt de Git-triggerblokkade niet.
- Houd Preview-deployments minimaal: gewone PR's maken er geen; iedere expliciete Preview heeft een reden, eigenaar en retentieplan. Controleer actuele Vercel-retentie-instellingen en leg beheer daarvan vast. Zie [Vercel Hobby-retentie](https://vercel.com/changelog/hobby-projects-now-retain-fewer-deployments-to-free-up-storage).
- Bescherm altijd de actieve canonieke TEST-deployment waar `liquid-hr-hr-suite.vercel.app` naar verwijst. Nooit automatische of destructieve deploymentopruiming. Alleen na afzonderlijk mandaat, nadat automatische Git-triggers uit staan, en uitsluitend volgens de bewezen PowerShell V4-procedure met voorafgaande SHA-/aliascontrole.

## 7. Hosted safety smoke

Minimaal:
- publieke login laadt;
- normale loginmethoden blijven aanwezig volgens productconfig;
- Test Auth niet zichtbaar/bereikbaar;
- TEST_CAPTURE niet publiek;
- geen bootstrap/debugtokenroute;
- geen Control Plane oppervlak via HR-suite;
- beveiligde routes vereisen auth.

Authenticated hosted smoke alleen wanneer veilig beschikbaar; geen auth-bypass bouwen voor bewijs.

## 8. Expliciete, beperkte TEST-release met open acceptance

Voor de uitsluitend synthetische operationele TEST-omgeving kan Edwin **in de oorspronkelijke taak** expliciet een beperkte TEST-release met niet-kritieke OPEN acceptatie autoriseren; dat is voldoende mandaat en vereist niet bij elk open screenshot een nieuwe toestemming. Dit geldt niet voor een bekende kritieke auth-/privacy-/scope-/integriteitsregressie. Rapporteer openstaande bewijspunten als OPEN, nooit als GREEN. Minimum:
- minimale geverifieerde auth/anonieme API-/tenantbasissmoke en geen vastgestelde kritieke kwetsbaarheid;
- **passende risicogestuurde gate:** FAST/STANDARD targeted; CONTROLLED de volledige finale relevante suite, met eerlijke registratie van omgevingsgebonden timeouts;
- exacte release-SHA, local/main/origin synchronisatie en schone deploymentcheckout;
- hosted READY/safety smoke;
- expliciete afzonderlijke OPEN-matrix, niet vermommen als volledig ACCEPTANCE GREEN. Gebruik `AA-OPEN.md` als **index** van relevante nog openstaande punten, met de gedateerde testrapporten als onderliggend bewijs.

Vercel `production` is hier alleen het deploymentchannel, **geen** claim van operationele productieklaarheid. Deployment Protection is geen afgesproken extra voorwaarde voor deze TEST-release; dit ontslaat ons niet van server-side autorisatie of het gericht bewijzen van de openstaande negatieve controles.

De CONVERGENCE01-uitzondering van 2026-10-02 resulteerde in TEST `1.20260928.1` met securityacceptatie OPEN. Verdere bugfixes documenteren als nieuwe traceerbare commits/deployments, en kritieke bevindingen eerst oplossen voordat nieuwe gevoelige mogelijkheden worden geactiveerd.

## 9. Releaseblockers versus backlog

Release blocker:
- vastgesteld kritisch security-/data-integriteitsdefect; voor een volledige ACCEPTANCE GREEN-release blijft elke verplichte ontbrekende securityassertion blokkerend; een bewust beperkte TEST-release volgt uitsluitend de uitzondering hierboven;
- required migration mismatch;
- verplichte acceptance assertion faalt;
- verplichte gate **voor de toepasselijke leverroute** rood (een niet-verplichte full suite bij FAST/STANDARD is geen automatische TEST-blocker);
- deployment niet READY.

Geen automatische blocker:
- expliciet geparkeerde volgende wave;
- projectbrede bestaande advisorwarnings buiten scope;
- nice-to-have UX;
- bewijs dat door toolingmetadata niet beschikbaar is terwijl onderliggende release technisch bewezen is, mits expliciet als evidencegap vastgelegd;
- niet-kritieke ontbrekende theme-/viewport-/screenshotcontrole bij FAST/STANDARD, mits toegelaten als OPEN in het expliciete synthetische TEST-mandaat.

## 10. Cleanup

Cleanup is **geen verplicht sluitstuk van een kleine productwijziging**. Bundel reguliere repository-/worktreeopruiming in een afzonderlijk geautoriseerd onderhoudsmoment. Na succesvolle integratie/release, uitsluitend waar nodig:
- stop lokale servers;
- controleer poorten/processen;
- verwijder tijdelijke generated artifacts;
- verwijder alleen de eigen tijdelijke branch/worktree na bewezen integratie en behoud van benodigde bestanden;
- ruim andere obsolete worktrees/branches uitsluitend in een afzonderlijk geautoriseerde cleanup-scope op;
- nooit `git worktree remove --force` blind gebruiken wanneer secrets of unieke artifacts mogelijk aanwezig zijn;
- behoud worktrees met unieke payroll/migrationlineagecommits tot expliciete reconciliatie;
- verwijder remote branches pas nadat merge/provenance bewezen is.

## 11. Anti-iteratiehel

- Maak voor FAST/STANDARD de TEST-integratiebeslissing direct na de gerichte gates; laat niet-kritieke OPEN-evidence volgende werkzaamheden niet automatisch blokkeren.
- Geen volledige suite na iedere kleine fix.
- Na een echte defectfix: targeted regressie; alleen bij brede blast radius opnieuw bredere gates.
- Stop zodra de afgesproken leverroute haar verplichte gates haalt en de geautoriseerde TEST-status is vastgelegd; verzin geen extra closeout-wave.
- Nieuwe ideeën gaan naar AA-NEXT/AA-ROAD of backlog, niet automatisch dezelfde release in.
- Reeds verklaarde externe bewijs-/fixtureafhankelijkheden gaan met eigenaar en concrete heropeningsvoorwaarde naar AA-OPEN. Dit verlaagt nooit de vereiste veiligheidsgates en geeft geen zelfstandige deploytoestemming.
