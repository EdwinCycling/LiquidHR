# PAYTEST-AUTH-01B — vaste Payroll-testaccounts en harness

**Verdict: PARTIAL / BLOCKED — geen volledige persona-acceptatie.** Datum: 2026-10-14. Uitgevoerd in `work/paytest-auth-01-current-20261013`, vanaf kandidaat-HEAD `86fb4a47912977c9123b542694298b7b3d3090a1`; op het moment van controle wees `origin/main` naar `8c585f8397e059070e2107cdbec57ab7fbe3757e`. Geen merge of deployment uitgevoerd.

## Afgeronde acties

- De vaste persona-catalogus, leesbare instructie en root `AGENTS.md` leggen nu de directe lokale handoff Test HR Admin → `payroll-lisa` / `payroll-jaap` / `payroll-frits` vast. Edwin is geen tussenpersona en krijgt geen nieuwe toegang.
- De centrale credentialfile `%LOCALAPPDATA%\LiquidHR\TestRuntime\payroll-test-personas.env` is aanwezig en ACL-beperkt tot de huidige Windows-gebruiker; de zes vereiste waarden zijn gegenereerd en gecontroleerd zonder ze te tonen. Geen credential staat in de repository.
- Lisa's bestaande TEST-Auth-wachtwoord is via de ondersteunde Auth Admin-flow vernieuwd. Bestaande Auth-link, medewerker, employment en runs zijn niet gewijzigd.
- Jaap en Frits zijn niet geprovisioneerd: de Test HR Admin heeft alleen Mars-binding; de gecontroleerde RLS/Core-linkroute gaf 403 vóór writes en er was geen bestaande employee-link RPC. Er zijn geen orphan Auth-users, Core-links, rollen of administratie-toegang toegevoegd.
- Een voorgestelde tijdelijke uitbreiding van de route-allowlist naar Edwin is door automatische review afgewezen: die zou de caller verbreden buiten de expliciet goedgekeurde Test HR Admin en een niet-aangevraagde securitygrenswijziging introduceren, strijdig met de eis om zonder Edwin-afhankelijkheid rechtstreeks te wisselen. De wijziging is niet toegepast en er is geen indirecte bypass gebruikt.
- Geen Payroll-run, employee-, employment-, ESS-, rol- of historische trace-data gewijzigd.

## Runtime- en browserbewijs

- Statische catalogus-/role-switchcontrole, PowerShell-parser, Node-syntax en JSON-parse zijn geslaagd. De lokale preflight met de bestaande gebruikers-`LOCALAPPDATA` bevestigde de centrale TEST-variabelen, runtime/dependencies en ACL-beveiligde credentialwaarden; met `-SkipBrowser` blijven persona's bewust `BLOCKED` en is er geen `READY`-claim.
- In de laatste volledige lokale browserrun was Lisa's directe login bruikbaar: `/my-salary` en haar eigen salaris-API antwoordden HTTP 200. De vaste handoff Test HR Admin → Lisa en de zichtbare 2026-10 FINALIZED-weergave zijn niet bevestigd. Op `/my-salary` was geen PDF/downloadcontrol zichtbaar.
- De cross-employee salarisprobe van Lisa naar Jaap antwoordde HTTP 200 met niet-lege of onbekende `data`; de browserchecker blokkeert hier fail-closed. Response-bodies zijn niet gelogd. De dossierprobe gaf eveneens HTTP 200; de response-body is niet als denialbewijs gebruikt. Lisa heeft een bestaande `DIRECT_MANAGER`-toewijzing in Planeten en andere groepen; deze is niet aangepast. De verwachte rolgrens en feitelijke datascopestatus moeten gericht worden vastgesteld.
- De vaste Auth-role-switch naar Jaap en Frits antwoordde HTTP 503 omdat er geen bestaande Auth-identiteit/employee-link is. Hun directe login en self-only-, dossier-, PDF-, desktop- en mobiele acceptatie zijn dus niet bewezen; de pogingen genereerden browserconsole-errors door die ontbrekende identiteit.
- Jaaps bestaande 2026-10-run `e20e0345-90ac-489b-9fee-7610b2d8f6a3` blijft `SUCCEEDED / CONCEPT`; hij is niet gefinaliseerd of herberekend.

## Frits-provenance — read-only

Voor de runs `338ef391-fbf6-435a-a4d7-e28a8024ebc2`, `131a5fcb-c92a-416f-8fdf-bc87e2d3ae47` en `2d8057f1-92a9-4e0b-bfc6-09806c81ced5` matchen de opgeslagen bron-employee-ID en employment-ID Frits. In elk van de drie traces matchen `sourceHash` met de bron-snapshot-hash, `inputHash` met de calculation-input-set-hash en `resultHash` met de run-result-hash. De tracevelden `calculationContext.personaLabel` bevatten alle drie `Jan`; de bron-snapshotpayload bevat geen `Jan`-label. De bevinding is daarom **TRACE_LABEL_MISMATCH_OPEN**, geen vastgestelde employee-ID-mismatch. Historische resultaten zijn niet gewijzigd. PFZW blijft `SOURCE_GAP`; netto blijft `NON_DEFINITIVE`.

## Hosted veiligheid en checks

- Vercel Preview `dpl_BPSoLrZTpFN37t9AeStaqb1TkAyf` werd na de push READY op exact commit `5869191f3d2e3badc8815b6f86fcd4b6fa50a2fe`, branch `work/paytest-auth-01-current-20261013`, alias `liquidhr-git-work-paytest-auth-01-curre-3735cc-edwinitsolutions.vercel.app`. De anonieme `/login` toonde de normale uitnodigingslogin; Test Auth en role-switch waren niet zichtbaar.
- De gecontroleerde Production-deployment was READY op `main`-SHA `8c585f8397e059070e2107cdbec57ab7fbe3757e`. De publieke login toonde de normale invite-only flow; Test Auth en role-switch waren niet zichtbaar. Dit bewijst geen Preview-acceptatie.
- `node --check scripts/check-test-personas.browser.mjs`, PowerShell-parser en JSON-validatie: PASS. De checker `-SkipBrowser` bevestigde statische/runtime/config/credential-preflight maar eindigde bewust met code 2 omdat browseracceptatie was overgeslagen; geen persona kreeg `READY`.
- `git -c core.whitespace=cr-at-eol diff --check`: PASS. De reguliere Windows-worktree heeft CRLF; de EOL-bewuste check bevestigt dat er geen inhoudelijke trailing whitespace is.

## Vereiste afsluitproef

Hervat Jaap/Frits alleen wanneer er een expliciet geautoriseerd, bestaand Auth Admin + auditbaar Core-linkpad beschikbaar is met de juiste Jupiter-beheerscope. Bewijs daarna hun vaste directe handoff en self-only rechten; bevestig Lisa's verwachte employee/managergrens via positieve en negatieve API-probes zonder response-bodies te bewaren; bevestig Lisa's FINALIZED UI en echte beschikbare PDF; controleer desktop en 390 px; en los Frits' `Jan`-trace-label uitsluitend via geverifieerde provenance en toegestane productflow op. Behoud Jaaps CONCEPT en alle Frits-historie. Merge blijft geblokkeerd zolang verplichte acceptatie openstaat.
