# AA-REL — Convergence, Release, Deployment & Cleanup

Status: **LEIDEND**
Eerste opzet: 2026-09-29

Doel: één gecontroleerde releaseflow en geen iteratiehel.

**AA-LEAN-02 (2026-10-12):** LiquidHR heeft momenteel één uitsluitend synthetische TEST-doelomgeving. Een geautoriseerde TEST-push is niet hetzelfde als een formele productieacceptatie. De omvang van de levering volgt het **risico van de diff**, niet de omvang van LiquidHR.

| Route | TEST-integratie bij expliciet mandaat | Bewijs |
| --- | --- | --- |
| **FAST** — zuiver cosmetische UI, logo, tekst of icoon zonder contractimpact | Rechtstreeks op veilige main/integratiecontext, geen verplichte PR/Preview | Gerichte checks en korte visuele/hosted smoke |
| **STANDARD** — afgebakende gewone feature of bugfix | Gecontroleerde integratie naar synthetic TEST, geen verplichte PR/Preview | Gerichte module-/contractchecks en toepasselijke browser-/hosted smoke |
| **CONTROLLED** — auth-/OAuth-toestemmingssemantiek, tenant/RLS, schema, Payroll, security, brede shared core | Volledige gecontroleerde convergence- en acceptatieflow | Positieve/negatieve scopechecks, volledige finale relevante suite en vereiste omgevings-/browsergate |

Alle routes behouden privacy, audit, RLS, secrets, migratiebescherming en een non-force integratie met exacte SHA-provenance. Een FAST-aanpassing aan enkel de **presentatie** van een consent-scherm is niet automatisch CONTROLLED; wijziging van weergegeven rechten, scopes of betekenis kan dat wel zijn.

## 1. Scheiding feature versus release

Featurebranches:
- implementeren;
- targeted/relevante tests;
- expliciet geselecteerde in-scope bestanden committen;
- geen version bump of handmatige deployment voor docs/tooling;
- mergen/pushen alleen wanneer de oorspronkelijke opdracht dat expliciet autoriseert;
- stoppen zodra scope en toepasselijke gates bewezen zijn.

**FAST/STANDARD synthetische TEST-flow (geen formele productieacceptatie):** bevestig actuele main en diff → gerichte tests/lint/type/i18n waar relevant → één toepasselijke UI-smoke → commit/integratie/push **alleen met expliciet voorafgaand mandaat** → automatische Vercel-build op exacte SHA controleren → minimale hosted smoke → afsluiten; niet-kritieke ontbrekende QA eerlijk OPEN. Geen standaard full suite, Preview, uitgebreide screenshots of aparte closeout-run.

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
- een merge kan de Git-integratiebuild starten; controleer die uitkomst en start geen tweede handmatige deployment.

## 6. Vercel

Canoniek HR-project: `liquidhr`.

- “Production” is de deploymentchannelnaam, niet een tweede businessomgeving.
- Deploy alleen het bedoelde project.
- Control Plane wordt niet automatisch gedeployed omdat HR-suite wordt released.
- Controleer deploymentstatus READY.
- Controleer bestaande canonical alias.
- Controleer waar tooling dit exposeert de commitprovenance.
- Een ontbrekend hostingmetadata-veld is evidencegap, niet automatisch productdefect.

### Preview versus directe synthetic TEST-integratie

- **FAST/STANDARD:** wanneer de gebruiker de directe TEST-integratie vooraf expliciet heeft geautoriseerd, is een voorafgaande Preview of PR **geen verplichte gate**. Controleer de echte auto-deployment en relevante hosted smoke ná de push. Een niet-kritieke, niet-uitgevoerde visuele check kan OPEN blijven als het releasebesluit dat dekt; een bekende kritieke regressie nooit.
- **CONTROLLED of expliciete Preview-/PR-opdracht:** gebruik commit-specifieke immutable Preview-acceptatie indien de toepasselijke risk/releasegate dit vereist.
- Vercel Preview gebruikt alleen eigen Preview-scoped variabelen en geïsoleerde synthetische Core/Payroll-backends; het leent geen lokale of gezamenlijke TEST-config.
- Voer op de Preview-commit de vereiste browsermatrix uit, inclusief normale auth, relevante console/networkcontroles en 390 px waar van toepassing. Leg deployment-ID/URL, SHA, READY-status en resultaten vast.
- Na groene toepasselijke review-/acceptatiegates wordt een PR alleen binnen expliciet merge-mandaat gecontroleerd naar `main` gemerged. De Git-integratie kan de exacte `main`-SHA naar het bestaande `liquidhr` TEST-kanaal bouwen; controleer daarna READY, alias, SHA-pariteit en relevante hosted smoke.
- Promoot voor deze flow geen Preview-deployment handmatig met `vercel promote`: Vercel voert daarbij een nieuwe build met Production-variabelen uit. Gebruik de gecontroleerde merge naar `main` voor releaseprovenance.
- Een nog niet ingerichte Preview-backend/config blokkeert de Preview-gate voor nieuwe PR's; leg de ontbrekende eenmalige inrichting vast. Zij blokkeert een andere, al geaccepteerde TEST-release niet automatisch.

De uitvoerbare lokale start- en Preview-procedure staat in `docs/delivery/TEST_RUNTIME_AND_VERCEL_PREVIEW.md`.

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
