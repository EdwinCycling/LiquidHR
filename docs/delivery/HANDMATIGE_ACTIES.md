# Handmatige acties

Laatste controle: 16 juli 2026. Deel nooit wachtwoorden, API-sleutels of tokens in chat.

## Al gekoppeld

- Supabase-plugin: `LiquidHR` (`wnpfloqpjvaacobppbpk`), status `ACTIVE_HEALTHY`.
- Vercel-plugin: project `liquid-hr-hr-suite`.
- GitHub: repository `EdwinCycling/LiquidHR` is door Vercel geïmporteerd.
- HeRa-, gecombineerde dienstverband-, OrgChart- en dashboardmigraties zijn live toegepast.

Docker Desktop, `supabase login/link`, `vercel login` en opnieuw importeren zijn voor de huidige test niet nodig.

## 1. Vercel controleren

1. Open Vercel → `liquid-hr-hr-suite` → **Settings → Build and Deployment**.
2. Controleer dat **Root Directory** exact `apps/hr-suite` is.
3. Laat **Output Directory** zonder dashboard-override; de repository gebruikt `.next`.
4. Controleer onder **Environment Variables** voor Preview en Production deze namen:

   ```text
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   NEXT_PUBLIC_APP_URL
   SUPABASE_SECRET_KEY
   BSN_HASH_KEY
   EMPLOYEE_PII_ENCRYPTION_KEY
   GEMINI_KEY
   GEMINI_MODEL
   ```

5. `GEMINI_MODEL` moet exact `gemini-3.1-flash-lite` zijn. Meld alleen ontbrekende namen, nooit waarden.

## 2. Supabase voor livegang

1. Open Supabase → `LiquidHR` → **Authentication → Providers → Password**.
2. Schakel **Leaked password protection** in; dit is de enige actuele Security Advisor-waarschuwing.
3. Configureer vóór echte gebruikers een eigen SMTP-provider.
4. Voor Google OAuth gebruik je callback `https://wnpfloqpjvaacobppbpk.supabase.co/auth/v1/callback` en voeg je de definitieve Vercel-URL aan de redirect-allowlist toe.

## 3. Grote functionele test

1. Test Dashboard als startpagina en maak/bewerk/wissel/dupliceer/verwijder dashboards.
2. Maak een reminder, open hem vanuit de sidebar en test Gereed, Uitstellen, Verbergen en Reminderbeheer.
3. Test OrgChart zoeken en filters; drag-and-drop hoort niet in deze versie.
4. Test HeRa: gesprek, reminderconcept met bevestiging, export en verwijderen.
5. Herhaal de hoofdflows op 390 px breedte.
6. Geef per onderdeel `geslaagd` of de exacte foutmelding en pagina-URL door.

## Alleen als Git-push niet werkt

Voer eenmalig `gh auth login` en `gh auth status` uit en deel alleen de accountnaam.

Het centrale versienummer staat in `apps/hr-suite/lib/app-version.ts` en volgt `X.datum.volgnummer`. Huidige versie: `1.20260716.3`.
