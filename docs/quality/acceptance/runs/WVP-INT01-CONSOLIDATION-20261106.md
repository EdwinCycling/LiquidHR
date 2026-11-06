# WVP-INT01 — WVP02 t/m WVP05 integratieacceptatie

**Opdrachtgever:** Edwin
**Datum:** 6 november 2026
**Status:** Geïntegreerde lokale codekandidaat / CONTROLLED-acceptatie OPEN

## Kandidaat en herkomst

- Repository: `EdwinCycling/LiquidHR`; integratiebranch `work/wvp-int01-20261106`.
- Basis: `origin/main` `8c580cda76cd2ea641ddaafe13a7b55213d89833`.
- Opgenomen oorspronkelijke PR-heads: #94 `42b591500365e404217758f83fc87dcfa96b703f`; #95 `4a903994913af031d579c7b083f2ae6dd97be5b6`; #96 `a981b6b2896f001ea98cb958d839775dc98bff57`; #97 `79027ac316f2b0a838bb965f18b14615415f4390`.
- Integratie gebeurde met normale mergecommits; alle vier bron-heads blijven in Git traceerbaar. PR #94–#97 zijn tijdens deze cyclus niet bijgewerkt, gepusht of gemerged en blijven de oorspronkelijke Draft PR’s.
- De bestaande stash `f901aaba57e1612422ae3cd3302927b3a7e9dace` en ongestagede WVP01-acceptatienotitie zijn behouden.

## Geïntegreerde functionaliteit

De WVP-casuswerkplek combineert de bestaande PMUX-processtatus en taakvoorraad met WVP-mijlpalen, deadlines, urgentie, modelverantwoordelijke rol en gekoppelde casusgebeurtenissen. Processtart blijft gescheiden van taakuitvoering. De WVP04-status “geen koppeling” is behouden als lege toestand; WVP05 toont echte relaties met bestaande medewerkerdocumenten en laat die via bevestiging ontkoppelen.

Documentrelaties hergebruiken `employee_documents`, de bestaande documentservice, WVP-casusservice, documentrechten en audit. De relatie bewaart alleen IDs en auditmetadata; broninhoud of medische metadata wordt niet gekopieerd. Ontkoppelen markeert alleen de relatie. Employee krijgt geen beheeracties; Manager/HR Admin krijgen ze alleen wanneer de bestaande case-, team-, administratie- en documentrechten gelden. Schema-onbeschikbaarheid, ontbrekende documenttoegang, lege mijlpalen/koppelingen en mutatiefouten hebben expliciete statussen of foutmelding.

## Conflicten en beveiligingsreview

Conflicten in de casuspagina, labels, berichten, WVP-test en AA/WVP-documentatie zijn inhoudelijk samengevoegd. De WVP02-processtatus/startlogica en WVP03-mijlpaal-/gebeurtenisprojectie zijn behouden. De afzonderlijke WVP04-placeholders zijn vervangen door de WVP05-relatielijst, zonder de betekenis van “geen koppeling” te verliezen. NL/EN-keys blijven gelijk.

**Statische autorisatiereview: PASS. Overall security gate: HOLD tot verplichte tests en personaacceptatie zijn uitgevoerd.**

- WVP START controleert aan servicezijde en in de directe `wvp_command`-RPC `process-definition:write` én `process-definition:publish`, binnen de bestaande tenant-/HR-groep-/administratiescope en vóór idempotente terugkeer of WVP-mutatie. De bestaande PMUX-kernelcontrole `process-instance:start` blijft afzonderlijk gelden.
- Taakbevestiging blijft achter `process-task:act` in de bestaande claim-/actie-RPC. WVP05-writes vereisen bestaande WVP-casus/team-/administratiescope, document:read, dezelfde tenant/administratie/medewerker en een geldige bestaande WVP-taak. Reads zijn RLS- en documenttoegang-gefilterd; directe table writes zijn niet verleend.
- WVP05-add is idempotent. Remove is een soft unlink; de brondocumentrij wordt niet verwijderd. Audit bevat relatie-identifiers en actor/tijd, geen inhoud of vrije tekst.
- De casuspagina redirect nu ook bij ontbrekende authenticatie tijdens documentopties laden. De ontkoppelknop verschijnt alleen bij een leesbare documentreferentie. Geen open kritieke codebevinding gevonden in deze review.
- Geen rol/grant/RLS- of tenantrecht verruimd. Geen bestaande gepubliceerde procesdefinitie, procesinstantie of businessrecord gewijzigd.

## Controles

| Controle | Resultaat | Bewijs/grens |
| --- | --- | --- |
| Statische securityreview | PASS | Service-, RPC-, PMUX-kernel-, documentservice-, RLS- en UI-route bekeken; geen live bewijs. |
| NL/EN i18n | PASS | Bestaande `check-i18n.mjs`: 43 namespaces met gelijke sleutels. |
| `git diff --check` | PASS | Zowel werkdiff als gestagede integratiediff gecontroleerd. |
| WVP01/WVP02 SQL-/PGlite-contracttests | NOT RUN | Vitest-binary ontbreekt; geen installatie uitgevoerd. |
| WVP05 SQL-/PGlite-contracttests | NOT RUN | Vitest-binary ontbreekt; geen installatie uitgevoerd. |
| WVP-casus UI-regressietests | NOT RUN | Vitest-binary ontbreekt. |
| TypeScript | NOT RUN | Lokale `tsc`-binary ontbreekt. |
| ESLint | NOT RUN | Lokale `eslint`-binary ontbreekt. |
| HR Admin/Manager/Employee browser- en negatieve scopeacceptatie | NOT RUN | Geen beschikbare LiquidHR-runtime/browser-sessie; geen loginpoging of herstelronde. |
| Supabase advisors/typegeneratie na migratie | NOT RUN | Migraties zijn niet toegepast. |
| Vercel-release | NOT RUN | Niet geautoriseerd of uitgevoerd. |

## Database en vervolg voor operationeel gebruik

Read-only migratiehistorie van Core TEST `wnpfloqpjvaacobppbpk` bevestigt dat WVP01-basis `20261026131216` en WVP01-auditcorrectie `20261026175140` geregistreerd zijn. WVP02 SEC01 `20261106150000` en WVP05-documentkoppelingen `20261106180416` zijn niet geregistreerd. Geen migratie is in deze cyclus toegepast. De vereiste codevolgorde blijft WVP02 SEC01 eerst, daarna WVP05. Geen businessdata is gewijzigd.

Voor operationeel bruikbaar WVP-dossier zijn nog nodig: de verplichte WVP02/WVP05 contract- en UI-tests, TypeScript en lint; bestaande HR Admin-, Manager- en Employee-flows plus negatieve Jupiter/Mars/Mercurius-, team- en HR-groepscopes; en een afzonderlijk migratiemandaat gevolgd door toepassing in volgorde, Supabase security/performance-advisors, database-typegeneratie en readback. WVP01 live reminders/audit/rollen blijven open. WVP03 is een registratiestatusindex en claimt geen wettelijke RIV-compleetheid; daarvoor moeten requirements eerst gevalideerd zijn.

Geen merge naar `main`, push, tweede PR, Supabase-write of Vercel-release in deze cyclus. De kandidaat is lokaal op `work/wvp-int01-20261106`; bestaande PR #94–#97 blijven open/Draft.
