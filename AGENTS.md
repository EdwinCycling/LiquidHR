# LiquidHR — bindende Codex-regels

Motto: **It takes a genius to keep it simple.**

## Start en instructieprioriteit

- Lees dit bestand vóór wijzigingen. Lees daarna de concrete opdracht en de actuele kop van [`docs/AA/AA-CURRENT.md`](docs/AA/AA-CURRENT.md); gebruik [`docs/AA/AA-README.md`](docs/AA/AA-README.md) als router.
- Lees alleen toepasselijke AA-secties en requirements/ADR's van het geraakte domein. Laad `docs/README.md`, `docs/delivery/CURRENT_CONTEXT.md`, `docs/delivery/IMPLEMENTATION_STATUS.md` en historische rapporten niet volledig tenzij de concrete taak die inhoud nodig heeft. Zoek gericht op onderwerp, datum, route of evidence-ID.
- Bij conflict geldt: (1) actuele expliciete opdracht en mandaat; (2) niet-onderhandelbare privacy-, security- en data-integriteitsgrenzen; (3) dit operationele contract; (4) toepasselijke AA-documenten; (5) goedgekeurde domeinrequirements/architectuur; (6) historische rapporten uitsluitend als bewijs/context. Herstel een conflict op de juiste plek.

## Uitvoeringsmandaat

- Maak de in-scope taak zelfstandig af: onderzoek, kleine aanpak, implementatie, reproduceerbare bugfixes, gerichte regressietests, passende type/lint/buildchecks, eigen expliciete commits en de door de opdracht geautoriseerde PR-, merge- of releaseacties. Vraag geen toestemming voor normale ontwikkelstappen.
- Volg één bounded cyclus: **Understand → Implement → Fix → Targeted Test → Verify → Deliver**. Reproduceer een mislukking, stel oorzaak vast, herstel en hertest. Maximaal twee gerichte herstelcycli per blocker; rapporteer daarna kort oorzaak, herstel, bewijs en de benodigde menselijke beslissing.
- Eén uitvoerende agent is standaard. Start geen subagents of parallelle implementatie tenzij de gebruiker dat expliciet autoriseert. Onderzoeks- of reviewwerk maakt op zichzelf geen extra Git-checkout nodig.
- Raadpleeg [`AA-OP.md`](docs/AA/AA-OP.md), [`AA-TEST.md`](docs/AA/AA-TEST.md) en [`AA-REL.md`](docs/AA/AA-REL.md) voor de toepasselijke workflow, test- en releaseregels.

## AA-LEAN-03 — minimale handmatige goedkeuringen (2026-10-13)

**Bindend voor alle huidige en toekomstige LiquidHR Codex-opdrachten.** Een gegeven taak is het uitvoeringsmandaat voor normale, in-scope ontwikkelstappen; dezelfde toestemming wordt niet per commando, script, Git-stage, commit, test, tijdelijke cache of browseractie opnieuw aan de gebruiker gevraagd. Voer veilige handelingen zelfstandig uit en bundel eventuele werkelijk noodzakelijke keuzes in maximaal één concrete vraag.

**Vooraf toegestaan in bestaande synthetische TEST:** de normale lokale Test Auth-login, logout, sessievernieuwing, en ingebouwde rolwissel tussen bestaande HR Admin-, Manager- en Employee-testidentiteiten, inclusief de Supabase Auth-handoff die de bestaande beveiligde testharness zelf nodig heeft. Geen nieuwe accounts, magic-link-captures, role grants, credentialwijzigingen of niet-goedgekeurde businessdatawrites; gebruik geen menselijke Production-identiteit om een test te laten slagen.

**Technische goedkeuringen blijven apart van taakmandaat.** Codex-clients kunnen sandbox- of netwerkprompts tonen die tekstinstructies niet opheffen. Gebruik waar beschikbaar een gepaste lokale `workspace-write`-sandbox met `approval_policy = "on-request"` en `approvals_reviewer = "auto_review"` / *Approve for me* voor in aanmerking komende verzoeken; configureer zo nodig gerichte commandoregels of writable roots. Verander geen gebruikers- of organisatiebrede Codex-config stilzwijgend en kies nooit blind voor `danger-full-access` of een sandboxbypass. `approval_policy = "never"` is **geen** garantie dat een sandbox-geblokkeerde Git- of netwerkactie alsnog slaagt.

