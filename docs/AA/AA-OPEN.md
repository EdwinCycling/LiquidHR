# AA-OPEN — Openstaande punten, uitgesteld bewijs en beslissingen

Status: **LIVING REGISTER — geen acceptatiebewijs**
Gestart: 2026-10-04
Eigenaar van dit register: centrale LiquidHR-releasecoördinatie. Iedere rij heeft daarnaast een inhoudelijke spoorverantwoordelijke.

## 1. Waarom dit document bestaat

Een afgeronde ontwikkelslice kan inhoudelijk waardevol zijn terwijl één specifiek bewijsstuk, externe testfixture of productbesluit ontbreekt. Stop dan met herhaalde diagnose van dezelfde *vastgestelde* blokkade. Registreer haar hier en laat de volgende onafhankelijke ontwikkeling doorgaan waar dat veilig kan.

**Dit document is geen uitzonderingsvergunning.** `AA-ACCEPT` en de gedateerde runrapporten bepalen wat bewezen is; `AA-REL` bepaalt of een beperkte synthetische TEST-release met OPEN-punten expliciet mogelijk is. Een ontbrekende verplichte securityassertion blijft een blokkade voor **volledige ACCEPTANCE GREEN**. Een aangetoond kritisch security- of data-integriteitsdefect, een verplichte migratieafwijking of een rode releasegate wordt niet door registratie gedegradeerd.

Houd onderscheid tussen:
- `OPEN — EVIDENCE`: gedrag nog niet aangetoond;
- `OPEN — DECISION`: expliciete product-, security- of architectuurbeslissing nodig;
- `OPEN — ENVIRONMENT`: concrete account-, infrastructuur- of fixturevoorwaarde ontbreekt;
- `PLANNED`: bewust volgende productwave, **geen** achteraf mislukte acceptatie;
- `CLOSED`: gedateerd bewijs en exact bron-/testcommit vastgelegd.

De observaties over CAO-BENCH02 en TEST-HARNESS01 hieronder komen uit **lokale Codex-overdrachten van 2026-10-04**; hun nieuwe branches zijn op deze startbaseline **niet geverifieerd op remote `main`**. Dat is geen claim dat die code al geïntegreerd of gedeployed is.

## 2. Werkwijze voor Codex, ChatGPT en releasecoördinatie

1. Beoordeel een mislukte test eerst normaal: reproduceer → root cause → minimale fix → regressietest → retest. **Normale productbugs gaan niet automatisch naar AA-OPEN.**
2. Als de oorzaak een daadwerkelijk vastgestelde externe afhankelijkheid, noodzakelijke fixture of formeel besluit is, registreer één herbruikbaar ID met scope, bestaande evidence, eigenaar, impact, heropeningsvoorwaarde en vereiste afsluitproef. Verwijs vanuit het originele runrapport.
3. Laat het originele verdict `PARTIAL`/`BLOCKED`/`ENVIRONMENT-GATED` ongewijzigd totdat bewijs bestaat. Schrijf nooit `GREEN` op basis van een plan, code of naburige test.
4. Koppel ieder OPEN-punt aan precies één eigenaar en een concrete heropeningsaanleiding: vóór een bepaalde release, vóór externe activering, bij beschikbaar komen van een testfixture of tijdens een benoemde volgende wave. Vermijd algemene deadlines zonder besluit.
5. Controleer dit register vóór convergence en bij het plannen van een wave. Neem alleen items mee die voor die wave of releasegate relevant zijn. Heropen niet automatisch alle historische kwesties.
6. Sluit een item met datum, de exacte geverifieerde run/commit en verwijzing naar acceptatiebewijs. Laat historische bronrapporten intact; Git bewaart wijzigingshistorie. Nieuwe structurele werkwijzigingen horen ook in AA-OP/AA-TEST/AA-REL.
7. Bij een bewust **beperkte synthetische TEST-release** beslist Edwin expliciet per openstaand relevant securitypunt volgens AA-REL §8; vermeld alle OPEN-punten en eventuele beperkingen in het releaseverslag. Geen publieke of klantproductieclaim.

## 3. Actief register — momentopname 2026-10-04

