# Handmatige acties

Laatste controle: 16 juli 2026. Dit document bevat alleen acties die niet veilig vanuit de code of de gekoppelde plugins kunnen worden uitgevoerd. Deel nooit wachtwoorden, API-sleutels of tokens in chat.

## Wat al gekoppeld is

- Supabase-plugin: verbonden met project `LiquidHR` (`wnpfloqpjvaacobppbpk`), status `ACTIVE_HEALTHY`.
- Vercel-plugin: verbonden met project `liquid-hr-hr-suite`.
- GitHub-repository: `EdwinCycling/LiquidHR` is als remote ingesteld en door Vercel geïmporteerd.
- De HeRa-, gecombineerde dienstverband-, OrgChart- en persoonlijke dashboardmigraties zijn live toegepast.

Docker Desktop, `supabase login`, `supabase link`, `vercel login` en opnieuw importeren in Vercel zijn voor de huidige grote test dus niet nodig.

## Actie 1 — Vercel-instellingen controleren

1. Open Vercel en kies project `liquid-hr-hr-suite`.
2. Open **Settings → Build and Deployment**.
3. Controleer dat **Root Directory** exact `apps/hr-suite` is.
4. Controleer dat **Output Directory** niet handmatig wordt overschreven. De repository bevat nu de juiste waarde `.next`.
5. Open **Settings → Environment Variables** en controleer voor zowel Preview als Production de aanwezigheid van:

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

6. Controleer dat `GEMINI_MODEL` exact `gemini-3.1-flash-lite` is.
7. Stuur alleen terug welke namen ontbreken; stuur geen waarden.

## Actie 2 — Supabase-beveiliging voor livegang

1. Open Supabase-project `LiquidHR`.
2. Ga naar **Authentication → Providers → Password**.
3. Schakel **Leaked password protection** in. Dit is de enige actuele Security Advisor-waarschuwing.
4. Configureer vóór gebruik met echte personen een eigen SMTP-provider onder **Authentication → SMTP**.
5. Activeer Google OAuth alleen wanneer dit getest moet worden. Gebruik callback:

   ```text
   https://wnpfloqpjvaacobppbpk.supabase.co/auth/v1/callback
   ```

6. Voeg localhost en de definitieve Vercel-URL toe aan de toegestane redirect-URL's.
7. Meld alleen: `leaked passwords aan/uit`, `SMTP gereed/niet gereed`, `Google OAuth aan/uit`.

## Actie 3 — Functionele acceptatietest

Na een geslaagde nieuwe Vercel-deployment:

1. Log in en controleer dat Dashboard de persoonlijke startpagina is.
2. Maak, benoem, wissel, bewerk, dupliceer en verwijder een testdashboard. Vernieuw tussendoor om opslag te controleren.
3. Maak een reminder één minuut in de toekomst. Open hem vanuit de sidebar en test **Gereed**, **15 min uitstellen**, **Verbergen** en **Reminderbeheer**.
4. Open OrgChart vanuit de linkerbalk en test zoeken en filters; drag-and-drop hoort bewust niet in deze versie.
5. Open HeRa, maak een gesprek, laat HeRa een reminderconcept voorstellen, bevestig het, exporteer het gesprek en verwijder het gesprek.
6. Herhaal de hoofdflows op ongeveer 390 px breedte en controleer dat geen horizontale scroll ontstaat.
7. Geef per onderdeel `geslaagd` of de exacte foutmelding en pagina-URL door.

## Alleen indien Git-push vanaf deze computer niet werkt

Voer dan eenmalig uit:

```powershell
gh auth login
gh auth status
```

Deel daarna alleen de GitHub-accountnaam, nooit een token.

## Versienummer

Het centrale versienummer staat in `apps/hr-suite/lib/app-version.ts` en volgt `X.datum.volgnummer`. Huidige versie: `1.20260716.3`.
