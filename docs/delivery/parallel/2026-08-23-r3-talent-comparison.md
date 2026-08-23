# Roadmap 3 — Talent Comparison workspace

Datum: 2026-08-23

- Baseline: `7ef5e39dae8995eafbefcd8f2c0d9eb950c75e21`
- Worktree: `.codex-worktrees/r3-talent-comparison`
- Branch: `work/r3-talent-comparison`
- Runtime: poort `3123`

## Implemented

- `/workforce/talent/comparison` en het bestaande `/settings/talent/comparison` gebruiken dezelfde verbeterde `TalentComparisonWorkspace`.
- Zoekbare, keyboard-bereikbare employee- en profile/version-selects met GET URL-state; `employeeId` en `profileVersionId` blijven behouden bij refresh/readback.
- Requirements tonen target/current, requirement type, outcome, rationale, source record/type en geldigheid.
- `MATCH`, `GAP`, `MISSING_EVIDENCE` en `UNKNOWN` blijven de bestaande service-outcomes; er zijn geen scores of matchingregels toegevoegd.
- Employee-, profile-, job group- en current-scope-context zijn zichtbaar; bestaande employee/profile-links blijven binnen hun bestaande routecontracten.
- Explicit zero, empty en read-error states; desktop gebruikt een interne scrollbare matrix en mobiel een kaartweergave zonder page overflow.
- Default en LinkedHR gebruiken dezelfde Foundation/token-contracten; focus-states en Lucide-statusiconen zijn toegevoegd.
- Service-DTO uitgebreid met `asOf`, current values en bronmetadata voor bestaande RELEASED/current records. Formules en permissioncontracten zijn niet gewijzigd.
- Alleen `comparison...`-i18n-sleutels toegevoegd in NL/EN.
- Geen schema, migration, RLS, remote apply, generic Foundation, andere Talent-workspace, centrale docs of version bump gewijzigd.

## Verificatie

- Component- en schema-tests: 2 files, 4 tests passed.
- TypeScript: `npm.cmd run type-check` vanuit `apps/hr-suite` — groen.
- i18n: `npm.cmd run check:i18n --workspace @liquid-hr/hr-suite` — 33 namespaces met gelijke NL/EN-sleutels.
- Lint: gerichte ESLint op gewijzigde comparison files — groen.
- `git diff --check` — exit 0; alleen bekende LF/CRLF-normalisatieberichten.
- Anonymous preflight: route 307 naar login; `GET /api/talent/comparison` 401.

## Real acceptance evidence

- TEST HR Admin: comparison page 200, authenticated API 200, console errors 0, page errors 0. De live workspace bevatte 58 employees en 6 profiles.
- HR: drie geldige employee/profile-combinaties via URL-state gaven page/API 200; refresh/readback van beide queryparameters is bevestigd. Requirements en bestaande outcome-semantiek werden gelezen.
- TEST Manager: comparison page 200, authenticated API 200, console errors 0, page errors 0. De actuele Manager-fixture exposeert 5 scoped employees en 0 profiles; de bestaande no-profiles zero-state is daardoor bewezen. Er is geen profieldata of algoritme verzonnen.
- TEST Employee: final page `/geen-toegang` en API 403; console errors 0, page errors 0.
- HR Default `liquid-navy` en LinkedHR `linkedhr` zijn browsermatig geladen. Bij 390×844 waren document- en body-scrollwidth beide 390; geen horizontale page-scroll.

## Open / blocked

- De Manager-fixture heeft in deze actuele TEST-dataset geen actieve profiles, waardoor een positieve Manager employee/profile-combinatie niet uitvoerbaar was. Dit is als data-zero-state vastgelegd; geen productsemantiek is aangepast.
- De eerste `agent-browser`/Playwright CLI-daemon kon door lokale EPERM/CDP-problemen niet starten. De acceptance is daarom uitgevoerd met de lokaal geïnstalleerde Playwright Chromium-fallback; geen secrets zijn gelogd.

## Delivery

- Canonical `apps/hr-suite/.env.local` is tijdelijk naar deze worktree gekopieerd; inhoud/secrets zijn niet gelogd of gecommit.
- Server op poort 3123 wordt vóór commit/oplevering gestopt.
- Geen push, merge of deploy uitgevoerd.
