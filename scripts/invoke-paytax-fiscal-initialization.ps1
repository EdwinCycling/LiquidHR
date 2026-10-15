[CmdletBinding()]
param([switch]$Apply,[ValidateSet('Mars','Jupiter')][string[]]$Administrations=@('Mars','Jupiter'))
$ErrorActionPreference='Stop'
Import-Module Microsoft.PowerShell.Utility
$base='http://127.0.0.1:3010'
$session=[Microsoft.PowerShell.Commands.WebRequestSession]::new()
$headers=@{Origin=$base}
function Invoke-Local([string]$Path,[string]$Method='GET',$Body=$null,[string]$ContentType='application/x-www-form-urlencoded') {
  $options=@{Uri=($base+$Path);Method=$Method;WebSession=$session;Headers=$headers;SkipHttpErrorCheck=$true;TimeoutSec=600}
  if($null-ne $Body){$options.Body=$Body;$options.ContentType=$ContentType}
  $response=Invoke-WebRequest @options
  if([int]$response.StatusCode-ge 400){throw "LOCAL_HTTP_$([int]$response.StatusCode): $Path"}
  return $response
}
try { $null=Invoke-Local '/api/local/sign-in' 'POST' @{account='hr-admin'} }
catch {
  # A successful Auth redirect can briefly precede the Data API clock. Keep
  # the real cookie jar and let the following authorized preflight decide.
  if ($_.Exception.Message -ne 'LOCAL_HTTP_500: /api/local/sign-in') { throw }
  Start-Sleep -Seconds 2
}
$null=Invoke-Local '/api/context/select' 'POST' @{selection='07249eb9-545c-883b-b26b-d52f83b4f4a1|6ba6f1df-e376-40f2-abff-ffdf000172e1'}
$ids=@{Mars='2057f6ec-cd3e-3c28-9126-c41235d4ffae';Jupiter='8483abc9-f275-c80b-5a23-fedc54ce9f0a'}
foreach($name in $Administrations){
  $admin=$ids[$name]
  $null=Invoke-Local '/api/context/administration' 'POST' (@{administrationId=$admin}|ConvertTo-Json -Compress) 'application/json'
  $preflight=(Invoke-Local '/api/local/fiscal-initialization').Content|ConvertFrom-Json
  if($preflight.userId-ne'f9157157-6527-4348-8200-57ef57e28df1'-or$preflight.administrationId-ne$admin-or-not$preflight.salaryWrite-or$preflight.tenantId-ne'07249eb9-545c-883b-b26b-d52f83b4f4a1'-or$preflight.hrGroupId-ne'6ba6f1df-e376-40f2-abff-ffdf000172e1'){throw 'FISCAL_PREFLIGHT_SCOPE_MISMATCH'}
  Write-Output ($preflight|ConvertTo-Json -Compress)
  if($Apply){
    foreach($pass in @(1,2)){
      $result=(Invoke-Local '/api/local/fiscal-initialization' 'POST' @{administrationId=$admin}).Content|ConvertFrom-Json
      if($result.administrationId-ne$admin){throw 'FISCAL_READBACK_SCOPE_MISMATCH'}
      $counts=@($result.items|Group-Object status|ForEach-Object{@{status=$_.Name;count=$_.Count}})
      $output=Join-Path $PSScriptRoot "../.artifacts/PAYTAX-UI-01B/$name-pass-$pass.json"
      New-Item -ItemType Directory -Force -Path (Split-Path $output)|Out-Null
      $result|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $output -Encoding utf8
      Write-Output (@{administration=$name;pass=$pass;counts=$counts}|ConvertTo-Json -Depth 5 -Compress)
    }
  }
}
# Auth cookies only lived in this process; no credentials or tokens were exported.
