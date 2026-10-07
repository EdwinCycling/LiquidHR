[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-TestRuntimeHardlinkPaths {
    param([Parameter(Mandatory)][string]$Path)

    $fsutil = Get-Command fsutil.exe -ErrorAction Stop
    $listedPaths = @(& $fsutil.Source hardlink list $Path 2>$null)
    if ($LASTEXITCODE -ne 0) {
        return @()
    }

    return @(
        $listedPaths |
            ForEach-Object { $_.Trim() } |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    )
}

function Test-TestRuntimeHardlink {
    param(
        [Parameter(Mandatory)][string]$CanonicalPath,
        [Parameter(Mandatory)][string]$DestinationPath
    )

    $canonicalFullPath = [IO.Path]::GetFullPath($CanonicalPath)
    $volumeRoot = [IO.Path]::GetPathRoot($canonicalFullPath)
    $expectedFsutilPath = '\' + $canonicalFullPath.Substring($volumeRoot.Length).TrimStart('\')
    $listedPaths = @(Get-TestRuntimeHardlinkPaths -Path $DestinationPath)

    return @(
        $listedPaths | Where-Object {
            [string]::Equals($_, $expectedFsutilPath, [StringComparison]::OrdinalIgnoreCase)
        }
    ).Count -gt 0
}

function Invoke-TestRuntimeProvisioning {
    param(
        [Parameter(Mandatory)][string]$CanonicalPath,
        [Parameter(Mandatory)][string]$DestinationPath
    )

    $canonicalFullPath = [IO.Path]::GetFullPath($CanonicalPath)
    $destinationFullPath = [IO.Path]::GetFullPath($DestinationPath)
    if ([string]::Equals($canonicalFullPath, $destinationFullPath, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'The canonical source and TEST runtime destination must be different paths.'
    }
    if (-not (Test-Path -LiteralPath $canonicalFullPath -PathType Leaf)) {
        throw 'The protected canonical TEST configuration is missing. No file was created or changed.'
    }

    $canonicalItem = Get-Item -LiteralPath $canonicalFullPath -Force
    if ($canonicalItem.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        throw 'The protected canonical TEST configuration is a reparse point. Refusing to provision it.'
    }

    $canonicalVolume = [IO.Path]::GetPathRoot($canonicalFullPath)
    $destinationVolume = [IO.Path]::GetPathRoot($destinationFullPath)
    if (-not [string]::Equals($canonicalVolume, $destinationVolume, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Windows hard links require the canonical file and TEST runtime destination to be on the same volume.'
    }

    $destinationDirectory = Split-Path -Parent $destinationFullPath
    if (Test-Path -LiteralPath $destinationDirectory -PathType Leaf) {
        throw 'A file occupies the TEST runtime destination directory path. No file was changed.'
    }
    if (-not (Test-Path -LiteralPath $destinationDirectory -PathType Container)) {
        New-Item -ItemType Directory -Path $destinationDirectory -Force -ErrorAction Stop | Out-Null
    }

    if (Test-Path -LiteralPath $destinationFullPath) {
        $destinationItem = Get-Item -LiteralPath $destinationFullPath -Force
        if (-not $destinationItem.PSIsContainer -and
            (Test-TestRuntimeHardlink -CanonicalPath $canonicalFullPath -DestinationPath $destinationFullPath)) {
            Write-Output 'The central local TEST runtime configuration is already a verified hard link.'
            return
        }

        throw 'The TEST runtime destination already exists and is not a verified hard link to the canonical file. It was not overwritten.'
    }

    try {
        New-Item -ItemType HardLink -Path $destinationFullPath -Target $canonicalFullPath -ErrorAction Stop | Out-Null
    } catch {
        throw "Windows could not create the TEST runtime hard link ($($_.Exception.Message)). No file copy or fallback was attempted."
    }

    if (-not (Test-TestRuntimeHardlink -CanonicalPath $canonicalFullPath -DestinationPath $destinationFullPath)) {
        throw 'The created destination could not be verified as a hard link. It was left untouched for inspection.'
    }

    Write-Output 'The central local TEST runtime configuration is provisioned as a verified hard link. Configuration values were not read or displayed.'
}

if ($MyInvocation.InvocationName -ne '.') {
    $userProfilePath = [Environment]::GetFolderPath([Environment+SpecialFolder]::UserProfile)
    $localAppDataPath = [Environment]::GetEnvironmentVariable('LOCALAPPDATA')
    if ([string]::IsNullOrWhiteSpace($userProfilePath) -or [string]::IsNullOrWhiteSpace($localAppDataPath)) {
        throw 'The current Windows user profile or LOCALAPPDATA path is unavailable. No configuration was changed.'
    }

    $canonicalConfigPath = Join-Path $userProfilePath 'Documents/Apps/LiquidHR/apps/hr-suite/.env.local'
    $destinationConfigPath = Join-Path $localAppDataPath 'LiquidHR/TestRuntime/.env.local'
    Invoke-TestRuntimeProvisioning -CanonicalPath $canonicalConfigPath -DestinationPath $destinationConfigPath
}
