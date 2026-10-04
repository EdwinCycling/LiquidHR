$launcherPath = Join-Path $PSScriptRoot '..\start-test-worktree.ps1'
$launcherSource = Get-Content -LiteralPath $launcherPath -Raw

Describe 'start-test-worktree runtime bridge' {
    It 'laadt de centrale config buiten process.execArgv voordat Next start' {
        $launcherSource | Should Match '\$nextArguments = @\(\)'
        $launcherSource | Should Match 'process\.loadEnvFile\(configFile\)'
        $launcherSource | Should Match 'process\.execArgv = \[\]'
        $launcherSource | Should Match '& \$node\.Source -e \$runtimeBridge @runtimeArguments'
    }

    It 'geeft geen --env-file door in de Next-argumentlijst' {
        $launcherSource | Should Not Match '\$nextArguments = @\("--env-file=\$centralConfig"'
    }
}
