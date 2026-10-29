# AA-REQ — LiquidHR Fundamental Requirements

> **29-10-2026, na INS-02 merge.** **INS-01 en INS-02 zijn code-geïntegreerd**, niet gehost vrijgegeven: [#57](https://github.com/EdwinCycling/LiquidHR/pull/57) en [#60](https://github.com/EdwinCycling/LiquidHR/pull/60), `main` `cc6d4b56f3ed4705012aac88a57cbccccef0b608`. INS-02-contract: onderscheid dienstverbandstarts/-einden van unieke medewerkers die een toegestane scope binnenkomen/verlaten; deduplicatie en historisch geldige organisatieplaatsingen, geautoriseerde detail-/CSV-pariteit, NL/EN en geen onbewezen verlooppercentage. HR Admin ziet alleen geautoriseerde administraties; Manager uitsluitend directe teamleden binnen actieve administratie via bestaande `employee:read`, met server-side prequery allowlist; Employee geen toegang. Zes termination-events met soft-deleted dienstverbanden zijn een afzonderlijke all-history-reconciliatiemaat, niet automatisch reguliere uitstroom. 37/37 gerichte tests PASS; full typecheck en live RLS/browser/release blijven afzonderlijke acceptatiepunten. Geen nieuwe permissies, RLS-grants of databasewijzigingen. [INS-02 contract](../requirements/reports/INS-02_JOINERS_LEAVERS.md).


> **Requirements-/acceptatiestatus 29-10-2026.** Deze fundamentele invarianten blijven LEIDEND; de Headcount & FTE-implementatie staat alleen in [Draft PR #57](https://github.com/EdwinCycling/LiquidHR/pull/57), niet in `main`. Productbesluit INS-01: HR Admin leest geautoriseerde administraties; Manager uitsluitend directe teamscope in de actieve administratie via bestaande `employee:read` plus server-side scopebeperking; Employee geen toegang. Alle directe API-aanroepen, queryfilters, detail en CSV moeten dezelfde autorisatie en canonieke berekening gebruiken. Headcount is gededupliceerd per medewerker; FTE wordt niet stilzwijgend op nul gezet bij ontbrekende of ambigue roosterfactor; ontbrekende historische organisatieplaatsingen worden niet gegokt. KPI, trend, tabel en CSV moeten reconciliëren; NL/EN, responsive en geautoriseerde drilldown zijn onderdeel van acceptatie. De bestaande 23 gerichte tests en lokale persona-acceptatie zijn PASS; Engelse live-UI en hosted releaseacceptatie OPEN. Geen nieuwe grants/RLS of databasewrites. Zie [INS-01 issue #56](https://github.com/EdwinCycling/LiquidHR/issues/56) en [AA-CURRENT](AA-CURRENT.md). Dit is een statusaanvulling, geen nieuwe permissie of wijziging van de bestaande securityregels.


Status: **LEIDEND**
Eerste opzet: 2026-09-29

Dit document bevat alleen fundamentele product- en architectuurregels. Detailrequirements blijven in `docs/requirements` en besluiten in `docs/decisions`.

## 1. Productgrenzen

- LiquidHR is een multi-tenant HR-platform.
- De zichtbare en functionele klantgrens is: **tenant → HR-groep → administratie**.
- Een HR-groep is een afzonderlijke HR-omgeving binnen een tenant/holding.
- Een administratie behoort tot precies één HR-groep en wordt niet stilzwijgend tussen groepen verplaatst.
- Server-side contextvalidatie is leidend; querystrings, cookies en clientstate zijn nooit zelfstandig bewijs van autorisatie.
- Control Plane is een gesloten leveranciersapplicatie en geen klantmodule.
- TEST is een omgeving en gegevensherkomst, geen andere set productmogelijkheden: normale producthandelingen zijn via dezelfde gebruikersworkflow en autorisaties beschikbaar. De volledige regel en acceptatiecriteria staan in [PRODUCT_ENVIRONMENT_PARITY](../architecture/PRODUCT_ENVIRONMENT_PARITY.md).

Leidend detail:
- `docs/requirements/multitenancy/`
- `docs/requirements/platform/LIQUIDHR_CONTROL_PLANE.md`
- ADR-0001, ADR-0008, ADR-0009

## 2. Persoon, medewerker, dienstverband en IKV

- Een persoons-/medewerkerkaart bestaat maximaal één keer binnen de relevante HR-groep.
- Een medewerker kan aan één of meer administraties zijn gekoppeld conform het bestaande assignmentmodel.
- Een medewerker kan meerdere dienstverbanden hebben.
- Een medewerker kan meerdere inkomstenverhoudingen (IKV's) hebben.
- Een IKV is **niet** hetzelfde als een medewerker.
- Matching/import mag nooit automatisch een tweede medewerker maken wanneer een bestaande medewerker veilig wordt herkend.
- Ambiguïteit wordt niet gegokt; die wordt geblokkeerd of expliciet ter menselijke beoordeling aangeboden.
- Voorletters zijn geen voornaam. Een ontbrekende voornaam wordt niet uit initialen verzonnen.
- Payroll-/Loonaangiftegegevens mogen bestaande HR-gegevens niet stilzwijgend overschrijven als bron en actuele waarde verschillen.

Leidend detail:
- ADR-0003
- `docs/requirements/core-hr/MEDEWERKER.md`
- `docs/requirements/employment/`

## 3. Autorisatie en privacy

- Autorisatie wordt server-side afgedwongen.
- UI-verbergen is nooit de enige beveiligingsmaatregel.
- Iedere lees-/schrijfroute respecteert tenant-, HR-groep-, administratie- en subjectscope.
- RLS, grants en RPC-autorisatie worden als defense in depth gebruikt.
- Cross-tenant, cross-group en out-of-scope subjecttoegang moeten fail-closed zijn.
- Beveiligde identificerende gegevens worden niet onnodig gelogd of in testfixtures opgenomen.
- Omgevings- en gegevensherkomst zijn interne audit/provenance; toon die niet als technische teststatus in klantgerichte schermen of documenten.
- BSN wordt volgens de bestaande beveiligde identifier/fingerprintarchitectuur behandeld; geen plaintext BSN in importstaging.
- Secrets, tokens, wachtwoorden en `.env.local`-inhoud komen nooit in logs, prompts, screenshots, commits of documentatie.

Leidend detail:
- `docs/requirements/authorization/AUTORISATIE_EN_RECHTEN.md`
- `docs/architecture/ENVIRONMENT_AND_AI_RULES.md`

## 4. Database en mutations

- Schemawijzigingen zijn forward-only migrations.
- Een mislukte, teruggerolde migration krijgt geen gefingeerde history.
- Reeds remote toegepaste migrations worden niet opnieuw toegepast.
- Nieuwe tabellen krijgen in dezelfde delivery aandacht voor RLS, grants, policies, indexes/FK's waar nodig en typegen.
- Writes verlopen via bestaande domain services/RPC's wanneer die bestaan; geen parallelle tweede businesslogica bouwen.
- Kritieke mutations zijn idempotent waar retries realistisch zijn.
- Auditrecords zijn append-only waar het auditcontract dit vereist.
- Direct client-DML wordt beperkt waar businessregels server-side moeten worden bewaakt.

## 5. UX en i18n

- Gebruik de bestaande LiquidHR UX-foundation, design tokens, componenten en navigatiepatronen.
- Nieuwe schermen worden niet als afwijkend mini-product vormgegeven.
- NL/EN-pariteit blijft behouden voor gebruikersgerichte teksten.
- Loading-, error-, empty-, validation- en permissionstates horen bij de feature, niet bij een latere polishronde.
- Responsive gedrag wordt passend bij het scherm getest.
- Toegankelijke labels, focusgedrag en toetsenbordbediening blijven onderdeel van UI-acceptatie.
- Verberg geen normale producthandeling achter fixtureclaims, ontwikkelrollen of een TEST-only route. Interne provisioning blijft afgeschermd en staat los van de productflow.

Leidend detail:
- `docs/requirements/ux/LIQUIDHR_UX_FOUNDATION_V1.md`
- `docs/requirements/ux/WIZARD_UX_STANDARD.md`

## 6. Import- en integratieprincipes

- Externe brondata wordt eerst gevalideerd en genormaliseerd voordat definitieve domain writes plaatsvinden.
- Preview/staging is gescheiden van finalization.
- Een preview maakt geen definitieve HR-domainrecords aan.
- Imports zijn herhaalbaar/idempotent waar dezelfde bron opnieuw kan worden aangeboden.
- Geen fictieve afdelingen, functies, arbeidsvoorwaarden, kostenplaatsen of andere stamdata aanmaken om een import kunstmatig groen te maken.
- Ontbrekende niet-blokkerende inrichting leidt tot duidelijke waarschuwing, draft/status of Setup Assistant-vervolgstap.
- Jaar-/versieverschillen in externe standaarden horen in adapters, niet verspreid door UI en services.

### Import-readiness en bestaande medewerkers

- Een personenimport is ook een **match/upsert-proces**: een bronpersoon kan al als medewerker in LiquidHR bestaan.
- Bij een veilige bestaande match blijft de bestaande medewerker leidend; maak geen duplicate employee aan.
- De import mag gecontroleerd ontbrekende administratie-/IKV-/dienstverbandrelaties toevoegen.
- Materiële verschillen tussen bron en bestaande HR-data worden als conflict/controlepunt getoond en niet blind overschreven.
- Readiness wordt server-side uit actuele stamdata bepaald; geen handmatig afgevinkte checklist als bewijs.
- Readiness onderscheidt minimaal: **gereed**, **waarschuwing/draft mogelijk**, **blokkerend** en **niet vereist**.
- Ontbrekende afdelingen, functies, kostenplaatsen of salarisstructuur blokkeren een Loonaangifte-import niet automatisch.
- De claim “XSD-geldig voor jaar N” mag alleen wanneer tegen de bijpassende officiële XSD voor dat jaar/namespace is gevalideerd.

### Import-finalization en herstel

- Een importfinalisatie moet **atomair of veilig resumable** zijn. Een gedeeltelijke write mag niet leiden tot duplicaten bij retry.
- Als de productflow een medewerker plus dienstverband/draft verwacht, geldt “medewerker aangemaakt maar geen dienstverband/draft” als onvolledige finalisatie en niet als succesvolle businessuitkomst.
- Per batch/record moet voldoende duurzame status bestaan om veilig te kunnen hervatten of gericht te herstellen zonder dezelfde medewerker opnieuw aan te maken.
- Een retry gebruikt de reeds vastgestelde bestaande medewerker/match en maakt niet opnieuw een employee aan.
- Foutcategorie/SQLSTATE of equivalente diagnostische classificatie moet veilig kunnen worden vastgelegd zonder persoonsgegevens/secrets te loggen.
- `COMPLETED_WITH_WARNINGS` mag geen kerninvariant verbergen die volgens het importcontract noodzakelijk is voor een bruikbare uitkomst.

## 7. AI-principes

- AI-acties gaan via app-/service-/autorisatielaag.
- Nieuwe businessacties respecteren actuele permissions, scopes en feature switches.
- Disable/revoke mag noodzakelijke trusted cleanup/accounting niet blokkeren.
- Credits, providerusage en businessaudit moeten reproduceerbaar en controleerbaar zijn.
- Providercalls worden niet gebruikt voor tests wanneer synthetic/deterministic bewijs volstaat.
- HR Admin kan AI-functionaliteit binnen afgesproken productgrenzen beheren.

Leidend detail:
- ADR-0010
- FDR-0008
- `docs/requirements/ai/`

## 8. Bewijs boven aannames

- “GREEN” betekent waargenomen bewijs binnen de afgesproken scope.
- Een browseractie die niet werkelijk is uitgevoerd is geen browserbewijs.
- Een blocked browser-URL is geen geslaagde API-negative.
- Een gerelateerde test is geen vervanging voor het gevraagde scenario.
- Environment-gated bewijs wordt als zodanig gerapporteerd, niet als productdefect en ook niet als GREEN.
