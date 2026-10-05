# CONTROL02 — contextkeuze UX-notitie

## Visuele verbetering

Het post-login contextkeuzescherm sluit nu aan op de rustige LiquidHR-startflow. Een gecentreerde PageShell, herkenbare LiquidHR-markering en korte werkcontext-eyebrow leiden naar één semantische Surface. De klantomgeving en HR-groep staan in de bestaande Foundation FormField- en DropdownSelect-patronen met meer tussenruimte en helpertekst. De primaire CTA staat volbreedte op kleine schermen en naast de sessiehelper op grotere schermen.

De foutmelding “De context kon niet worden opgeslagen. Kies opnieuw.” verschijnt als inline alert met icoon, rand en live aankondiging. HR-groep blijft uitgeschakeld tot een klantomgeving is gekozen. De POST-body, foutstatusafhandeling en route naar /dashboard/start zijn ongewijzigd.

## States

- **Default:** klantomgeving en HR-groep met labels, helperteksten en primaire CTA.
- **Loading:** bestaande spinner met “Context opslaan…”, aria-busy op de kaart en uitgeschakelde velden/CTA.
- **Error:** onvolledige keuze toont de bestaande validatiemelding; een mislukte save toont exact de bestaande fouttekst inline. Een nieuwe keuze wist de foutstatus.
- **Responsive:** PageShell houdt een leesbare maximale breedte; content stapelt, en de CTA vult op kleine schermen de rij. Op desktop staat de footer-helper naast de CTA.

## Checks

- Gerichte componenttest: **1 bestand / 5 tests PASS** voor default-hiërarchie, validatiefout, mislukte save met exacte POST-scope, succesvolle navigatie en loading/disabled state.
- NL/EN-i18ncontrole: **41 namespaces PASS**.
- Strikte non-incremental TypeScript: **PASS**.
- ESLint op gewijzigde TSX-bestanden: **0 fouten**.
- git diff --check: **PASS**.
- Responsive classes zijn nagekeken in de page/form en vergeleken met de bestaande login-referentiebeelden apps/hr-suite/login-desktop.png en apps/hr-suite/login-mobile.png. Er is geen browser-screenshot of authenticated contextflow uitgevoerd; de bekende C02-CTX-013 browsercontextgate bleef ongewijzigd en is niet opnieuw onderzocht.