| ID | Status / eigenaar | Punt en huidig bewijs | Heropenen / afsluitvoorwaarde |
| --- | --- | --- | --- |
| SEC-PAY-001 | OPEN — ENVIRONMENT; Control / TEST-HARNESS, daarna Payroll QA | CAO-BENCH02 mist één directe **admin-naar-admin serverweigering binnen Planeten**. Jupiter, Mars en Mercurius zijn volgens lokale read-only inventaris actief en Payroll-enabled; bestaande Test HR Admin is tenantbreed bevoegd en bewijst geen weigering. De goedgekeurde provisioner kan geen nieuwe Auth-identiteit veilig aanmaken/aanmelden. Productkandidaat `07cb05eabf9cfeadbc1a94eb210f066c116a44f7`; documentatiecheckpoint `27ce37499ac35cbc8f95f564f193b2c216004a71`; feature `PARTIAL`. | Één goedgekeurde synthetische Core TEST-Auth-identiteit met uitsluitend Planeten + ADMINISTRATION-binding Mars BV, zonder tenantbrede/Jupiter-toegang. Bewijs via dezelfde echte sessie positieve Mars-toegang en directe serverweigering voor bestaande Jupiter-K1-run `81160d5e-6eac-4975-bfdb-a540911b8680`, zonder Jupiter-data te lekken. **Verplicht voor volledige CAO-security-GREEN.** Niet opnieuw binnen de huidige Payroll-featureloop onderzoeken. |
| PAY-RULE-002 | OPEN — EVIDENCE; Payroll rules / onafhankelijke salarisexpert | De K2-run bewaart als intern bruto `1911.735632183908045976`; de conceptloonstrook en PDF tonen via bestaande **display-only HALF_UP** € 1.911,74. PDF/JSON-consistentie is gecontroleerd, maar wettelijke afronding van de relevante zondagtoeslag is daarmee **niet** bewezen. | Voordat fiscale/cao-compliance, betalings-, definitieve loonstrook- of externe nauwkeurigheidsclaims op K2 rusten: officiële rekenvoorschriften en onafhankelijke oracle voor de exacte afrondingsstap bepalen en versioned implementeren indien nodig; bewijs de gepinde output, trace en exports. Geen historische run stilzwijgend veranderen. |
| PAY-COVER-003 | OPEN — EVIDENCE / PRODUCTBEREIK; Payroll product en regels | K1/K2, R1/R2, B1/B2, C1 zijn volgens lokale browserhandoff persistent `SUCCEEDED`; H1 betreft alleen synthetische Metalektro-HP-toepasselijkheid. Zeven benchmarks bewijzen niet alle cao-verplichtingen, fiscale situaties of algemene Nederlandse payrollcompliance. | Bij uitbreiding/commercialisatie: bepaling-voor-bepaling `SUPPORTED/PARTIAL/UNSUPPORTED`, officiële bronversie, onafhankelijke rekengevallen en expliciet beoordeelde beperkingen vastleggen. H1 niet als volledige derde cao adverteren. |
| PAY-CORE-004 | OPEN — DEPENDENCY; CONTROL02 + Payroll | Live Core → Payroll snapshot-/employee-employment-IKV-contract en complete multi-IKV-bronacceptatie zijn niet door de bestaande synthetische M0-/cao-bewijzen afgedekt. | Tijdens expliciete CONTROL02/Payroll-contractwave: eigenaarschap, effectieve datums, meer dan één IKV, veilige bronread/snapshots, authscope en integratieregressies aantoonbaar accepteren vóór live multi-IKV-loonverwerking. |
| QA-HARNESS-005 | OPEN — EVIDENCE; TEST-HARNESS01 / platform | Los ontwikkelde lokale testharness is bij de eerste eigen run `PARTIAL/RED` gemeld wegens 403 op testlogin; later is zij volgens Payroll-overdracht gecontroleerd **als losse acceptatieclient** gebruikt. Dit bewijst niet dat de onafhankelijke harnessbranch zelf volledig GREEN of geïntegreerd is. | Laat de harness-eigenaar een actuele zelfstandige browser-/persona-/mobile-/auth-negative-eindrun, securityreview en codecommit overdragen. Reconcileer pas daarna selectief met nieuwe main. |
| SEC-CONTROL-006 | OPEN — EVIDENCE; Control | Eerdere TEST-release heeft nog openstaande echte AUDITOR-write-, uitnodiging-reuse/revoke-, forged-scope-, tweede- en cross-tenant-bootstrap-negatives. | Gerichte live/API-bewijzen op vastgepinde geaccepteerde releasecode; kritieke fouten onmiddellijk repareren. Detail: CONVERGENCE01-acceptatierapport en AA-ACCEPT. |
| SEC-INS-007 | OPEN — EVIDENCE; Insights | Bradford CSV echte bestandinhoud, rijscope, filterpariteit en spreadsheet-formuleveiligheid en resterende directe API-/forged-contextmatrix zijn niet volledig bewezen. | Download en parse echte exports; vergelijk inhoud, scopes en serverrespons met onafhankelijke verwachte resultaten. |
| SEC-AI-008 | OPEN — EVIDENCE; AI Foundation / HeRa | Eerdere AI01-A TEST-release mist gerichte live feature-toggle-na-sessiestart, scope-revoke en persona-/forged-scope-negatives. | Voer de afgesproken live gerichte controles uit op bewezen runtimecontext met de echte accounts; behoud bestaande governance/recovery. |
| API-DEC-009 | OPEN — DECISION; API/AI | APIAI-D0 benoemt nog niet-geaccordeerde externe client-/gebruikersdelegatie, OAuth-scopebinding, privacy-/outputprojecties, rate limiting en auditcontracten. Hosted ONE VERSION-acceptatie bewijst deze externe grens niet. | Voor **APIAI-01-externe activering**: formeel gekozen D-03/D-04-contract, relevante auth/security-evidence en actueel AA-API-AI-plan; geen tweede authlaag. |
| ENV-PREVIEW-010 | OPEN — ENVIRONMENT, laatst gedocumenteerd 2026-10-02; release/platform | In de bestaande Preview-procedure staat dat afzonderlijke synthetische Core- en Payroll-Preview-backends plus Preview-scoped Vercel-variabelen nog ingericht moeten worden. De huidige status na die documentdatum is niet opnieuw bewezen. | Verifieer actuele inrichting vóór de volgende PR die volgens AA-REL op een commit-specifieke Preview moet worden geaccepteerd. Geen gedeelde TEST-database gebruiken als Preview-vervanger. |
| DOC-CONVERGE-011 | OPEN — INTEGRATIE; centrale releasecoördinatie | Remote `main` van deze docs-baseline is `6349d025...` / app `1.20261002.1`, maar sommige AA-statuspassages bevatten oudere historische releasebeschrijvingen. Nieuwere ONE VERSION-documentatie en CAO-BENCH02-commits zijn in lokale overdrachten gemeld, niet allemaal op `main`. Afzonderlijke AA-API-AI-/masterroadmapconceptbranches bestaan. | Tijdens geplande gecontroleerde documentatie-/PAY-CONVERGE-slag: verifieer de broncommits, werk AA-CURRENT/AA-ACCEPT/AA-NEXT bij op basis van echt bewijs; neem de losse AA-concepten selectief over, zonder blinde branchmerge of onbedoelde docs-only deployment. |

