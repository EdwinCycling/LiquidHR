# PAYTAX-UI-01B / PAYTEST-PERSONAS-CLOSEOUT — 2026-10-15

## Uitkomst

Lokale Auth, drie persona's en fiscale vulling binnen bestaande schrijfrechten zijn bewezen. Gehele-populatiedekking is **PARTIAL** door ontbrekende IKV-bronnen en administraties zonder schrijfscope. Geen merge, deployment, nieuwe algemene rechten of Payroll Lab-writes.

Runtime: http://127.0.0.1:3010. Zelf inloggen via `/local/sign-in`, daarna `/local/personas` of `/settings/payroll/fiscal`. De oude `/api/auth/test-login` blijft 404. De nieuwe afgeschermde knop gebruikt de bestaande servercredential en normale Supabase password-login; geen secrets in uitvoer/browseropslag. Development, localhost, featureflag, canonieke Core TEST-ref en geverifieerde vaste identiteit blijven verplicht. Hosted routes blijven gesloten.

## Auth en persona's

Werkelijke HR Admin Auth: `hradmin.fixture@liquidhr.test`, ID `f9157157-6527-4348-8200-57ef57e28df1`. Serverpreflight: TENANT_ADMIN, tenant `07249eb9-545c-883b-b26b-d52f83b4f4a1`, Planeten, actieve Mars/Jupiter-administratie en `salary:write=true`.

| Persona | Werkelijk browserbewijs | Negatieve controles |
|---|---|---|
| Lisa | Rechtstreeks vanuit HR Admin; eigen salaris en ESS renderen; bestaande DIRECT_MANAGER-rol; salaris directe rapportage leesbaar | Jaap en Mars-medewerker zonder salarisdata; buiten-scope salaris geeft nu zakelijke 404 in plaats van generieke 500 |
| Jaap | Rechtstreekse handoff; eigen salarisservice werkt; ESS toont geen definitieve loonstrook voor CONCEPT | Lisa-salaris geweigerd; Lisa-documenten leeg door RLS |
| Frits | Rechtstreekse handoff; eigen salaris en historie; niet-definitieve waarschuwing; veilige terugkeer naar TENANT_ADMIN na herstel opnieuw bewezen | Lisa-salaris geweigerd; Lisa-documenten leeg door RLS |

Terugkeer Lisa naar HR Admin eveneens zichtbaar bewezen. Accountwisselaar mobiel 390×844: selectie/actie zichtbaar, documentbreedte 390; viewport hersteld. Handoff meldt niet vooraf af: bestaande sessie blijft bestaan totdat de eenmalige nieuwe sessie is bevestigd. Geen herbruikbare toegangstokens bewaard.

Jaap/Frits: ieder precies één actieve ADMINISTRATION/EMPLOYEE-toewijzing voor Jupiter en één CREATE-provenanceaudit. Bestaande trigger maakt de bijbehorende HR-groepindex. Bronmigratie `20261015080000_paytest_personas_employee_access_closeout.sql`; remote registratie **20261015061113** met naam `paytest_personas_employee_access_closeout`. Dit versieverschil is vastgelegd, niet herschreven. Exacte Auth-, employee-, employment-, tenant-, groep-, administratie- en systeemrolguards; gehele transactie faalt bij conflict. Replay voegt niets toe. Geen permanente functie/RPC/policy/grant toegevoegd. Eerste poging met ongeldige auditactie faalde atomair; succesvolle bron gebruikt CREATE.

## Fiscale inventarisatie en daadwerkelijke writes

Opnieuw geteld: **94 administratieve medewerkervermeldingen; 86 CONFIRMED, niet-verwijderde dienstverbanden overlappen oktober 2026**. Vermeldingen zijn geen unieke personen over administraties.

