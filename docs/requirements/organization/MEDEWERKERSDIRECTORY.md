# Medewerkersdirectory voor medewerkers

## Doel

Een medewerker mag de medewerkerslijst van de actieve administratie openen wanneer HR dit toestaat. De standaardwaarde is aan.

De medewerkerdirectory bevat uitsluitend actieve, niet-gearchiveerde medewerkers. Toekomstige, uit dienst zijnde, externe en gearchiveerde records zijn niet zichtbaar en zijn niet als filter beschikbaar. Managers behouden hun bestaande mogelijkheid om teamscope/alle medewerkers en de overige arbeids- en archiefstatussen te bekijken.

Een collega opent voor een medewerker geen HR- of managementdetailpagina, maar een veilige popup met uitsluitend de door HR vrijgegeven velden:

- naam;
- functie en afdeling;
- zakelijk e-mailadres;
- zakelijk telefoonnummer;
- aanwezigheid van deze week als `Aan het werk`, `Vrij` of `Afwezig`, zonder afwezigheidsreden;
- rooster.

Het personeelsnummer is geen directoryveld: het wordt voor medewerker-naar-medewerkerweergave niet in de lijst of popup getoond en wordt ook niet als zoekveld gebruikt. Dezelfde beperking geldt voor een manager die een collega buiten het directe team als medewerker-collega bekijkt.

Naam is verplicht zichtbaar en kan niet door HR worden uitgezet. De overige vijf velden staan standaard aan en kunnen afzonderlijk door HR worden uitgezet in **Instellingen > HR-inrichting > Medewerkersdirectory**. De gekozen zichtbaarheid geldt zowel voor de collega-popup als voor de medewerkerslijst; uitgeschakelde functie-/afdelings- en e-mailvelden worden ook niet gebruikt voor zoekresultaten.

## Autorisatie en gegevensgrens

De lijst gebruikt de canonieke permission `employee-directory:read`. De collega-popup gebruikt dezelfde server-side permission en een veilige Supabase-projectie. Een medewerker kan alleen de eigen volledige medewerkerpagina openen; een collega wordt altijd beperkt tot de popup. BSN, salaris, bankgegevens, documenten, absence-redenen en andere HR-/managementgegevens komen niet in de directoryprojectie.

Voor `DIRECT_MANAGER` geldt dezelfde grens: directe teamleden openen de normale managerdetailpagina; medewerkers buiten het directe team openen de beperkte collega-popup. De detailroute controleert dit server-side, zodat een handmatig ingevoerde URL geen omweg vormt.

De directory-instellingen zijn tenant- en administratiegebonden. RLS blijft actief; de read-RPC's controleren tenant, administratie, permission en de HR-instellingen server-side.

## Lijstweergave

Aanvulling: de medewerkerslijst bevat ook de persoonlijke view-keuze **Foto collage**, met een strak vierkant raster van foto’s of initialen zonder namen.

De medewerkerslijst ondersteunt zeven persoonlijke weergavekeuzes: **Detail**, **Compact**, **Kaarten**, **Foto's groot**, **Foto's standaard**, **Foto's klein** en **Alleen foto (vierkant)**. De gebruiker kiest de weergave in het bestaande filterpaneel; de keuze wordt opgeslagen in `user_preferences.ui_state.employeesList` en blijft behouden na herladen. De kaart- en fotoweergave gebruiken automatisch zoveel kolommen als de beschikbare schermbreedte toelaat. De drie benoemde fotoweergaven tonen uitsluitend de foto of initialen en de voornaam. De vierkante variant toont alleen de foto of initialen, met een dunne rand en zonder naam. Er worden geen status-, functie-, contact- of personeelsnummergegevens toegevoegd. Dezelfde klik-, veldprivacy- en rolgrenzen gelden in iedere weergave.
