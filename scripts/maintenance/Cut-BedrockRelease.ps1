<#
.SYNOPSIS
    Unified local release orchestrator for bedrock. Repository-local
    preparation only — never touches another GitHub repository, never
    closes or files an issue anywhere (that is cascade.yml's job, see
    docs/specs/2026-09-22-release-automation-and-cascade-design.md §3).
.DESCRIPTION
    1. Validates a clean working tree.
    2. Resolves the baseline tag and target version (labels drive semver
       selection unless -TargetVersion is given; §4.3).
    3. Ensures a dedicated feature branch is open (e.g. chore/release-vX.Y.Z)
       per §S006.
    4. Fetches merged-PR delta via a single gh api graphql round-trip.
    5. Assembles and prepends the CHANGELOG.md entry, syncs version
       manifests.
    6. Runs pre-tag quality gates: s015_audit_release_notes, s012_audit_pins,
       audit_release_version, and run_qa --mode full -q.
    7. Commits to the feature branch, pushes branch, ensures draft PR is open,
       tags at the full 40-char SHA, pushes tag, verifies remote visibility.
    8. Publishes the GitHub Release with the heading-promoted body.
.PARAMETER TargetVersion
    Explicit vX.Y.Z override. Must agree with what merged-PR labels imply
    unless -Force is passed.
.PARAMETER Resume
    Re-entrant recovery: checks the three-fact remote state (tag exists?
    release exists?) and resumes from the first incomplete step instead of
    re-running everything.
.PARAMETER Force
    Overrides the halt-for-confirmation guard when an explicit
    -TargetVersion under-bumps past a labeled breaking change, and the
    halt-for-confirmation guard for a type:defect PR missing its
    ### Changelog Entry block.
.EXAMPLE
    pwsh ./scripts/maintenance/Cut-BedrockRelease.ps1
    pwsh ./scripts/maintenance/Cut-BedrockRelease.ps1 -TargetVersion v0.11.0
    pwsh ./scripts/maintenance/Cut-BedrockRelease.ps1 -Resume
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$TargetVersion,
    [switch]$Resume,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
Import-Module (Join-Path $PSScriptRoot "CutBedrockRelease.Helpers.psm1") -Force

function Test-CleanWorkingTree {
    $status = git status --porcelain
    if ($status) {
        throw "Working tree is not clean. Commit or stash changes before cutting a release."
    }
}

function Ensure-ReleaseBranch {
    param([Parameter(Mandatory)] [string]$Version)

    $currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
    $targetBranch = Get-ReleaseBranchName -Version $Version -CurrentBranch $currentBranch

    if ($currentBranch -eq "master" -or $currentBranch -eq "main") {
        Write-Host "==> Direct push to 'master' is blocked by ecosystem policy §S006." -ForegroundColor Cyan
        Write-Host "==> Ensuring feature branch '$targetBranch' is open..." -ForegroundColor Cyan
        $existing = (git branch --list $targetBranch).Trim()
        if ($existing) {
            git checkout $targetBranch
        } else {
            git checkout -b $targetBranch
        }
        if ($LASTEXITCODE -ne 0) { throw "Failed to switch to release branch '$targetBranch'" }
        return $targetBranch
    }

    Write-Host "==> Operating on active feature branch: '$currentBranch'" -ForegroundColor Cyan
    return $currentBranch
}

function Get-LatestReleaseTag {
    git fetch --tags --force origin | Out-Null
    $tags = git tag --list "v*.*.*" --sort=-v:refname
    if (-not $tags) {
        throw "No existing vMAJOR.MINOR.PATCH tag found to compute a baseline from."
    }
    return ($tags -split "`n")[0]
}

