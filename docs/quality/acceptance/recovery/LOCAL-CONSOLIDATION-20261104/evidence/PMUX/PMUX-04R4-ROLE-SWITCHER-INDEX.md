# PMUX-04R4 — Role-switcher capture-index

Status van deze run: **geen screenshots vastgelegd**. De geïsoleerde Codex In-App Browser kon `http://127.0.0.1:3011/local/personas` niet bereiken (`net::ERR_CONNECTION_REFUSED`). Er zijn geen persona-acties uitgevoerd. De onderstaande captures zijn geen onderdeel van of vervanging voor de 35 PMUX-04-acceptatiebeelden.

| ID | Persona | Route | Verwachte controle | Viewport | Resultaat | Capture |
|---|---|---|---|---|---|---|
| R4-01 | Owner | `/local/personas` | Bestaande HR Admin-, Manager- en Employee-keuzes zichtbaar | Desktop | Runtime niet bereikbaar; owner-login niet gestart | NOT CAPTURED |
| R4-02 | HR Admin | `/settings/process-automation` | Processtudio en HR-procesrechten | Desktop | Niet bezocht; geen geauthenticeerde sessie | NOT CAPTURED |
| R4-03 | Employee | `/work?view=REQUESTS` | Mijn aanvragen en rolcontext | Desktop | Niet bezocht; geen role switch | NOT CAPTURED |
| R4-04 | Manager | `/work?view=WORK` | Mijn werk en rolcontext | Desktop | Niet bezocht; geen role switch | NOT CAPTURED |
| R4-05 | Employee / Manager | `/settings/process-automation` | Verwachte toegangsweigering | Desktop | Niet getest; geen geauthenticeerde sessie | NOT CAPTURED |

Geen mobiele screenshots zijn gemaakt. Deze index bevat uitsluitend diagnostische status en geen synthetisch of gegenereerd beeldmateriaal.
