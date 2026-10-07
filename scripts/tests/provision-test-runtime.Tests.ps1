. (Join-Path $PSScriptRoot '..\provision-test-runtime.ps1')

Describe 'provision-test-runtime' {
    It 'creates and verifies a hard link without reading the canonical file' {
        $sourcePath = Join-Path $TestDrive 'canonical.env.local'
        $destinationPath = Join-Path $TestDrive 'LiquidHR\TestRuntime\.env.local'
        New-Item -ItemType File -Path $sourcePath | Out-Null

        Invoke-TestRuntimeProvisioning -CanonicalPath $sourcePath -DestinationPath $destinationPath

        Test-Path -LiteralPath $destinationPath -PathType Leaf | Should Be $true
        Test-TestRuntimeHardlink -CanonicalPath $sourcePath -DestinationPath $destinationPath | Should Be $true
    }

    It 'is idempotent for an already verified canonical hard link' {
        $sourcePath = Join-Path $TestDrive 'canonical-idempotent.env.local'
        $destinationPath = Join-Path $TestDrive 'LiquidHR-idempotent\TestRuntime\.env.local'
        New-Item -ItemType File -Path $sourcePath | Out-Null
        Invoke-TestRuntimeProvisioning -CanonicalPath $sourcePath -DestinationPath $destinationPath | Out-Null

        $failure = $null
        try {
            Invoke-TestRuntimeProvisioning -CanonicalPath $sourcePath -DestinationPath $destinationPath | Out-Null
        } catch {
            $failure = $_.Exception.Message
        }

        $failure | Should Be $null
        Test-TestRuntimeHardlink -CanonicalPath $sourcePath -DestinationPath $destinationPath | Should Be $true
    }

    It 'refuses and preserves a different file at the destination' {
        $sourcePath = Join-Path $TestDrive 'canonical-existing.env.local'
        $destinationPath = Join-Path $TestDrive 'LiquidHR-existing\TestRuntime\.env.local'
        New-Item -ItemType File -Path $sourcePath | Out-Null
        New-Item -ItemType Directory -Path (Split-Path -Parent $destinationPath) -Force | Out-Null
        New-Item -ItemType File -Path $destinationPath | Out-Null
        $before = Get-Item -LiteralPath $destinationPath

        $failure = $null
        try {
            Invoke-TestRuntimeProvisioning -CanonicalPath $sourcePath -DestinationPath $destinationPath | Out-Null
        } catch {
            $failure = $_.Exception.Message
        }

        $failure | Should Match 'not a verified hard link'

        $after = Get-Item -LiteralPath $destinationPath
        $after.Length | Should Be $before.Length
        $after.LastWriteTimeUtc | Should Be $before.LastWriteTimeUtc
        Test-TestRuntimeHardlink -CanonicalPath $sourcePath -DestinationPath $destinationPath | Should Be $false
    }

    It 'stops when the canonical file is absent and creates no destination directory' {
        $missingSourcePath = Join-Path $TestDrive 'missing-canonical.env.local'
        $destinationPath = Join-Path $TestDrive 'LiquidHR-missing\TestRuntime\.env.local'

        $failure = $null
        try {
            Invoke-TestRuntimeProvisioning -CanonicalPath $missingSourcePath -DestinationPath $destinationPath | Out-Null
        } catch {
            $failure = $_.Exception.Message
        }

        $failure | Should Match 'canonical TEST configuration is missing'
        Test-Path -LiteralPath (Split-Path -Parent $destinationPath) | Should Be $false
    }
}
