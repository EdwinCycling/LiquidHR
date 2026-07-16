# Handmatige acties

Dit document bevat alleen acties die een eigenaar/beheerder buiten de codebase moet uitvoeren. Geheimen, wachtwoorden en tokens horen nooit in dit document of in GitHub.

## Nu nodig om volledige verificatie en deployment af te ronden

### 1. Supabase CLI-koppeling voor verificatie

Kies één route.

**Lokale testdatabase (aanbevolen voor de volgende ontwikkelslice)**

1. Installeer en start Docker Desktop voor Windows.
2. Open PowerShell en voer uit:

   ```powershell
   Set-Location "C:\Users\Edwin\Documents\Apps\HRMyDay\apps\hr-suite"
   npx supabase start
   ```

3. Controleer de containers:

   ```powershell
   npx supabase status
   ```

4. Geef daarna in deze chat door dat `supabase status` volledig healthy toont. De agent kan dan databaseproeven, advisors en typegeneratie lokaal uitvoeren.

**Bestaand Supabase-project**

1. Log lokaal in; de browser vraagt om toestemming:

   ```powershell
   Set-Location "C:\Users\Edwin\Documents\Apps\HRMyDay\apps\hr-suite"
   npx supabase login
   ```

2. Koppel het bestaande project. De CLI vraagt om het databasewachtwoord; voer dat alleen in de terminal in:

   ```powershell
   npx supabase link --project-ref wnpfloqpjvaacobppbpk
   ```

3. Geef daarna in deze chat door dat de koppeling gelukt is. De reminder-migraties zijn al live toegepast; de agent voert dan databaseproeven, advisors en `supabase gen types` uit. Gebruik alleen een dry-run voordat nieuwe, nog niet toegepaste migraties worden gepusht.

Gebruik `npx supabase db reset --linked` uitsluitend wanneer dit remote project aantoonbaar een wegwerp-testomgeving is: die opdracht verwijdert alle remote data.

### 2. Vercel aan GitHub koppelen

1. Open het Vercel Dashboard en kies **Add New → Project**.
2. Importeer GitHub-repository `EdwinCycling/LiquidHR`.
3. Gebruik `main` als production branch en de repositoryroot (`.`) als root directory.
4. Voeg deze omgevingsvariabelen toe in Vercel. Gebruik voor Preview en Production eigen, stabiele secretwaarden:

   ```text
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   NEXT_PUBLIC_APP_URL
   BSN_HASH_KEY
   EMPLOYEE_PII_ENCRYPTION_KEY
   SUPABASE_SECRET_KEY
   ```

5. Zet `NEXT_PUBLIC_APP_URL` na de eerste deployment op de uiteindelijke Vercel-URL.
6. Geef daarna de Vercel-projectnaam of deployment-URL door. De agent kan dan de build, logs en preview verifiëren.

## Productie vóór livegang

- Activeer Supabase leaked-password protection.
- Configureer een eigen SMTP-provider in Supabase voor uitnodigingen en herstelmails.
- Activeer Google OAuth en registreer de actuele Supabase callback en Vercel redirect-URL's.
- Controleer dat geen server-only secret met `NEXT_PUBLIC_` begint.
- Voer een uitnodiging-, login-, wachtwoordherstel- en autorisatieregressie uit op de publieke preview.

## Status van de punten 1 t/m 6

| Punt | Status | Wat blokkeert volledige afronding |
|---|---|---|
| 1. Klok en reminders | Gedeeltelijk | Schema, RLS, API, Tijdhub/reminderpagina en live browserflow werken. De databaseproef, advisors en CLI-typegeneratie moeten nog worden herhaald met een gekoppelde Supabase CLI. |
| 2. Dienstverbandflow | Gedeeltelijk | Atomaire multi-domeinroute, validatie en migratie zijn lokaal gereed; de migratie/test moeten nog tegen Supabase worden uitgevoerd. Basis/IKV- en organisatieformulieren, nieuwe persoonskaartflow en externe ketenhistorie volgen nog. |
| 3. Auth en deployment | Gedeeltelijk | Codebasis/GitHub zijn klaar; SMTP, Google OAuth, Vercel-koppeling en publieke verificatie ontbreken. |
| 4. Afwezigheid en workflow | Niet gestart | Leidend datamodel, API/UI en resolver ontbreken. |
| 5. Multitenancy-afwerking | Gedeeltelijk | Bestaande fundering werkt; nieuwe domeinen moeten nog tenant-/administratiescope en isolatietests krijgen. |
| 6. Documenten en compliance | Niet gestart | Schema, opslag, autorisatie, UI en compliance-audits ontbreken. |

## Versienummer

Het versienummer staat centraal in `apps/hr-suite/lib/app-version.ts` en volgt altijd `X.datum.volgnummer`.

- Huidige versie: `1.20260716.1`.
- `X` wordt uitsluitend aangepast op expliciete opdracht van de opdrachtgever.
- De datum is `JJJJMMDD`.
- Het volgnummer start iedere dag op `1` en wordt diezelfde dag ophoogd bij een versie-update.
- Bij de opdracht `update versie nr` past de agent uitsluitend dit centrale bestand aan, draait de relevante controles en pusht de wijziging naar GitHub.
