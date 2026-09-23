Import-Module (Join-Path $PSScriptRoot "CutBedrockRelease.Helpers.psm1") -Force

Describe "Resolve-TargetVersion" {
    It "bumps patch when only defect/chore labels are in the delta" {
        $labels = @(@("type:defect"), @("chore"))
        $result = Resolve-TargetVersion -BaselineTag "v0.10.3" -PrLabelSets $labels
        $result.Version | Should -Be "v0.10.4"
        $result.Segment | Should -Be "patch"
        $result.Halted | Should -Be $false
    }

    It "bumps minor when a type:feature label is present and no major label is" {
        $labels = @(@("type:defect"), @("type:feature"))
        $result = Resolve-TargetVersion -BaselineTag "v0.10.3" -PrLabelSets $labels
        $result.Version | Should -Be "v0.11.0"
        $result.Segment | Should -Be "minor"
    }

    It "bumps major when a breaking label is present" {
        $labels = @(@("type:feature"), @("breaking"))
        $result = Resolve-TargetVersion -BaselineTag "v0.10.3" -PrLabelSets $labels
        $result.Version | Should -Be "v1.0.0"
        $result.Segment | Should -Be "major"
    }

    It "accepts an explicit -TargetVersion that agrees with the computed segment" {
        $labels = @(@("type:defect"))
        $result = Resolve-TargetVersion -BaselineTag "v0.10.3" -PrLabelSets $labels -ExplicitVersion "v0.10.4"
        $result.Version | Should -Be "v0.10.4"
        $result.Halted | Should -Be $false
    }

    It "halts when an explicit -TargetVersion under-bumps past a breaking label, without -Force" {
        $labels = @(@("breaking"))
        $result = Resolve-TargetVersion -BaselineTag "v0.10.3" -PrLabelSets $labels -ExplicitVersion "v0.10.4"
        $result.Halted | Should -Be $true
        $result.HaltReason | Should -Match "breaking"
    }

    It "does not halt on an under-bump when -Force is passed" {
        $labels = @(@("breaking"))
        $result = Resolve-TargetVersion -BaselineTag "v0.10.3" -PrLabelSets $labels -ExplicitVersion "v0.10.4" -Force
        $result.Halted | Should -Be $false
        $result.Version | Should -Be "v0.10.4"
    }
}

Describe "ConvertTo-PromotedReleaseBody" {
    It "promotes a ### For consumers heading to ## For consumers, once" {
        $changelogEntry = "### Breaking Changes`nNone`n`n### For consumers`n- **Resolves Upstream Issues:** None`n"
        $result = ConvertTo-PromotedReleaseBody -ChangelogEntry $changelogEntry
        $result | Should -Match "(?m)^## For consumers$"
        $result | Should -Not -Match "(?m)^### For consumers$"
    }

    It "leaves every other ### heading at its original depth" {
        $changelogEntry = "### Fixed`n- entry`n`n### For consumers`n- key: value`n"
        $result = ConvertTo-PromotedReleaseBody -ChangelogEntry $changelogEntry
        $result | Should -Match "(?m)^### Fixed$"
    }
}

Describe "Build-ChangelogEntry" {
    It "assembles a fixed entry's metadata from a PR body's ### Changelog Entry block" {
        $pr = @{
            Number = 101
            Title  = "Fix route collision on wildcard admin paths"
            Labels = @("type:defect")
            Body   = "### Changelog Entry`n- **Root Cause & Escape:** wildcard route registered first.`n- **Prevention:** test_admin_routes.py::test_literal_route_wins`n"
        }
        $entry = Build-ChangelogEntry -MergedPrs @($pr) -TargetVersion "v0.11.0" -Consumers @("CollectIt", "MLBTracker") -ResolvedIssueNumbers @(101)
        $entry.Text | Should -Match "\[#101\] Fix route collision on wildcard admin paths"
        $entry.Text | Should -Match "Origin / Root Cause:\*\* wildcard route registered first\."
        $entry.Text | Should -Match "Prevention / Test:\*\* test_admin_routes\.py::test_literal_route_wins"
        $entry.Text | Should -Match "/bump-bedrock-pin v0\.11\.0"
        $entry.Text | Should -Match "djntechnic/CollectIt.*djntechnic/MLBTracker"
    }

    It "halts (returns Halted = true) for a type:defect PR with no ### Changelog Entry block" {
        $pr = @{ Number = 102; Title = "Fix thing"; Labels = @("type:defect"); Body = "no block here" }
        $entry = Build-ChangelogEntry -MergedPrs @($pr) -TargetVersion "v0.11.0" -Consumers @("CollectIt") -ResolvedIssueNumbers @(102)
        $entry.Halted | Should -Be $true
        $entry.HaltReason | Should -Match "102"
    }

    It "emits 'None' body for Breaking Changes when no PR carries a breaking label" {
        $pr = @{ Number = 103; Title = "Add export"; Labels = @("type:feature"); Body = "" }
        $entry = Build-ChangelogEntry -MergedPrs @($pr) -TargetVersion "v0.11.0" -Consumers @("CollectIt") -ResolvedIssueNumbers @()
        $entry.Text | Should -Match "(?s)### Breaking Changes\r?\nNone"
    }
}

Describe "Test-RemoteReleaseState (three-fact resume check)" {
    It "reports NotStarted when the tag does not exist remotely" {
        $state = Test-RemoteReleaseState -TagExists $false -ReleaseExists $false
        $state.Phase | Should -Be "NotStarted"
    }

    It "reports TagOnly when the tag exists but no release does" {
        $state = Test-RemoteReleaseState -TagExists $true -ReleaseExists $false
        $state.Phase | Should -Be "TagOnly"
    }

    It "reports Published when both the tag and the release exist" {
        $state = Test-RemoteReleaseState -TagExists $true -ReleaseExists $true
        $state.Phase | Should -Be "Published"
    }
}
