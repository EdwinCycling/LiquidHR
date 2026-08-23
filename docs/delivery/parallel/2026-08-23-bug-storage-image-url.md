# LiquidHR bugfix — storage image/avatar runtime handling

Datum: 2026-08-23

Baseline: `7ef5e39dae8995eafbefcd8f2c0d9eb950c75e21`

Branch: `work/bug-storage-image-url`

Worktree: `C:\Users\Edwin\Documents\Apps\LiquidHR\.codex-worktrees\bug-storage-image-url`

Port: `3130`

## Uitkomst

De centrale image-resolver is toegevoegd in `apps/hr-suite/lib/storage/image-url.ts`.

- `storage://...` wordt nooit als browser-URL teruggegeven.
- Employee avatars gaan naar de bestaande authenticated `/api/employees/{employeeId}/avatar`-proxy.
- Company branding gaat naar de bestaande authenticated `/api/settings/company-branding/logo`-proxy.
- Geldige `http(s)://`, same-origin paths en bestaande `data:image/...`-fixtures blijven ondersteund waar dat al het contract was.
- Null, lege, malformed en niet-ondersteunde waarden worden `null`, zodat de bestaande initials/icon-fallback kan renderen.
- Legacy `storage://`-waarden worden vóór server-side signing naar een objectpad genormaliseerd.

## Trace en canonieke keten

1. `employees.avatar_url` bewaart uploads als `storage://${tenantId}/${employeeId}/${uuid}.webp`.
2. `uploadEmployeeAvatar` uploadt naar bucket `employee-avatars` en bewaart daarna de interne referentie.
3. `resolveStoredImageUrl` vertaalt die referentie naar `/api/employees/{employeeId}/avatar`; directe browser-rendering van `storage://` is daarmee uitgesloten.
4. `getEmployeeAvatar` blijft server-side geautoriseerd via `employee:read`, leest tenant + HR-groep + employee, maakt een 300-seconden Supabase signed URL en haalt de bytes server-side op.
5. De avatarroute geeft alleen image-bytes terug. Sign/object-failure geeft 404; authorization blijft 403 via `permissionErrorResponse`; een signed URL wordt niet als redirect doorgegeven.
6. Dashboard shell/profile, Employee overview, Startpage leave/absence, en branding gebruiken nu dezelfde resolver. De bestaande Employee/Talent/Calendar/organization consumers die al `employeeAvatarHref` gebruiken blijven op dezelfde proxy werken.
7. `administration_branding.logo_storage_path` wordt via dezelfde boundary naar de bestaande brandingproxy gebracht en vóór signing naar een objectpad genormaliseerd.

De eerdere acceptance-evidence meldde `storage://...jpg` met `ERR_UNKNOWN_URL_SCHEME` in de algemene layout. De exacte authenticated browserreproductie op deze branch kon niet worden uitgevoerd door de environment-blocker hieronder; de lokale regressielus dekt de gevonden browsergrens en de proxy/security-keten af.

## Regressietests

Toegevoegd:

- `lib/storage/image-url.test.ts`: storage reference, legacy whitespace, branding path, geldige web/data URL, null/empty/invalid fallback.
- `lib/employees/employee-avatar-runtime.test.ts`: employee mapping, server-side signing, signed/object failure zonder fetch-lek.
- `app/api/employees/[employeeId]/avatar/route.test.ts`: private object 404, unauthorized 403 en bytes-only response zonder `Location`.

De nieuwe red-capable test was op baseline rood door het ontbrekende resolver-seam; na implementatie zijn de gerichte storage/proxytests `11/11` groen.

## Verificatie

- Gerichte storage/proxytests: `11/11` groen.
- Representatieve bestaande tests Employee/Startpage/Talent/Absence/Calendar: `25/25` groen.
- Volledige hr-suite: `222` testbestanden, `868` tests groen.
- Strict TypeScript: groen.
- Gerichte ESLint op alle gewijzigde TS/TSX-bestanden: groen.
- Webpack productiebuild: groen, `224` routes.
- i18n: niet nodig; er is geen zichtbare tekst of taalbestand gewijzigd.
- `git diff --check`: groen.
- Schema/migration/RLS/remote storage: niet gewijzigd en niet toegepast.
- Server: niet gestart; poort 3130 was vrij en is vrij gebleven.

## Authenticated/browser acceptance

`BLOCKED BY ENVIRONMENT`.

Preflight op de exacte worktree bevestigde:

- `apps/hr-suite/.env.local`: afwezig.
- Actief proces: geen `NEXT_PUBLIC_SUPABASE_URL` en geen `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Canonical fixture-auth kon daarom niet veilig naar deze appserver worden aangesloten.
- De beschikbare root test-authfile is niet gekopieerd, gelogd of gecommit.
- `npx.cmd` is beschikbaar, maar zonder app-env is een authenticated TEST Manager-login niet uitvoerbaar.

Daarom niet uitgevoerd: TEST Manager-login, Manager dashboard/layout, employee identity/avatar, één Talent-route, één Absence/Insights-route, Default/LinkedHR, desktop en 390×844, console/network `0 ERR_UNKNOWN_URL_SCHEME`. Dit is geen product-RED en geen authenticated securitybewijs.

## Scopegrenzen

Geen datamigratie, fixturecorrectie, schemawijziging, remote apply, push, merge, deploy, version bump of centrale delivery-documentupdate uitgevoerd. Alleen dit parallelle handoff-document is toegevoegd; de lokale commit volgt zonder remote actie.
