[CmdletBinding()]
param(
    [string]$Message
)

throw "'backup.ps1' is uitgefaseerd en fail-closed. Er zijn geen bestanden, commits, tags of branches gewijzigd. Gebruik een expliciete commit met alleen de bedoelde paden."
