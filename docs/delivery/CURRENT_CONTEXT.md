# Actuele overdracht Liquid HR

Laatste update: 2026-07-18. Dit is het compacte startpunt voor iedere nieuwe of geforkte chat. Lees daarna `docs/README.md`; neem geen secrets in documentatie op.

## Vaste architectuur

Liquid HR is een Nederlandstalig, i18n-klaar HR/payrollplatform op Next.js, Supabase en strict TypeScript. Bouwvolgorde is `schema → API → UI`. Tenantgrenzen zijn absoluut, autorisatie wordt server-side én met RLS afgedwongen en zichtbare tekst komt uit paritaire NL/EN-taalbestanden.

## Actuele stand

- Medewerkers, dienstverbanden, IKV, organisatie, permissions, effectieve tijdlijnen, reminders en HeRa-basis zijn aanwezig.
- De vijfstappenwizard publiceert een volledig dienstverband atomair: Employment, IKV-koppeling, plaatsing, arbeidsvoorwaarden, rooster, optioneel salaris en kostenverdeling van exact 100%.
- Functiegroepen, functies, effective-dated functierevisies en salarisschaalrevisies met een vrij aantal treden zijn per administratie beheerbaar. Gepubliceerde revisies zijn onveranderlijk.
- Iedere medewerker heeft een veilig documentdossier met private opslag, metadata, tags, gecombineerde zichtbaarheid, signed downloads, soft-delete/herstel en vervalreminders voor persoon/rol/afdelingstak.
- De dienstverbanddetailpagina bevat een responsieve tijdkaart. `/hr-calendar` biedt een groot maandraster en mobiele agenda met HR-wijzigingen. Salarisbedragen worden niet in de gedeelde eventprojectie opgenomen.
- Het autorisatiescherm heeft drie werkruimtes: rechten beheren met zoek- en groepsacties, een grafische rollen/functionaliteits-heatmap en afzonderlijke organisatietoewijzingen. De visualisatie is presentatie; API, permissions, scope en RLS blijven beslissend.
- Applicatieversie: `1.20260718.2`.
- Actieve featurebranch: `codex/hera-data-agent`. Featurecommits: `08de9b3` en `67393ec`; documentatie-/afrondcommit volgt in dezelfde branch.

## Live database en verificatie

- Supabase-project `wnpfloqpjvaacobppbpk` is gezond. De migraties `20260718090000` t/m `20260718132000` voor deze slice zijn live toegepast.
- Live SQL-proeven geslaagd: volledige dienstverbandflow, functie/salarisrevisies, documentdossiers, HR-change-projectie en kalenderautorisatie.
- Vitest: 52 bestanden, 201 tests geslaagd.
- `check:i18n`: 18 namespaces gelijk voor NL/EN. Strict TypeScript, ESLint en productiebuild (42 pagina's) zijn geslaagd.
- Supabase security advisor meldt alleen uitgeschakelde leaked-password protection. Deze functie is volgens Supabase alleen beschikbaar vanaf Pro en is binnen het huidige abonnement niet inschakelbaar; dit is een geaccepteerde abonnementsbeperking. Nieuwe tabellen hebben RLS; de reminder-target policies zijn per mutatie gesplitst om dubbele permissive SELECT-policies te voorkomen.
- Lokale app draait bij overdracht op `http://localhost:3000` (processtatus altijd opnieuw controleren).
- Publieke preview: `https://liquidhr-git-codex-hera-data-agent-edwinitsolutions.vercel.app`. Login en mobiele 390px-layout zijn gecontroleerd. Beschermde previewflows konden niet zonder een hostspecifieke ingelogde sessie worden doorlopen.

## Bewust resterend werk

1. Basis/IKV en organisatieplaatsing zijn op de bestaande dienstverbanddetailtabs nog read-only; de volledige aanmaak/publicatieflow is wel gereed.
2. Nieuwe persoonskaart vanuit de dienstverbandflow bij geen identity-match.
3. Externe ketenhistorie en cao-uitzonderingen beheren.
4. Globale documenten, bulk-loonstrookimport en AI-compliance/OCR/RAG.
5. Vrije Liquid Display-query's en uitgebreidere HeRa-tools.

## Handmatige productieacties

- Heroverweeg Supabase leaked-password protection alleen bij een toekomstige upgrade naar Pro of hoger.
- Configureer SMTP, Google OAuth/redirects en de vereiste stabiele server-only secrets per omgeving.
- Log afzonderlijk in op de branch-preview om de beschermde flows visueel end-to-end te controleren.

Zie `docs/delivery/HANDMATIGE_ACTIES.md` voor de beheerde externe actielijst. Dit bestand is gebruiker-eigendom en is in deze slice niet overschreven.

## Hervatten

1. Lees `AGENTS.md`, `docs/README.md` en dit bestand.
2. Controleer werkboom, branch, poort 3000, Supabase-migraties en previewstatus opnieuw.
3. Gebruik `docs/delivery/IMPLEMENTATION_STATUS.md` en de relevante requirements als waarheid voor resterend werk.
4. Werk na iedere materiële slice dit bestand, de status en de requirements bij.
