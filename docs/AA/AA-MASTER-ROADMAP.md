# AA-MASTER-ROADMAP — LiquidHR geïntegreerde productroadmap

> **ACTUALISATIEWAARSCHUWING — 2026-10-03:** sinds dit concept is opgesteld staat de ONE VERSION/PAYLAB00–04-merge op remote `main` (`6349d02538351cd01fc51f298c6e6fa0ba88006c`); de canonieke AA-documenten staan inmiddels eveneens op main. De eerdere beschrijving dat PAYLAB04 nog de eerstvolgende feature is, en dat AA niet op main staat, is **ingehaald door deze code-/documentatiemerge**. De voorlopige releaseacceptatie op main registreerde hosted Vercel-proof/eindgate tijdens deze controle nog als PENDING. Voor verdere Payroll is nu de actuele AA-NEXT na PAYLAB04 leidend (onder meer CAO-BENCH); vervang bij formele AA-overname alle historische baselines en de oude PAYLAB04-vooruitblik. De DevDay-update in §9 is enkel een voorstel. **Deze branch niet blind mergen en security niet automatisch GREEN markeren.**\n\n
**Status:** DRAFT / integratiedocument; nog niet canoniek op main  
**Opgesteld:** 2026-10-02  
**Repository:** EdwinCycling/LiquidHR  
**Documentatiebranch:** docs/aa-master-roadmap-20261002, ontstaan uit main op cb73260ff0cd83d19fa29e44c9f0b93749fb10af  
**Doel:** één vindplaats voor de samenhang tussen álle productsporen, niet een vervanging van bestaande gedetailleerde roadmaps of requirements.

> Dit overzicht is een product- en dependencykaart. Alleen expliciet afgesproken waves worden als zodanig benoemd; horizons zijn **geen vastgelegde kwartalen of opleverdatums**. De actuele release- en acceptatiebasis moet bij gebruik opnieuw tegen main worden gecontroleerd. De lopende ONE VERSION-release kan deze conceptstatus wijzigen.

## 1. Verhouding tot de bestaande AA-documenten

De AA-set is opgezet als living documentatie met gescheiden verantwoordelijkheden:

| Bron | Waarvoor leidend | Wat dit masterdocument toevoegt |
| --- | --- | --- |
| AA-REQ / AA-OP / AA-TEST / AA-REL | Basisarchitectuur, Codex-werkwijze, tests en releases | Verwijst ernaar; dupliceert geen normatieve regels |
| AA-CURRENT / AA-ACCEPT | Bewezen actuele code-, release- en acceptatiestatus | Status in deze master is slechts een gedateerde momentopname |
| AA-NEXT | Eerstvolgende concrete productwaves en hun exacte scope | Laat zien hoe die waves bij de volledige productportfolio passen |
| AA-ROAD | Strategische lange-termijnkoers en featuregebieden | Brengt portfolio, parallelle sporen en wederzijdse afhankelijkheden in één kaart samen |
| AA-PAYROLL | Payroll bounded context, componentengine, test- en ontwikkelvolgorde | Toont de Payroll-fasen naast Core, AI, API en overige modules |
| AA-API-AI | Voorstel voor externe API, gedeelde tools, MCP, WebMCP en ChatGPT-app | Toont het nieuwe integratiespoor binnen de totale LiquidHR-roadmap |
| Onderliggende requirements, ADR/FDR en gedateerde acceptance reports | Domeindetails en bewijs | Verwijst door in plaats van volledige specificaties te kopiëren |