function Invoke-GraphQLDeltaQuery {
    param([Parameter(Mandatory)] [string]$BaselineTag)

    $deltaPrNumbers = git log "$BaselineTag..HEAD" --oneline |
        Select-String -Pattern '\(#(\d+)\)' |
        ForEach-Object { [int]$_.Matches.Groups[1].Value }

    $query = @'
query($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    pullRequests(states: MERGED, first: 100, orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes {
        number
        title
        body
        labels(first: 20) { nodes { name } }
        closingIssuesReferences(first: 10) { nodes { number } }
      }
    }
  }
}
'@
    $raw = gh api graphql -f query=$query -f owner="djntechnic" -f repo="bedrock" | ConvertFrom-Json
    $nodes = @($raw.data.repository.pullRequests.nodes)

    $filteredNodes = if ($deltaPrNumbers) {
        @($nodes | Where-Object { $_.number -in $deltaPrNumbers })
    } else {
        @()
    }

    $normalizedPrs = @()
    foreach ($node in $filteredNodes) {
        $labels = @($node.labels.nodes | ForEach-Object { $_.name })
        $issues = @($node.closingIssuesReferences.nodes | ForEach-Object { $_.number })
        $normalizedPrs += [pscustomobject]@{
            Number        = $node.number
            Title         = $node.title
            Body          = $node.body
            Labels        = $labels
            ClosingIssues = $issues
        }
    }
    return $normalizedPrs
}

function Sync-VersionManifests {
    param([Parameter(Mandatory)] [string]$Version)

    $rawVersion = if ($Version.StartsWith("v")) { $Version.Substring(1) } else { $Version }

    $pkgJson = Get-Content package.json -Raw
    $pkgJson = $pkgJson -replace '("version"\s*:\s*)"[^"]+"', "`$1`"$rawVersion`""
    Set-Content package.json -Value $pkgJson -NoNewline

    $pyproject = Get-Content packages/bedrock-api/pyproject.toml -Raw
    $pyproject = $pyproject -replace '(?m)^(version\s*=\s*)"[^"]+"', "`$1`"$rawVersion`""
    Set-Content packages/bedrock-api/pyproject.toml -Value $pyproject -NoNewline
}

function Invoke-PreTagGates {
    param([Parameter(Mandatory)] [string]$Version)

    Write-Host "==> Gate: s015_audit_release_notes" -ForegroundColor Cyan
    python scripts/audit/s015_audit_release_notes.py $Version --root .
    if ($LASTEXITCODE -ne 0) { throw "s015_audit_release_notes failed (exit $LASTEXITCODE)" }

    Write-Host "==> Gate: s012_audit_pins" -ForegroundColor Cyan
    python scripts/audit/s012_audit_pins.py --root .
    if ($LASTEXITCODE -ne 0) { throw "s012_audit_pins failed (exit $LASTEXITCODE)" }

    Write-Host "==> Gate: audit_release_version" -ForegroundColor Cyan
    python -m bedrock.tools.audit_release_version $Version --repo-root .
    if ($LASTEXITCODE -ne 0) { throw "audit_release_version failed (exit $LASTEXITCODE)" }

    Write-Host "==> Gate: run_qa (full, quiet)" -ForegroundColor Cyan
    $qaArgs = Get-PreTagGateQaArgs -Quiet
    python @qaArgs
    if ($LASTEXITCODE -ne 0) { throw "run_qa failed (exit $LASTEXITCODE)" }
}

function New-ReleaseCommitAndTag {
    param(
        [Parameter(Mandatory)] [string]$Version,
        [Parameter(Mandatory)] [string]$Branch
    )

    git add CHANGELOG.md package.json packages/bedrock-api/pyproject.toml README.md
    git commit -m "release: $Version"
    $sha = (git rev-parse HEAD).Trim()
    git tag -a $Version $sha -m "release: $Version"
    git push -u origin $Branch
    if ($LASTEXITCODE -ne 0) { throw "git push origin $Branch failed (exit $LASTEXITCODE)" }
    git push origin $Version
    if ($LASTEXITCODE -ne 0) { throw "git push origin $Version failed (exit $LASTEXITCODE)" }

    $remoteTag = git ls-remote --tags origin $Version
    if (-not $remoteTag) {
        throw "git push origin $Version did not report HTTP success but the tag is not visible on origin. Do not report the release as ready; hand the user the commands and wait, per CLAUDE.md."
    }
    return $sha
}

