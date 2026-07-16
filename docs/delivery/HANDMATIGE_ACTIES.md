# Handmatige acties

Dit document bevat alleen acties die een eigenaar/beheerder buiten de codebase moet uitvoeren. Geheimen, wachtwoorden en tokens horen nooit in dit document of in GitHub.

## Uitvoerbaar stappenplan voor Edwin

Voer de stappen hieronder in deze volgorde uit. Geef na elke afgeronde stap in deze chat alleen het gevraagde resultaat door; plak nooit sleutels, wachtwoorden, tokens of volledige terminaluitvoer met secrets.

### Stap 1 — GitHub CLI installeren en aanmelden

1. Installeer GitHub CLI voor Windows via [cli.github.com](https://cli.github.com/) of voer in een nieuwe PowerShell uit:

   ```powershell
   winget install --id GitHub.cli
   ```

2. Sluit PowerShell volledig, open een nieuwe PowerShell en controleer de installatie:

   ```powershell
   gh --version
   ```

3. Log in op jouw GitHub-account en kies bij de vragen voor `GitHub.com`, `HTTPS` en browser-based login:

   ```powershell
   gh auth login
   ```

4. Controleer de aanmelding:

   ```powershell
   gh auth status
   ```

5. Geef door: `GitHub CLI klaar`, plus alleen de accountnaam die `gh auth status` noemt. Daarna kan ik de huidige branch pushen en een pull request naar `main` voorbereiden.

### Stap 2 — Supabase voor de HeRa-migratie beschikbaar maken

Kies **één** route: lokaal met Docker is het veiligst; remote gebruiken mag alleen als dit project een testomgeving is of je de productie-impact begrijpt.

#### Route A: lokale Supabase via Docker Desktop

1. Start Docker Desktop en wacht totdat de status `Engine running` toont.
2. Open PowerShell en ga naar de hoofdwerkmap:

   ```powershell
   Set-Location "C:\Users\Edwin\Documents\Apps\HRMyDay\apps\hr-suite"
   ```

3. Start de lokale stack:

   ```powershell
   npx supabase start
   ```

4. Controleer of alle containers healthy zijn:

   ```powershell
   npx supabase status
   ```

5. Geef door: `Lokale Supabase healthy`. Ik voer daarna de nieuwe HeRa-migratie, RLS-test, advisors en typegeneratie uit.

#### Route B: bestaand remote Supabase-testproject

1. Ga naar dezelfde map:

   ```powershell
   Set-Location "C:\Users\Edwin\Documents\Apps\HRMyDay\apps\hr-suite"
   ```

2. Meld de Supabase CLI aan. De browser vraagt toestemming:

   ```powershell
   npx supabase login
   ```

3. Koppel het bestaande project. Vul een databasewachtwoord uitsluitend in de terminal in:

   ```powershell
   npx supabase link --project-ref wnpfloqpjvaacobppbpk
   ```

4. Controleer eerst welke migraties zouden worden uitgevoerd; voer dit commando niet uit wanneer de output onverwacht is:

   ```powershell
   npx supabase db push --dry-run
   ```

5. Geef door: `Supabase remote gekoppeld, dry-run gecontroleerd`. Ik beoordeel de lijst en voer pas daarna de daadwerkelijke push uit.

### Stap 3 — Vercel aan GitHub koppelen

Doe deze stap nadat GitHub CLI is aangemeld en de branch is gepusht.

1. Open [vercel.com/new](https://vercel.com/new) en meld aan met het GitHub-account dat toegang heeft tot `EdwinCycling/LiquidHR`.
2. Kies **Import Git Repository** en selecteer `EdwinCycling/LiquidHR`.
3. Laat **Root Directory** op `.` staan en gebruik `main` als production branch.
4. Voeg onder **Settings → Environment Variables** onderstaande namen toe voor zowel `Preview` als `Production`. Neem de bestaande lokale waarden over, maar publiceer geen waarde in chat of Git:

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

5. Zet `GEMINI_MODEL` exact op `gemini-3.1-flash-lite`.
6. Zet `NEXT_PUBLIC_APP_URL` eerst op de Vercel-preview-URL en vervang hem na de productiedeployment door de definitieve product-URL.
7. Deploy het project en geef door: `Vercel gekoppeld` plus uitsluitend de deployment-URL. Ik controleer dan buildlogs en de publieke werking.

### Stap 4 — Verplichte Supabase- en auth-instellingen

1. Open je Supabase-project → **Authentication** → **Providers / Password** en schakel **Leaked password protection** in.
2. Configureer onder **Authentication → SMTP** een eigen SMTP-provider voordat uitnodigingen of wachtwoordherstel naar echte personen gaan.
3. Activeer Google alleen wanneer je Google-login wilt testen. Voeg dan de Supabase callback en de actuele localhost/Vercel-redirects toe aan de allowlist.
4. Geef door welke onderdelen zijn ingeschakeld: `leaked passwords`, `SMTP`, `Google OAuth`. Stuur geen screenshots met secrets.

### Stap 5 — Functionele acceptatietest na deployment

Meld je in een normale browser aan en voer uit:

1. Open de linkerbalk. Controleer dat **HeRa**, **Medewerkers**, **Afdelingen** en **OrgChart** plat onder elkaar staan; OrgChart moet zichtbaar zijn.
2. Maak een persoonlijke reminder die één minuut in de toekomst ligt.
3. Klik de reminder in de sidebar. Controleer titel, toelichting, tijd, typebadge, **Gereed**, **15 min uitstellen**, **Verbergen** en **Reminderbeheer**.
4. Klik **Reminderbeheer** en controleer dat de juiste reminder op de overzichtspagina zichtbaar is.
5. Open HeRa, maak een gesprek, exporteer het gesprek en verwijder het daarna. Bevestig alleen een reminderconcept dat je zelf hebt gecontroleerd.
6. Test dezelfde flow op mobiele breedte (ongeveer 390 px); controleer dat de popup geen horizontale scroll heeft en de acties onder elkaar kunnen staan.
7. Geef per punt `geslaagd` of de exacte foutmelding/URL door. Dan kan ik gericht eventuele laatste fouten herstellen.

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

3. Geef daarna in deze chat door dat de koppeling gelukt is. De reminder- en HeRa-migraties moeten dan worden gecontroleerd; de agent voert databaseproeven, advisors en `supabase gen types` uit. Gebruik alleen een dry-run voordat nieuwe, nog niet toegepaste migraties worden gepusht.

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
   GEMINI_KEY
   GEMINI_MODEL=gemini-3.1-flash-lite
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

Voor de GitHub/Vercel-publicatie ontbreekt op deze werkplek nog externe aanmelding: installeer of maak `gh` beschikbaar en voer `gh auth login` uit; voer daarna `npx vercel login` uit en voltooi de device-flow. Vervolgens kan de agent branch `agent/points-1-6` veilig pushen en het GitHub-project aan Vercel koppelen.

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

- Huidige versie: `1.20260716.2`.
- `X` wordt uitsluitend aangepast op expliciete opdracht van de opdrachtgever.
- De datum is `JJJJMMDD`.
- Het volgnummer start iedere dag op `1` en wordt diezelfde dag ophoogd bij een versie-update.
- Bij de opdracht `update versie nr` past de agent uitsluitend dit centrale bestand aan, draait de relevante controles en pusht de wijziging naar GitHub.
