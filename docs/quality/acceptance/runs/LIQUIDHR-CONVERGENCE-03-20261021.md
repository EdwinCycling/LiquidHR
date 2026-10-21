# LIQUIDHR-CONVERGENCE-03 — lokale finale gate

Datum: 2026-10-21. Dit verslag betreft de lokale branch integration/liquidhr-unified-20261021, begonnen op 33221d36b6e16fb26e43b4e63a22adbeb2f21169. Appversie blijft 1.20261012.5. Geen push, merge naar main, deployment of databasewijziging.

## Technische controles

- Full ESLint: PASS, 0 errors en 8 warnings. De prefer-const-fout in distribution-read-service.test.ts is hersteld.
- TypeScript: PASS.
- i18n: PASS, 43 NL/EN namespaces gelijk.
- Gerichte regressietest: PASS, distribution-read-service.test.ts: 4/4.
- Focus-widgetbuild: PASS op de kandidaat met npm run build:chatgpt-focus-widget.
- Production build: PASS eerder op start-SHA 33221d36b6e16fb26e43b4e63a22adbeb2f21169. Niet opnieuw uitgevoerd na de test-only lintfix: de lokale devserver had de beschermde apps/hr-suite/next-env.d.ts automatisch gewijzigd naar .next/dev typepaden; het repositorycontract verbiedt dit bestand te wijzigen.

## Browseracceptatie lokaal

- HR Admin-startpagina: gerenderd op desktop.
- STAR Talent Insights: route en filters gerenderd; de gekozen TEST-context bevatte 0 medewerkers.
- Employee-dashboard: bestaande Medewerker-persona gerenderd op desktop.
- Payroll: /payroll retourneerde een schermfout Payroll library unavailable voor de bestaande testadministratie; de beschikbare lokale Payroll-personas hadden geen zichtbare Payroll-beheernavigatie.
- 390px/smalle kaarten: niet bewezen. De verbonden Chrome-tab bood geen viewportinstelling; Playwright CLI vond geen browserinstantie.
- Focus-widget: lokale bundle bouwt; geen AI-aanroep of remote widgetconnectie gestart.
- Geen browsermutaties aan salaris-, HR- of talentgegevens uitgevoerd.

## Migraties read-only

- 20260924143533_fix_d01_document_actor_audience_scope.sql komt in de toegepaste geschiedenis overeen met alias 20260924143939 / d01_document_actor_audience_scope; bestaande D01-evidence bevat dezelfde mapping.
- 20261014155924_core_local_payroll_persona_link is in de toegepaste geschiedenis geregistreerd als alias 20261014162631 / core_local_payroll_persona_link_v1.
- De relevante Payroll/CAO/Talent-migraties van 14–21 oktober zijn aanwezig in de toegepaste historie exact of via de eerder vastgelegde aliassen. Er is geen SQL uitgevoerd en geen schema aangepast.

## Deploymentcontrole en verdict

- vercel.json stelt git.deploymentEnabled op false.
- Vercel-project liquidhr blijft aan GitHub gekoppeld. De Vercel-instellingen tonen een actieve Deploy Hook naar branch work/ai-gpt-live; de caller kon niet worden bevestigd. De webhooklijst-API gaf 403. Er is niets ingetrokken of aangepast.
- VERDICT: HOLD. Niet versie-bumpen naar 1.20261021.1 zolang de Payroll-, 390px- en Deploy Hook-gates openstaan.
