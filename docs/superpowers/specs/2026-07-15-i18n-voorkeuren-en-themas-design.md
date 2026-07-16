# Internationalisatie, voorkeuren en thema’s

Status: goedgekeurd ontwerp, gereed voor implementatieplanning  
Datum: 15 juli 2026

## 1. Doel

Liquid HR krijgt vanaf de fundering volledige Nederlandse en Engelse UI-ondersteuning. Nederlands is de standaardtaal. Taal en thema zijn persoonlijke, tenantonafhankelijke voorkeuren die op ieder apparaat opnieuw beschikbaar zijn na inloggen.

## 2. Vertaalarchitectuur

Vertalingen staan per taal en functionele namespace in:

```text
apps/hr-suite/messages/nl/<namespace>.json
apps/hr-suite/messages/en/<namespace>.json
```

De eerste namespaces zijn `common`, `auth`, `navigation`, `settings`, `departments`, `employees`, `employment`, `validation` en `errors`.

Regels:

- Nederlands (`nl`) is de fallback en standaard.
- Engels (`en`) is altijd compleet aanwezig.
- UI-teksten, labels, validatiemeldingen, foutmeldingen, lege toestanden, e-mails en notificaties worden niet hardcoded toegevoegd.
- Nieuwe talen worden toegevoegd door een gelijkvormige taalmap te plaatsen en de ondersteunde-localesconfiguratie uit te breiden.
- Een `check:i18n`-script faalt bij ontbrekende of extra sleutels ten opzichte van Nederlands.
- Databasecodes blijven taalneutraal; presentatie gebruikt vertaalsleutels of gelokaliseerde labeltabellen.

De locale staat niet in de URL. Server Components lezen een veilige locale-cookie. Daardoor blijven routes stabiel en verschijnt bij de eerste render direct de juiste taal.

## 3. Persoonlijke voorkeuren

Er komt een tabel `user_preferences` met `auth_user_id` als primaire sleutel en minimaal:

- `locale`, initieel `nl` of `en`;
- `theme`, één van de zes ondersteunde themacodes;
- `created_at` en `updated_at`.

Deze tabel bevat bewust geen `tenant_id`. De voorkeur hoort bij de persoon en geldt dus in alle tenants en administraties waartoe die gebruiker toegang heeft.

RLS is self-only: een gebruiker kan uitsluitend zijn eigen voorkeur lezen, toevoegen en wijzigen. Een andere klant of beheerder kan deze voorkeur niet inzien of overschrijven.

Voor een nog niet ingelogde bezoeker geldt de cookie of anders `nl` en Liquid Navy. Na inloggen synchroniseert de server database en cookie. De database is dan leidend; wijzigingen worden gelijktijdig naar beide geschreven.

## 4. Themasysteem

De zes thema’s zijn:

1. `liquid-navy` — standaard, zakelijk diepblauw;
2. `noordzee` — blauwgroen;
3. `bos` — rustig groen;
4. `warm-zand` — warme neutrale tinten;
5. `aubergine` — warme paarstinten;
6. `nacht` — volwaardig donker thema.

Ieder thema definieert dezelfde semantische CSS-variabelen voor onder meer achtergrond, oppervlak, primaire actie, secundaire tekst, rand, focus, succes, waarschuwing, fout en datavisualisatie. Tailwind v4 koppelt deze variabelen via `@theme inline` aan tokens.

Componenten bevatten geen hardcoded hexwaarden. Alle zes thema’s voldoen aan zichtbare focus, voldoende contrast en herkenbare fout- en successtatussen. Het thema wordt vóór hydratatie op het document gezet om kleurflitsen te voorkomen.

## 5. Instellingeninterface

De sidebar krijgt een knop voor een toegankelijke instellingenpopup. Op mobiel gebruikt deze een vrijwel schermvullende sheet; op desktop een compacte modal.

De eerste instellingen zijn:

- taal: Nederlands of English;
- thema: zes visueel herkenbare keuzes;
- opslaan en annuleren met duidelijke feedback.

Wijzigingen worden via een Server Action verwerkt. De invoer wordt strikt gevalideerd, waarna database en cookie worden bijgewerkt en de huidige route opnieuw wordt gerenderd.

## 6. Documentatieregel

`AGENTS.md`, de architectuurindex en de omgevingsregels krijgen een permanente instructie:

- iedere nieuwe gebruikersgerichte tekst moet via het vertaalsysteem lopen;
- Nederlands en Engels worden in dezelfde wijziging bijgewerkt;
- `check:i18n` moet slagen;
- nieuwe componenten gebruiken uitsluitend thematokens.

## 7. Testcriteria

- Unit-tests voor locale- en themavalidatie, cookiegedrag en voorkeurssynchronisatie.
- `check:i18n` controleert sleutelpariteit en geldige JSON.
- RLS-tests bewijzen dat voorkeuren nooit tussen gebruikers lekken.
- Component- en browsertests controleren taalwisseling zonder URL-wijziging.
- Browsertests controleren alle thema’s, toetsenbordbediening, focus en mobiele popupweergave.
- Geen zichtbare verkeerde taal of standaardthema tijdens serverrender/hydratatie.

## 8. Opleverregel

Iedere testbare versie draait lokaal op poort 3000 en wordt daarna ook publiek als preview gedeployed. De publieke URL wordt opgenomen in `docs/delivery/IMPLEMENTATION_STATUS.md`, zodat testen vanaf iPhone en een andere laptop mogelijk is.

