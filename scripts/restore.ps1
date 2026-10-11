[CmdletBinding()]
param(
    [switch]$Force,
    [switch]$Clean
)

throw "'restore.ps1' is uitgefaseerd en fail-closed. Er zijn geen bestanden, refs of untracked bestanden gewijzigd of verwijderd. Gebruik gerichte Git-acties alleen na scope- en statuscontrole."