| Administratie | Vermeldingen | Oktober-dienstverbanden | Fiscale profielen na uitvoering | Personen met profiel | Uitvoering/grens |
|---|---:|---:|---:|---:|---|
| Mars | 10 | 9 | 8 | 8 | 6 nieuwe; 2 bestaande bewaard; 1 ontbrekende geldige IKV |
| Jupiter | 43 | 42 | 21 | 19 | 21 nieuwe; 20 zonder geldige IKV; 1 self-write geweigerd |
| Mercurius | 24 | 24 | 0 | 0 | Geen geautoriseerde schrijfscope |
| Noorderlicht | 10 | 10 | 0 | 0 | Geen geautoriseerde tenant-/groeps-/administratiescope |
| DGA | 1 | 1 | 0 | 0 | Geen geautoriseerde HR-groep-/administratiescope |
| Hoofdadministratie | 6 | 0 | 0 | 0 | Geen schrijfscope en geen bevestigd oktober-dienstverband |

**27 nieuwe profielen, totaal29**, uitsluitend via bestaande geautoriseerde Core-service/RPC, met readback van profiel-ID, bestaande IKV, bron en loonheffingskorting. Bron HR_ADMIN_CONFIRMED; NL/wit/standaard/maand/regulier/volledige periode; geldigheid binnen bestaande dienstverband/IKV-intervallen en 2026. Realistische ondersteunde variatie: Mars korting ja3/nee5; Jupiter ja15/nee6. Geen bijzondere situatie of niet-ondersteunde tabel gefingeerd. Bestaande fiscale versies ongewijzigd. Tweede batch per administratie: nul nieuwe versies. Lokale batchresultaten: `.artifacts/PAYTAX-UI-01B/*-pass-*.json`.

Jupiter-roster bevat ook4 inactieve/onbeschikbare medewerkers en6 dienstverbanden buiten oktober; geen writes daarvoor. Ontbrekende IKV is inclusief ontbrekende/ongeldige effectieve employee-employment-IKV-relatie, niet automatisch een ontbrekend nummer. Exacte uitzonderingen met IDs staan in [het uitzonderingenbestand](PAYTAX-UI-01B-EXCEPTIONS-20261015.json).

Self-write-grens: HR Admin eigen medewerker `01c349f0-be6f-01dc-4d96-b5bf66085a56`, dienstverband `b407c312-3293-7830-5c49-f2c8514ac32f`; bestaande self-permissions geven geen salary:write. Niet omzeild. Jaap heeft geen geldige oktober-IKV-koppeling; geen profiel of bronrelatie verzonnen.

## Functionele UI en beveiligde identificatie

Zeven tabs blijven bereikbaar: Algemeen, Belastingen, Overige, Verzekeringen, Loonkostenvoordeel, ZVW en Opmerkingen. Ondersteunde loonheffingskorting/IKV/geldigheid/administratieve bron lopen via bestaande service; overige berekenfuncties eerlijk read-only. Historie blijft zichtbaar. Ontbrekende IKV blokkeert invoer met zakelijke melding. Fiscaal overzicht hersteld voor ontbrekende zoekknopvertaling; regressietest gebruikt echte NL/EN-woordenboeken. ESS-maandvertaling hersteld.

BSN-service: correcte lookup op `employee_id` en tenant, verplichte reveal-audit vóór decryptie, bestaande BSN-validatie ook server-side bij invoer. Geen plaintext BSN gelezen/gelogd, geen BSN-writes.17 bestaande beveiligde identificaties hebben cipher/fingerprint; ontbrekende identificatie is niet verzonnen. Opslag-/revealpad gericht getest met mocks, geen live BSN-reveal. Ontwikkelproductupdates met expliciete TEST/DEMO/FIXTURE/BENCHMARK-titelprefix worden uit de gewone updates gefilterd; beheerhistorie blijft bestaan. Bestaande namen en vrije zakelijke fixture-inhoud in andere modules zijn niet herschreven: volledige productbrede tekstopschoning is hiermee niet bewezen.

## Payroll-integriteit

Alle **52** calculation_runs byte-inhoudelijk vergeleken via digests van run, component_results, calculation_traces en lifecycle_events: **alle gelijk aan baseline vóór writes**. Dus ook Frits' drie historische Jan-traces ongewijzigd; labelvraagstuk blijft open.

| Mars-run | Bruto | Loonheffing | Na loonheffing, onvolledig | Lifecycle |
|---|---:|---:|---:|---|
| `f33294bf-2eea-52d6-ab36-3f740e822a51` | €3.517,00 | €1.261,33 | €2.255,67 | SUCCEEDED / CONCEPT |
| `7034df4f-7dbb-57d5-ba2c-498855092587` | €3.534,00 | €1.268,08 | €2.265,92 | SUCCEEDED / CONCEPT |

