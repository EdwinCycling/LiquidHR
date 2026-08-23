# Bugfix unauthorized routes — 2026-08-23

## Scope

- Branch: `work/bug-unauthorized-routes`
- Worktree: `.codex-worktrees/bug-unauthorized-routes`
- Baseline: `7ef5e39dae8995eafbefcd8f2c0d9eb950c75e21`
- Lokale serverpoort: `3129`
- Geen push, merge, deploy, version bump, schema-, RLS- of permissionwijziging.

## Root cause en implementatie

`/absence/new` en `/authorization` deden hun route-level `requireAnyPermission()`/`requirePermission()` zonder de bestaande `AuthorizationError`-catch. De dashboard-layout vangt alleen authenticatie- en contextfouten tijdens het laden van de layout; een `AuthorizationError` uit een child page bereikt daarom de generieke Next server-errorafhandeling.

Beide pagina’s gebruiken nu het bewezen routepatroon van Star Performers/Talent:

```ts
try {
  await requirePermission(...)
} catch (error) {
  if (error instanceof AuthorizationError) redirect('/geen-toegang')
  throw error
}
```

Voor `/absence/new` is hetzelfde patroon toegepast rond `requireAnyPermission(['absence:write'])`. Overige errors blijven rethrowen. API-routes zijn niet gewijzigd.

Regressietests:

- `apps/hr-suite/app/(dashboard)/absence/new/page.test.tsx`
- `apps/hr-suite/app/(dashboard)/authorization/page.test.tsx`

## Lokale gates

- Gerichte regressietests: **GREEN — 2/2 tests**
- Strict TypeScript: **GREEN**
- i18n: **GREEN — 33 gelijke NL/EN-namespaces**
- ESLint: **GREEN — 0 errors, 8 bestaande warnings**
- `git diff --check`: **GREEN**

## Environment/auth preflight

- TEST fixture-auth uitgevoerd met de canonical `TALENT_*_PASSWORD`-keys; alleen fixture-accounts `hr-admin`, `manager` en `employee` zijn gesynchroniseerd.
- Env-key-namen zijn gecontroleerd; waarden, wachtwoorden, tokens en cookies zijn niet gelogd of gecommit.
- `.env.local` is niet naar de worktree gekopieerd; de lokale server gebruikte alleen proces-env-injectie vanuit de bestaande hoofdwerkplek.
- Tijdelijke Employee-themawijziging naar Liquid Navy is voor de matrix uitgevoerd en daarna via de bestaande personal-settings-flow naar LinkedHR teruggezet.

## Authenticated browserbewijs

Fresh contexts zijn gebruikt per persona/run. De access-denied-surface had op desktop en 390×844 geen horizontale overflow, focus op de Uitloggen-button en `axe` 0 violations.

| Persona / viewport / theme | `/absence/new` | `/authorization` | Resultaat |
|---|---|---|---|
| Employee / 1280×800 / Liquid Navy | `/geen-toegang`, geen generic error | `/geen-toegang`, geen generic error | GREEN |
| Employee / 390×844 / Liquid Navy | `/geen-toegang`, geen generic error | `/geen-toegang`, geen generic error | GREEN |
| Employee / 1280×800 / LinkedHR | `/geen-toegang`, geen generic error | `/geen-toegang`, geen generic error | GREEN |
| Employee / 390×844 / LinkedHR | `/geen-toegang`, geen generic error | `/geen-toegang`, geen generic error | GREEN |
| HR / 1280×800 / Liquid Navy | HTTP 200, normale heading | HTTP 200, normale heading | GREEN |
| HR / 390×844 / LinkedHR | HTTP 200, normale heading | HTTP 200, normale heading | GREEN |
| Manager / 1280×800 / Liquid Navy | HTTP 200, normale heading | `/geen-toegang`, geen generic error | GREEN |

De `/dashboard/start` sanity gate gaf voor alle gecontroleerde personas HTTP 200 met normale hoofdcontent. De fresh UI-runs rapporteerden 0 console-errors. Een bewust uitgevoerde Employee negatieve API-fetch naar `/api/roles` gaf de verwachte browser-resourcewaarschuwing door HTTP 403; die is niet als UI-regressie gerekend.

API-contractcontrole met Employee:

- `GET /api/roles`: **403**
- `POST /api/roles` met geldige rolpayload: **403**

## Eindstatus

- Implementatie: **DONE**
- Lokaal geverifieerd: **GREEN**
- Authenticated browseracceptance: **GREEN** voor de gevraagde matrix
- Open: geen bugfix-specifieke blockers
- Release/deployment: niet uitgevoerd volgens opdracht
- Server: gestopt
