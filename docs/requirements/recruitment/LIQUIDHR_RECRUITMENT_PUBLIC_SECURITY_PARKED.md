# LiquidHR Recruitment — publieke securityconfiguratie parkeren

**Status:** geparkeerd / later oppakken  
**Fase:** development & test  
**Datum:** 2026-08-13

## Aanleiding

Guided Recruitment is functioneel geïmplementeerd en lokaal/remote grotendeels geverifieerd.

De publieke sollicitatieflow bevat bewust een fail-closed beveiligingsgrens voor:

- bot/spambeveiliging;
- rate limiting;
- malwarecontrole op geüploade CV's/documenten.

De benodigde externe configuratie is op dit moment nog niet aanwezig.

Omdat LiquidHR zich nog in development/test bevindt en de publieke sollicitatieflow nog niet productie-open hoeft te staan, wordt dit **bewust geparkeerd**.

Dit is geen open product- of architectuurprobleem. De beveiligingsboundary bestaat al en blijft zonder configuratie veilig gesloten.

---

## Ontbrekende configuratie

De Recruitment-implementatie verwacht de volgende environment variables:

```text
NEXT_PUBLIC_TURNSTILE_SITE_KEY
TURNSTILE_SECRET_KEY
RECRUITMENT_RATE_LIMIT_PEPPER
RECRUITMENT_MALWARE_SCAN_URL
RECRUITMENT_MALWARE_SCAN_API_KEY
```

### Cloudflare Turnstile

Doel:

- bot- en spambeveiliging van het publieke sollicitatieformulier;
- client-side challenge/token;
- server-side verificatie vóór een sollicitatie wordt verwerkt.

Later nodig:

- dev/test of productie Turnstile-configuratie;
- site key;
- secret key;
- configuratie van toegestane LiquidHR-hostnames.

### Recruitment rate-limit pepper

Doel:

- veilige hashing van signalen die voor rate limiting worden gebruikt;
- voorkomen dat ruwe netwerk-/identificerende waarden als rate-limitidentifier hoeven te worden opgeslagen.

Later nodig:

- één cryptografisch sterke willekeurige secret;
- uitsluitend opslaan als server-side environment secret;
- nooit committen in Git of opnemen in documentatie/logs.

### Malware scanner

Doel:

- publieke uploads zoals CV's eerst in quarantaine verwerken;
- type/MIME/signature/sizecontrole uitvoeren;
- bestand pas na succesvolle malwarecontrole als `CLEAN` beschikbaar maken;
- besmette, onbekende of niet-verifieerbare bestanden fail-closed weigeren.

Later nodig:

- keuze voor een geschikte malware-scanprovider;
- voorkeur voor een privacygeschikte/private scanoptie vanwege persoonsgegevens in CV's;
- API-endpoint;
- API-key;
- controle van dataverwerking, bewaartermijn en regio voordat productiegebruik wordt toegestaan.

---

## Huidig gedrag

Zonder bovenstaande configuratie:

- publieke vacatureweergave mag functioneren;
- Recruitment HR-functionaliteit mag functioneren;
- publieke intake mag **niet** onbeveiligd worden doorgelaten;
- publieke submit/upload blijft fail-closed;
- er mag geen bypass, dummy scanner of hardcoded testsecret aan productcode worden toegevoegd.

De bekende foutstate bij ontbrekende publieke securityproofs is onderdeel van het veilige gedrag.

---

## Wanneer opnieuw oppakken

Dit onderwerp opnieuw openen zodra één van deze momenten aanbreekt:

1. Guided Recruitment wordt voorbereid voor productie;
2. een publiek LiquidHR-sollicitatieformulier extern bereikbaar moet worden;
3. echte externe kandidaten documenten moeten kunnen uploaden;
4. een algemene LiquidHR-platformvoorziening voor publieke uploads wordt ingericht.

Tot dat moment is geen verdere actie nodig.

---

## Aanpak wanneer we dit later activeren

### Stap 1 — provider/configuratie kiezen

- Turnstile configureren;
- sterke `RECRUITMENT_RATE_LIMIT_PEPPER` genereren;
- malware-scanprovider selecteren;
- privacy/securityvoorwaarden controleren.

### Stap 2 — dev/test configureren

Configureer de vijf environment variables uitsluitend in de development/testomgeving.

Gebruik geen echte kandidaatgegevens voor de verificatie.

### Stap 3 — releasegate uitvoeren

Bewijs minimaal:

- geldige Turnstile-verificatie;
- ongeldige/ontbrekende challenge wordt geweigerd;
- rate limiting werkt;
- veilige synthetische upload bereikt quarantaine;
- scanner geeft `CLEAN` voor veilige testfile;
- besmet/ongeldig/scanner-onbereikbaar blijft fail-closed;
- alleen `CLEAN` documenten kunnen via de geautoriseerde Recruitment-route worden geopend;
- geen storage-object-URL of secret lekt naar client/logs;
- één volledige synthetische publieke sollicitatie doorloopt de happy path.

Pas daarna mag de publieke Recruitment-releasegate als GREEN worden beschouwd.

---

## Architectuurregel voor later

Deze functionaliteit bij voorkeur niet opnieuw als Recruitment-specifieke oplossing ontwerpen wanneer andere LiquidHR-modules eveneens publieke uploads nodig krijgen.

Onderzoek dan of Turnstile/rate limiting/malware scanning als gedeelde **LiquidHR public-ingestion security service** kan worden gebruikt, met Recruitment als eerste consumer.

De bestaande Recruitment-contracten en fail-closed boundary blijven daarbij leidend; niet opnieuw ontwerpen zonder concrete reden.

---

## Besluit 2026-08-13

**Parkeren.**

LiquidHR bevindt zich nog in testfase. De externe Turnstile-, rate-limit- en malwarescannerconfiguratie is nog niet nodig voor de huidige ontwikkelwerkzaamheden.

Geen tijdelijke bypass implementeren.  
Geen productiecredentials regelen totdat de publieke Recruitment-flow richting productie gaat.