**PAY-CONVERGE-verificatie 2026-10-04:** de CAO-BENCH02-code is alleen in de lokale integratiebranch samengebracht; remote main en de bestaande Vercel-release zijn niet gewijzigd. De AA-CURRENT/AA-ACCEPT/AA-NEXT-statussen verwijzen nu naar het lokale kandidaatrapport. DOC-CONVERGE-011 blijft OPEN voor niet-meegenomen API/AI- en masterroadmapconcepten.

**ENV-PREVIEW-010-verificatie 2026-10-04:** read-only Vercel-metadata toonde geen Preview-deployment. De vereiste Payroll-Preview-variabelen staan alleen op Production. Core-variabelen zijn als Production/Preview-targets geregistreerd, maar omdat waarden verborgen bleven is gescheiden URL-inhoud niet bewezen. Gebruik de gedeelde TEST-database niet als Preview-vervanger.

## 4. Beslisregister voor de eerstvolgende integratie

**PAY-CONVERGE (eerstvolgende centrale releasebeslissing):**
- Hergebruik de lokaal gemelde zeven uitgevoerde benchmarkscenario's, K1/K2-downloadbewijs, H1, desktop/iPhone 16 en eerdere test-/buildresultaten **uitsluitend** na verificatie van exacte code- en migratieprovenance op de geïntegreerde kandidaat.
- `SEC-PAY-001` blijft OPEN totdat een echte Mars-only actor de negatieve Jupiter-API-test aantoont. Dit verhindert volledige **CAO-BENCH02 ACCEPTANCE GREEN**.
- Een **uitsluitend synthetische TEST-release met OPEN** is geen automatische toestemming: de actuele AA-REL §8-voorwaarden, verplichte gezamenlijke suite/build en minimale veiligheidscontrole moeten slagen en Edwin moet die beperkte release expliciet goedkeuren.
- Een nieuw, aangetoond kritisch auth-/data-integriteitsdefect of verplichte migratiemismatch blijft een harde blocker.
- Publiceer `PAY-RULE-002`/`PAY-COVER-003` als zichtbare demonstratiebeperkingen; geen wettelijke correctheidsclaim voor ongevalideerde regels.

## 5. Onderhoud en vindplaatsen

- Canonieke bewezen release-/teststatus: [AA-CURRENT](AA-CURRENT.md) en [AA-ACCEPT](AA-ACCEPT.md).
- Concrete komende productwaves: [AA-NEXT](AA-NEXT.md); strategische richting: [AA-ROAD](AA-ROAD.md).
- Uitvoeringsregels: [AA-OP](AA-OP.md), [AA-TEST](AA-TEST.md) en [AA-REL](AA-REL.md).
- Fijnmazig runbewijs blijft in `docs/quality/acceptance/runs/` of de expliciete domeinacceptatiemap, ook als dat momenteel uitsluitend op een lokale featurebranch staat.
- Bij het sluiten van een open punt: voeg onderaan een korte afsluittabel toe met ID, sluitdatum, bewijscommit, testrapport en relevante release. Verplaats een punt niet stilzwijgend naar `CLOSED`.