function Ensure-ReleasePullRequest {
    param(
        [Parameter(Mandatory)] [string]$Version,
        [Parameter(Mandatory)] [string]$Branch
    )

    $existingPr = (gh pr list --head $Branch --state open --json number --jq '.[0].number' 2>$null)
    if ($existingPr) {
        Write-Host "==> Release pull request already open: #$existingPr" -ForegroundColor Green
        return $existingPr
    }

    Write-Host "==> Ensuring draft release pull request for $Branch targeting master is open..." -ForegroundColor Cyan
    $prUrl = gh pr create --base master --head $Branch --title "release: $Version" --body "Release $Version automated preparation per §S006 and §S015." --draft 2>$null
    if ($LASTEXITCODE -eq 0 -and $prUrl) {
        Write-Host "==> Opened draft release pull request: $prUrl" -ForegroundColor Green
        return $prUrl
    } else {
        Write-Warning "Could not automatically create pull request for $Branch (exit $LASTEXITCODE). Please open PR manually targeting master."
    }
}

function Publish-GitHubRelease {
    param(
        [Parameter(Mandatory)] [string]$Version,
        [Parameter(Mandatory)] [string]$ChangelogEntry
    )

    $body = ConvertTo-PromotedReleaseBody -ChangelogEntry $ChangelogEntry
    $bodyFile = New-TemporaryFile
    Set-Content -Path $bodyFile -Value $body -NoNewline
    try {
        gh release create $Version --title $Version --notes-file $bodyFile --verify-tag
        if ($LASTEXITCODE -ne 0) { throw "gh release create failed (exit $LASTEXITCODE)" }
    } finally {
        Remove-Item $bodyFile -ErrorAction SilentlyContinue
    }
}

# --- Main flow -------------------------------------------------------------

$tagName = if ($TargetVersion) { if ($TargetVersion -match '^v') { $TargetVersion } else { "v$TargetVersion" } } else { $null }
$remoteTagExists = if ($tagName) { [bool](git ls-remote --tags origin $tagName) } else { $false }
$remoteReleaseExists = $false
if ($remoteTagExists) {
    gh release view $tagName *> $null
    $remoteReleaseExists = ($LASTEXITCODE -eq 0)
}

if ($Resume) {
    $state = Test-RemoteReleaseState -TagExists $remoteTagExists -ReleaseExists $remoteReleaseExists
    if ($state.Phase -eq "Published") {
        Write-Host "==> $tagName is already tagged and published. No further local action taken." -ForegroundColor Green
        exit 0
    }
}

Test-CleanWorkingTree
$baselineTag = Get-LatestReleaseTag
$mergedPrs = Invoke-GraphQLDeltaQuery -BaselineTag $baselineTag

$labelSets = @($mergedPrs | ForEach-Object { ,($_.Labels) })
$resolution = Resolve-TargetVersion -BaselineTag $baselineTag -PrLabelSets $labelSets -ExplicitVersion $tagName -Force:$Force
if ($resolution.Halted) {
    throw $resolution.HaltReason
}
$version = $resolution.Version

$releaseBranch = Ensure-ReleaseBranch -Version $version

$consumers = (Get-Content bedrock.toml -Raw | Select-String -Pattern 'consumers\s*=\s*\[(.*?)\]').Matches[0].Groups[1].Value `
    -split "," | ForEach-Object { $_.Trim().Trim('"') }
$issueNumbers = @($mergedPrs | ForEach-Object { $_.ClosingIssues } | Sort-Object -Unique)

$entryResult = Build-ChangelogEntry -MergedPrs $mergedPrs -TargetVersion $version -Consumers $consumers -ResolvedIssueNumbers $issueNumbers
if ($entryResult.Halted -and -not $Force) {
    throw $entryResult.HaltReason
}

$changelogPath = "CHANGELOG.md"
$existing = Get-Content $changelogPath -Raw
Set-Content -Path $changelogPath -Value ($entryResult.Text + "`n`n" + $existing) -NoNewline

Sync-VersionManifests -Version $version
Invoke-PreTagGates -Version $version

if ($PSCmdlet.ShouldProcess("origin/$releaseBranch and tag $version", "commit, tag, push, and open PR")) {
    New-ReleaseCommitAndTag -Version $version -Branch $releaseBranch
    Ensure-ReleasePullRequest -Version $version -Branch $releaseBranch
    Publish-GitHubRelease -Version $version -ChangelogEntry $entryResult.Text
}

Write-Host "==> Release $version published. Server-side cascade and issue closure run in CI on release: published." -ForegroundColor Green
exit 0
