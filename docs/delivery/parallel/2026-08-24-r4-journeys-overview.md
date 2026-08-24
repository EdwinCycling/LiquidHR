# R4 Journeys live overview — overdracht

## Scope

- Branch: `work/r4-journeys-overview`
- Baseline: `main` / `1471aa224e2318b0c216d95e16b2ba1c4cd3ec64`
- Route: `/journeys`
- Testprefix: `R4-JNY-LIVE`
- Geen schemawijziging, migration apply, mutation of nieuwe fixturedata.
- Buiten scope gebleven: `/journeys/new`, template catalog/designer, steps en participant mutations.

## Implementatie

- `/journeys` gebruikt nu de Foundation v1.2 page shell, page header, filter bar, surfaces, badges, buttons, empty state en dropdown.
- Live management projection toont status, attention state, progress, target, participants, anchor date, next moment en detail drilldown.
- Participant projection toont uitsluitend de actor-safe participant projection, met self/participant-relatie, progress, participants, next action en detail drilldown.
- Search en statusfilter zijn URL-state; zoeken omvat template, target en participant-context. No-results heeft een herstelactie.
- Bestaande `journey:read`/participant-semantiek en aparte `journey:write`-weergave van `/journeys/new` zijn behouden. Er zijn geen permissions toegevoegd.
- Progress wordt uit de live topic-statussen afgeleid; er is geen extra mutation-pad.
- Route-specifieke decorative shadow/lift is verwijderd; Foundation overlay/surface tokens blijven leidend.

## Acceptance

- HR management: groen op desktop en 390×844; `/journeys` en `/journeys/:id` zijn gecontroleerd, inclusief status, attention, progress, participants, next moment, search, no-results en drilldown.
- Manager: groen op desktop; geen management-nav of `Journey starten`, wel actor-safe `Jouw Journeys` met deelname, progress, team en next action.
- Employee: groen op desktop; self rows tonen `Mijn Journey`, participant rows `Deelname`, zonder management controls.
- Interactieve statuskeuze `Actief` submitteert naar `?q=&status=ACTIVE`; URL/direct render toont alleen de geselecteerde status.
- 390×844: `window.innerWidth=390`, `window.innerHeight=844`, `document.documentElement.scrollWidth=390`; geen horizontale overflow.
- Console: HR, Manager en Employee bevatten alleen normale React DevTools/HMR-logs; geen console errors.
- Long-name layout is structureel afgedekt met `min-w-0`, `break-words` en responsive grids.

## Verification

- Gerichte tests: 3 files, 10 tests groen.
- Volledige hr-suite tests: 236 files/tests groen / 906 assertions groen.
- Strict TypeScript: `npx tsc --noEmit --incremental false --pretty false` groen. Het workspace incremental typecheck-commando kon in de tijdelijke worktree geen `.tsbuildinfo` schrijven (`EPERM`); dat is omzeild zonder code- of configuratiewijziging.
- i18n: `33 namespaces met gelijke NL/EN-sleutels`.
- ESLint: volledig groen met 0 errors en 8 bestaande warnings buiten deze slice; gerichte lint voor alle gewijzigde code groen.
- `git diff --check`: groen.

## Handoff en cleanup

- Alleen deze parallel-handoff is toegevoegd; centrale delivery- en statusdocumenten zijn niet gewijzigd.
- De canonical `.env.local` is niet naar de worktree gekopieerd: de secret-guard blokkeerde die persistente duplicatie. Voor browseracceptance zijn dezelfde lokale env-waarden alleen process-scoped aan de devserver meegegeven; geen secretwaarden zijn gelogd of gecommit.
- Geen remote write, push, merge, deploy of databaseactie uitgevoerd.
- Browser-sessies en devserver worden vóór overdracht gestopt; de gevraagde worktree wordt teruggezet naar `C:\Users\Edwin\Documents\Apps\LiquidHR.codex-worktrees\r4-journeys-overview`.
