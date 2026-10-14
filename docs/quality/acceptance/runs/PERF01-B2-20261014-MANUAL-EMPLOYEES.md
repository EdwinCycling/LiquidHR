# PERF01-B2 — ingelogde medewerkers-smoke, 2026-10-14

**Omgeving:** uitsluitend synthetische LiquidHR TEST.  
**Bewijstype:** gebruiker bevestigt zelf 7/7 checklistpunten na browserlogin. Geen HAR, screenshot of geautomatiseerde browserrun aangeleverd.  
**Scope:** functionaliteit van `/employees`; geen algemene security-/performanceacceptatie.

## Vastgestelde release-identiteit

- GitHub `main` SHA: `8c585f8397e059070e2107cdbec57ab7fbe3757e` (`perf(employees): paginate overview server-side`).
- Vercel `liquidhr` deployment `dpl_BDd7JE7M2gr2gsD4ma2hoUorKpTo`: **READY**, exacte main-SHA, canonieke alias `liquid-hr-hr-suite.vercel.app` (onafhankelijk via Vercel gecontroleerd).
- Testadres: https://liquid-hr-hr-suite.vercel.app/employees
- [Linux-build GitHub Actions #38519689908](https://github.com/EdwinCycling/LiquidHR/actions/runs/38519689908): `completed/success`, Node 24.19.0, op **kandidaat** SHA `ebaab882f19542d2fb8f0653a70192035c15cde5`. De Vercel-release op de latere geïntegreerde `main`-SHA is afzonderlijk READY bevestigd.

## Gebruikersgerapporteerde ingelogde browser-smoke: 7/7 PASS

De gebruiker heeft op 14 oktober 2026 alle zeven eerdere checklistpunten handmatig afgevinkt en het resultaat in de conversatie bevestigd.

| # | Controle | Uitslag |
| --- | --- | --- |
| 1 | Medewerkersoverzicht opent na inloggen zonder foutmelding | PASS |
| 2 | De eerste pagina toont maximaal 50 medewerkers | PASS |
| 3 | Paginanavigatie naar pagina 2 werkt | PASS |
| 4 | Terug naar pagina 1, zonder dubbel getoonde medewerkers | PASS |
| 5 | Zoeken op naam werkt over pagina's heen | PASS |
| 6 | Statusfilter of sortering werkt | PASS |
| 7 | Pagina-refresh behoudt lijst en URL-/filterstatus | PASS |

De eerder gerapporteerde synthetische RPC-fixture omvatte 88 medewerkers; 38 rijen op pagina 2 was een verwachte testuitkomst. Dit browserrapport bevat **geen afzonderlijke ruwe rijtelling van 38**, netwerklog of latencydata. De specifieke ingelogde rol is in het gebruikersrapport niet expliciet benoemd.

## Eerder technisch bewijs (niet opnieuw uitgevoerd)

- Codex-resultaat: **629 testbestanden, 3.024 tests geslaagd**, 4 bestanden en 8 tests overgeslagen. Gerichte TypeScript-, ESLint-, i18n- en diff-checks geslaagd.
- Supabase TEST-migratie `20261013143616` eenmaal toegepast; versioned RPC, RPC-body, eigenaar, `search_path` en EXECUTE-grants volgens Codex gecontroleerd.
- Positive/negative RPC- en scopecontroles volgens Codex geslaagd voor HR Admin, Manager en Directory-only, inclusief tenant-, HR-groep-, administratie-, teamscope en verborgen-veldzoeken. Niet opnieuw door de gebruiker in de browser getest.
- De eerder genoemde mediane databasefunctieverbetering en JSONB-payloadreductie zijn **geen** bewijs voor volledige page-/dashboardlatency.

## Verdict, beperkingen en resterend werk

**PASS — beperkte functionele geauthenticeerde browseracceptatie van PERF01-B2 op synthetische TEST: 7/7 handmatig door gebruiker bevestigd.** Het openstaande punt ‘ingelogde `/employees`-smoke ontbreekt’ kan voor deze flow worden gesloten.

Niet door deze run bewezen: afzonderlijke Manager-browser-/cross-team-negatives; complete `/employees`-latency of dashboard-p75; screenshot/HAR; andere projectbrede security-, OAuth- of personaacceptatie. Het aparte performancebewijs `PERF01-B-019` blijft [OPEN in AA-OPEN](../../../AA/AA-OPEN.md). **Geen projectbrede acceptance GREEN.**

Dit verslag bevat alleen documentatie; geen productcode, database-/schemawijziging of Vercel-instelling.
