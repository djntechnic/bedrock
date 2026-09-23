<#
.SYNOPSIS
    Unified local release orchestrator for bedrock. Repository-local
    preparation only — never touches another GitHub repository, never
    closes or files an issue anywhere (that is cascade.yml's job, see
    docs/specs/2026-09-22-release-automation-and-cascade-design.md §3).
.DESCRIPTION
    1. Validates a clean master working tree.
    2. Resolves the baseline tag and target version (labels drive semver
       selection unless -TargetVersion is given; §4.3).
    3. Fetches merged-PR delta via a single gh api graphql round-trip.
    4. Assembles and prepends the CHANGELOG.md entry, syncs version
       manifests.
    5. Runs pre-tag quality gates: s015_audit_release_notes, s012_audit_pins,
       pytest, npm test, npm run typecheck.
    6. Commits, tags at the full 40-char SHA, pushes, verifies remote
       visibility.
    7. Publishes the GitHub Release with the heading-promoted body.
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
    $branch = git rev-parse --abbrev-ref HEAD
    if ($branch -ne "master") {
        throw "Cut-BedrockRelease.ps1 must run on master, not '$branch'."
    }
}

function Get-LatestReleaseTag {
    git fetch --tags origin | Out-Null
    $tags = git tag --list "v*.*.*" --sort=-v:refname
    if (-not $tags) {
        throw "No existing vMAJOR.MINOR.PATCH tag found to compute a baseline from."
    }
    return ($tags -split "`n")[0]
}

function Invoke-GraphQLDeltaQuery {
    param([Parameter(Mandatory)] [string]$BaselineTag)

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
    return $raw.data.repository.pullRequests.nodes
}

function Invoke-PreTagGates {
    param([Parameter(Mandatory)] [string]$Version)

    Write-Host "==> Gate: s015_audit_release_notes" -ForegroundColor Cyan
    python scripts/audit/s015_audit_release_notes.py $Version --root .
    if ($LASTEXITCODE -ne 0) { throw "s015_audit_release_notes failed (exit $LASTEXITCODE)" }

    Write-Host "==> Gate: s012_audit_pins" -ForegroundColor Cyan
    python scripts/audit/s012_audit_pins.py --root .
    if ($LASTEXITCODE -ne 0) { throw "s012_audit_pins failed (exit $LASTEXITCODE)" }

    Write-Host "==> Gate: pytest" -ForegroundColor Cyan
    Push-Location packages/bedrock-api
    try {
        pytest
        if ($LASTEXITCODE -ne 0) { throw "pytest failed (exit $LASTEXITCODE)" }
    } finally { Pop-Location }

    Write-Host "==> Gate: npm test" -ForegroundColor Cyan
    npm test
    if ($LASTEXITCODE -ne 0) { throw "npm test failed (exit $LASTEXITCODE)" }

    Write-Host "==> Gate: npm run typecheck" -ForegroundColor Cyan
    npm run typecheck
    if ($LASTEXITCODE -ne 0) { throw "npm run typecheck failed (exit $LASTEXITCODE)" }
}

function New-ReleaseCommitAndTag {
    param([Parameter(Mandatory)] [string]$Version)

    git add CHANGELOG.md package.json packages/bedrock-api/pyproject.toml README.md
    git commit -m "release: $Version"
    $sha = (git rev-parse HEAD).Trim()
    git tag -a $Version $sha -m "release: $Version"
    git push origin master
    git push origin $Version

    $remoteTag = git ls-remote --tags origin $Version
    if (-not $remoteTag) {
        throw "git push origin $Version did not report HTTP success but the tag is not visible on origin. Do not report the release as ready; hand the user the commands and wait, per CLAUDE.md."
    }
    return $sha
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
        gh release create $Version --title $Version --notes-file $bodyFile --target master
        if ($LASTEXITCODE -ne 0) { throw "gh release create failed (exit $LASTEXITCODE)" }
    } finally {
        Remove-Item $bodyFile -ErrorAction SilentlyContinue
    }
}

# --- Main flow -------------------------------------------------------------

$tagName = if ($TargetVersion) { $TargetVersion } else { $null }
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

$labelSets = $mergedPrs | ForEach-Object { $_.labels.nodes | ForEach-Object { $_.name } }
$resolution = Resolve-TargetVersion -BaselineTag $baselineTag -PrLabelSets $labelSets -ExplicitVersion $TargetVersion -Force:$Force
if ($resolution.Halted) {
    throw $resolution.HaltReason
}
$version = $resolution.Version

$consumers = (Get-Content bedrock.toml -Raw | Select-String -Pattern 'consumers\s*=\s*\[(.*?)\]').Matches[0].Groups[1].Value `
    -split "," | ForEach-Object { $_.Trim().Trim('"') }
$issueNumbers = $mergedPrs | ForEach-Object { $_.closingIssuesReferences.nodes } | ForEach-Object { $_.number } | Sort-Object -Unique

$entryResult = Build-ChangelogEntry -MergedPrs $mergedPrs -TargetVersion $version -Consumers $consumers -ResolvedIssueNumbers $issueNumbers
if ($entryResult.Halted -and -not $Force) {
    throw $entryResult.HaltReason
}

$changelogPath = "CHANGELOG.md"
$existing = Get-Content $changelogPath -Raw
Set-Content -Path $changelogPath -Value ($entryResult.Text + "`n`n" + $existing) -NoNewline

Invoke-PreTagGates -Version $version

if ($PSCmdlet.ShouldProcess("origin/master and tag $version", "commit, tag, and push")) {
    New-ReleaseCommitAndTag -Version $version
    Publish-GitHubRelease -Version $version -ChangelogEntry $entryResult.Text
}

Write-Host "==> Release $version published. Server-side cascade and issue closure run in CI on release: published." -ForegroundColor Green
exit 0
