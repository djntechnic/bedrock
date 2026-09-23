<#
.SYNOPSIS
    Side-effect-free decision logic for Cut-BedrockRelease.ps1, split out so
    it is directly Pester-testable without mocking git/gh.
#>

function Resolve-TargetVersion {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)] [string]$BaselineTag,
        [Parameter(Mandatory)] [array]$PrLabelSets,
        [string]$ExplicitVersion,
        [switch]$Force
    )

    if ($BaselineTag -notmatch '^v(\d+)\.(\d+)\.(\d+)$') {
        throw "BaselineTag '$BaselineTag' is not a vMAJOR.MINOR.PATCH tag"
    }
    $major = [int]$Matches[1]
    $minor = [int]$Matches[2]
    $patch = [int]$Matches[3]

    $hasMajor = $false
    $hasMinor = $false
    foreach ($labels in $PrLabelSets) {
        if ($labels -contains "semver:major" -or $labels -contains "breaking") { $hasMajor = $true }
        if ($labels -contains "semver:minor" -or $labels -contains "type:feature" -or $labels -contains "enhancement") { $hasMinor = $true }
    }

    if ($hasMajor) { $segment = "major"; $computed = "v$($major + 1).0.0" }
    elseif ($hasMinor) { $segment = "minor"; $computed = "v$major.$($minor + 1).0" }
    else { $segment = "patch"; $computed = "v$major.$minor.$($patch + 1)" }

    if (-not $ExplicitVersion) {
        return [pscustomobject]@{ Version = $computed; Segment = $segment; Halted = $false; HaltReason = $null }
    }

    if ($ExplicitVersion -eq $computed -or $Force) {
        return [pscustomobject]@{ Version = $ExplicitVersion; Segment = $segment; Halted = $false; HaltReason = $null }
    }

    if ($hasMajor -and $ExplicitVersion -ne $computed) {
        return [pscustomobject]@{
            Version    = $ExplicitVersion
            Segment    = $segment
            Halted     = $true
            HaltReason = "explicit -TargetVersion $ExplicitVersion under-bumps past a breaking-labeled PR in the delta (labels imply $computed); pass -Force to override"
        }
    }

    return [pscustomobject]@{ Version = $ExplicitVersion; Segment = $segment; Halted = $false; HaltReason = $null }
}

function ConvertTo-PromotedReleaseBody {
    [CmdletBinding()]
    param([Parameter(Mandatory)] [string]$ChangelogEntry)

    return ($ChangelogEntry -replace '(?m)^### For consumers$', '## For consumers')
}

function Build-ChangelogEntry {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)] [array]$MergedPrs,
        [Parameter(Mandatory)] [string]$TargetVersion,
        [Parameter(Mandatory)] [array]$Consumers,
        [Parameter(Mandatory)] [AllowEmptyCollection()] [array]$ResolvedIssueNumbers
    )

    $fixedEntries = @()
    $addedEntries = @()
    $maintEntries = @()
    $breakingEntries = @()

    foreach ($pr in $MergedPrs) {
        if ($pr.Labels -contains "breaking" -or $pr.Labels -contains "semver:major") {
            $breakingEntries += "- **[#$($pr.Number)] $($pr.Title)**"
        }
        if ($pr.Labels -contains "type:defect" -or $pr.Labels -contains "bug") {
            if ($pr.Body -notmatch '(?ms)### Changelog Entry') {
                return [pscustomobject]@{
                    Halted     = $true
                    HaltReason = "PR #$($pr.Number) is labeled type:defect but has no ### Changelog Entry block"
                    Text       = $null
                }
            }
            $rootCauseMatch = [regex]::Match($pr.Body, '(?ms)\*\*Root Cause & Escape:\*\*\s*(.+?)\r?\n')
            $preventionMatch = [regex]::Match($pr.Body, '(?ms)\*\*Prevention:\*\*\s*(.+?)\r?\n')
            $rootCause = if ($rootCauseMatch.Success) { $rootCauseMatch.Groups[1].Value.Trim() } else { "" }
            $prevention = if ($preventionMatch.Success) { $preventionMatch.Groups[1].Value.Trim() } else { "" }
            $fixedEntries += "- **[#$($pr.Number)] $($pr.Title)**`n  - **Origin / Root Cause:** $rootCause`n  - **Prevention / Test:** $prevention"
        }
        elseif ($pr.Labels -contains "type:feature" -or $pr.Labels -contains "type:task" -or $pr.Labels -contains "enhancement") {
            $addedEntries += "- **[#$($pr.Number)] $($pr.Title)**"
        }
        else {
            $maintEntries += "- **[#$($pr.Number)] $($pr.Title)**"
        }
    }

    $breakingBody = if ($breakingEntries.Count -gt 0) { $breakingEntries -join "`n" } else { "None" }
    $fixedBody = if ($fixedEntries.Count -gt 0) { $fixedEntries -join "`n" } else { "None" }
    $addedBody = if ($addedEntries.Count -gt 0) { $addedEntries -join "`n" } else { "None" }
    $maintBody = if ($maintEntries.Count -gt 0) { $maintEntries -join "`n" } else { "None" }
    $issuesBody = if ($ResolvedIssueNumbers.Count -gt 0) { ($ResolvedIssueNumbers | ForEach-Object { "#$_" }) -join ", " } else { "None" }
    $consumersBody = ($Consumers | ForEach-Object { "``djntechnic/$_``" }) -join ", "

    $today = (Get-Date -Format "yyyy-MM-dd")
    $text = @"
## $TargetVersion - $today

### Breaking Changes
$breakingBody

### Fixed
$fixedBody

### Added / Changed
$addedBody

### Platform Maintenance
$maintBody

### For consumers
- **Resolves Upstream Issues:** $issuesBody
- **Target Downstream Repositories:** $consumersBody
- **Expected Pin Migration:** ``/bump-bedrock-pin $TargetVersion``
"@

    return [pscustomobject]@{ Halted = $false; HaltReason = $null; Text = $text }
}

function Test-RemoteReleaseState {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)] [bool]$TagExists,
        [Parameter(Mandatory)] [bool]$ReleaseExists
    )

    if (-not $TagExists) {
        return [pscustomobject]@{ Phase = "NotStarted" }
    }
    if (-not $ReleaseExists) {
        return [pscustomobject]@{ Phase = "TagOnly" }
    }
    return [pscustomobject]@{ Phase = "Published" }
}

Export-ModuleMember -Function Resolve-TargetVersion, ConvertTo-PromotedReleaseBody, Build-ChangelogEntry, Test-RemoteReleaseState
