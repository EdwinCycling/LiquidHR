# PAYRUN-ROUTE-01E — Testpersona-handoff en scopecontrole — 2026-10-21

**Eindverdict: SECURITY HOLD — HR Admin-context wijkt aantoonbaar af van Mars-only contract.** De route- en Payroll-datacontroles zijn hierom gestopt.

## Uitgevoerde browsercontrole

- Werkboom/branch: work/BRANCH-SPLIT-PAYROLL-20261021; bestaande lokale server http://127.0.0.1:3010; dezelfde bestaande Chrome-tab gebruikt.
- De canonieke persona-afspraak schrijft voor dat Test HR Admin uitsluitend Mars BV heeft en geen Jupiter-toegang. De lokale preflight scripts/check-test-personas.ps1 -SkipBrowser had de statische catalogus-/role-switchcontrole eerder geslaagd, maar markeerde runtime en credentialpreflight als BLOCKED omdat centrale lokale TEST-configuratie ontbrak. Er is niets geprovisioneerd of aangemaakt.
- Vóór de wissel toonde de bestaande lokale accountwisselaar de owner-sessie met rolcodes DIRECT_MANAGER, TENANT_ADMIN. De aanwezige doelen Lisa, Jaap, Frits en Manager zijn niet als persona ingelogd of getest.
- Via de bestaande lokale accountwisselaar is doel hr-admin geselecteerd. De flow eindigde op de dashboardroute. De lokale personaweergave toonde daarna effectieve rolcode TENANT_ADMIN; de context is dus niet de gewone Jupiter-medewerkerrol.
- De dashboardadministratiekeuze stond na deze HR Admin-handoff op Jupiter BV en bood Jupiter BV en Mars BV als keuzes. Dit is een concrete Mars-only-contractafwijking onder de Test HR Admin-sessie. De afwijking is niet toegeschreven aan een gewone Jupiter-medewerkerlogin.
- De waarneming bewijst de effectieve rol en Jupiter-selectie; de onderliggende oorzaak (autorisatietoekenning versus server-afgeleide standaardselectie) is niet geïsoleerd. Geen rechten gewijzigd.

## Bewust niet uitgevoerd na scope-afwijking

- /payroll/runs, ESS/salarisroutes, run-/periode-/medewerkerdata en routeperformance zijn niet geopend of gemeten.
- Geen negatieve Payroll-routeprobe is verstuurd. Daardoor zijn toegestane/geweigerde routes per persona nog niet bewezen.
- Lisa/Jaap/Frits stonden in de bestaande wisselaar als “Beschikbaar”; dit is alleen UI-readiness en geen bewijs van succesvolle handoff, salaris-self-scope of negatieve grenzen. Manager en de overige persona's zijn niet gewisseld.
- De browseracceptatie wordt hervat nadat de eigenaar de HR Admin/Jupiter-scope read-only heeft verklaard en een bestaande ondersteunde Mars-only-context aantoonbaar beschikbaar is.

## Integriteit en provenance

- Alleen de expliciet ondersteunde lokale Test Auth/role-switch is gebruikt; geen handmatige cookie-, Auth-, rol- of administratieaanpassing.
- Geen Payroll-mutatie, berekening, review, finalisatie, PDF-mutatie, databasewrite, productcodewijziging, push, merge of deployment uitgevoerd.
- Productcode/buildkandidaat blijft 82558de1dd1f0439c99866de261b35cbf01b85b6; deze acceptatieturn heeft geen build of tests herhaald.
