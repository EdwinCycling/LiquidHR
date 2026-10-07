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

    It 'behoudt compatibiliteit met ondersteunde Node-versies zonder loadEnvFile API' {
        $launcherSource | Should Match '\$hasLoadEnvFileApi'
        $launcherSource | Should Match 'process\.execArgv\.some'
        $launcherSource | Should Match '--env-file=\$centralConfig'
    }

    It 'verwijst naar de veilige metadata-only provisioningroutine wanneer centrale config ontbreekt' {
        $launcherSource | Should Match 'provision-test-runtime\.ps1'
        $launcherSource | Should Match 'er is geen alternatieve configuratie gemaakt of gebruikt'
    }
}