Vraag expliciete toestemming uitsluitend waar de **harde grenzen hieronder** dat vereisen. Als een legitieme handeling technisch geblokkeerd blijft: probeer één veilige alternatieve route, meld daarna eenmaal de exacte oorzaak en vereiste instelling/toestemming; geen keten van tientallen escalaties. Detail: [AA-OP, AA-LEAN-03](docs/AA/AA-OP.md#aa-lean-03--autonoom-uitvoeren-en-goedkeuringsverzoeken-2026-10-13).

## Git en scope

- `main` is de centrale trunk; `work/payroll-p0-p1` en de bijbehorende worktree zijn het geparkeerde Nmbrs-spoor en beschermd. Bestaande unieke wijzigingen en worktrees blijven behouden.
- Maak alleen een tijdelijke branch wanneer isolatie of PR-workflow nodig is. Verifieer de actuele `origin/main`; gebruik `work/<run-id>-<YYYYMMDD>`. Maak niet automatisch een tweede worktree.
- Stage uitsluitend expliciet geselecteerde, in-scope bestanden. Gebruik geen brede staging, permanente backup-/rescue-/archivebranches of verplaatsbare `last-good`-refs. Geen automatische force, reset, clean of branch/tagverplaatsing.
- Raak `docs/_local-incoming` (140 lokaal geconsolideerde bestanden) niet aan. Wijzig nooit `apps/hr-suite/next-env.d.ts`.
- LiquidHR is **LOCAL FIRST → GITHUB CONTINUOUS → VERCEL ON DEMAND**. GitHub-pushes, PR's en merges zijn nooit een Vercel-release; alleen het expliciete verzoek `RELEASE LIQUIDHR TEST` autoriseert die. Zie `docs/AA/AA-REL.md` §6. Houd de effectieve Vercel Git/Preview-triggers uit vóór een policy-push; als dat niet betrouwbaar te bevestigen is, stop vóór push.
- Integratie, push, merge en deployment vereisen het mandaat uit de oorspronkelijke opdracht. Een GitHub-integratie wijzigt alleen de Development-baseline. Controleer READY, SHA, alias en smoke uitsluitend na een afzonderlijk geautoriseerde Vercel-release.

## Beschermde handelingen en omgeving

- Aparte expliciete toestemming is vereist voor remote database/schemawrites, inclusief TEST; destructieve businessdatawijzigingen; Production-data of echte klantgegevens; secret-/credentialrotatie; securityrechten of tenanttoegang buiten de opdracht; het weggooien van unieke niet-geïntegreerde gebruikerswijzigingen; en merge/deployment/release buiten het oorspronkelijke mandaat.
- Bestaande synthetische TEST-fixtures zijn binnen expliciete scope bruikbaar. Geen directe SQL/service-role-bypass, verzonnen fallback, kunstmatig afgedwongen lifecycle-succes of wijzigingen aan Payroll-history om groen te fabriceren.
- Nooit secrets, tokens, cookies, magic links, plaintext BSN of IBAN printen, loggen, vragen of committen.
- Beschermde canonical config: `apps/hr-suite/.env.local`. Lees of toon de waarden nooit; kopieer, vervang, verplaats of verwijder het bestand niet. De centrale TEST-config `%LOCALAPPDATA%\LiquidHR\TestRuntime\.env.local` is volgens de provisioner een hardlink naar diezelfde file. Controleer alleen bestaan/linkmetadata; maak of herstel de link alleen wanneer de opdracht lokale runtimeconfiguratie vereist. Nooit `git clean -x/-X`.
- Vercel `production` is de deploymentchannelnaam van de bestaande synthetic TEST-omgeving; het is geen toestemming voor writes naar live productiedata. GitHub `main` en Vercel TEST zijn aparte baselines. Geen Docker, lokale containers of WSL-workaround.
- De geaccepteerde SEC-01-migratie is uitsluitend op TEST toegepast. Wijzig of herhaal haar niet; dit mandaat staat geen nieuwe migratie toe. CONTROL02 en de officiële Loonaangifte-XML-import blijven geannuleerd.

## Technische en domeininvarianten

- Bouw schema → API-route → UI. Gebruik strict TypeScript, nooit `any`, Next.js Server Components/Server Actions en URL-state; geen React Query of SWR.
- Iedere tabel in een exposed schema heeft RLS en passende policies in dezelfde migration. Dwing autorisatie server-side én met RLS af; UI-verberging is alleen UX. Elke datatoegang respecteert toepasselijke tenant-, HR-groep-, administratie-, rol-, employee-, team- en casescope.
- Gebruik canonieke permissions `resource:action` of `self:resource:action`. Behoud de grenzen tussen HR Admin, Manager en Medewerker, ESS/MSS en Focus. Houd mutaties auditable.
- Gebruik Engelse database-entiteiten en identifiers; Nederlandse, i18n-klare comments, documentatie, zichtbare tekst en fouten. Nederlands (`nl`) is standaard; NL en EN hebben dezelfde keys. Voeg een taal als volledige namespace-set toe onder `apps/hr-suite/messages/<taalcode>/`.
- Na een schemawijziging: relevante Supabase advisors controleren en `packages/db/types.ts` genereren/verifiëren. Migrations zijn forward-only; herschrijf geen historische migratieregistratie. Test kritieke autorisatie- en salarislogica test-first.
- Payroll behoudt exacte decimalen, wettelijke afrondingsstappen, versionering, immutable history en bron-/resultaatprovenance; raadpleeg `AA-PAYROLL.md` voor de volledige domeingates.
- `apps/hr-suite` gebruikt UX Foundation v1. Hergebruik bestaande primitives/patterns/layouts; plaats generieke componenten respectievelijk in `components/ui`, `components/patterns` en `components/layout`, domeincomponenten in hun featuremap. Rapporteer een ontbrekende gedeelde component als `FOUNDATION_GAP` in plaats van een lokale kopie te bouwen.
- UI gebruikt Tailwind v4, Foundation CSS-variabelen, Lucide voor standaardiconen en toegankelijke `focus-visible`-states. Geen hardcoded hex, willekeurige radius/shadow/gradient of standaard hover-lift. Surfaces zijn vlak met semantische border/radius zonder standaard shadow; voorkom card-on-card.
- Behoud `/employees` als lijst-/workbenchreferentie en Employee Detail met `DetailColumns` (ongeveer 2/3 inhoud, 1/3 aside). Closed value lists gebruiken een toegankelijke doorzoekbare keuzecomponent met zichtbare selectie; beheerstamdata is lijst-eerst met zoeken/filter/sort, klikrij en modal bewaren/annuleren; archiveren is een expliciete modalactie.
- Themes blijven token-gedreven en componenten theme-agnostic. LinkedHR is een officieel LiquidHR-theme met dezelfde Foundation. Een visuele redesign wijzigt standaard geen route, API, database, RLS, permissions, businesslogica of data-eigenaarschap.

## Documentatie en verificatie

- Nieuwe requirements: `docs/requirements/<domein>/`; duurzame architectuur-/productbesluiten: ADR/FDR; acceptance evidence: `docs/quality/acceptance/runs/`.
- Houd `AA-CURRENT.md` compact (richtlijn 100–150 regels) en actueel. Werk na een afgeronde verticale slice de relevante index en implementation status bij; bewaar historische acceptance-evidence onveranderd en verwijs ernaar.
- Kies de kleinste passende gate volgens `AA-TEST.md`. Alleen wijzigingen aan zichtbare tekst/taalmodules vereisen `check:i18n`; een volledige suite/build/browserrun is geen ritueel voor docs/tooling.
- Wijzigingen aan Chromium, Playwright of PDF-tracing volgen de Function Storage-gate in `docs/AA/AA-REL.md` §6. Documentatiecommits mogen geen Vercel-build starten; de veilige `ignoreCommand` is alleen een extra buildfilter, geen deploymentblokkade.
- **AA-LEAN-02 / TEST Fast Delivery:** classificeer op **feitelijk gewijzigd gedrag**, niet op de map waarin een bestand staat: FAST (kleine cosmetische/tekstuele UI zonder contractwijziging), STANDARD (gewone feature/bugfix), CONTROLLED (auth-/OAuth-rechten of toestemmingsemantiek, tenant/RLS, schema, Payroll, security of brede shared-core-impact). De precieze minimumgates staan in `AA-TEST.md` en `AA-REL.md`.
- FAST/STANDARD/CONTROLLED blijven de risicogestuurde testgates; integratie naar GitHub `main` deployt niet. De actieve Vercel TEST-baseline blijft staan tot een expliciet geautoriseerde release. Niet-kritieke ontbrekende QA blijft OPEN; dit versoepelt geen privacy-, security- of datagrenzen.
- Eén wijziging = één afgebakende implementatie- en verificatiecyclus. Geen automatisch tweede worktree, nieuwe closeout-wave, uitgebreide documentatieset of werkboomcleanup. Hergebruik geldig bewijs; meld blokkades alleen als zij de gekozen gate werkelijk raken.
- Gebruik [`docs/DEVELOPER_TOOLKIT.md`](docs/DEVELOPER_TOOLKIT.md) voor de huidige veilige scripts. Backup/restore legacy-scripts zijn fail-closed.
