[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [int]$ProcessIdParam,

  [int]$IntervalSeconds = 300,

  [int]$DurationMinutes = 60,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)

$ErrorActionPreference = 'Stop'
$startedAt = Get-Date
$sampleCount = [math]::Floor(($DurationMinutes * 60) / $IntervalSeconds) + 1
$samples = [System.Collections.Generic.List[object]]::new()
$parent = Split-Path -Parent $OutputPath
if ($parent -and -not (Test-Path -LiteralPath $parent)) {
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
}
if (Test-Path -LiteralPath $OutputPath) {
  Remove-Item -LiteralPath $OutputPath -Force
}

for ($sample = 0; $sample -lt $sampleCount; $sample++) {
  $timestamp = Get-Date
  $elapsedSeconds = [int]($timestamp - $startedAt).TotalSeconds

  try {
    $process = Get-Process -Id $ProcessIdParam -ErrorAction Stop
    $samples.Add([pscustomobject]@{
        Timestamp = $timestamp.ToString('o')
        ElapsedMinutes = [math]::Round($elapsedSeconds / 60, 2)
        ProcessId = $ProcessIdParam
        WorkingSetGB = [math]::Round($process.WorkingSet64 / 1GB, 4)
        PrivateMemoryGB = [math]::Round($process.PrivateMemorySize64 / 1GB, 4)
        VirtualMemoryGB = [math]::Round($process.VirtualMemorySize64 / 1GB, 4)
        Handles = $process.Handles
        Threads = $process.Threads.Count
        CpuSeconds = [math]::Round($process.CPU, 2)
        Status = 'running'
    })
  }
  catch {
    $samples.Add([pscustomobject]@{
        Timestamp = $timestamp.ToString('o')
        ElapsedMinutes = [math]::Round($elapsedSeconds / 60, 2)
        ProcessId = $ProcessIdParam
        WorkingSetGB = $null
        PrivateMemoryGB = $null
        VirtualMemoryGB = $null
        Handles = $null
        Threads = $null
        CpuSeconds = $null
        Status = 'exited-or-inaccessible'
    })
    break
  }

  if ($samples.Count -eq 1) {
    $samples[0] | Export-Csv -LiteralPath $OutputPath -NoTypeInformation -Encoding utf8
  }
  else {
    $samples[$samples.Count - 1] | Export-Csv -LiteralPath $OutputPath -NoTypeInformation -Append -Encoding utf8
  }

  if ($sample -lt ($sampleCount - 1)) {
    Start-Sleep -Seconds $IntervalSeconds
  }
}

$samples | Format-Table -AutoSize
