# Bestaande medewerker gebruiken in de medewerkerwizard

## Doel

Een gevonden persoon kan vanuit de medewerkerwizard expliciet opnieuw worden gebruikt. Bij uitsluitend een afgesloten dienstverband gebeurt dat als herintreder; bij een gevonden persoon zonder dienstverband kan de gebruiker de bestaande persoonskaart aanvullen. De gebruiker kan ook altijd kiezen om een geheel nieuwe medewerker aan te maken.

## Functionele afspraken

- De identiteitscontrole toont bij een kandidaat met een afgesloten dienstverband de actie **Herintreden met deze medewerker**.
- De identiteitscontrole toont bij een kandidaat zonder dienstverband de actie **Deze medewerker gebruiken**.
- De actie is niet beschikbaar voor een persoon met een actief dienstverband. De bestaande actie om de persoonskaart te openen blijft voor andere kandidaten beschikbaar.
- Na de keuze worden persoonsgegevens, contactgegevens, het primaire adres en bestaande vrije veldwaarden in de volgende wizardtabs vooringevuld.
- Het bestaande personeelsnummer blijft behouden en wordt in de herintredingsflow niet opnieuw als vrij nummer gecontroleerd.
- De controlepagina maakt bij hergebruik geen nieuwe `Employee`; de bestaande persoon wordt bijgewerkt met de ingevulde persoonsgegevens.
- Bij een bestaande persoon zonder dienstverband biedt de controlepagina twee keuzes: alleen **Medewerker bijwerken** of **Medewerker + dienstverband aanmaken**.
- Bij herintreding wordt de bestaande persoon bijgewerkt en daarna een nieuw `Employment` gestart.
- Als de gebruiker kiest om geen bestaande medewerker te gebruiken, blijft de normale route voor een nieuwe `Employee` beschikbaar.
- Bij de overgang naar de dienstverbandtabs verschijnt eerst een expliciete keuze:
  - zoveel mogelijk gegevens uit het laatst afgesloten dienstverband als voorstel overnemen;
  - met nieuwe gegevens beginnen.
- Alleen gegevens die binnen de gekozen administratie en de actuele stamdata nog geldig zijn, mogen als voorstel worden overgenomen. De nieuwe startdatum en het nieuwe dienstverbandnummer worden nooit uit de oude relatie gekopieerd.
- De kopieerkeuze kan voorstellen doen voor medewerkertype, contract, rooster, salaris, organisatie en kostenverdeling. De gebruiker controleert en kan iedere voorgestelde waarde wijzigen.

## Technische grens

Deze wijziging gebruikt de bestaande `employees`, `employments` en tijdlijntabellen. Er is geen nieuwe tabel of migratie nodig. De bestaande server-side autorisatie, HR-groepsscope en RLS blijven leidend.

## Verificatie

- Strict TypeScript, ESLint, i18n-pariteit en `git diff --check` zijn uitgevoerd.
- De authenticated lokale wizardcontrole bevestigde de herintredingsactie en het voorvullen van de kern-, extra- en contacttabs.
- Het openen van de laatste opslagactie en het daadwerkelijk publiceren van een nieuw dienstverband zijn niet uitgevoerd, omdat dat testdata zou muteren.
