#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Unified Quality Gate and Audit Runner for a bedrock consumer (PowerShell 7).
.DESCRIPTION
    Dispatches Bedrock Platform Audits (S001-S015, S100) and App-Specific Domain
    Audits (S101+). Each switch selects exactly its own set: -Platform never runs
    domain audits, -Domain never runs platform audits. With no switch, both run.

    Checks run concurrently, one process each. Each check's output is buffered
    and printed as one block when it finishes, followed by its timing, so
    parallel runs never interleave. The script exits with the worst (highest)
    exit code of any check it ran, so a caller never has to parse output.

    The interpreter is the repo's .venv when one exists (Scripts/ on Windows,
    bin/ on POSIX), else `python` from PATH.

    `python -m bedrock.tools.run_qa --mode full` runs this same audit set as
    one lane beside the backend and frontend suites.
.PARAMETER All
    Executes both platform audits and domain audits.
.PARAMETER Platform
    Executes platform audits only (bedrock.tools.run_all).
.PARAMETER Domain
    Executes domain audits only (scripts/audit/s1*_audit_*.py).
.PARAMETER Standard
    Executes a single standard (e.g. S011) or domain standard (e.g. S101).
.EXAMPLE
    ./scripts/run_audit.ps1
    ./scripts/run_audit.ps1 -Platform
    ./scripts/run_audit.ps1 -Domain
    ./scripts/run_audit.ps1 -Standard S011
#>
[CmdletBinding()]
param (
    [switch]$All,
    [switch]$Platform,
    [switch]$Domain,
    [string]$Standard
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$AuditDir = Join-Path $PSScriptRoot "audit"

$Python = "python"
foreach ($candidate in @(
        (Join-Path $RepoRoot ".venv/Scripts/python.exe"),
        (Join-Path $RepoRoot ".venv/bin/python"))) {
    if (Test-Path $candidate) {
        $Python = $candidate
        break
    }
}

if ($Standard) {
    $stdNum = $Standard.ToUpper().Replace("S", "").PadLeft(3, '0')
    $domainAudits = @(Get-ChildItem -Path $AuditDir -Filter "s${stdNum}_audit_*.py" -File -ErrorAction SilentlyContinue)
    if ($domainAudits.Count -gt 0) {
        & $Python $domainAudits[0].FullName --root $RepoRoot
        exit $LASTEXITCODE
    }

    $module = & $Python -c "import pkgutil, bedrock.tools; prefix = 's$stdNum' + '_audit_'; mods = [m.name for m in pkgutil.iter_modules(bedrock.tools.__path__) if m.name.startswith(prefix)]; print(mods[0] if mods else '')"
    if ($module) {
        & $Python -m "bedrock.tools.$module" --root $RepoRoot
        exit $LASTEXITCODE
    }
    Write-Error "Unknown standard: $Standard"
    exit 2
}

if (-not $Platform -and -not $Domain -and -not $All) {
    $All = $true
}
if ($All) {
    $Platform = $true
    $Domain = $true
}

$checks = [System.Collections.Generic.List[object]]::new()
if ($Platform) {
    $checks.Add([pscustomobject]@{
            Name = "platform (bedrock.tools.run_all)"
            Args = @("-m", "bedrock.tools.run_all", "--root", $RepoRoot)
        })
}
if ($Domain) {
    $domainScripts = @(Get-ChildItem -Path $AuditDir -Filter "s1*_audit_*.py" -File -ErrorAction SilentlyContinue | Sort-Object Name)
    if ($domainScripts.Count -eq 0) {
        Write-Host "==> No domain audit scripts found under scripts/audit/. Skipping." -ForegroundColor Yellow
    }
    foreach ($script in $domainScripts) {
        $checks.Add([pscustomobject]@{
                Name = $script.BaseName
                Args = @($script.FullName, "--root", $RepoRoot)
            })
    }
}

if ($checks.Count -eq 0) {
    exit 0
}

$wall = [System.Diagnostics.Stopwatch]::StartNew()
$results = $checks | ForEach-Object -ThrottleLimit ([Environment]::ProcessorCount) -Parallel {
    $check = $_
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    $output = & $using:Python @($check.Args) 2>&1 | Out-String
    $exitCode = $LASTEXITCODE
    $stopwatch.Stop()
    [pscustomobject]@{
        Name       = $check.Name
        ExitCode   = $exitCode
        DurationMs = $stopwatch.Elapsed.TotalMilliseconds
        Output     = $output
    }
}
$wall.Stop()

$worstExitCode = 0
foreach ($result in @($results | Sort-Object Name)) {
    Write-Host ""
    Write-Host "==> $($result.Name)" -ForegroundColor Cyan
    if ($result.Output) {
        Write-Host $result.Output.TrimEnd()
    }
    $marker = if ($result.ExitCode -eq 0) { "PASS" } else { "FAIL" }
    $color = if ($result.ExitCode -eq 0) { "Green" } else { "Red" }
    Write-Host ("  [{0}] {1}  ({2:N0}ms)  exit={3}" -f $marker, $result.Name, $result.DurationMs, $result.ExitCode) -ForegroundColor $color
    if ($result.ExitCode -gt $worstExitCode) {
        $worstExitCode = $result.ExitCode
    }
}

$passed = @($results | Where-Object { $_.ExitCode -eq 0 }).Count
$failed = @($results | Where-Object { $_.ExitCode -ne 0 }).Count
Write-Host ""
Write-Host ("=" * 80)
Write-Host ("Total: {0}  Passed: {1}  Failed: {2}  Elapsed: {3:N0}ms" -f @($results).Count, $passed, $failed, $wall.Elapsed.TotalMilliseconds)
Write-Host ("=" * 80)

exit $worstExitCode
