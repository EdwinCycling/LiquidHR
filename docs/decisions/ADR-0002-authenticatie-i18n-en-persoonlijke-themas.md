# ADR-0002 — Authenticatie, i18n en persoonlijke thema's

Datum: 15 juli 2026  
Status: Goedgekeurd

## Context

Terugkerende magic links zijn onhandig op meerdere browsers en apparaten. Liquid HR is een gesloten multi-tenantapplicatie waarin de eerste beheerder door het platform wordt aangemaakt en daarna gebruikers uitnodigt. Taal en thema horen bij de gebruiker, niet bij een klant.

## Besluit

- Inloggen gebeurt met Google OAuth of e-mailadres en wachtwoord; magic links zijn geen normale loginmethode meer.
- Registratie geeft zonder geldige uitnodiging nooit HR-toegang. `user_access` en RLS bepalen tenant- en administratietoegang.
- Preboarding gebruikt het privé-e-mailadres dat aan de vooraf aangemaakte Employee is gekoppeld. Zakelijke gebruikers worden op hun zakelijke adres uitgenodigd.
- Een geverifieerd zakelijk adres kan later aan dezelfde auth-user en Employee worden gekoppeld; er ontstaat geen tweede persoonskaart.
- Nederlands is standaard en Engels is verplicht. Ieder namespacebestand heeft in beide talen exact dezelfde sleutels.
- Locale en één van zes thema's worden self-only in `user_preferences` opgeslagen. De HTML-root krijgt server-side `lang` en `data-theme` om een zichtbare themaflits te voorkomen.

## Gevolgen

Google-provider, redirect-URL's, eigen SMTP en leaked-password protection moeten handmatig in Supabase worden geconfigureerd. De server-only uitnodigings- en acceptatiestroom vereist `SUPABASE_SECRET_KEY`.

Vervangen besluiten: geen.
