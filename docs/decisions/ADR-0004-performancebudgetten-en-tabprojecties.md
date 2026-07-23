# ADR-0004 — Performancebudgetten en tabprojecties

**Status:** AANVAARD  
**Datum:** 2026-07-23  
**Domein:** medewerker-, dienstverband- en andere URL-tabnavigatie

## Context

Een medewerkerdetailroute bestaat uit een gedeelde kaart en meerdere zware domeinen: persoonsgegevens, dienstverbanden, salaris, dossier, reminders en historie. Wanneer iedere URL-tab alle domeindata en alle permissionchecks opnieuw laadt, wordt een kleine tabwissel afhankelijk van de langzaamste en grootste query. De medewerkerlijst is bovendien hoog-cardinaliteit; collectief prefetchen kan de database en browser juist belasten.

## Besluit

1. Iedere route maakt een expliciete, getypeerde serverprojectie voor de actieve tab. Inactieve tabdata wordt niet gelezen.
2. Shelldata die op iedere tab nodig is, blijft klein en wordt niet door losse componenten opnieuw opgehaald. Onafhankelijke autorisatie- en datareads starten parallel.
3. Iedere detailroute heeft een route-segment `loading.tsx`. Dit is UX-feedback en geen vervanging voor de meting.
4. Voor nieuwe navigatie geldt als standaardbudget p75 ≤ 1.500 ms voor eerste detailnavigatie en p75 ≤ 1.000 ms voor een warme tabwissel. De meting gebruikt een ingelogde browser, een representatieve demo-medewerker en wacht op een inhoudelijk herkenningspunt (heading/tabnav), niet alleen op URL-wijziging.
5. Een medewerkerlijst gebruikt geen collectieve prefetch van alle dynamische detail- of dienstverbandlinks. Gerichte prefetch is alleen toegestaan na een gemeten voordeel zonder onaanvaardbare extra Supabaseverzoeken.
6. Een wijziging aan een bestaande projectie documenteert vóór/na-metingen in `docs/delivery/CURRENT_CONTEXT.md`. De releasegate blijft verplicht bij releasevoorbereiding en bij wijzigingen aan gedeelde infrastructuur, auth, routing, schema/RLS of kritieke businesslogica.

## Gevolgen

- Nieuwe tabs vragen een kleine dataprojectie in de service/API-laag en een gerichte routecontrole.
- Een tab kan bewust een lege niet-actieve projectie krijgen; de UI mag die data niet als geladen presenteren buiten de actieve tab.
- Security blijft onveranderd: `requirePermission()` en RLS blijven actief. Minder queries betekent nooit minder autorisatie.
- De budgetten zijn een regressiesignaal, geen harde SLA. Datasetgrootte, koude Vercel-start en externe Supabase-latentie worden bij een afwijking apart vermeld.

## Afwijzen van alternatieven

- Een globale clientcache (React Query/SWR) zou de server-gedreven URL-state en RLS-grens vertroebelen.
- Alles vooraf laden maakt iedere tab individueel simpel, maar schaalt slecht en was de directe oorzaak van onnodige detailwachtrondes.
- Collectief prefetchen op de lijst verschuift de kosten naar achtergrondverkeer en kan bij 50+ medewerkers meer queries veroorzaken dan de gebruiker ooit opent.