Geen herberekening, vervanging, finalisatie, PDF of ESS-publicatie uitgevoerd. Deze bedragen zijn geen volledig definitief nettoloon. Elke run behoudt4 componenten,10 controles (4PASS/6WARN) en1 trace.

## Volledig netto: bron- en enginegaten

| Component | Bestaande bron / werkende regel | Nog nodig voor reguliere volledige verwerking |
|---|---|---|
| Werknemerspensioen | Core2 assignments,3 versies,22 staffels; scenario-engine leeftijd/franchise/plafond/deeltijd/aandeel | Beide Mars-snapshots hebben0 assignments; toepasselijke gevalideerde regeling en allocatie aan reguliere flow |
| Werkgeverspensioen | Dezelfde versiebronnen; aandeelberekening in scenario-engine | Geldige werkgeversallocatie en juridische/fiscale grondslag per administratie |
| Werknemersverzekeringen/werkgeverslasten | Contracten97, salarissen109; AWF/AOF/WHK/WKO-scenarioregels | Gevalideerde werkgeversindeling, sector/beschikking, jaarmaxima/cumulatieven en reguliere wiring; scenariopercentages zijn geen normale bron |
| ZVW | Scenarioheffing en jaarreferenties aanwezig; fiscale tab eerlijk read-only | Toepasselijke kwalificatie, grondslag, werknemers-/werkgeverbehandeling en cumulatieve maxima |
| Vakantiegeld/reserveringen | Arbeidsvoorwaarden/salaris; scenarioreserveringen | Effectieve gevalideerde percentages, opbouw-/uitbetalingshistorie en reguliere verwerking |
| Cumulatieve fiscale grondslagen | Payroll-historie, hashgebonden scenario-opening op FINALIZED voorganger | Algemene YTD-openingen, continuïteit en cumulatieve fiscale verwerking; geen fictieve nulopening |
| Variabel loon/overige inhoudingen | Approved actual-work bronpad;4 perioden/25 revisies; approval/overwerkvalidaties | Toepasselijke componentregels en bedragen/provenance; reguliere niet-reguliere beloning/inhoudingen nog incompleet |

`employee-payroll-calculation-service.ts` houdt deze volledigheidsblokkades expliciet aan. Volgende afzonderlijke bouwslag: geverifieerde bronallocaties verbinden, componenten onafhankelijk controleren en pas daarna een nieuwe revisie naar REVIEWED → FINALIZED → PDF → ESS. Bestaande concepten blijven intact.

## Gates en resterende grenzen

- Gerichte finale Vitest:12 bestanden/78 tests; fiscale7-tabs2; echte NL/EN-overzicht2; manager-RLS/PGlite3 geslaagd. Eerdere handoff/confirm/runtime37 tests ook geslaagd.
- TypeScript, gerichte ESLint, i18n43 namespaces en diff-check geslaagd. Veilige afzonderlijke TEMP/TMP-cache gebruikt; repository-PGlite dependency beschikbaar.
- Guarded build stopt vóór build: kandidaat moet schoon zijn; bestaande beschermde wijzigingen in next.config.ts blijven behouden. next-env.d.ts niet bewerkt/gestaged. Geen volledige buildclaim.
- Core security/performance advisors gecontroleerd: bestaande security-definer-waarschuwingen, leaked-passwordbescherming en index/policyadviezen blijven open; geen nieuwe functie/policy toegevoegd. Geen schema/typeswijziging door deze datamigratie.
- Catalogus/credentialmetadata-preflight slaagde; oude automatische browserharness met SkipBrowser meldt terecht geen browseracceptatie. Browserbewijs hierboven is afzonderlijk via echte Chrome-sessies verzameld. Losse wachtwoordlogin voor ieder persona niet apart bewezen; echte Supabase-handoff en ESS wel.
- PR33 blijft OPEN/DRAFT, niet gemerged. Server3010 blijft actief. Onbevoegde administraties, ontbrekende IKVs, eigen HRAdmin-self-write, historisch Jan-label en volledig-nettogaten zijn expliciete open punten.
