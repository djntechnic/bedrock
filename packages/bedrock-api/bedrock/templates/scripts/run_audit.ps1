<#
.SYNOPSIS
    Unified Quality Gate and Audit Runner for a bedrock consumer.
.DESCRIPTION
    Dispatches Bedrock Platform Audits (S001-S014, S100) and App-Specific Domain
    Audits (S101+). Each switch selects exactly its own set: -Platform never runs
    domain audits, -Domain never runs platform audits. With no switch, both run.
.PARAMETER All
    Executes both platform audits and domain audits.
.PARAMETER Platform
    Executes platform audits only (bedrock.tools.run_all).
.PARAMETER Domain
    Executes domain audits only (scripts/audit/s1*_audit_*.py).
.PARAMETER Standard
    Executes a single standard (e.g. S011) or domain standard (e.g. S101).
.EXAMPLE
    .\scripts\run_audit.ps1
    .\scripts\run_audit.ps1 -Platform
    .\scripts\run_audit.ps1 -Domain
    .\scripts\run_audit.ps1 -Standard S011
#>
[CmdletBinding()]
param (
    [switch]$All,
    [switch]$Platform,
    [switch]$Domain,
    [string]$Standard
)

$ErrorActionPreference = "Stop"
$VenvPython = "python"

if ($Standard) {
    $stdNum = $Standard.ToUpper().Replace("S", "").PadLeft(3, '0')
    $domainAudits = Get-ChildItem -Path (Join-Path $PSScriptRoot "audit") -Filter "s${stdNum}_audit_*.py" -ErrorAction SilentlyContinue
    if ($domainAudits) {
        & $VenvPython $domainAudits[0].FullName --root .
        exit $LASTEXITCODE
    }

    $module = & $VenvPython -c "import pkgutil, bedrock.tools; prefix = 's$stdNum' + '_audit_'; mods = [m.name for m in pkgutil.iter_modules(bedrock.tools.__path__) if m.name.startswith(prefix)]; print(mods[0] if mods else '')"
    if ($module) {
        & $VenvPython -m "bedrock.tools.$module" --root .
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

$Failed = $false

if ($Platform) {
    Write-Host "==> Running Platform Audits (bedrock.tools.run_all)..." -ForegroundColor Cyan
    & $VenvPython -m bedrock.tools.run_all --root .
    if ($LASTEXITCODE -ne 0) {
        $Failed = $true
    }
}

if ($Domain) {
    Write-Host "==> Running Domain Audits..." -ForegroundColor Cyan
    $domainScripts = @(Get-ChildItem -Path (Join-Path $PSScriptRoot "audit") -Filter "s1*_audit_*.py" -ErrorAction SilentlyContinue)
    if ($domainScripts.Count -eq 0) {
        Write-Host "==> No domain audit scripts found under scripts/audit/. Skipping." -ForegroundColor Yellow
    } else {
        foreach ($script in $domainScripts) {
            Write-Host "==> Executing $($script.Name)" -ForegroundColor Cyan
            & $VenvPython $script.FullName --root .
            if ($LASTEXITCODE -ne 0) {
                $Failed = $true
            }
        }
    }
}

if ($Failed) {
    Write-Host "==> Audit failed." -ForegroundColor Red
    exit 1
}

Write-Host "==> All requested audits passed." -ForegroundColor Green
exit 0
