param([string]$RepositoryRoot = (Get-Location).Path)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $RepositoryRoot
$files = @(rg --files -g '!node_modules' -g '!.next' -g '!.git' -g '!.turbo' -g '!coverage' -g '!dist')
function Lines([string]$Path) { if (Test-Path -LiteralPath $Path) { return (Get-Content -LiteralPath $Path | Measure-Object -Line).Lines }; return 0 }
$ts = @($files | ? { $_ -match '\.(ts|tsx)$' })
$prod = @($ts | ? { $_ -notmatch '(test|spec)\.(ts|tsx)$' })
$tests = @($files | ? { $_ -match '(test|spec)\.(ts|tsx|sql)$' })
$migrations = @(rg --files apps/hr-suite/supabase/migrations -g '*.sql')
$sql = ($migrations | % { Get-Content -Raw -LiteralPath $_ }) -join "`n"
$types = if (Test-Path -LiteralPath 'packages/db/types.ts') { Get-Content -Raw -LiteralPath 'packages/db/types.ts' } else { '' }
$tableBlock = if ($types.Contains('Tables: {') -and $types.Contains('Views: {')) { $types.Substring($types.IndexOf('Tables: {'), $types.IndexOf('Views: {') - $types.IndexOf('Tables: {')) } else { '' }
[PSCustomObject]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString('o')
  files = $files.Count
  textLines = (($files | % { Lines $_ }) | Measure-Object -Sum).Sum
  tsTsxFiles = $ts.Count
  tsTsxLines = (($ts | % { Lines $_ }) | Measure-Object -Sum).Sum
  productionTsTsxFiles = $prod.Count
  productionTsTsxLines = (($prod | % { Lines $_ }) | Measure-Object -Sum).Sum
  testFiles = $tests.Count
  testLines = (($tests | % { Lines $_ }) | Measure-Object -Sum).Sum
  pageRoutes = @($files | ? { $_ -match '(^|[/\\])page\.(ts|tsx)$' }).Count
  apiRoutes = @($files | ? { $_ -match '(^|[/\\])app[/\\]api[/\\].+[/\\]route\.(ts|tsx)$' }).Count
  components = @($files | ? { $_ -match '(^|[/\\])components[/\\].+\.(ts|tsx)$' }).Count
  services = @($files | ? { $_ -match '(^|[/\\])lib[/\\].+\.(ts|tsx)$' -and $_ -notmatch '(test|spec)\.(ts|tsx)$' }).Count
  migrations = $migrations.Count
  generatedTableTypes = @($tableBlock -split "`n" | ? { $_ -match '^      [A-Za-z0-9_]+: \{' }).Count
  tableDefinitions = ([regex]::Matches($sql, '(?im)create table(?: if not exists)? (?:public\.)?[A-Za-z0-9_]+')).Count
  rlsEnablements = ([regex]::Matches($sql, '(?im)enable row level security')).Count
  policies = ([regex]::Matches($sql, '(?im)create policy')).Count
  indexes = ([regex]::Matches($sql, '(?im)create (unique )?index')).Count
  functions = ([regex]::Matches($sql, '(?im)create (or replace )?function')).Count
} | ConvertTo-Json -Depth 5