**Tijdelijke bronlocaties op 2026-10-02:** AA-NEXT, AA-ROAD, AA-REQ, AA-OP, AA-TEST, AA-REL, AA-CURRENT, AA-ACCEPT en AA-PAYROLL staan op [docs/aa-foundation-20260929](https://github.com/EdwinCycling/LiquidHR/tree/docs/aa-foundation-20260929/docs/AA); het aparte [AA-API-AI-concept](https://github.com/EdwinCycling/LiquidHR/blob/docs/aa-api-ai-20261002/docs/AA/AA-API-AI.md) staat op docs/aa-api-ai-20261002. Op het moment van opstellen ontbrak de AA-set op canonieke main. **De verouderende documentatiebranch niet zelfstandig mergen.** ONE VERSION/centrale documentatieconvergentie kiest en integreert de goedgekeurde actuele versies. Daarna verwijzingen omzetten naar relatieve, canonieke main-paden en de master vanuit de juiste nieuwe main-baseline overnemen.

**Bij tegenspraak:** expliciete actuele productbesluiten, leidende domeinrequirements, goedgekeurde AA-standaarden en nieuwe acceptatie-evidence hebben voorrang. Deze master creëert geen nieuwe productautorisatie.

## 2. Productvisie en niet-onderhandelbare integratiegrenzen

LiquidHR groeit van geïntegreerde HR-software voor het Nederlandse MKB naar één beheersbaar HR-, Workforce-, Payroll- en AI-platform. Het doel is menselijke HR- en salarisbeslissingen beter te ondersteunen, administratieve overdrachten te verminderen en een coherent gegevensmodel te behouden.

- **Eén product / één repo:** EdwinCycling/LiquidHR met één gezamenlijke main en één gecontroleerde operationele TEST-release. Meerdere ontwikkelworktrees zijn toegestaan, ongecontroleerde aparte productversies niet.
- **Eén LiquidHR-gebruikersapp:** Payroll Lab is een bounded context in dezelfde LiquidHR-app en monorepo, geen tweede Payroll-gebruikersapp.
- **Aparte technische componenten waar nodig:** een pure, frameworkonafhankelijke Payroll-engine en een geïsoleerde Payroll Lab-database. Dat is niet strijdig met één product of gezamenlijke release.
- **Core als bron:** employee, employment, IncomeRelationship/IKV, HR-groep, administratie, organisatie en bestaande geautoriseerde domeinservices hebben duidelijk gegevensownership.
- **Gedeelde autorisatie:** tenant, HR-groep, administratie, actor/rol en subjectscope gelden bij elke API-, AI-, MCP-, browser-, integration- en Payroll-aanroep. Geen extra rechten doordat een nieuw kanaal toegang krijgt.
- **Audit en governance:** bestaande audit, human confirmation, AI-governance en credits worden hergebruikt; geen tweede onafhankelijke AI- of toolback-end.
- **Testcontext:** alle huidige omgevingen en gegevens zijn TEST. De Vercel-targetnaam production betekent niet dat LiquidHR al in een live klantproductieomgeving draait.
- **Geen automatische productclaims:** GEBOUWD, GETEST, RELEASED en volledig ACCEPTED zijn afzonderlijke statussen. Alleen actuele evidence bepaalt GREEN.

## 3. Uitgangspositie en lopende ONE VERSION-release

### 3.1 Bewezen gezamenlijke baseline vóór Payroll-integratie

- Canonieke main op controledatum: cb73260ff0cd83d19fa29e44c9f0b93749fb10af.
- Applicatieversie: 1.20260928.1.
- Vercel-project liquidhr; deployment dpl_CANMAQydQcYGy9Xe7JhNm8grJuvH READY; TEST-release onder de bestaande alias.
- CONVERGENCE01: **TEST RELEASED**, niet alle securityacceptatie GREEN.
- Gerichte resterende evidence: Control forged-context/actor/invitations/AUDITOR, INS01 report/API/export/scope en AI01-A feature-toggle/scope-revocation/persona-negatives.
- CONTROL01 heeft staging en een geslaagde synthetische payrollimportcase; officiële XML/XSD-support en de volledige readiness/importwizard zijn CONTROL02.
- PAYLAB02 M0 is afgebakend synthetisch GREEN; PAYLAB03 heeft een lokaal bewezen beperkte NL-2026 reguliere maandcase. Geen algemene NL Payroll-complianceclaim.

Bewijslocaties: docs/quality/acceptance/runs/CONVERGENCE01-20260928.md op main, gedateerde PAYLAB02/PAYLAB03-rapporten in het relevante ontwikkelspoor, en de uiteindelijke AA-CURRENT/AA-ACCEPT na convergentie.

### 3.2 Huidige ONE VERSION-opdracht (volgens productoverdracht)

Payroll-integratie is lokaal **MERGE-READY**, geaccepteerd op:

- Branch: integration/payroll-foundation-20261002.
- Geaccepteerde HEAD: 3ff38bdc4b145dbf1080cf8f0a7f4abd41c2eb96.
- Onafhankelijke LUNA MAX-review heeft deze integratie volgens de overdracht geaccepteerd; schone werkboom gemeld.
- Deze branch was bij GitHub-controle niet als remote branch beschikbaar; genoemde HEAD is daarom **overdrachtevidence, nog niet een op remote main bewezen release**.
- De gemelde browserfout was teruggevoerd op PGRST303 / JWT issued at future en vervolgens geslaagde tests. Alleen bij herhaling tijdens release eerst tijdsynchronisatie nagaan, geen ongevraagde nieuwe onderzoeksronde.
- Hoogste prioriteit: de geaccepteerde samenvoeging, noodzakelijke gezamenlijke checks, veilige release naar de ene Vercel TEST-omgeving en eindrapportage. **Geen nieuwe Payroll-functionaliteit, geen ongecontroleerde cleanup van oude branches of worktrees.**
- Permanente procesverbetering in dezelfde opdracht: veilige PowerShell-start van nieuwe worktrees met centrale lokale TEST-configuratie en preflight voor configuratie/dependencies/poorten/build; gedocumenteerde gescheiden Vercel Preview-configuratie, browseracceptatie en gecontroleerde promotie naar de gezamenlijke TEST-release. Ontbrekende externe eenmalige instellingen documenteren en de primaire release niet onnodig blokkeren.

**Promotionregels:** volg het definitieve AA-REL-document op de geïntegreerde main. Een technisch geslaagde release mag als TEST RELEASED worden gerapporteerd wanneer dat bewezen is; resterende securitynegatives worden nooit stilzwijgend GREEN. Voor het nieuwe API/AI-implementatiespoor blijft de afzonderlijk afgesproken ONE VERSION GREEN-gate gelden.

## 4. Portfolio-overzicht

| Spoor | Huidige basis / classificatie | Afgesproken volgende richting | Hoofdafhankelijkheid |
| --- | --- | --- | --- |
| Core HR / Workforce | Bestaand medewerker-, employment-, organisatie- en administratieplatform | CONTROL02; stamdatakwaliteit; verdere Workforce-UX | Control/IKV/servicecontracts |
| Verlof / Actual Work | Bestaand fundament | AW02: vervolg op actuele acceptatiebasis | Core, kalender, permissionmodel |
| Verzuim / WvP | ABS02 GREEN in scope, WvP-taakfundament aanwezig | WVP01 casemanagement | Absence lifecycle en casemanagerautorisatie |
| Insights / Liquid Analyse | Rapportcatalogus en Analyse-hub, INS01 TEST RELEASED / PARTIAL | INS02 report consistency en Headcount/FTE; verdere workforce-/cross-domainanalyses | Scoped queries, gedeelde metrics, exportveiligheid |
| Talent / Performance | Bestaande onderdelen en leidende Talent Blueprint | Function profiles/capabilities; POP, skills, 9-grid en continuous appraisal verder integreren | Core profielen en organisatie |
| Journeys / Recruitment | Journeys bouwstappen 1–3 als afgerond gedocumenteerd; recruitmentfundament | Journeys verdiepen, lichte ATS en kandidaat→medewerker→preboarding | Core, documenten, permissions |
| Documents & Signing | Document Studio en bestaande generatiestroom; DG2/DG3 eerder dev-accepted | Volledige distributie- en signinglevenscyclus; DOCX-adapter en externe signing separaat | Dossier, templates, juridische/securityscope |
| Payroll | PAYLAB02 synthetic M0, PAYLAB03 lokale beperkte fiscale proof; integratie MERGE-READY | Gezamenlijke release; PAYLAB04; CAO-BENCH; verdere fiscale/payment-/documentflows | Core/IKV-contract, eigen Lab-DB en componentengine |
| AI / HeRa | AI Foundation, AI Everywhere, HeRa/voicebasis; AI01-A deels open | AI01-B credits/commercial governance; HeRa-kwaliteit en gecontroleerde agentworkflows | Auth, governance, toolservices |
| API / MCP / WebMCP / ChatGPT | Interne BFF en bestaande AI-/providerfundamenten; apart AA-API-AI-concept | Externe API; gedeelde read-tools; MCP; ChatGPT Workforce Assistant; geïntegreerde WebMCP | ONE VERSION GREEN, autorisatie en relevante domeinservices |
| Externe integraties | Providerneutrale voorbereiding en historisch Nmbrs P0/P1-werk | Nmbrs eerst: bestaande code verifiëren, dan P2/P3/P4 | Providercontract, secretbeheer, employment-mapping |
| Control Platform | Gescheiden leveranciersapp, tenant-/contextlifecycle | Gerichte live-securityacceptatie; operationeel beheer | Eigenaarschap auth en tenantbootstrap |
| International HR / Mobile | Meertaligheid/responsive basis en ESS/MSS | Gefaseerd BE/DE; verdere mobile self-service | HR-datamodel, jurisdictie-/privacybesluiten |

Status is bewust gedateerd en indicatief: bij een nieuwe release gaan AA-CURRENT en AA-ACCEPT vóór deze tabel.

## 5. Domeinroadmaps en productwaarde

### 5.1 Core HR, Workforce en CONTROL02

De basis van het product bestaat uit medewerkers, dienstverbanden, contracten, HR-groepen, administraties, organisatiestructuur, autorisaties, instellingen en dossiers. Eén betrouwbaar medewerker-/employment-/IKV-model wordt door rapportage, Talent, Payroll en integraties gedeeld.

**CONTROL02: loonaangifte XML Import V1 + readiness UI**
- HR Admin kan in Instellingen → Medewerkers & dienstverband de eenmalige import voorbereiden.
- Server-side gereedheidscontrole toont bestaande inrichting, relevante blokkades en veilige follow-up.
- Flow: upload → detectie → analyse → matching → preview → bevestiging → resultaat.
- Reeds bestaande personen en dienstverbanden worden herkend; meervoudige IKV's blijven intact; verschillen zijn zichtbaar; de preview heeft nul definitieve domeinwrites.
- Jaar-/namespaceadapters en officiële XSD-evidence uitsluitend voor daadwerkelijk ondersteunde aangiftejaren.
- Gedeelde IncomeRelationship-/IKV-contracten expliciet vastleggen vóór live Payroll-integratie daarop vertrouwt.

Verdere richting: complete HR Admin-inrichting, datakwaliteit, betekenisvolle workforce-/organisatie-drilldown, medewerker-/managerzelfservice.

### 5.2 Verlof, Actual Work en WvP

- Bestaande verlof-, werk- en verzuimfuncties blijven binnen hun bestaande domeinen.
- **WVP01:** versieerbare wettelijke SYSTEM-mijlpalen, custom/recurring taken, future timeline, case manager, werkvoorraad, re-integratie, RIV-readiness, reminders en rapporten; bestaande ABS02/absence-taken en effectieve tijdslogica hergebruiken.
- **AW02:** verdere Actual Work-uitbouw na hercontrole van requirements en accepted baseline.
- Gevoelige gegevens en manager-/casemanagerscope blijven gescheiden van algemene Workforce Insights.

### 5.3 Talent, Workforce Development en Performance

Leidend detail: docs/requirements/Talent/01-LiquidHR-Workforce-Talent-Product-Blueprint-v2.0.md op main; latere productbesluiten en actuele implementatiestatus eerst controleren.

- Talent Foundation: functiegroepen → functies, optionele functiefamilies, datumgebonden functieprofielen, capabilitybibliotheek (skills, competenties, kennis, talen, certificaten), zelfstandig configureerbare senioriteit en niveaumodel.
- Heldere contextscheiding: HR Admin configureert onder Instellingen; HR en manager gebruiken onder Workforce; medewerkers lezen eigen gegevens in ESS.
- Operational Talent: POP, skillsmatrix, GAP-analyse, vlootschouw/9-grid, continuous appraisal en talentdashboards gefaseerd, zonder Fase-1-scope onbedoeld uit te breiden.
- Latere mogelijkheden: opleiding/ontwikkeling, opvolgingsinzicht en AI-assistentie, steeds met menselijke verantwoordelijkheid en echte geautoriseerde brondata.

### 5.4 Journeys en Recruitment

- Bestaande Journeys-bouwstappen als fundament: configureerbare tijdlijn rond één persoon, rollen, deelnemers en buddy, preboarding en onboarding.
- Uitbreidbare scenario's: reboarding, promotie, overstap, terugkeer en offboarding.
- Licht ATS: vacature- en kandidaatstroom, veilige overgang kandidaat → medewerker → preboarding, waar nodig gecontroleerde AI-ondersteuning.
- Journeys is geen zelfstandige BPMN/workflowengine; koppel concrete workflowacties later via de bestaande Process Automation-laag.

### 5.5 Documents & Signing

- Document Studio met versieerbare native templates en bekende/tijd-/vrije placeholders; preview, final artifact, dossierlink en audit.
- Eerdere DG2/DG3-vervolgscope: distributie naar meerdere medewerkers met afzonderlijke snapshots, status per ontvanger, geautoriseerde medewerkerinzage en interne signing.
- DOCX-/Word-import-/replace-codefunctionaliteit alleen toevoegen na verificatie van het actuele template-/editorcontract: niet doen alsof de bestaande native editor automatisch een DOCX-importer is.
- AI-documentgeneratie met dezelfde governance; externe signing is een apart product-, privacy-, security- en juridisch besluit.

### 5.6 Insights, Reporting en Liquid Analyse

- INS01-gerichte beveiligings- en inhoudsacceptatie afmaken voor persona/API-/export-/scopegaten.
- **INS02:** één Report Consistency Contract voor definities, filters, KPI, grafiek, tabel, drilldown, export, states en autorisatie. Eerste referentierapport: Headcount & FTE Trend.
- Volgende analysegebieden: in-/uitstroom, verloop, diensttijd, contracten, verzuim, samenstelling, salary/workforce en later cross-domainanalyse.
- Geautoriseerde managercontext; werknemers krijgen geen management Insights buiten hun eigen rechten. Geen fictieve data of divergente tabel/grafiek-/exportdefinities.

### 5.7 Payroll: afzonderlijk ontwikkelspoor, één product

De leidende detaillering blijft AA-PAYROLL en de afzonderlijke payrollrequirements. Geen reeds geaccepteerde fiscale scope verruimen op basis van een roadmapzin.

1. **PAYLAB00–03 / ONE VERSION:** veilige bounded-contextintegratie; pure packages/payroll-engine, server-only adapters en aparte Payroll Lab-database. PAYLAB02 synthetic M0 en PAYLAB03 beperkte NL-2026 full-monthcase blijven afgebakend.
2. **PAYLAB04:** versioned Payroll Component Library boven de bewezen SYSTEM-componentengine; functionele tegels Berekeningen en Salariscomponenten. Geen complete designer in deze slice.
3. **CAO-BENCH01/02:** twee publieke benchmarkcao's (Kinderopvang 2025–2026, Retail Non-Food 2026–2027 module Mode) plus synthetische bedrijfseigen open-bandsregeling. Zeven Payroll-scenario's, aangevuld met afzonderlijk Metalektro-HP-toepasselijkheidsvoorbeeld; nooit algemene cao-compliance claimen. Gerichte testloon-/regelingaanpassingen uitsluitend binnen afgesproken scope en na inventarisatie/rollback.
4. **PAYLAB05 / fiscale vervolgslices:** componentdesigner, bredere fiscale 2026-situaties, pensioen, werkgeverspremies/VCR, Zvw, bijzondere beloningen, meer dan één IKV en iteratieve gedeelde grondslagen wanneer expliciet ontworpen en bewezen.
5. **Payroll by Exception:** lopende loonperiode continu herberekenen op actuele, geversioneerde input; verklaarbare outliers, gerichte werkvoorraad en gecontroleerde salarisgoedkeuring. Richting, geen bewezen operationele volledige payrollfunctie.
6. **PROFORMA00/01:** veilige synthetische what-if via dezelfde engine, later geautoriseerde HR-/ESS-scenario's; bruto→netto en netto→bruto uitsluitend voor daadwerkelijk ondersteunde regels.
7. **PAYDOC00–03:** contracten voor loonstrook/jaaropgaaf, LiquidHR Standard PDF, later wettelijk correcte jaaraggregatie en optionele gecontroleerde documentdesigner.
8. **PAYMENT00–04:** PayableProjection gescheiden van netto loon; goedgekeurde betalingsinstructies en SEPA-export na veilige finalisatie; later split/recovery/reconciliation, optionele bankconnector en separaat onderbouwde belasting-/pensioenbetalingen.
9. **Integratie en aangifte:** CONTROL02-import en zelf gegenereerde aangifte vanuit payroll zijn afzonderlijke acceptatiedomeinen. Accounting-/payment-/aangifte-adapters vereisen eigen contracten en officiële validatie.

Één Payroll Lab-sidebaritem; nieuwe tegels worden pas actief als hun functie werkt. Geen ongerichte Core-schema-, auth- of migrationmutaties vanuit de Payroll-track.

### 5.8 AI Foundation, HeRa en commerciële governance

- Bestaande AI Everywhere-capabilities en HeRa waar technisch beschikbaar doorontwikkelen; de huidige AI-runtime, providerveiligheid, settlement/recovery en credits niet opnieuw bouwen.
- Nog gerichte AI01-A live-negatives op actuele scopes, toggles en revocation.
- **AI01-B:** allowance/quota, charge catalog, credits en aanvullende kredietgeldigheid, budget/gebruik, waarschuwingen en capabilitybeheer. BASIC/PLUS/EXCELLENT en eerder genoemde creditbedragen zijn richtinggevend totdat een expliciet commercieel besluit ze vastlegt.
- HeRa: kwalitatief goede geautoriseerde medewerker-/teamtools, duidelijke geheugenregels, begrijpelijke bronverwijzingen, voice en menselijke bevestiging. Een modelconnector is geen end-to-end productacceptatie.
- Latere agentic workflows uitsluitend via dezelfde governance, scopes, auditeerbare acties en expliciete bevestiging waar nodig.

### 5.9 Reguliere API, remote MCP, ChatGPT-app, WebMCP

Leidend concept: het aparte AA-API-AI-document, te reconciliëren met de uiteindelijk goedgekeurde AA-set.

- **APIAI-D0:** code-/contractinventarisatie en product-/auth-besluiten na vaststelling van de gedeelde baseline.
- **APIAI-01:** aparte read-only, versieerbare externe API; bestaande interne BFF niet rechtstreeks extern publiceren.
- **APIAI-02:** één getypeerde, geautoriseerde service-/business-toolfaçade.
- **APIAI-03:** remote MCP op dezelfde read-only façade met expliciet geverifieerde externe delegatie.
- **APIAI-04:** eerste ChatGPT-app als read-only Workforce Assistant: zichtbare workforce, team skills en development plans, onderbouwde antwoorden en LiquidHR-deeplinks.
- **APIAI-05:** geïntegreerde browser-WebMCP-tools met browserauth en elke keer actuele server-side scopecontrole.
- **APIAI-06 (niet geaccordeerd):** mutaties, webhooks en verdere proactieve agents pas met apart product-, security- en acceptancebesluit.

De afzonderlijke synthetische WebMCP Challenge-demo is ontwerpreferentie, geen bewijs dat deze productintegratie al is opgeleverd. Externe API, MCP, WebMCP en ChatGPT worden geen vier eigen engines.

### 5.10 Externe payrollproviders en partnerintegraties

- **Nmbrs is gekozen provider #1.** Eerst huidige P0-providerfoundation en P1-OAuth/company binding/code/evidence inventariseren; eerdere lokale successen zijn geen automatisch bewijs van actuele hosted end-to-endacceptatie.
- Vervolgens gescopeerd P2 lezen/vergelijken, P3 gecontroleerd importeren en P4 eventuele verdere synchronisatie. Eén actief providercontract per HR-groep, deelname per employment en strikt begrensde providercapabilities.
- Eigen LiquidHR Payroll-engine en gekoppelde externe payrollproviders zijn twee onderscheiden productroutes, met mogelijk gedeelde Core-context.
- Provider #2, partner-API-writes, events en webhooks hebben nog geen definitieve scope/volgordebesluit.

### 5.11 Platform, mobile en internationalisering

- Control Platform: tenant-/HR-groep-/administratiebootstrap, first-admin, rollen, auditing en operational tooling; open acceptatienegatives eerst bewijzen.
- ESS/MSS: betere mobiele, rolgebonden journeys en veelgebruikte medewerkers-/manageracties.
- International HR: gefaseerd België/Duitsland, landspecifieke velden en lokalisatie; **niet** impliciet internationale Payroll.
- Eén LiquidHR-designsysteem, hergebruik van UI-componenten, NL/EN-pariteit, toegankelijkheid, responsive schermen en gecontroleerde release-/dependencyonderhoudswaves.

## 6. Horizons: prioriteit zonder fictieve kalenderdeadlines

| Horizon | Doel | Inhoud / stopvoorwaarde |
| --- | --- | --- |
| H0 — gezamenlijk convergeren | Eén canonieke code- en releasebaseline | Lopende ONE VERSION met geaccepteerde Payroll-HEAD; gecontroleerde main-merge, gezamenlijke build/tests, Vercel TEST-release, provenance, geactualiseerde AA-documentatie en releaseprocesverbetering. Geen nieuwe Payroll-features. |
| H1 — acceptatie en basiscontracten | De gedeelde basis bewezen veilig en voorspelbaar | Gerichte open Control/INS01/AI01-A-negatives; formeel actuele AA-set; CONTROL02 en IKV-contract; APIAI-D0 kan documentair vooruit, implementatie alleen na afgesproken GREEN-gate. |
| H2 — benoemde productwaves | Gescopeerde, aantoonbare uitbreidingen | AA-NEXT benoemt WVP01, INS02 en AI01-B na CONTROL02. Payroll kan na integratie via dependencycheck PAYLAB04 voorbereiden; APIAI-01/02 en providerinventarisatie parallel als de gedeelde contractsituatie het toestaat. |
| H3 — moduleverdieping | Talent, workflows en Payroll functioneel completeren | Skills/POP/performance, Journeys/recruitment, documenten, Workforce Insights; CAO-BENCH en later Component Designer/fiscale vervolgslices; remote MCP/ChatGPT/WebMCP na bewezen API/façade. |
| H4 — platformbreed automatiseren | Payroll by Exception en gecontroleerde intelligente workflows | Continu berekende payroll, pro-forma, documenten/betalingen/aangifte, bredere geautoriseerde agents, externe integraties, internationale HR en mobiele verdieping, elk na eigen productbesluit en acceptatie. |

**Horizon is niet gelijk aan kalenderkwartaal.** De concrete volgende run hoort in AA-NEXT; overige ideeën staan in AA-ROAD en de relevante requirements. Geen Codex-run promoveert zelfstandig EXPLORE → PLANNED → COMMITTED.

## 7. Parallelle werksporen en gedeelde gates

| Spoor | Kan parallel? | Gedeelde grens / releasecoördinatie |
| --- | --- | --- |
| ONE VERSION convergence | Centrale, geserialiseerde release | Alleen geaccepteerde integratie, minimale fixes en expliciete procesverbetering |
| Openstaande Control/Insights/AI-security | Gerichte, goed gescheiden acceptatieruns | Een wijziging aan gedeelde auth/context/RLS vereist coördinatie en regressies |
| CONTROL02 | Als zelfstandig gescopeerde wave | Ownership over employee/employment/IKV, imports en gedeelde migrations |
| Payroll componentengine/isolated Lab | Ja, na nieuwe main-baseline en dependencyplan | Shared Core-, CONTROL02- en IKV-contracten niet gelijktijdig ongecoördineerd wijzigen |
| WVP01 / INS02 / AI01-B | In beginsel ja, na scope-inventarisatie | Bij overlap in permissions, domeinservices, rapportsemantiek en migrations geserialiseerd integreren |
| APIAI-D0 en documentatie | Ja, ook tijdens release zonder main aan te raken | Nieuwe APIAI-code pas na ONE VERSION GREEN op nieuwe externe worktree |
| API/MCP/ChatGPT/WebMCP | Gefaseerd binnen eigen spoor | Eén toolfaçade en gedeelde auth/governance; geen parallelle schaduwautorisatie |
| Nmbrs P0/P1-inventarisatie | Ja, read-only en gescopeerd | P2/P3 mapping en shared employee/IKV-writes koppelen aan Core-/Payrolldependencyplan |
| Talent/Journeys/Documents/Mobile | Per concrete wave te bepalen | Bestaande servicecontracts en dataclassificatie leidend |

Elke uitvoeringsrun verwijst naar het exacte start-SHA, de bedoelde scope, benodigde contracts, actuele test- en acceptatie-evidence en zijn eigen Definition of Done. Mergerechten en centrale release horen bij het geldende AA-OP/AA-REL.

## 8. Besluitpunten, expliciete openingen en onderhoud

1. **ONE VERSION:** feitelijke gezamenlijke main-/Vercel-/Supabase-migrationlineage en vrijgegeven applicatieversie na release controleren; niet anticiperend als GREEN noteren.
2. **AA-documentatieconvergentie:** laat ONE VERSION de juiste AA-versies op main goedkeuren; neem dit masterconcept en AA-API-AI daarna via afzonderlijke, controleerbare documentatiediff over. Werk AA-README en de roadmapleesmatrix bij met AA-MASTER-ROADMAP.
3. **Securityacceptatie:** onderscheid gerichte resterende Control/INS01/AI01-A live-negatives van de technische TEST-release en van de nieuwe API/AI GREEN-gate.
4. **CONTROL02 ↔ Payroll:** definitief live Core IncomeRelationship-/IKV-contract, permissions, migrationlineage en veldownership vastleggen vóór nieuwe gezamenlijke writes.
5. **Payroll:** PAYLAB04-scope en acceptatie, daarna benchmark, fiscale vervolgdekking, pro-forma, documenten en betalingen alleen afzonderlijk vrijgeven; geen algemene compliance-/SEPA-/jaaropgaafclaims vooruitlopen.
6. **API/AI:** externe clientauth/delegatie, exacte read-contracten, MCP transport, ChatGPT-app auth/distributie en relevante WebMCP-browsercompatibiliteit vóór implementatie accorderen.
7. **Nmbrs:** bestaande providerimplementatie, secret-/OAuth- en hosted-evidence opnieuw verifiëren; provider #2 niet zelf kiezen.
8. **Commercieel:** definitieve Liquid Credits, tiers, limieten en modulepositionering via expliciet productbesluit.
9. **Capaciteit/planning:** pas kalenderkwartalen, teams en harde releasedatums toevoegen zodra de afhankelijkheden en beschikbare capaciteit expliciet zijn vastgesteld.

**Bijwerkregel:** na elke gezamenlijke GREEN-release eerst AA-CURRENT/AA-ACCEPT/AA-NEXT controleren; actualiseer deze master alleen bij relevante portfolio-, afhankelijkheids- of horizonwijzigingen. Detailrequirements blijven in de domeindocumenten, en bewijs in gedateerde acceptatierapporten. Zo ontstaat één overzicht zonder concurrerende of gedupliceerde roadmaps.


## 9. Nieuwe ecosysteeminput: OpenAI Plugin Extensions (DevDay 2026)

**Broncontrole:** 2026-10-03; **status:** voorgestelde uitbreiding van de *presentatie- en onboarding-roadmap*, geen extra automatische MVP-verplichting. Deze input is volledig uitgewerkt in het afzonderlijke AA-API-AI-concept, sectie 11. Actuele primaire bronnen:
- https://github.com/openai/mcp-extensions/blob/main/docs/spec.md
- https://developers.openai.com/plugins/build/extensions
- https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt

De reguliere externe API, één gedeelde geautoriseerde business-toolfaçade en een read-only MCP/ChatGPT Workforce Assistant blijven onze **eerste kernarchitectuur**. Nieuw te beoordelen zijn de ChatGPT-sidebar als mogelijke LiquidHR Workplace, een compact conversation-panel voor team-/skills-/POP-inzichten, instellingen en beveiligde deep links. Een verpakte onboarding-skill kan een eerste bruikbare read-only teamvraag begeleiden zodra distributie en auth aantoonbaar werken. HR-documentviewers/editors, model-appcontext op grotere schaal, events en geavanceerde ChatGPT-UX behoren tot latere afzonderlijk beoordeelde fasen.

OpenAI's **Sign in with ChatGPT** mag niet worden verward met het resource-server- en rechtencontract voor LiquidHR-data. ChatGPT-identiteit is geen HR-rol, tenanttoewijzing of automatische accountlink. Optioneel gebruik van iemands ChatGPT-plan voor AI-aanvragen is een andere, afzonderlijk toegestane mogelijkheid. De officiële documentatie beperkt de initiële commerciële identity-beschikbaarheid tot geselecteerde partners en plan usage tot onder andere open-source, lokale persoonlijke en geselecteerde private apps; daardoor krijgt LiquidHR een **haalbaarheidsbesluit**, geen MVP-afhankelijkheid of aangenomen besparing op Liquid Credits.

**Roadmapplaatsing:** tijdens APIAI-D0 actuele feature-/platformmatrix en commerciële beschikbaarheid verifiëren; eventueel onboarding bij bewezen eerste MCP/ChatGPT-MVP; sidebar/panel/settings/context/deep links als UI-verdieping; documentviewer en eventueel events later. Plugin Extensions zijn niet hetzelfde als WebMCP: beide delen services en governance maar hebben een ander kanaal en eigen toegangs-/acceptatietests. Geen wijzigingen aan de lopende ONE VERSION-merge of release.
