# AA-REQ — LiquidHR Fundamental Requirements

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
