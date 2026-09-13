# Consolidated Standards, Tooling, and Testing Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the consolidated ecosystem roadmap across `claude-kit`, `bedrock`, `CollectIt`, and `MLBTracker`: establish workstation foundations, author platform standards (`s001`–`s012`) and 1:1 audit tools (`bedrock.tools`), deploy declarative `bedrock.toml` configuration, build unified QA test orchestration (`run_qa.py`), cut Bedrock release `v0.10.0`, and execute synchronized consumer migrations in `CollectIt` and `MLBTracker`.

**Architecture:** Bedrock platform serves as canonical authority for platform standards (`s001`–`s099`), 1:1 audit tools in `bedrock.tools`, and the unified QA runner (`run_qa.py`). `claude-kit` acts as sole authority for shared agentic skills/doctrine, deploying via read-only NTFS Directory Junctions maintained by scheduled Windows tasks. Consumers configure audits declaratively via `bedrock.toml` with additive exemptions, strictly partition `scripts/audits/` from `scripts/maintenance/`, and execute all test suites in < 25s via deterministic delta testing.

**Tech Stack:** Python 3.11+, Pytest, pytest-testmon, vulture, Allure, Node.js, Vitest (workspaces), knip, TypeScript, PowerShell 7, Windows 11 Task Scheduler, GitHub Actions CI.

**Spec:** [`C:\Dev\bedrock\docs\specs\2026-09-12-consolidated-standards-tooling-and-testing-roadmap-design.md`](file:///C:/Dev/bedrock/docs/specs/2026-09-12-consolidated-standards-tooling-and-testing-roadmap-design.md)

## Global Constraints

- **Zero Business Logic Changes (MANDATORY)**: This entire roadmap strictly addresses tooling, standardization, repository structure, workflows, and automated testing architecture. There are **zero intended business logic modifications**. If an implementation step attempts or requires altering domain models, business calculations, persistence methods, or database seed definitions, it is **out of scope and considered a defect**.
- Target Repositories: `C:\Dev\claude-kit`, `C:\Dev\bedrock`, `C:\Dev\CollectIt`, `C:\Dev\MLBTracker`.
- Python Interpreter: `.venv\Scripts\python.exe` on Windows 11 / PowerShell 7.
- Python Interpreter Environments: `C:\Dev\CollectIt\.venv\Scripts\python.exe` is used exclusively for `CollectIt`. `bedrock` and `MLBTracker` deliberately do not use local virtual environments and execute directly via the host Python 3.11 environment (`python` on PATH).
- Zero broken tests ship to master (§S005).
- Standards naming on disk is strictly lowercase kebab-case (`docs/standards/s001-no-duplicate-ui-code.md` ... `s012-dual-pin-platform-governance.md`).
- Standards citations in documentation and comments use 3-digit padded references: `§S001` or `[§S001](s001-no-duplicate-ui-code.md)`.
- 1:1 parity between standards and audit scripts (`bedrock.tools.audit_s001_duplicates` -> `s001`).
- Two-Stage Windows NTFS Rename Invariant: All case-altering renames stage through an intermediate `__tmp` path (`git mv <Src> <Src>__tmp && git mv <Src>__tmp <Dst>`).
- Strict consumer script partition: `scripts/audits/` (blocking quality gates) vs `scripts/maintenance/` (operational utilities).
- Declarative manifests (`bedrock.toml`): Every audit tool section must declare `exemptions = [...]` (merged additively with platform baselines).
- Shared tooling ownership: `claude-kit` is the sole canonical author of shared skills/doctrine. Deployed to consumers as untracked, read-only NTFS Directory Junctions.
- Stale agent/hook/symlink pruning: Active pruning of broken junctions, orphaned skills, and dead hooks is enforced to prevent context pollution and token churn.
- Lockstep dual-pin dependency governance: `requirements.txt` and `package.json` must reference the identical Bedrock release tag (`v0.10.0`).
- Strict commit cadence: Atomic commit after every task; single coordinated PR per repo.

---

## Task Decomposition Overview

- **Phase 0: Workstation & Tooling Foundation (Zero-Tag)**
  - Task 0.1: Headless PowerShell `$PROFILE` Zero-Token Bailout
  - Task 0.2: Standardize `.gitignore` Baseline Across Repositories
  - Task 0.3: Centralize All Agentic Tooling in `claude-kit`, Authoring Runbook & Sync Engine
  - Task 0.4: Clean Up Inconsistent Symlinks, Deprecated Tools & Token Bloat
  - Task 0.5: Deploy Superpowers Path Alignment & Windows Scheduled Task
- **Phase 1: Bedrock Canonical Platform Implementation**
  - Task 1.1: Platform Standards `s001` through `s012` Authoring & Citation Sweep
  - Task 1.2: Audit Reporter Substrate (`bedrock.tools._reporter`)
  - Task 1.3: Declarative Manifest Engine (`bedrock.tools._config` & `bedrock.toml`)
  - Task 1.4: Platform Audit Suite `audit_s001` through `audit_s004`
  - Task 1.5: Platform Audit Suite `audit_s005` through `audit_s008`
  - Task 1.6: Platform Audit Suite `audit_s009` through `audit_s012`
  - Task 1.7: Standards Synchronization & Suite Runner (`sync_standards` & `run_all`)
  - Task 1.8: Taxonomy Validator & Automated NTFS Remediator
  - Task 1.9: Bedrock Documentation Six-Folder Taxonomy Reorganization
  - Task 1.10: Unified QA Orchestrator (`run_qa.py`), Vitest Workspace & Dead-Code Checks
  - Task 1.11: Bedrock Pre-Flight Suite Verification & Local Validation
- **Phase 2: Bedrock Platform Release (`v0.10.0`)**
  - Task 2.1: Package Version Bumps, CHANGELOG Entry & Git Tag `v0.10.0`
- **Phase 3: CollectIt Consumer Migration**
  - Task 3.1: Dual-Pin Lockstep Bump to `v0.10.0`
  - Task 3.2: Automated NTFS Two-Stage Remediation & Template Kebab-Casing
  - Task 3.3: Deploy `CollectIt/bedrock.toml`, Mirror S001–S012 & Renumber S101–S102
  - Task 3.4: Partition `scripts/audits/` vs `scripts/maintenance/` & Delete Platform Duplicates
  - Task 3.5: Deploy `run_qa.py`, `run_audit.ps1`, Vitest Workspace & Pytest Markers
  - Task 3.6: Update CollectIt CI, `CLAUDE.md`, and `GEMINI.md`
- **Phase 4: MLBTracker Consumer Migration**
  - Task 4.1: Dual-Pin Lockstep Bump to `v0.10.0`
  - Task 4.2: Automated Remediation & Punchlist Eviction to `scratch/`
  - Task 4.3: Deploy `MLBTracker/bedrock.toml`, Mirror S001–S012 & Renumber S101–S102
  - Task 4.4: Partition `scripts/audits/` vs `scripts/maintenance/` & Delete Platform Duplicates
  - Task 4.5: Deploy `run_qa.py`, `run_audit.ps1`, Vitest Workspace, Pytest Markers & Hygiene Tests
  - Task 4.6: Update MLBTracker CI, `CLAUDE.md`, and `GEMINI.md`
- **Phase 5: Ecosystem-Wide Verification & Lock-In**
  - Task 5.1: Ecosystem Cross-Repo Audit Sweep & Clean Working Tree Verification

---

## Phase 0: Workstation & Tooling Foundation (Zero-Tag)

### Task 0.1: Headless PowerShell `$PROFILE` Zero-Token Bailout

**Agent Recommendation:**

- Claude: `model: haiku`, `effort: low`
- AGY: `model: flash`, `thinking: low`

**Files:**

- Modify: `C:\Users\SuperDan\Documents\PowerShell\Microsoft.PowerShell_profile.ps1`
- Backup: `C:\Users\SuperDan\Documents\PowerShell\Microsoft.PowerShell_profile.ps1.bak`

**Interfaces:**

- Consumes: PowerShell environment variables and stream redirection flags.
- Produces: Sub-10ms, silent execution for non-interactive / agent subprocesses while preserving interactive prompt decorations for human sessions.

- [x] **Step 1: Backup current PowerShell profile**

```powershell
Copy-Item -Path $PROFILE -Destination "$PROFILE.bak" -Force
```

- [x] **Step 2: Add non-interactive fast bailout to top of `$PROFILE`**
Insert at line 1 of `Microsoft.PowerShell_profile.ps1`:

```powershell
# 1. Fast-Path Headless / Agent Subshell Bailout
$isNonInteractive = (
    [Console]::IsOutputRedirected -or
    [Console]::IsInputRedirected -or
    $env:VSCODE_NONINTERACTIVE -or
    $env:ANTIGRAVITY_NONINTERACTIVE -or
    $env:CLAUDE_CODE_ENTRYPOINT -or
    $env:CLAUDE_NONINTERACTIVE -or
    ($env:TERM_PROGRAM -eq 'noninteractive') -or
    ($Host.Name -ne 'ConsoleHost') -or
    ([Environment]::CommandLine -match '(-NonInteractive|-Command|-EncodedCommand|-NoLogo|-c\b)')
)

# Global UTF-8 Encoding (Mandatory for deterministic Windows 11 tool execution)
$OutputEncoding = [System.Text.UTF8Encoding]::new()
[Console]::InputEncoding  = [System.Text.UTF8Encoding]::new()
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'

if ($isNonInteractive) {
    return
}
```

- [x] **Step 3: Verify non-interactive execution produces zero token overhead**
Run:

```powershell
pwsh -Command "Write-Output 'CLEAN_PROFILE'"
```

Expected output: Exactly `CLEAN_PROFILE` with zero terminal icons, PSReadLine messages, or banners.

---

### Task 0.2: Standardize `.gitignore` Baseline Across Repositories

**Agent Recommendation:**

- Claude: `model: haiku`, `effort: low`
- AGY: `model: flash`, `thinking: low`

**Files:**

- Modify: `C:\Dev\claude-kit\.gitignore`
- Modify: `C:\Dev\bedrock\.gitignore`
- Modify: `C:\Dev\CollectIt\.gitignore`
- Modify: `C:\Dev\MLBTracker\.gitignore`

**Interfaces:**
- Produces: Standardized, exhaustive `.gitignore` files with explanatory section headers, locking down runtime artifacts, database journals, data directories (`data/`, `imports/`, `exports/`), local workspace configurations, and deployed agentic tooling junctions.

- [ ] **Step 1: Deploy master `.gitignore` template across all repositories**
Deploy the following canonical master `.gitignore` template across `claude-kit`, `bedrock`, `CollectIt`, and `MLBTracker`, preserving only repository-specific build exemptions (e.g. `!packages/bedrock-ui/dist/` in Bedrock, or `!data/rankings.json` in MLBTracker/CollectIt):

```gitignore
# ==============================================================================
# AI AGENTS, WORKSPACES & LOCAL OVERRIDES
# 1. PYTHON, TESTING, COVERAGE & CACHE
# ==============================================================================
__pycache__/
*.py[cod]
*$py.class
*.egg-info/
.pytest_cache/
.coverage
htmlcov/
# pytest-testmon delta cache (per-developer / per-session local execution state)
.testmondata*
.testmon

# ==============================================================================
# 2. ENVIRONMENT, SECRETS & DEPENDENCY RUNTIMES
# ==============================================================================
.env
.env.*
!.env.example
.dependencies_installed
node_modules/
.venv/

# ==============================================================================
# 3. BUILD, PACKAGING & DISTRIBUTION ARTIFACTS
# ==============================================================================
build/
dist/
/packages/*/dist/
!packages/bedrock-ui/dist/
*.zip
*.tar.gz

# ==============================================================================
# 4. DATABASES, LOGS, DATA DIRECTORIES & RUNTIME ASSETS
# ==============================================================================
# SQLite database files and runtime sidecars
*.db
*.sqlite
*.sqlite3
*.db-wal
*.db-shm
*.db-journal
*.sqbpro
*.log

# Data directories (ephemeral downloads, uncommitted ETL data, backups, test fixtures)
data/
!data/rankings.json
imports/
exports/
Exports/
api/static/headshots/

# ==============================================================================
# 5. IDE, EDITOR, SYSTEM & LOCAL WORKSPACE PROFILES
# ==============================================================================
.vscode/*
!.vscode/settings.json
!.vscode/tasks.json
!.vscode/launch.json
.vscode/*.local.json
Thumbs.db
Desktop.ini
.DS_Store
*_FileTree.*

# Local workspace files (canonical <repo>.code-workspace and .antigravityrc are tracked)
*.code-workspace.local
.antigravityrc.local
.claude/settings.local.json
*.local.json
.antigravity/

# Agent runtime caches, state & worktrees
# ==============================================================================
# 6. AI AGENTS, TOOLING HOOKS & DEPLOYED READ-ONLY HARNESSES
# ==============================================================================
# Agent state caches & sandboxes
.playwright-mcp/
.superpowers/
.claude/state/
.claude/worktrees/
.playwright-mcp/
.superpowers/sdd/**
.claude/settings.local.json

# Deployed read-only junctions from claude-kit (in consumer repos: bedrock, CollectIt, MLBTracker)
# All agentic tools are authored canonically in claude-kit and linked as untracked junctions
.agents/skills/
.agents/agents/
.claude/skills/
.claude/agents/
.claude/hooks/

# ==============================================================================
# 7. DOCUMENTATION ARTIFACTS, DESIGNS & EPHEMERAL SCRATCH
# ==============================================================================
# Ephemeral developer scratch and punchlists
scratch/
docs/project/punchlists/
docs/reference/punchlists/

# Local workspace files
*.code-workspace.local
# Deprecated/pre-eviction directory guards (prevent accidental re-commit via git add -A)
docs/punchlists/
docs/archive/
docs/artifacts/
docs/screenshots/
docs/working files/

# pytest-testmon delta caches
.testmondata*

# Local SQLite databases & sidecars
*.db-wal
*.db-shm
*.db-journal
# Large binaries / screenshots outside designated design roots
debug_tab*.png
```

- [ ] **Step 2: Deploy cross-repository workspace permissions across all 4 targets**
Create or update local workspace override configurations (`.antigravityrc.local` and `.claude/settings.local.json`) across `bedrock`, `CollectIt`, `MLBTracker`, and `claude-kit` with explicit relative paths:

```json
{
  "permissions": {
    "additionalDirectories": [
      "../bedrock",
      "../claude-kit",
      "../CollectIt",
      "../MLBTracker"
    ],
    "allow": [
      "Read(//c/Dev/**)",
      "Edit(//c/Dev/**)"
    ]
  }
}
```

- [ ] **Step 3: Author and deploy PreToolUse file naming & path guard hook**
Author `C:\Dev\claude-kit\hooks\pre-tool-guard.ps1` and register the hook in `.claude/settings.json` across all repositories:

```powershell
# C:\Dev\claude-kit\hooks\pre-tool-guard.ps1
$inputJson = [Console]::In.ReadToEnd()
if (-not $inputJson) { exit 0 }
$data = $inputJson | ConvertFrom-Json
if (-not $data.tool_input) { exit 0 }

$path = if ($data.tool_input.file_path) { $data.tool_input.file_path } else { $data.tool_input.path }
if (-not $path) { exit 0 }
$norm = $path.Replace('\', '/')

# Block deprecated directories and unapproved punchlist locations across relative and absolute paths
if ($norm -match '(^|/)(Templates|Exports)/|(^|/)docs/(project/)?punchlists/') {
    [Console]::Error.WriteLine("[FATAL GUARD] Access Denied: Writes to '$norm' are forbidden. Use canonical lowercase directories.")
    exit 2
}

# Enforce kebab-case for markdown docs under docs/
if ($norm -match '(^|/)docs/.*\.md$') {
    $filename = Split-Path -Leaf $norm
    if ($filename -notin @('README.md', 'CLAUDE.md', 'GEMINI.md') -and $filename -notmatch '^[a-z0-9-]+(\.[a-z0-9-]+)*\.md$') {
        [Console]::Error.WriteLine("[FATAL GUARD] Access Denied: '$filename' must be lowercase kebab-case.")
        exit 2
    }
}
exit 0
```

Register the hook in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "pwsh -NoProfile -File \"$(git rev-parse --show-toplevel)/.claude/hooks/pre-tool-guard.ps1\""
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 4: Verify git status is clean of ephemeral files**
*(Note: In `claude-kit`, section 6 does NOT ignore `.claude/`, `rules/`, `skills/`, `agents/`, or `hooks/`, as `claude-kit` is the authoritative git repository for all agentic tools).*
 Run:

```powershell
"claude-kit", "bedrock", "CollectIt", "MLBTracker" | ForEach-Object {
    git -C "C:\Dev\$_" status --short
}
```
Expected output: Clean working trees without untracked `data/`, WAL sidecars, or local workspace files.


- [ ] **Step 5: Commit `.gitignore` across repositories**

```bash
# In claude-kit:
git -C C:\Dev\claude-kit add .gitignore && git -C C:\Dev\claude-kit commit -m "chore(git): standardize agentic .gitignore baseline"
# In bedrock:
git -C C:\Dev\bedrock add .gitignore && git -C C:\Dev\bedrock commit -m "chore(git): standardize agentic .gitignore baseline"
# In CollectIt:
git -C C:\Dev\CollectIt add .gitignore && git -C C:\Dev\CollectIt commit -m "chore(git): standardize agentic .gitignore baseline"
# In MLBTracker:
git -C C:\Dev\MLBTracker add .gitignore && git -C C:\Dev\MLBTracker commit -m "chore(git): standardize agentic .gitignore baseline"
git -C C:\Dev\claude-kit add .gitignore && git -C C:\Dev\claude-kit commit -m "chore(git): update comprehensive master .gitignore baseline"
git -C C:\Dev\bedrock add .gitignore && git -C C:\Dev\bedrock commit -m "chore(git): update comprehensive master .gitignore baseline"
git -C C:\Dev\CollectIt add .gitignore && git -C C:\Dev\CollectIt commit -m "chore(git): update comprehensive master .gitignore baseline"
git -C C:\Dev\MLBTracker add .gitignore && git -C C:\Dev\MLBTracker commit -m "chore(git): update comprehensive master .gitignore baseline"
```

---

### Task 0.3: Centralize Agentic Governance Engine, Declarative Manifests & Sync Engine

**Agent Recommendation:**

- Claude: `model: sonnet`, `effort: high`
- AGY: `model: pro`, `thinking: high`

**Files:**

- Author / Restructure in `C:\Dev\claude-kit\`:
- `rules/s01-ui-primitives.md`
- `rules/s03-logging-standards.md`
- `rules/s05-zero-broken-tests.md`
- `rules/ebay-sanitizer.md`
- `rules/stat-invariants.md`
- `skills/anti-ui-slop/SKILL.md`
- `skills/audit-ebay-compliance/SKILL.md`
- `skills/bump-bedrock-pin/SKILL.md`
- `skills/check-grid/SKILL.md`
- `skills/compact-test-runner/SKILL.md`
- `skills/cut-release/SKILL.md`
- `skills/grid-guru/SKILL.md`
- `skills/implement-issue/SKILL.md`
- `skills/react-best-practices/SKILL.md`
- `skills/run-tests/SKILL.md`
- `skills/sql-sentinel/SKILL.md`
- `skills/triage-plan/SKILL.md`
- `agents/backend-api-engineer.json`
- `agents/exporter-pipeline-specialist.json`
- `agents/frontend-ui-engineer.json`
- `agents/grid-sentinel.json`
- `agents/listing-studio-engineer.json`
- `agents/quality-gatekeeper.json`
- `agents/route-security-engineer.json`
- `agents/schema-domain-architect.json`
- `agents/ui-sentinel.json`
- `hooks/PreToolUse/pre-tool-guard.ps1`
- `hooks/PreToolUse/file_creation_guard.py`
- `hooks/post-edit-check.sh`
- `hooks/compaction_brief.py`
- `hooks/session_context.py`
- `hooks/stop-reminder.sh`
- `scripts/Sync-AgenticTooling.ps1`
- `scripts/Audit-AgenticTooling.ps1`
- `docs/guide/authoring-and-deploying-agentic-tooling.md`
- Consumer Manifests:
- `C:\Dev\bedrock\agentic.toml`
- `C:\Dev\CollectIt\agentic.toml`
- `C:\Dev\MLBTracker\agentic.toml`
- Registration: Windows Scheduled Task `Bedrock-Sync-AgenticTooling` and profile aliases

**Interfaces:**

- Consumes: Canonical flat asset registry (`rules/`, `skills/`, `agents/`, `hooks/`) in `claude-kit`.
- Consumes: Consumer-level capability requests defined in local `agentic.toml` files.
- Produces: Dual-target agent compilation (`.claude/agents/*.md` and `.agents/agents/*.md`), on-demand read-only NTFS Directory Junctions, hardened Windows ACL Deny rules, and global user discovery paths (`~/.gemini/skills`, `~/.claude/skills`).

- [ ] **Step 1: Author the flat canonical registry in `claude-kit`** Structure `C:\Dev\claude-kit` as an agnostic system of record with four core directories: `rules/`, `skills/`, `agents/`, and `hooks/`. Drop all domain namespaces (`plugins/collectit-doctrine`, `plugins/mlbtracker-doctrine`). Author all agent definitions as multi-target JSON schemas.

Create `C:\Dev\claude-kit\agents\ui-sentinel.json`:

```json
{
"name": "ui-sentinel",
"description": "Audits localhost applications via browser actuation, resolves console errors, enforces @djntechnic/bedrock-ui adoption, and flags inconsistent UX/save semantics.",
"deprecated": false,
"targets": {
"claude": {
"model": "sonnet",
"effort": "high",
"tools": ["Read", "Edit", "Bash"]
},
"antigravity": {
"model": "gemini-3.1-pro",
"thinking": "high",
"mainAgent": true,
"subagent": true,
"tools": ["view_file", "replace_file_content", "run_command"],
"skills": ["anti-ui-slop", "react-best-practices"],
"commandExecutionPolicy": "auto"
}
},
"directives": [
"Zero Duplicate UI (§S001): Compose only from @djntechnic/bedrock-ui primitives.",
"Design Tokens (§S009): Enforce theme token compliance; reject bare hex literals.",
"Console Cleanliness (§S003): Ensure browser console is clear of warnings and unhandled rejections."
]
}
```

Create `C:\Dev\claude-kit\agents\grid-sentinel.json`:

```json
{
"name": "grid-sentinel",
"description": "DataGrid and 7-layer contract specialist. Audits, wires, and refactors DataGrids, useGridConfig, and Admin Grid Editor sync.",
"deprecated": false,
"targets": {
"claude": {
"model": "sonnet",
"effort": "high",
"tools": ["Read", "Edit", "Bash"]
},
"antigravity": {
"model": "gemini-3.1-pro",
"thinking": "high",
"mainAgent": true,
"subagent": true,
"tools": ["view_file", "replace_file_content", "run_command"],
"skills": ["check-grid", "grid-guru"],
"commandExecutionPolicy": "auto"
}
},
"directives": [
"Standardized Grid Engine (§S002): All tabular data must compose the platform <DataGrid> and consume useGridConfig(gridId).",
"7-Layer Contract Alignment: Every grid field must align across DB, migrations, Pydantic, route GET/PATCH, TS interfaces, runtime mapping, and UI components.",
"Podium & Medal Gating: Row medal/podium tints (getRankRowClass) must be strictly gated on config.showRankHighlight."
]
}
```

- [ ] **Step 2: Deploy declarative `agentic.toml` manifests to consumer repositories**

Create `C:\Dev\CollectIt\agentic.toml`:

```ini, toml
[runtime]
harness = ["claude", "antigravity"]
isolation_mode = "read_only_junction"

rules = [
"s01-ui-primitives",
"s03-logging-standards",
"s05-zero-broken-tests",
"ebay-sanitizer"
]

skills = [
"anti-ui-slop",
"audit-ebay-compliance",
"bump-bedrock-pin",
"compact-test-runner",
"implement-issue",
"react-best-practices",
"run-tests",
"sql-sentinel",
"triage-plan"
]

agents = [
"exporter-pipeline-specialist",
"listing-studio-engineer",
"quality-gatekeeper",
"route-security-engineer",
"schema-domain-architect",
"ui-sentinel"
]

hooks = [
"pre-tool-guard.ps1",
"post-edit-check.sh"
]
```

Create `C:\Dev\MLBTracker\agentic.toml`:

```ini, toml
[runtime]
harness = ["claude", "antigravity"]
isolation_mode = "read_only_junction"

rules = [
"s01-ui-primitives",
"s03-logging-standards",
"s05-zero-broken-tests",
"stat-invariants"
]

skills = [
"anti-ui-slop",
"audit-ebay-compliance",
"bump-bedrock-pin",
"check-grid",
"compact-test-runner",
"grid-guru",
"implement-issue",
"react-best-practices",
"run-tests",
"sql-sentinel",
"triage-plan"
]

agents = [
"backend-api-engineer",
"frontend-ui-engineer",
"grid-sentinel",
"quality-gatekeeper",
"schema-domain-architect",
"ui-sentinel"
]

hooks = [
"pre-tool-guard.ps1",
"compaction_brief.py",
"session_context.py",
"stop-reminder.sh"
]
```

Create `C:\Dev\bedrock\agentic.toml`:

```ini, toml
[runtime]
harness = ["claude", "antigravity"]
isolation_mode = "read_only_junction"

rules = [
"s01-ui-primitives",
"s03-logging-standards",
"s05-zero-broken-tests"
]

skills = [
"anti-ui-slop",
"bump-bedrock-pin",
"compact-test-runner",
"cut-release",
"react-best-practices",
"sql-sentinel",
"triage-plan"
]

agents = [
"backend-api-engineer",
"frontend-ui-engineer",
"quality-gatekeeper",
"ui-sentinel"
]

hooks = [
"pre-tool-guard.ps1"
]
```

- [ ] **Step 3: Implement `Sync-AgenticTooling.ps1` compilation and binding engine**
Author `C:\Dev\claude-kit\scripts\Sync-AgenticTooling.ps1`:

```powershell
<#
.SYNOPSIS
    Compiles and mounts declarative agentic tools from claude-kit into consumer workspaces.
.DESCRIPTION
    Parses agentic.toml, mounts requested rules and skills via NTFS junctions, compiles
    dialect-specific agent definitions for Claude Code and Antigravity, provisions lifecycle
    hooks, resolves third-party skill fallbacks, and applies read-only Windows ACLs.
.PARAMETER RepoRoot
    Target repository path. Defaults to the current working directory.
.PARAMETER All
    Iterates and applies synchronization across bedrock, CollectIt, and MLBTracker.
.PARAMETER Clean
    Purges dynamic junctions and compiled agent targets, returning the workspace to a zero-agent state.
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = (Get-Location).Path,
    [switch]$All,
    [switch]$Clean
)

$ErrorActionPreference = 'Stop'
$KitRoot = 'C:\Dev\claude-kit'
$TargetRepos = if ($All) { @('C:\Dev\bedrock', 'C:\Dev\CollectIt', 'C:\Dev\MLBTracker') } else { @($RepoRoot) }

function Reset-Junction([string]$Path) {
    if (Test-Path -LiteralPath $Path) {
        # Temporarily clear Deny rules to allow directory reset
        try {
            $acl = Get-Acl -LiteralPath $Path
            $denyRules = $acl.Access | Where-Object { $_.AccessControlType -eq 'Deny' }
            foreach ($rule in $denyRules) {
                $acl.RemoveAccessRule($rule) | Out-Null
            }
            Set-Acl -LiteralPath $Path -AclObject $acl -ErrorAction SilentlyContinue
        } catch {}

        $item = Get-Item -LiteralPath $Path -Force
        if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
            $item.Delete()
        } else {
            Remove-Item -LiteralPath $Path -Recurse -Force
        }
    }
    $null = New-Item -ItemType Directory -Path $Path -Force
}

# 1. Global User Directory Discovery Sync
$globalSkillPaths = @(
    "$HOME\.claude\skills",
    "$HOME\.gemini\skills",
    "$HOME\.gemini\antigravity\skills"
)
foreach ($gp in $globalSkillPaths) {
    if (-not (Test-Path -LiteralPath $gp)) {
        $null = New-Item -ItemType Directory -Path $gp -Force
    }
}
$allSharedSkills = Get-ChildItem -Path "$KitRoot\skills" -Directory
foreach ($sk in $allSharedSkills) {
    foreach ($gp in $globalSkillPaths) {
        $dest = Join-Path $gp $sk.Name
        if (-not (Test-Path -LiteralPath $dest)) {
            $null = New-Item -ItemType Junction -Path $dest -Target $sk.FullName
        }
    }
}

# 2. Downstream Consumer Synchronization
foreach ($repo in $TargetRepos) {
    $manifestPath = Join-Path $repo 'agentic.toml'
    if (-not (Test-Path -LiteralPath $manifestPath)) { continue }

    Write-Host "Syncing Agentic Tooling for: $repo" -ForegroundColor Cyan

    $manifest = & python -c "import tomllib, json, sys; print(json.dumps(tomllib.load(open(sys.argv[1], 'rb'))))" $manifestPath | ConvertFrom-Json

    $claudeRules  = Join-Path $repo '.claude\rules'
    $claudeSkills = Join-Path $repo '.claude\skills'
    $claudeAgents = Join-Path $repo '.claude\agents'
    $claudeHooks  = Join-Path $repo '.claude\hooks'
    $agentRules   = Join-Path $repo '.agents\rules'
    $agentSkills  = Join-Path $repo '.agents\skills'
    $agentAgents  = Join-Path $repo '.agents\agents'

    Reset-Junction $claudeRules
    Reset-Junction $claudeSkills
    Reset-Junction $claudeAgents
    Reset-Junction $claudeHooks
    Reset-Junction $agentRules
    Reset-Junction $agentSkills
    Reset-Junction $agentAgents

    if ($Clean) {
        Write-Host "[$repo] Cleaned all local mounts." -ForegroundColor Yellow
        continue
    }

    # Mount Rules
    if ($manifest.rules) {
        foreach ($ruleName in $manifest.rules) {
            $src = Join-Path $KitRoot "rules\$ruleName.md"
            if (Test-Path -LiteralPath $src) {
                Copy-Item -LiteralPath $src -Destination (Join-Path $claudeRules "$ruleName.md") -Force
                Copy-Item -LiteralPath $src -Destination (Join-Path $agentRules "$ruleName.md") -Force
                Write-Host "  -> Synced Rule: $ruleName" -ForegroundColor DarkGray
            } else {
                Write-Warning "[$repo] Rule not found in claude-kit: $ruleName"
            }
        }
    }

    # Mount Requested Skills (with Third-Party Fallback)
    if ($manifest.skills) {
        foreach ($skillName in $manifest.skills) {
            $src = Join-Path $KitRoot "skills\$skillName"
            if (-not (Test-Path -LiteralPath $src)) {
                # Fallback to globally installed external runtime skills (e.g. superpowers)
                $globalFallback = Join-Path "$HOME\.claude\skills" $skillName
                if (Test-Path -LiteralPath $globalFallback) {
                    $src = $globalFallback
                }
            }

            if (Test-Path -LiteralPath $src) {
                $null = New-Item -ItemType Junction -Path (Join-Path $claudeSkills $skillName) -Target $src
                $null = New-Item -ItemType Junction -Path (Join-Path $agentSkills $skillName) -Target $src
                Write-Host "  -> Linked Skill: $skillName" -ForegroundColor DarkGray
            } else {
                Write-Warning "[$repo] Skill not found in claude-kit or global paths: $skillName"
            }
        }
    }

    # Compile Dual-Dialect Agents
    if ($manifest.agents) {
        foreach ($agentName in $manifest.agents) {
            $srcJson = Join-Path $KitRoot "agents\$agentName.json"
            if (-not (Test-Path -LiteralPath $srcJson)) {
                Write-Warning "[$repo] Agent schema not found in claude-kit: $agentName"
                continue
            }
            $agentDef = Get-Content -LiteralPath $srcJson -Raw | ConvertFrom-Json
            if ($agentDef.deprecated -eq $true) {
                Write-Warning "[$repo] Skipping deprecated agent: $agentName"
                continue
            }

			# Claude Format (.claude/agents/<agent>.md)
            $claudeMd = Join-Path $claudeAgents "$agentName.md"
            $cTools = ($agentDef.targets.claude.tools | ForEach-Object { "  - $_" }) -join "`n"
            $cDirectives = ($agentDef.directives | ForEach-Object { "- $_" }) -join "`n"
            @"
---
name: $($agentDef.name)
description: $($agentDef.description)
model: $($agentDef.targets.claude.model)
effort: $($agentDef.targets.claude.effort)
tools:
$cTools
---

# $($agentDef.name)
$($agentDef.description)

## Directives
$cDirectives
"@ | Set-Content -LiteralPath $claudeMd -Encoding utf8

            # Antigravity Format (.agents/agents/<agent>.md)
            $agyMd = Join-Path $agentAgents "$agentName.md"
            $aTools = ($agentDef.targets.antigravity.tools | ForEach-Object { "  - $_" }) -join "`n"
            $aSkills = if ($agentDef.targets.antigravity.skills) {
                "`nskills:`n" + (($agentDef.targets.antigravity.skills | ForEach-Object { "  - $_" }) -join "`n")
            } else { "" }
@"
---
name: $($agentDef.name)
description: $($agentDef.description)
model: $($agentDef.targets.antigravity.model)
thinking: $($agentDef.targets.antigravity.thinking)
mainAgent: true
subagent: true
tools:
$aTools$aSkills
commandExecutionPolicy: auto
---

# $($agentDef.name)
$($agentDef.description)

## Directives
$cDirectives
"@ | Set-Content -LiteralPath $agyMd -Encoding utf8

            Write-Host "  -> Compiled Agent: $agentName" -ForegroundColor DarkGray
        }
    }

	# Mount Lifecycle Hooks
    if ($manifest.hooks) {
        foreach ($hookFile in $manifest.hooks) {
            $hSrc = Join-Path $KitRoot "hooks\$hookFile"
            if (Test-Path -LiteralPath $hSrc) {
                Copy-Item -LiteralPath $hSrc -Destination (Join-Path $claudeHooks $hookFile) -Force
                Write-Host "  -> Synced Hook: $hookFile" -ForegroundColor DarkGray
            }
        }
    }

    # Enforce Read-Only Windows ACLs
    $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $denyRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        $currentUser,
        "Write, Delete, DeleteSubdirectoriesAndFiles",
        "ContainerInherit, ObjectInherit",
        "None",
        "Deny"
    )
    foreach ($dir in @($claudeRules, $agentRules, $claudeSkills, $agentSkills, $claudeAgents, $agentAgents)) {
        $acl = Get-Acl -LiteralPath $dir
        $acl.AddAccessRule($denyRule)
        Set-Acl -LiteralPath $dir -AclObject $acl
    }
```

- [ ] **Step 4: Author `claude-kit/docs/guide/authoring-and-deploying-agentic-tooling.md`** Document the canonical governance model:

1. All rules, skills, agents, and hooks are authored directly in `claude-kit`.
2. Repositories specify tooling requirements declaratively in `agentic.toml`.
3. Agent definitions use multi-target `.json` files that compile to Claude and Antigravity frontmatter dialects.
4. NTFS Directory Junctions allow tool re-use across repositories without duplicating files.
5. Windows ACL Deny rules lock local consumer tool directories to prevent modifications by autonomous agents.
6. Retiring or deprecating a tool in `claude-kit` removes it from consumers on the next synchronization.

- [ ] **Step 5: Execute initial synchronization across all targets** Run:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File "C:\Dev\claude-kit\scripts\Sync-AgenticTooling.ps1" -All
```

Expected output: All junctions, compiled agents, and hooks are deployed across `bedrock`, `CollectIt`, and `MLBTracker` with status `PASS`.

- [ ] **Step 6: Register Windows Scheduled Task and interactive aliases** Run:

```powershell
$action = New-ScheduledTaskAction -Execute "pwsh.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File C:\Dev\claude-kit\scripts\Sync-AgenticTooling.ps1 -All"
$trigger1 = New-ScheduledTaskTrigger -AtLogon
$trigger2 = New-ScheduledTaskTrigger -Daily -At 03:00AM
Register-ScheduledTask -TaskName "Bedrock-Sync-AgenticTooling" -Action $action -Trigger @($trigger1, $trigger2) -Description "Synchronizes Bedrock declarative agentic tools and junctions" -Force

# Append aliases to PowerShell profile
$aliasBlock = @'

# Agentic Tooling Governance Aliases
Set-Alias -Name sync-agentic-tooling -Value "C:\Dev\claude-kit\scripts\Sync-AgenticTooling.ps1"
Set-Alias -Name Invoke-AgenticTool -Value "C:\Dev\claude-kit\scripts\Sync-AgenticTooling.ps1"
'@
if ((Get-Content $PROFILE -Raw) -notmatch 'sync-agentic-tooling') {
    Add-Content -Path $PROFILE -Value $aliasBlock
}
```

Expected output: Scheduled task registered; aliases active in interactive profile sessions.

- [ ] **Step 7: Commit configuration in `claude-kit` and consumer repositories**

```bash
# In claude-kit:
git -C C:\Dev\claude-kit add rules/ skills/ agents/ hooks/ docs/ scripts/Sync-AgenticTooling.ps1
git -C C:\Dev\claude-kit commit -m "feat(doctrine): implement flat declarative agentic governance engine"

# In consumers:
git -C C:\Dev\bedrock add agentic.toml && git -C C:\Dev\bedrock commit -m "chore(agents): add declarative agentic.toml manifest"
git -C C:\Dev\CollectIt add agentic.toml && git -C C:\Dev\CollectIt commit -m "chore(agents): add declarative agentic.toml manifest"
git -C C:\Dev\MLBTracker add agentic.toml && git -C C:\Dev\MLBTracker commit -m "chore(agents): add declarative agentic.toml manifest"
```

---

### Task 0.4: Clean Up Inconsistent Symlinks, Deprecated Tools & Token Bloat

**Agent Recommendation:**
- Claude: `model: sonnet`, `effort: medium`
- AGY: `model: pro`, `thinking: medium`

**Files:**
- Clean up: `C:\Dev\MLBTracker\.agents\skills\grid-refact` (permanently retire and delete)
- Convert: Convert existing `SymbolicLink` directories in `CollectIt`, `MLBTracker`, `bedrock`, and `$HOME\.gemini\skills` to uniform `Junction` points
- Create: `C:\Dev\claude-kit\scripts\Audit-AgenticTooling.ps1`

**Interfaces:**
- Consumes: Target directories across all repos and user profile.
- Produces: Clean, uniform `LinkType: Junction` for all linked tools with zero dangling symlinks, zero redundant skills, and zero token waste during context discovery.

- [ ] **Step 1: Unlock and retire deprecated skills across repos**
Temporarily strip Deny ACLs if present, then purge obsolete tools:
Run:
```powershell
$deprecatedPaths = @(
    "C:\Dev\MLBTracker\.agents\skills\grid-refact",
    "C:\Dev\MLBTracker\.claude\skills\grid-refact",
    "C:\Dev\CollectIt\.agents\skills\triage-plan-agy",
    "C:\Dev\CollectIt\.claude\skills\triage-plan-agy"
)

foreach ($path in $deprecatedPaths) {
    if (Test-Path -LiteralPath $path) {
        try {
            $parent = Split-Path -Parent $path
            $acl = Get-Acl -LiteralPath $parent
            $denyRules = $acl.Access | Where-Object { $_.AccessControlType -eq 'Deny' }
            foreach ($rule in $denyRules) {
                $acl.RemoveAccessRule($rule) | Out-Null
            }
            Set-Acl -LiteralPath $parent -AclObject $acl -ErrorAction SilentlyContinue
        } catch {}

        $item = Get-Item -LiteralPath $path -Force
        if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
            $item.Delete()
        } else {
            Remove-Item -LiteralPath $path -Recurse -Force
        }
        Write-Host "Purged deprecated path: $path" -ForegroundColor Green
    }
}
```

- [ ] **Step 2: Convert existing `SymbolicLink` directories to pure NTFS Junctions**
Run:
```powershell
"CollectIt", "MLBTracker", "bedrock" | ForEach-Object {
    $repo = $_
    Get-ChildItem -Path "C:\Dev\$repo\.agents\skills", "C:\Dev\$repo\.claude\skills" -ErrorAction SilentlyContinue | Where-Object {
        $_.LinkType -eq 'SymbolicLink'
    } | ForEach-Object {
        $target = $_.Target
        $path = $_.FullName
        Remove-Item -Path $path -Force
        New-Item -ItemType Junction -Path $path -Target $target | Out-Null
        Write-Host "Converted $path to Junction -> $target" -ForegroundColor Green
    }
}

# Convert global $HOME\.gemini\skills
Get-ChildItem -Path "$HOME\.gemini\skills" -ErrorAction SilentlyContinue | Where-Object {
    $_.LinkType -eq 'SymbolicLink'
} | ForEach-Object {
    $target = $_.Target
    $path = $_.FullName
    Remove-Item -Path $path -Force
    New-Item -ItemType Junction -Path $path -Target $target | Out-Null
    Write-Host "Converted $path to Junction -> $target" -ForegroundColor Green
}
```

- [ ] **Step 3: Implement and execute `Audit-AgenticTooling.ps1`**
Create `C:\Dev\claude-kit\scripts\Audit-AgenticTooling.ps1` verifying:
1. Every linked skill and agent across repos has `LinkType: Junction`.
2. Every junction target exists on disk (0 dangling pointers).
3. Deprecated tools (`grid-refact`, legacy `triage-plan-agy`) do not exist.
4. Stale compaction and transient files are absent from tracking (`.claude/state/compaction-brief.md`, `.gemini/audits/`, `.gemini/tracking/`).

- [ ] **Step 4: Commit in `claude-kit`**

```bash
git -C C:\Dev\claude-kit add scripts/Sync-AgenticTooling.ps1
git -C C:\Dev\claude-kit commit -m "feat(tooling): deploy Sync-AgenticTooling engine and task registration"
git -C C:\Dev\claude-kit add scripts/Audit-AgenticTooling.ps1
git -C C:\Dev\claude-kit commit -m "feat(tooling): implement Audit-AgenticTooling verification engine"
```

---

### Task 0.5: Deploy Superpowers Path Alignment & Windows Scheduled Task

**Agent Recommendation:**

- Claude: `model: sonnet`, `effort: low`
- AGY: `model: flash`, `thinking: low`

**Files:**

- Modify: `C:\Dev\TheLab\WorkstationTools\SuperpowersUpdates\update-superpowers-paths.ps1`
- Register: Windows Scheduled Task `Bedrock-Align-SuperpowersPaths`

**Interfaces:**

- Produces: Automatic rewriting of installed superpower skills (`brainstorming`, `writing-plans`, `executing-plans`) to emit specs to `docs/specs` and plans to `docs/plans`.

- [x] **Step 1: Set canonical paths in `update-superpowers-paths.ps1`**
Ensure default parameters in `update-superpowers-paths.ps1` specify:

```powershell
[string]$CustomSpecPath = "docs/specs",
[string]$CustomPlanPath = "docs/plans",
```

- [x] **Step 2: Execute `update-superpowers-paths.ps1`**
Run:
      Run:

```powershell
pwsh -File "C:\Dev\TheLab\WorkstationTools\SuperpowersUpdates\update-superpowers-paths.ps1"
```

Expected output: All superpower skills patched successfully.

- [x] **Step 3: Register Windows Scheduled Task**
Run:

```powershell
$action = New-ScheduledTaskAction -Execute "pwsh.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File C:\Dev\TheLab\WorkstationTools\SuperpowersUpdates\update-superpowers-paths.ps1 -CustomSpecPath docs/specs -CustomPlanPath docs/plans"
$trigger = New-ScheduledTaskTrigger -AtLogon
Register-ScheduledTask -TaskName "Bedrock-Align-SuperpowersPaths" -Action $action -Trigger $trigger -Description "Aligns superpower skill output paths to canonical 6-folder model" -Force
```

Expected output: Task registered with state `Ready`.

---

## Phase 1: Bedrock Canonical Platform Implementation

### Task 1.1: Platform Standards `s001` through `s012` Authoring & Citation Sweep

**Agent Recommendation:**

- Claude: `model: sonnet`, `effort: high`
- AGY: `model: pro`, `thinking: high`

**Files:**

- Create: `C:\Dev\bedrock\docs\standards\README.md`
- Create: `C:\Dev\bedrock\docs\standards\s001-no-duplicate-ui-code.md`
- Create: `C:\Dev\bedrock\docs\standards\s002-all-grids-wired-to-admin-config.md`
- Create: `C:\Dev\bedrock\docs\standards\s003-logging-protocol.md`
- Create: `C:\Dev\bedrock\docs\standards\s004-no-hardcoded-config-settings.md`
- Create: `C:\Dev\bedrock\docs\standards\s005-test-coverage-mandatory.md`
- Create: `C:\Dev\bedrock\docs\standards\s006-defect-isolation-and-pr-workflow.md`
- Create: `C:\Dev\bedrock\docs\standards\s007-schema-catalog.md`
- Create: `C:\Dev\bedrock\docs\standards\s008-documentation-layout-and-naming.md`
- Create: `C:\Dev\bedrock\docs\standards\s009-design-system.md`
- Create: `C:\Dev\bedrock\docs\standards\s010-granular-security-model.md`
- Create: `C:\Dev\bedrock\docs\standards\s011-config-driven-navigation.md`
- Create: `C:\Dev\bedrock\docs\standards\s012-dual-pin-platform-governance.md`
- Modify: Repository-wide find-and-replace across `bedrock/docs/` and `packages/`

**Interfaces:**

- Produces: Authoritative platform standards with 3-digit padded references (`§S001`–`§S012`) and zero domain-specific artifacts.

- [x] **Step 1: Author `docs/standards/s001-no-duplicate-ui-code.md` through `s012-dual-pin-platform-governance.md`**
Populate each standard document ensuring:
      Populate each standard document ensuring:
- Title uses 3-digit padded notation: `# Standard S001: No Duplicate UI Code`.
- Text citations use `§S001` through `§S012`.
- Standards map 1:1 to `bedrock.tools.audit_s###`.

- [x] **Step 2: Create `docs/standards/README.md` index catalog**
Include catalog table indexing S001 through S012 with contract descriptions and audit tool links.
      Include catalog table indexing S001 through S012 with contract descriptions and audit tool links.

- [x] **Step 3: Execute repository-wide find-and-replace sweep in Bedrock**
Replace all legacy references (`S01`, `S1`, `S02`, etc.) with canonical 3-digit padded notation (`§S001`, `§S002`) and updated kebab-case filenames across `docs/` and `packages/bedrock-api`.
      Replace all legacy references (`S01`, `S1`, `S02`, etc.) with canonical 3-digit padded notation (`§S001`, `§S002`) and updated kebab-case filenames across `docs/` and `packages/bedrock-api`.

- [x] **Step 4: Verify markdown formatting**
Run:
      Run:

```powershell
Get-ChildItem C:\Dev\bedrock\docs\standards\*.md | Select-Object Name
```

Expected output: Exactly `README.md` and `s001-*.md` through `s012-*.md`.

- [x] **Step 5: Commit in Bedrock**

```bash
git -C C:\Dev\bedrock add docs/standards/
git -C C:\Dev\bedrock commit -m "docs(standards): author canonical platform standards s001-s012 and sweep citations"
```

---

### Task 1.2: Audit Reporter Substrate (`bedrock.tools._reporter`)

**Agent Recommendation:**

- Claude: `model: sonnet`, `effort: medium`
- AGY: `model: pro`, `thinking: medium`

**Files:**

- Create: `packages/bedrock-api/bedrock/tools/_reporter.py`
- Test: `packages/bedrock-api/tests/test_reporter.py`

**Interfaces:**

- Produces: `AuditReporter(audit_code: str, audit_name: str, repo_root: Path, config_file: Path)`
  - `start_check(description: str) -> None`
  - `pass_check(details: str = "") -> None`
  - `fail_check(message: str, file_path: Path | str = None, line: int = None, hint: str = None) -> None`
  - `finish() -> int` (returns `0` on success, `1` on violation, `2` on configuration error)

- [x] **Step 1: Write failing unit test for `AuditReporter`**

```python
# packages/bedrock-api/tests/test_reporter.py
from pathlib import Path
from bedrock.tools._reporter import AuditReporter

def test_audit_reporter_pass():
    reporter = AuditReporter("S001", "No Duplicate UI Code", Path("."), Path("bedrock.toml"))
    reporter.start_check("Scanning components")
    reporter.pass_check("Found 0 duplicates")
    assert reporter.finish() == 0

def test_audit_reporter_fail():
    reporter = AuditReporter("S001", "No Duplicate UI Code", Path("."), Path("bedrock.toml"))
    reporter.start_check("Scanning components")
    reporter.fail_check("Twin component found", file_path="Button.tsx", line=10, hint="Use bedrock-ui")
    assert reporter.finish() == 1
```

- [x] **Step 2: Run test to verify it fails**
Run: `pytest packages/bedrock-api/tests/test_reporter.py`
Expected output: FAIL (`ModuleNotFoundError: No module named 'bedrock.tools._reporter'`).
      Run: `pytest packages/bedrock-api/tests/test_reporter.py`
      Expected output: FAIL (`ModuleNotFoundError: No module named 'bedrock.tools._reporter'`).

- [x] **Step 3: Implement `bedrock/tools/_reporter.py`**
Implement standard 80-column banner, monotonic microsecond timings, formatted failure output with line pointers and remediation hints, and exit code propagation.
      Implement standard 80-column banner, monotonic microsecond timings, formatted failure output with line pointers and remediation hints, and exit code propagation.

- [x] **Step 4: Run test to verify it passes**
Run: `pytest packages/bedrock-api/tests/test_reporter.py`
Expected output: PASS (all tests green).
      Run: `pytest packages/bedrock-api/tests/test_reporter.py`
      Expected output: PASS (all tests green).

- [x] **Step 5: Commit in Bedrock**

```bash
git -C C:\Dev\bedrock add packages/bedrock-api/bedrock/tools/_reporter.py packages/bedrock-api/tests/test_reporter.py
git -C C:\Dev\bedrock commit -m "feat(tools): implement unified AuditReporter engine"
```

---

### Task 1.3: Declarative Manifest Engine (`bedrock.tools._config` & `bedrock.toml`)

**Agent Recommendation:**

- Claude: `model: sonnet`, `effort: medium`
- AGY: `model: pro`, `thinking: medium`

**Files:**

- Create: `packages/bedrock-api/bedrock/tools/_config.py`
- Test: `packages/bedrock-api/tests/test_config.py`
- Create: `C:\Dev\bedrock\bedrock.toml`

**Interfaces:**

- Produces: `load_bedrock_config(repo_root: Path | None = None) -> BedrockConfig`
  - Loads `bedrock.toml` via `tomllib`.
  - Merges consumer exemptions additively with platform defaults.
  - Enforces that every tool section has an `exemptions = [...]` list.

- [x] **Step 1: Write failing unit test for `load_bedrock_config`**

```python
# packages/bedrock-api/tests/test_config.py
from pathlib import Path
from bedrock.tools._config import load_bedrock_config

def test_load_valid_config(tmp_path: Path):
    toml_content = """
    [tool.bedrock]
    schema_catalog = "api/core/schema_catalog.py"
    [tool.bedrock.audit.s001]
    exemptions = ["TwinComponent"]
    """
    (tmp_path / "bedrock.toml").write_text(toml_content, encoding="utf-8")
    cfg = load_bedrock_config(tmp_path)
    assert "TwinComponent" in cfg.audit_s001.exemptions
    assert "default" in cfg.audit_s001.exemptions  # Platform baseline merged
```

- [x] **Step 2: Run test to verify it fails**
Run: `pytest packages/bedrock-api/tests/test_config.py`
Expected output: FAIL.
      Run: `pytest packages/bedrock-api/tests/test_config.py`
      Expected output: FAIL.

- [x] **Step 3: Implement `bedrock/tools/_config.py` and `bedrock.toml`**
Implement typed config dataclasses with default baselines and additive merging. Create canonical `bedrock.toml` at Bedrock root.
      Implement typed config dataclasses with default baselines and additive merging. Create canonical `bedrock.toml` at Bedrock root.

- [x] **Step 4: Run test to verify it passes**
Run: `pytest packages/bedrock-api/tests/test_config.py`
Expected output: PASS.
      Run: `pytest packages/bedrock-api/tests/test_config.py`
      Expected output: PASS.

- [x] **Step 5: Commit in Bedrock**

```bash
git -C C:\Dev\bedrock add packages/bedrock-api/bedrock/tools/_config.py packages/bedrock-api/tests/test_config.py bedrock.toml
git -C C:\Dev\bedrock commit -m "feat(tools): implement declarative bedrock.toml configuration loader"
```

---

### Task 1.4: Platform Audit Suite `audit_s001` through `audit_s004`

**Agent Recommendation:**

- Claude: `model: sonnet`, `effort: high`
- AGY: `model: pro`, `thinking: high`

**Files:**

- Create: `packages/bedrock-api/bedrock/tools/audit_s001_duplicates.py` (promoted from `audit_s1_duplicates.py`)
- Create: `packages/bedrock-api/bedrock/tools/audit_s002_grids.py` (promoted from MLBTracker 69KB engine)
- Create: `packages/bedrock-api/bedrock/tools/audit_s003_logging.py` (new AST/regex logging gate)
- Create: `packages/bedrock-api/bedrock/tools/audit_s004_config.py` (promoted from MLBTracker 27KB engine)
- Tests: `packages/bedrock-api/tests/test_audit_s001_to_s004.py`

**Interfaces:**

- Consumes: `load_bedrock_config`, `AuditReporter`.
- Produces: Standalone CLI tools returning exit codes `0`, `1`, or `2`.

- [x] **Step 1: Write unit tests verifying CLI exit codes for `audit_s001`–`audit_s004`**
- [x] **Step 2: Implement `audit_s001_duplicates.py`**
- [x] **Step 3: Implement `audit_s002_grids.py`** (purge hardcoded app tables, source presentational tables from config)
- [x] **Step 4: Implement `audit_s003_logging.py`** (ban bare `console.*` and `print`)
- [x] **Step 5: Implement `audit_s004_config.py`** (AppConfigKey enum matching)
- [x] **Step 6: Run tests to verify they pass**
Run: `pytest packages/bedrock-api/tests/test_audit_s001_to_s004.py`
Expected output: PASS.
      Run: `pytest packages/bedrock-api/tests/test_audit_s001_to_s004.py`
      Expected output: PASS.
- [x] **Step 7: Commit in Bedrock**

```bash
git -C C:\Dev\bedrock add packages/bedrock-api/bedrock/tools/audit_s001_duplicates.py packages/bedrock-api/bedrock/tools/audit_s002_grids.py packages/bedrock-api/bedrock/tools/audit_s003_logging.py packages/bedrock-api/bedrock/tools/audit_s004_config.py packages/bedrock-api/tests/test_audit_s001_to_s004.py
git -C C:\Dev\bedrock commit -m "feat(tools): implement platform audits s001 through s004"
```

---

### Task 1.4.1: Harden Platform Audit S002 Engine and Synchronize Specification Documentation

**Files:**

- Modify: `packages/bedrock-api/bedrock/tools/audit_s002_grids.py`
- Modify: `packages/bedrock-api/tests/test_audit_s001_to_s004.py`
- Modify: `docs/standards/s002-all-grids-wired-to-admin-config.md`

**Interfaces:**

- Consumes: `load_bedrock_config`, `AuditReporter`.
- Produces: `bedrock.tools.audit_s002_grids` exit codes `0`, `1`, `2`, now also
  enforcing `page`, `row_key_column`, and Admin Grid Preview API wiring.

- [x] **Step 1: Write failing tests for `page`, `row_key_column`, and Preview API wiring invariants**
- [x] **Step 2: Harden `audit_s002_grids.py`** (enforce non-empty `page`, valid `row_key_column`, wired preview API endpoint; emit file/line/hint via `AuditReporter.fail_check`)
- [x] **Step 3: Synchronize `docs/standards/s002-all-grids-wired-to-admin-config.md`** with the 3 new invariants and TypeScript contract examples
- [x] **Step 4: Run tests to verify they pass**
Run: `pytest packages/bedrock-api/tests/test_audit_s001_to_s004.py -k "s002"`
Expected output: PASS.
      Run: `pytest packages/bedrock-api/tests`
      Expected output: 636 passed.
- [x] **Step 5: Commit in Bedrock**

```bash
git -C C:\Dev\bedrock add packages/bedrock-api/bedrock/tools/audit_s002_grids.py packages/bedrock-api/tests/test_audit_s001_to_s004.py docs/standards/s002-all-grids-wired-to-admin-config.md docs/standards/README.md
git -C C:\Dev\bedrock commit -m "feat(audit): harden audit_s002 with page taxonomy, row_key, and preview API checks"
```

---

### Task 1.4.2: Expand Standard S007 and Harden Platform Database Schema Invariants

**Files:**

- Modify: `docs/standards/s007-schema-catalog.md`
- Modify: `docs/plans/2026-09-12-consolidated-standards-tooling-and-testing-roadmap.md`

**Interfaces:**

- Consumes: none (documentation-only expansion; `bedrock.tools.audit_s007_schema_catalog`
  does not yet exist — its implementation is scoped to Task 1.5).
- Produces: the comprehensive S007 specification — object naming and prefix
  contracts, mandatory audit columns, boolean/lifecycle-state
  standardization, and the SQLite/PostgreSQL cross-dialect portability
  contract — that Task 1.5's `audit_s007_schema_catalog` implementation will
  enforce.

- [x] **Step 1: Expand `docs/standards/s007-schema-catalog.md`** with table/view/index
      naming conventions, the five reserved platform prefixes (`auth_`, `app_`,
      `sys_`, `log_`, `diag_`), the mandatory audit-columns contract
      (`created_at`, `created_by`, `modified_at`, `modified_by`, `is_active`),
      and the dual SQLite/PostgreSQL portability contract, while keeping the
      standard free of consumer domain vocabulary
- [x] **Step 2: Verify absence of domain terms**
Run: `git grep -iE "(CollectIt|MLBTracker|Lahman|Chadwick|card|ebay)" docs/standards/s007-schema-catalog.md`
Expected output: exit 1 (no matches).
- [x] **Step 3: Commit in Bedrock**

```bash
git -C C:\Dev\bedrock add docs/standards/s007-schema-catalog.md docs/plans/2026-09-12-consolidated-standards-tooling-and-testing-roadmap.md
git -C C:\Dev\bedrock commit -m "feat(standards): expand S007 with database object naming, audit columns, and cross-dialect portability"
```

---

### Task 1.4.3: Comparative Depth Audit & Remediation of Standards S001-S012 (Excluding S002 & S007) Against MLBTracker Doctrine

**Files:**

- Modify: `docs/standards/s001-no-duplicate-ui-code.md`
- Modify: `docs/standards/s003-logging-protocol.md`
- Modify: `docs/standards/s004-no-hardcoded-config-settings.md`
- Modify: `docs/standards/s005-test-coverage-mandatory.md`
- Modify: `docs/standards/s006-defect-isolation-and-pr-workflow.md`
- Modify: `docs/standards/s008-documentation-layout-and-naming.md`
- Modify: `docs/standards/s009-design-system.md`
- Modify: `docs/standards/s010-granular-security-model.md`
- Modify: `docs/standards/s011-config-driven-navigation.md`
- Modify: `docs/standards/s012-dual-pin-platform-governance.md`
- Modify: `docs/plans/2026-09-12-consolidated-standards-tooling-and-testing-roadmap.md`

**Interfaces:**

- Consumes: `C:\Dev\MLBTracker\docs\standards\` as the depth-parity source of
  truth for consumer-side rules not yet generically represented in bedrock.
- Produces: platform standards deepened to depth parity with MLBTracker's
  doctrine while remaining fully generic — zero domain vocabulary, every
  invariant expressed in platform primitives (consumers, domains, entities,
  records, components) instead of application nouns.

- [x] **Step 1: Pairwise gap analysis against MLBTracker's `S01`–`S11`**
      S001 gained the compose-beside-not-fork pattern and single icon/form
      primitive library invariants; S003 gained environment-switched output
      shape (pretty local / JSON in production), structured exception
      capture, correlation IDs, and payload-shape rules; S004 gained typed
      config-value coercion, fresh-checkout manifest verification, a typed
      config-key registry, and the frontend boot-default-then-DB-override
      settings pattern; S005 gained the multi-canary live-DB isolation
      contract, deterministic idempotent seed-fixture discipline, and the
      anti-busy-wait CI polling rule; S006 gained root-cause-before-filing,
      a closed issue-type taxonomy, and path-scoped/rate-limit-isolated CI
      gating; S008 gained the reachability/orphan rule and the
      retire-from-working-tree rule; S009 gained semantic color-role naming,
      the bare-Tailwind-color-utility ban, and the structural token category
      contract (spacing/breakpoints/elevation/z-index); S010 gained the
      four-flag (`can_view`/`can_update`/`can_delete`/`can_execute`)
      per-module model, the tri-state override resolution algorithm, the
      security activity log, and mandatory audit columns. S011 and S012
      were already at or beyond MLBTracker's depth and required no changes.
- [x] **Step 2: Verify absence of domain terms**
Run: `git grep -iE "(MLBTracker|CollectIt|player|team|card|ebay|statcast|lahman)" docs/standards/s001-no-duplicate-ui-code.md docs/standards/s003-logging-protocol.md docs/standards/s004-no-hardcoded-config-settings.md docs/standards/s005-test-coverage-mandatory.md docs/standards/s006-defect-isolation-and-pr-workflow.md docs/standards/s008-documentation-layout-and-naming.md docs/standards/s009-design-system.md docs/standards/s010-granular-security-model.md docs/standards/s011-config-driven-navigation.md docs/standards/s012-dual-pin-platform-governance.md`
Expected output: exit 1 (no matches).
- [x] **Step 3: Commit in Bedrock**

```bash
git -C C:\Dev\bedrock add docs/standards/ docs/plans/2026-09-12-consolidated-standards-tooling-and-testing-roadmap.md
git -C C:\Dev\bedrock commit -m "feat(standards): deepen S001-S012 platform standards based on comparative audit against MLBTracker doctrine"
```

---

### Task 1.4.4: Reconcile and Harden Audit Engines `audit_s001`, `audit_s003`, and `audit_s004` Against Enriched Platform Standards

**Files:**

- Modify: `packages/bedrock-api/bedrock/tools/audit_s001_duplicates.py`
- Modify: `packages/bedrock-api/bedrock/tools/audit_s003_logging.py`
- Modify: `packages/bedrock-api/bedrock/tools/audit_s004_config.py`
- Modify: `packages/bedrock-api/tests/test_audit_s001_to_s004.py`
- Modify: `docs/plans/2026-09-12-consolidated-standards-tooling-and-testing-roadmap.md`

**Interfaces:**

- Consumes: `load_bedrock_config`, `AuditReporter`, the enriched
  `docs/standards/s001-no-duplicate-ui-code.md`,
  `docs/standards/s003-logging-protocol.md`, and
  `docs/standards/s004-no-hardcoded-config-settings.md` invariants produced by
  Task 1.4.3.
- Produces: `audit_s001_duplicates`, `audit_s003_logging`, and
  `audit_s004_config`, still exiting `0`/`1`/`2`, now also enforcing:
  S001 — barrel-only primitive imports (`Button`, `Input`, `Select`, `Dialog`,
  `Modal`, `Tabs`, `Popover`, `Command`, `DataGrid`), inline formatter calls,
  and inline `queryKey` array literals; S003 — `console.info` alongside
  `log`/`warn`/`error`/`debug`, and exclusion of Python test files
  (`test_*.py`, `tests/**`) from the `print()` scan; S004 — a `get_config(...)`
  call site missing its default argument, and a hardcoded numeric
  `TooltipProvider` `delayDuration` literal in frontend source.

- [x] **Step 1: Write failing tests for the new S001/S003/S004 invariants**
- [x] **Step 2: Harden `audit_s001_duplicates.py`, `audit_s003_logging.py`, and `audit_s004_config.py`** (deterministic regex scans; emit file/line/hint via `AuditReporter.fail_check`)
- [x] **Step 3: Run tests to verify they pass**
Run: `pytest packages/bedrock-api/tests/test_audit_s001_to_s004.py`
Expected output: 34 passed.
      Run: `pytest packages/bedrock-api/tests`
      Expected output: 647 passed.
- [x] **Step 4: Commit in Bedrock**

```bash
git -C C:\Dev\bedrock add packages/bedrock-api/bedrock/tools/audit_s001_duplicates.py packages/bedrock-api/bedrock/tools/audit_s003_logging.py packages/bedrock-api/bedrock/tools/audit_s004_config.py packages/bedrock-api/tests/test_audit_s001_to_s004.py docs/plans/2026-09-12-consolidated-standards-tooling-and-testing-roadmap.md
git -C C:\Dev\bedrock commit -m "feat(tools): harden audit_s001, audit_s003, and audit_s004 to enforce enriched platform standards"
```

---

### Task 1.5: Platform Audit Suite `audit_s005` through `audit_s008`

**Agent Recommendation:**

- Claude: `model: sonnet`, `effort: high`
- AGY: `model: pro`, `thinking: high`

**Files:**

- Create: `packages/bedrock-api/bedrock/tools/audit_s005_testing.py` (new structural test gate)
- Create: `packages/bedrock-api/bedrock/tools/audit_s006_pr_workflow.py` (promoted from `audit_ledger_freshness.py`)
- Create: `packages/bedrock-api/bedrock/tools/audit_s007_schema_catalog.py` (promoted from `audit_schema_names.py`)
- Create: `packages/bedrock-api/bedrock/tools/audit_s008_guidance.py` (merges `audit_guidance.py` & `check_claude_md_length.py`)
- Tests: `packages/bedrock-api/tests/test_audit_s005_to_s008.py`

**Interfaces:**

- Produces: Fully parameter-driven enforcement of test pairing, PR workflow/ledger freshness, bare SQL literals, and guidance link/line limits.

- [x] **Step 1: Write unit tests for `audit_s005`–`audit_s008`**
- [x] **Step 2: Implement `audit_s005_testing.py`**
- [x] **Step 3: Implement `audit_s006_pr_workflow.py`**
- [x] **Step 4: Implement `audit_s007_schema_catalog.py`**
- [x] **Step 5: Implement `audit_s008_guidance.py`**
- [x] **Step 6: Run tests to verify they pass**
Run: `pytest packages/bedrock-api/tests/test_audit_s005_to_s008.py`
Expected output: PASS.
      Run: `pytest packages/bedrock-api/tests/test_audit_s005_to_s008.py`
      Expected output: PASS.
- [x] **Step 7: Commit in Bedrock**

```bash
git -C C:\Dev\bedrock add packages/bedrock-api/bedrock/tools/audit_s005_testing.py packages/bedrock-api/bedrock/tools/audit_s006_pr_workflow.py packages/bedrock-api/bedrock/tools/audit_s007_schema_catalog.py packages/bedrock-api/bedrock/tools/audit_s008_guidance.py packages/bedrock-api/tests/test_audit_s005_to_s008.py
git -C C:\Dev\bedrock commit -m "feat(tools): implement platform audits s005 through s008"
```

---

### Task 1.6: Platform Audit Suite `audit_s009` through `audit_s012`

**Agent Recommendation:**

- Claude: `model: sonnet`, `effort: high`
- AGY: `model: pro`, `thinking: high`

**Files:**

- Create: `packages/bedrock-api/bedrock/tools/audit_s009_design_tokens.py` (promoted from `audit_design_tokens.py`)
- Create: `packages/bedrock-api/bedrock/tools/audit_s010_security.py` (new route AST security gate)
- Create: `packages/bedrock-api/bedrock/tools/audit_s011_navigation.py` (merges navigation & target audits)
- Create: `packages/bedrock-api/bedrock/tools/audit_s012_pins.py` (promoted from `audit_bedrock_pins.py`)
- Tests: `packages/bedrock-api/tests/test_audit_s009_to_s012.py`

**Interfaces:**

- Produces: Enforcement of raw color literals, route permissions/RBAC, navigation target reachability, and dual-pin release tag parity.

- [x] **Step 1: Write unit tests for `audit_s009`–`audit_s012`**
- [x] **Step 2: Implement `audit_s009_design_tokens.py`**
- [x] **Step 3: Implement `audit_s010_security.py`**
- [x] **Step 4: Implement `audit_s011_navigation.py`**
- [x] **Step 5: Implement `audit_s012_pins.py`**
- [x] **Step 6: Run tests to verify they pass**
Run: `pytest packages/bedrock-api/tests/test_audit_s009_to_s012.py`
Expected output: PASS.
      Run: `pytest packages/bedrock-api/tests/test_audit_s009_to_s012.py`
      Expected output: PASS.
- [x] **Step 7: Commit in Bedrock**

```bash
git -C C:\Dev\bedrock add packages/bedrock-api/bedrock/tools/audit_s009_design_tokens.py packages/bedrock-api/bedrock/tools/audit_s010_security.py packages/bedrock-api/bedrock/tools/audit_s011_navigation.py packages/bedrock-api/bedrock/tools/audit_s012_pins.py packages/bedrock-api/tests/test_audit_s009_to_s012.py
git -C C:\Dev\bedrock commit -m "feat(tools): implement platform audits s009 through s012"
```

---

### Task 1.7: Standards Synchronization & Suite Runner (`sync_standards` & `run_all`)

**Agent Recommendation:**

- Claude: `model: sonnet`, `effort: medium`
- AGY: `model: pro`, `thinking: medium`

**Files:**

- Create: `packages/bedrock-api/bedrock/tools/sync_standards.py`
- Create: `packages/bedrock-api/bedrock/tools/run_all.py`
- Test: `packages/bedrock-api/tests/test_sync_and_run_all.py`

**Interfaces:**

- Produces: `sync_standards --check` for CI drift gating and `bedrock.tools.run_all` for full suite execution.

- [x] **Step 1: Write unit tests for `sync_standards` and `run_all`**
- [x] **Step 2: Implement `sync_standards.py`** (mirror writer with `--check` diffing)
- [x] **Step 3: Implement `run_all.py`** (dispatches `audit_s001` through `audit_s012`)
- [x] **Step 4: Run tests to verify they pass**
Run: `pytest packages/bedrock-api/tests/test_sync_and_run_all.py`
Expected output: PASS.
      Run: `pytest packages/bedrock-api/tests/test_sync_and_run_all.py`
      Expected output: PASS.
- [x] **Step 5: Commit in Bedrock**

```bash
git -C C:\Dev\bedrock add packages/bedrock-api/bedrock/tools/sync_standards.py packages/bedrock-api/bedrock/tools/run_all.py packages/bedrock-api/tests/test_sync_and_run_all.py
git -C C:\Dev\bedrock commit -m "feat(tools): implement sync_standards and run_all orchestrators"
```

---

### Task 1.8: Taxonomy Validator & Automated NTFS Remediator

**Agent Recommendation:**

- Claude: `model: sonnet`, `effort: high`
- AGY: `model: pro`, `thinking: high`

**Files:**

- Create: `packages/bedrock-api/bedrock/tools/audit_taxonomy_and_casing.py`
- Create: `packages/bedrock-api/bedrock/tools/remediate_taxonomy_and_casing.py`
- Tests: `packages/bedrock-api/tests/test_taxonomy_and_remediation.py`

**Interfaces:**

- Produces: Taxonomy and kebab-case validator, plus automated two-stage NTFS renamer (`__tmp`) and inbound link rewriter.

- [ ] **Step 1: Write unit tests for taxonomy audit and two-stage rename planner**
- [ ] **Step 2: Implement `audit_taxonomy_and_casing.py`**
- [ ] **Step 3: Implement `remediate_taxonomy_and_casing.py`**
- [ ] **Step 4: Run tests to verify they pass**
Run: `pytest packages/bedrock-api/tests/test_taxonomy_and_remediation.py`
Expected output: PASS.
      Run: `pytest packages/bedrock-api/tests/test_taxonomy_and_remediation.py`
      Expected output: PASS.
- [ ] **Step 5: Commit in Bedrock**

```bash
git -C C:\Dev\bedrock add packages/bedrock-api/bedrock/tools/audit_taxonomy_and_casing.py packages/bedrock-api/bedrock/tools/remediate_taxonomy_and_casing.py packages/bedrock-api/tests/test_taxonomy_and_remediation.py
git -C C:\Dev\bedrock commit -m "feat(tools): implement audit_taxonomy_and_casing and remediate_taxonomy_and_casing"
```

---

### Task 1.9: Bedrock Documentation Six-Folder Taxonomy Reorganization

**Agent Recommendation:**

- Claude: `model: sonnet`, `effort: medium`
- AGY: `model: pro`, `thinking: medium`

**Files:**

- Move: `bedrock/docs/*.md` -> `bedrock/docs/reference/`
- Evict: `bedrock/docs/punchlists/` -> `bedrock/scratch/`
- Index: `bedrock/docs/reference/README.md`, `bedrock/docs/specs/README.md`, `bedrock/docs/plans/README.md`

**Interfaces:**

- Produces: 100% compliant Bedrock documentation following the canonical 6-folder model.

- [ ] **Step 1: Move loose markdown files into `docs/reference/`**

```bash
git -C C:\Dev\bedrock mv docs/app_assembly.md docs/reference/app_assembly.md
git -C C:\Dev\bedrock mv docs/deployment.md docs/reference/deployment.md
git -C C:\Dev\bedrock mv docs/extension_points.md docs/reference/extension_points.md
git -C C:\Dev\bedrock mv docs/mail.md docs/reference/mail.md
git -C C:\Dev\bedrock mv docs/media.md docs/reference/media.md
git -C C:\Dev\bedrock mv docs/object_storage.md docs/reference/object_storage.md
git -C C:\Dev\bedrock mv docs/pagination.md docs/reference/pagination.md
git -C C:\Dev\bedrock mv docs/platform_guide.md docs/reference/platform_guide.md
git -C C:\Dev\bedrock mv docs/roadmap.md docs/reference/roadmap.md
git -C C:\Dev\bedrock mv docs/seo.md docs/reference/seo.md
```

- [ ] **Step 2: Evict punchlists to `scratch/`**

```powershell
mkdir C:\Dev\bedrock\scratch -Force
git -C C:\Dev\bedrock rm -r --cached docs/punchlists 2>$null || true
Move-Item C:\Dev\bedrock\docs\punchlists\* C:\Dev\bedrock\scratch\ -Force -ErrorAction SilentlyContinue
Remove-Item C:\Dev\bedrock\docs\punchlists -Recurse -Force -ErrorAction SilentlyContinue
```

- [ ] **Step 3: Update directory README indexes**
Create/update `README.md` in `docs/reference/`, `docs/specs/`, and `docs/plans/`.
      Create/update `README.md` in `docs/reference/`, `docs/specs/`, and `docs/plans/`.

- [ ] **Step 4: Run taxonomy audit in Bedrock**
Run: `python -m bedrock.tools.audit_taxonomy_and_casing --root C:\Dev\bedrock`
Expected output: `[PASS] Taxonomy and file casing audit clean`.
      Run: `python -m bedrock.tools.audit_taxonomy_and_casing --root C:\Dev\bedrock`
      Expected output: `[PASS] Taxonomy and file casing audit clean`.

- [ ] **Step 5: Commit in Bedrock**

```bash
git -C C:\Dev\bedrock add -A
git -C C:\Dev\bedrock commit -m "refactor(docs): consolidate Bedrock docs into canonical 6-folder taxonomy"
```

---

### Task 1.10: Unified QA Orchestrator (`run_qa.py`), Vitest Workspace & Dead-Code Checks

**Agent Recommendation:**

- Claude: `model: sonnet`, `effort: high`
- AGY: `model: pro`, `thinking: high`

**Files:**

- Create: `C:\Dev\bedrock\scripts\run_qa.py`
- Create: `C:\Dev\bedrock\vitest.workspace.ts`
- Create: `C:\Dev\bedrock\knip.json`
- Create: `C:\Dev\bedrock\scripts\maintenance\vulture_whitelist.py`
- Modify: `C:\Dev\bedrock\packages\bedrock-api\pytest.ini` (tri-marking)

**Interfaces:**

- Produces: Multi-tier test orchestrator (`--mode fast|scoped|full`), AST dead-code elimination, and sharded Vitest execution.

- [ ] **Step 1: Configure `pytest.ini` with strict Tri-Marking taxonomy**
- [ ] **Step 2: Configure `vitest.workspace.ts` and `knip.json`**
- [ ] **Step 3: Implement `scripts/maintenance/vulture_whitelist.py`**
- [ ] **Step 4: Implement `scripts/run_qa.py`** with stdout buffering, telemetry JSONL writer, and exit code propagation.
- [ ] **Step 5: Execute fast mode test**
Run: `python scripts/run_qa.py --mode fast --json`
Expected output: `{"status": "pass", "exit": 0, ...}` in < 20s.
      Run: `python scripts/run_qa.py --mode fast --json`
      Expected output: `{"status": "pass", "exit": 0, ...}` in < 20s.
- [ ] **Step 6: Commit in Bedrock**

```bash
git -C C:\Dev\bedrock add scripts/run_qa.py vitest.workspace.ts knip.json scripts/maintenance/vulture_whitelist.py packages/bedrock-api/pytest.ini
git -C C:\Dev\bedrock commit -m "feat(qa): implement unified run_qa orchestrator, vitest workspace, and knip/vulture"
```

---

### Task 1.11: Bedrock Pre-Flight Suite Verification & Local Validation

**Agent Recommendation:**

- Claude: `model: sonnet`, `effort: medium`
- AGY: `model: pro`, `thinking: medium`

**Files:**

- Test across: Bedrock root

**Interfaces:**

- Consumes: Complete Bedrock codebase.
- Produces: 100% green pre-flight verification before cutting `v0.10.0`.

- [ ] **Step 1: Run full unit test suite**
Run: `pytest packages/bedrock-api/tests`
Expected output: All tests pass.
      Run: `pytest packages/bedrock-api/tests`
      Expected output: All tests pass.

- [ ] **Step 2: Run all platform audits**
Run: `python -m bedrock.tools.run_all`
Expected output: `STATUS: PASSED (12/12 platform audits passing)`.
      Run: `python -m bedrock.tools.run_all`
      Expected output: `STATUS: PASSED (12/12 platform audits passing)`.

- [ ] **Step 3: Run dead-code and taxonomy audits**
Run: `python scripts/run_qa.py --dead-code`
Expected output: `vulture` and `knip` exit 0.
      Run: `python scripts/run_qa.py --dead-code`
      Expected output: `vulture` and `knip` exit 0.

- [ ] **Step 4: Verify clean working tree**
Run: `git -C C:\Dev\bedrock status --porcelain`
Expected output: 100% empty.
      Run: `git -C C:\Dev\bedrock status --porcelain`
      Expected output: 100% empty.

---

## Phase 2: Bedrock Platform Release (`v0.10.0`)

### Task 2.1: Package Version Bumps, CHANGELOG Entry & Git Tag `v0.10.0`

**Agent Recommendation:**

- Claude: `model: sonnet`, `effort: low`
- AGY: `model: flash`, `thinking: low`

**Files:**

- Modify: `C:\Dev\bedrock\packages\bedrock-api\pyproject.toml`
- Modify: `C:\Dev\bedrock\packages\bedrock-ui\package.json`
- Modify: `C:\Dev\bedrock\CHANGELOG.md`

**Interfaces:**

- Produces: Official release tag `v0.10.0` published on remote GitHub origin.

- [ ] **Step 1: Bump version strings to `0.10.0` in both packages**
- [ ] **Step 2: Add comprehensive CHANGELOG.md entry** documenting S001–S012, `bedrock.toml`, `run_qa.py`, and `bedrock.tools`.
- [ ] **Step 3: Commit release bump**

```bash
git -C C:\Dev\bedrock add packages/bedrock-api/pyproject.toml packages/bedrock-ui/package.json CHANGELOG.md
git -C C:\Dev\bedrock commit -m "chore(release): prepare v0.10.0 platform release"
```

- [ ] **Step 4: Merge to master and tag release**

```bash
git -C C:\Dev\bedrock checkout master
git -C C:\Dev\bedrock merge --no-ff docs/consolidated-ecosystem-roadmap -m "chore: merge consolidated ecosystem release v0.10.0"
git -C C:\Dev\bedrock tag -a v0.10.0 -m "v0.10.0 - Ecosystem standards S001-S012, declarative bedrock.toml, and unified QA engine"
git -C C:\Dev\bedrock push origin master --tags
```

Expected output: Tag `v0.10.0` pushed to GitHub remote.

---

## Phase 3: CollectIt Consumer Migration

### Task 3.1: Dual-Pin Lockstep Bump to `v0.10.0`

**Agent Recommendation:**

- Claude: `model: sonnet`, `effort: medium`
- AGY: `model: pro`, `thinking: medium`

**Files:**

- Modify: `C:\Dev\CollectIt\requirements.txt`
- Modify: `C:\Dev\CollectIt\frontend\package.json`
- Modify: `C:\Dev\CollectIt\frontend\package-lock.json`

**Interfaces:**

- Consumes: Release tag `v0.10.0`.
- Produces: Updated lockstep dependencies and re-installed virtual environments.

- [ ] **Step 1: Checkout feature branch in CollectIt**

```bash
git -C C:\Dev\CollectIt checkout -b chore/migrate-bedrock-v010
```

- [ ] **Step 2: Update `requirements.txt` and `package.json`**
Point `bedrock-api` and `@djntechnic/bedrock-ui` to tag `v0.10.0`.
      Point `bedrock-api` and `@djntechnic/bedrock-ui` to tag `v0.10.0`.

- [ ] **Step 3: Regenerate lockfile and install packages**

```bash
cd C:\Dev\CollectIt\frontend && npm install --package-lock-only --ignore-scripts
npm install --ignore-scripts
cd C:\Dev\CollectIt
pip install -r requirements.txt
```

- [ ] **Step 4: Verify package import**
Run: `python -c "import bedrock.tools.run_all; print('Bedrock tools ready')"`
Expected output: `Bedrock tools ready`.
      Run: `python -c "import bedrock.tools.run_all; print('Bedrock tools ready')"`
      Expected output: `Bedrock tools ready`.

- [ ] **Step 5: Commit pin bump**

```bash
git -C C:\Dev\CollectIt add requirements.txt frontend/package.json frontend/package-lock.json
git -C C:\Dev\CollectIt commit -m "chore(deps): bump bedrock dual pins to v0.10.0"
```

---

### Task 3.2: Automated NTFS Two-Stage Remediation & Template Kebab-Casing

**Agent Recommendation:**

- Claude: `model: sonnet`, `effort: high`
- AGY: `model: pro`, `thinking: high`

**Files:**

- Rename: `CollectIt/Templates/` -> `CollectIt/templates/`
- Rename: `CollectIt/Templates/*.html` -> lowercase kebab-case
- Relocate: `CollectIt/docs/ebay_templates_csv/` -> `CollectIt/templates/ebay-import-csv/`
- Evict: `CollectIt/docs/punchlists/`, `CollectIt/docs/archive/`, `CollectIt/docs/design/` -> `CollectIt/scratch/`

**Interfaces:**

- Produces: Kebab-compliant templates, evicted transient punchlists, and updated inbound link citations.

- [ ] **Step 1: Run automated remediation engine**
Run:
      Run:

```powershell
python -m bedrock.tools.remediate_taxonomy_and_casing --root C:\Dev\CollectIt
```

Expected output: Two-stage NTFS renames executed for templates and standards with inbound link rewrites.

- [ ] **Step 2: Relocate eBay import CSVs**

```powershell
mkdir C:\Dev\CollectIt\templates\ebay-import-csv -Force
git -C C:\Dev\CollectIt mv docs/ebay_templates_csv/* templates/ebay-import-csv/ 2>$null || true
Remove-Item C:\Dev\CollectIt\docs\ebay_templates_csv -Force -ErrorAction SilentlyContinue
```

- [ ] **Step 3: Evict punchlists and archive to `scratch/`**

```powershell
mkdir C:\Dev\CollectIt\scratch -Force
git -C C:\Dev\CollectIt rm -r --cached docs/punchlists docs/archive docs/design 2>$null || true
Move-Item C:\Dev\CollectIt\docs\punchlists\* C:\Dev\CollectIt\scratch\ -Force -ErrorAction SilentlyContinue
Move-Item C:\Dev\CollectIt\docs\archive\* C:\Dev\CollectIt\scratch\ -Force -ErrorAction SilentlyContinue
Move-Item C:\Dev\CollectIt\docs\design\* C:\Dev\CollectIt\scratch\ -Force -ErrorAction SilentlyContinue
Remove-Item C:\Dev\CollectIt\docs\punchlists, C:\Dev\CollectIt\docs\archive, C:\Dev\CollectIt\docs\design -Recurse -Force -ErrorAction SilentlyContinue
```

- [ ] **Step 4: Commit in CollectIt**

```bash
git -C C:\Dev\CollectIt add -A
git -C C:\Dev\CollectIt commit -m "refactor(templates): normalize templates kebab-casing and evict punchlists"
```

---

### Task 3.3: Deploy `CollectIt/bedrock.toml`, Mirror S001–S012 & Renumber S101–S102

**Agent Recommendation:**

- Claude: `model: sonnet`, `effort: medium`
- AGY: `model: pro`, `thinking: medium`

**Files:**

- Create: `C:\Dev\CollectIt\bedrock.toml`
- Mirror: `C:\Dev\CollectIt\docs\standards\s001-*.md` through `s012-*.md`
- Rename: `CollectIt/docs/standards/s101-ebay-sanitizer-and-vault.md`, `s102-listing-engine-templates-and-export.md`
- Update: `CollectIt/docs/standards/README.md`

**Interfaces:**

- Produces: Declarative CollectIt manifest, synchronized platform standards mirror, and renumbered domain standards.

- [ ] **Step 1: Create `CollectIt/bedrock.toml`** with domain paths and empty exemptions.
- [ ] **Step 2: Renumber domain standards** to `s101-ebay-sanitizer-and-vault.md` and `s102-listing-engine-templates-and-export.md`.
- [ ] **Step 3: Run `sync_standards` to populate `s001`–`s012` mirror**
Run: `python -m bedrock.tools.sync_standards`
Expected output: Platform standards synchronized with immutable header.
      Run: `python -m bedrock.tools.sync_standards`
      Expected output: Platform standards synchronized with immutable header.
- [ ] **Step 4: Verify mirror freshness**
Run: `python -m bedrock.tools.sync_standards --check`
Expected output: Exit code 0.
      Run: `python -m bedrock.tools.sync_standards --check`
      Expected output: Exit code 0.
- [ ] **Step 5: Commit in CollectIt**

```bash
git -C C:\Dev\CollectIt add bedrock.toml docs/standards/
git -C C:\Dev\CollectIt commit -m "docs(standards): mirror bedrock s001-s012 and renumber domain s101-s102"
```

---

### Task 3.4: Partition `scripts/audits/` vs `scripts/maintenance/` & Delete Platform Duplicates

**Agent Recommendation:**

- Claude: `model: sonnet`, `effort: medium`
- AGY: `model: pro`, `thinking: medium`

**Files:**

- Create: `C:\Dev\CollectIt\scripts\audits\audit_s101_ebay_compliance.py`
- Create: `C:\Dev\CollectIt\scripts\audits\audit_s102_listing_templates.py`
- Delete: `scripts/maintenance/audit_*.py` and `scripts/maintenance/check_claude_md_length.py`
- Retain in `scripts/maintenance/`: `generate_schema_catalog.py`, `generate_ebay_specs.py`

**Interfaces:**

- Produces: Strict division between blocking quality gates (`scripts/audits/`) and operational utilities (`scripts/maintenance/`).

- [ ] **Step 1: Create `scripts/audits/audit_s101_ebay_compliance.py`** adopting `AuditReporter`.
- [ ] **Step 2: Create `scripts/audits/audit_s102_listing_templates.py`** adopting `AuditReporter`.
- [ ] **Step 3: Delete duplicate platform audit scripts from `scripts/maintenance/`**

```bash
git -C C:\Dev\CollectIt rm scripts/maintenance/audit_bedrock_pins.py scripts/maintenance/audit_config.py scripts/maintenance/audit_ebay_compliance.py scripts/maintenance/audit_grids.py scripts/maintenance/audit_guidance.py scripts/maintenance/audit_navigation.py scripts/maintenance/audit_schema_names.py scripts/maintenance/audit_targets.py scripts/maintenance/check_claude_md_length.py 2>$null || true
```

- [ ] **Step 4: Commit in CollectIt**

```bash
git -C C:\Dev\CollectIt add scripts/
git -C C:\Dev\CollectIt commit -m "refactor(scripts): partition scripts/audits and remove platform duplicates"
```

---

### Task 3.5: Deploy `run_qa.py`, `run_audit.ps1`, Vitest Workspace & Pytest Markers

**Agent Recommendation:**

- Claude: `model: sonnet`, `effort: high`
- AGY: `model: pro`, `thinking: high`

**Files:**

- Create: `C:\Dev\CollectIt\scripts\run_audit.ps1`
- Create: `C:\Dev\CollectIt\scripts\run_qa.py`
- Create: `C:\Dev\CollectIt\frontend\vitest.workspace.ts`
- Create: `C:\Dev\CollectIt\frontend\knip.json`
- Create: `C:\Dev\CollectIt\scripts\maintenance\vulture_whitelist.py`
- Modify: `C:\Dev\CollectIt\pytest.ini`

**Interfaces:**

- Produces: Sub-25s delta testing loop, sharded frontend Vitest, and unified audit dispatcher.

- [ ] **Step 1: Deploy `scripts/run_audit.ps1`**
- [ ] **Step 2: Deploy `scripts/run_qa.py` and `scripts/maintenance/vulture_whitelist.py`**
- [ ] **Step 3: Deploy `frontend/vitest.workspace.ts` and `frontend/knip.json`**
- [ ] **Step 4: Update `pytest.ini` with Tri-Marking markers**
- [ ] **Step 5: Execute fast QA test**
Run: `python scripts/run_qa.py --mode fast --json`
Expected output: `{"status": "pass", "exit": 0, ...}` in < 25s.
      Run: `python scripts/run_qa.py --mode fast --json`
      Expected output: `{"status": "pass", "exit": 0, ...}` in < 25s.
- [ ] **Step 6: Commit in CollectIt**

```bash
git -C C:\Dev\CollectIt add scripts/run_audit.ps1 scripts/run_qa.py frontend/vitest.workspace.ts frontend/knip.json scripts/maintenance/vulture_whitelist.py pytest.ini
git -C C:\Dev\CollectIt commit -m "feat(qa): deploy run_qa orchestrator, vitest workspace, and tri-marking"
```

---

### Task 3.6: Update CollectIt CI, `CLAUDE.md`, and `GEMINI.md`

**Agent Recommendation:**

- Claude: `model: sonnet`, `effort: medium`
- AGY: `model: pro`, `thinking: medium`

**Files:**

- Modify: `C:\Dev\CollectIt\.github\workflows\ci.yml`
- Modify: `C:\Dev\CollectIt\CLAUDE.md`
- Modify: `C:\Dev\CollectIt\GEMINI.md`

**Interfaces:**

- Produces: Verified CI consistency jobs running `sync_standards --check`, `run_all`, and `scripts/audits/`; documentation ≤ 200 lines.

- [ ] **Step 1: Update `.github/workflows/ci.yml`**
Replace individual maintenance script steps with `python -m bedrock.tools.sync_standards --check`, `python -m bedrock.tools.run_all`, and execution of `scripts/audits/audit_s1*.py`.
      Replace individual maintenance script steps with `python -m bedrock.tools.sync_standards --check`, `python -m bedrock.tools.run_all`, and execution of `scripts/audits/audit_s1*.py`.
- [ ] **Step 2: Update `CLAUDE.md` and `GEMINI.md`**
Update audit commands to reference `.\scripts\run_audit.ps1` and `python scripts/run_qa.py`. Verify lines ≤ 200.
      Update audit commands to reference `.\scripts\run_audit.ps1` and `python scripts/run_qa.py`. Verify lines ≤ 200.
- [ ] **Step 3: Run full local audit sweep**
Run:
      Run:

```powershell
.\scripts\run_audit.ps1 -All
python scripts/run_qa.py --mode full
```

Expected output: All platform audits, domain audits, and tests pass.

- [ ] **Step 4: Commit, push PR, and merge to master**

```bash
git -C C:\Dev\CollectIt add .github/workflows/ci.yml CLAUDE.md GEMINI.md
git -C C:\Dev\CollectIt commit -m "ci: update consistency gates to use bedrock.tools and scripts/audits"
git -C C:\Dev\CollectIt push -u origin chore/migrate-bedrock-v010
gh pr create --repo djntechnic/CollectIt --base master --head chore/migrate-bedrock-v010 --title "chore: migrate to bedrock v0.10.0 standards and unified tooling" --body "Consolidates standards to s001-s012 and s101-s102, deploys bedrock.toml, partitions scripts/audits/, and integrates run_qa orchestrator."
gh pr checks --watch
git -C C:\Dev\CollectIt checkout master
git -C C:\Dev\CollectIt pull origin master
```

Expected output: PR merged cleanly to master.

---

## Phase 4: MLBTracker Consumer Migration

### Task 4.1: Dual-Pin Lockstep Bump to `v0.10.0`

**Agent Recommendation:**

- Claude: `model: sonnet`, `effort: medium`
- AGY: `model: pro`, `thinking: medium`

**Files:**

- Modify: `C:\Dev\MLBTracker\requirements.txt`
- Modify: `C:\Dev\MLBTracker\frontend\package.json`
- Modify: `C:\Dev\MLBTracker\frontend\package-lock.json`

**Interfaces:**

- Consumes: Release tag `v0.10.0`.
- Produces: Updated lockstep dependencies and re-installed virtual environments.

- [ ] **Step 1: Checkout feature branch in MLBTracker**

```bash
git -C C:\Dev\MLBTracker checkout -b chore/migrate-bedrock-v010
```

- [ ] **Step 2: Update `requirements.txt` and `package.json`**
Point `bedrock-api` and `@djntechnic/bedrock-ui` to tag `v0.10.0`.
      Point `bedrock-api` and `@djntechnic/bedrock-ui` to tag `v0.10.0`.

- [ ] **Step 3: Regenerate lockfile and install packages**

```bash
cd C:\Dev\MLBTracker\frontend && npm install --package-lock-only --ignore-scripts
npm install --ignore-scripts
cd C:\Dev\MLBTracker
pip install -r requirements.txt
```

- [ ] **Step 4: Commit pin bump**

```bash
git -C C:\Dev\MLBTracker add requirements.txt frontend/package.json frontend/package-lock.json
git -C C:\Dev\MLBTracker commit -m "chore(deps): bump bedrock dual pins to v0.10.0"
```

---

### Task 4.2: Automated Remediation & Punchlist Eviction to `scratch/`

**Agent Recommendation:**

- Claude: `model: sonnet`, `effort: high`
- AGY: `model: pro`, `thinking: high`

**Files:**

- Evict: `MLBTracker/docs/reference/punchlists/` -> `MLBTracker/scratch/`
- Update: Inbound link citations across `docs/` and `api/`

**Interfaces:**

- Produces: Clean docs taxonomy with zero transient punchlists.

- [ ] **Step 1: Run automated remediation engine**
Run:
      Run:

```powershell
python -m bedrock.tools.remediate_taxonomy_and_casing --root C:\Dev\MLBTracker
```

- [ ] **Step 2: Evict punchlists to `scratch/`**

```powershell
mkdir C:\Dev\MLBTracker\scratch -Force
git -C C:\Dev\MLBTracker rm -r --cached docs/reference/punchlists 2>$null || true
Move-Item C:\Dev\MLBTracker\docs\reference\punchlists\* C:\Dev\MLBTracker\scratch\ -Force -ErrorAction SilentlyContinue
Remove-Item C:\Dev\MLBTracker\docs\reference\punchlists -Recurse -Force -ErrorAction SilentlyContinue
```

- [ ] **Step 3: Commit in MLBTracker**

```bash
git -C C:\Dev\MLBTracker add -A
git -C C:\Dev\MLBTracker commit -m "refactor(docs): evict punchlists to scratch and normalize standards references"
```

---

### Task 4.3: Deploy `MLBTracker/bedrock.toml`, Mirror S001–S012 & Renumber S101–S102

**Agent Recommendation:**

- Claude: `model: sonnet`, `effort: medium`
- AGY: `model: pro`, `thinking: medium`

**Files:**

- Create: `C:\Dev\MLBTracker\bedrock.toml`
- Mirror: `C:\Dev\MLBTracker\docs\standards\s001-*.md` through `s012-*.md`
- Rename: `MLBTracker/docs/standards/s101-rankings-pipeline-and-stat-invariants.md`, `s102-ledger-transactions-and-audit-trail.md`
- Update: `MLBTracker/docs/standards/README.md`

**Interfaces:**

- Produces: Declarative MLBTracker manifest, synchronized platform standards mirror, and renumbered domain standards.

- [ ] **Step 1: Create `MLBTracker/bedrock.toml`** with presentational tables (`RosterTable`, `CardListTable`) and domain paths.
- [ ] **Step 2: Renumber domain standards** to `s101-rankings-pipeline-and-stat-invariants.md` and `s102-ledger-transactions-and-audit-trail.md`.
- [ ] **Step 3: Run `sync_standards` to populate `s001`–`s012` mirror**
Run: `python -m bedrock.tools.sync_standards`
Expected output: Platform standards synchronized.
      Run: `python -m bedrock.tools.sync_standards`
      Expected output: Platform standards synchronized.
- [ ] **Step 4: Verify mirror freshness**
Run: `python -m bedrock.tools.sync_standards --check`
Expected output: Exit code 0.
      Run: `python -m bedrock.tools.sync_standards --check`
      Expected output: Exit code 0.
- [ ] **Step 5: Commit in MLBTracker**

```bash
git -C C:\Dev\MLBTracker add bedrock.toml docs/standards/
git -C C:\Dev\MLBTracker commit -m "docs(standards): mirror bedrock s001-s012 and renumber domain s101-s102"
```

---

### Task 4.4: Partition `scripts/audits/` vs `scripts/maintenance/` & Delete Platform Duplicates

**Agent Recommendation:**

- Claude: `model: sonnet`, `effort: medium`
- AGY: `model: pro`, `thinking: medium`

**Files:**

- Create: `C:\Dev\MLBTracker\scripts\audits\audit_s101_rankings_pipeline.py`
- Create: `C:\Dev\MLBTracker\scripts\audits\audit_s102_ledger_transactions.py`
- Delete: `scripts/maintenance/audit_*.py` and `scripts/maintenance/check_claude_md_length.py`
- Retain in `scripts/maintenance/`: ETL, headshots downloader, database backup subsystem, inventory validators.

**Interfaces:**

- Produces: Strict division between blocking quality gates (`scripts/audits/`) and operational maintenance (`scripts/maintenance/`).

- [ ] **Step 1: Create `scripts/audits/audit_s101_rankings_pipeline.py`** adopting `AuditReporter`.
- [ ] **Step 2: Create `scripts/audits/audit_s102_ledger_transactions.py`** adopting `AuditReporter`.
- [ ] **Step 3: Delete duplicate platform audit scripts from `scripts/maintenance/`**

```bash
git -C C:\Dev\MLBTracker rm scripts/maintenance/audit_bedrock_pins.py scripts/maintenance/audit_config.py scripts/maintenance/audit_framework_boundary.py scripts/maintenance/audit_grids.py scripts/maintenance/audit_guidance.py scripts/maintenance/audit_project.py scripts/maintenance/audit_schema_names.py scripts/maintenance/audit_targets.py scripts/maintenance/check_claude_md_length.py 2>$null || true
```

- [ ] **Step 4: Commit in MLBTracker**

```bash
git -C C:\Dev\MLBTracker add scripts/
git -C C:\Dev\MLBTracker commit -m "refactor(scripts): partition scripts/audits and remove platform duplicates"
```

---

### Task 4.5: Deploy `run_qa.py`, `run_audit.ps1`, Vitest Workspace, Pytest Markers & Hygiene Tests

**Agent Recommendation:**

- Claude: `model: sonnet`, `effort: high`
- AGY: `model: pro`, `thinking: high`

**Files:**

- Create: `C:\Dev\MLBTracker\scripts\run_audit.ps1`
- Create: `C:\Dev\MLBTracker\scripts\run_qa.py`
- Create: `C:\Dev\MLBTracker\frontend\vitest.workspace.ts`
- Create: `C:\Dev\MLBTracker\frontend\knip.json`
- Create: `C:\Dev\MLBTracker\scripts\maintenance\vulture_whitelist.py`
- Modify: `C:\Dev\MLBTracker\pytest.ini`
- Modify: `C:\Dev\MLBTracker\api\tests\test_repo_hygiene.py`

**Interfaces:**

- Produces: Sub-25s delta test loop, sharded frontend Vitest, and updated repo hygiene test assertions.

- [ ] **Step 1: Deploy `scripts/run_audit.ps1`**
- [ ] **Step 2: Deploy `scripts/run_qa.py` and `scripts/maintenance/vulture_whitelist.py`**
- [ ] **Step 3: Deploy `frontend/vitest.workspace.ts` and `frontend/knip.json`**
- [ ] **Step 4: Update `pytest.ini` with Tri-Marking markers**
- [ ] **Step 5: Update `api/tests/test_repo_hygiene.py`** to assert kebab-cased standards filenames (`s\d{3}-[a-z0-9-]+\.md`).
- [ ] **Step 6: Execute fast QA test**
Run: `python scripts/run_qa.py --mode fast --json`
Expected output: `{"status": "pass", "exit": 0, ...}` in < 25s.
      Run: `python scripts/run_qa.py --mode fast --json`
      Expected output: `{"status": "pass", "exit": 0, ...}` in < 25s.
- [ ] **Step 7: Commit in MLBTracker**

```bash
git -C C:\Dev\MLBTracker add scripts/run_audit.ps1 scripts/run_qa.py frontend/vitest.workspace.ts frontend/knip.json scripts/maintenance/vulture_whitelist.py pytest.ini api/tests/test_repo_hygiene.py
git -C C:\Dev\MLBTracker commit -m "feat(qa): deploy run_qa orchestrator, vitest workspace, and hygiene updates"
```

---

### Task 4.6: Update MLBTracker CI, `CLAUDE.md`, and `GEMINI.md`

**Agent Recommendation:**

- Claude: `model: sonnet`, `effort: medium`
- AGY: `model: pro`, `thinking: medium`

**Files:**

- Modify: `C:\Dev\MLBTracker\.github\workflows\ci.yml`
- Modify: `C:\Dev\MLBTracker\CLAUDE.md`
- Modify: `C:\Dev\MLBTracker\GEMINI.md`

**Interfaces:**

- Produces: Verified CI consistency jobs running `sync_standards --check`, `run_all`, and `scripts/audits/`; documentation ≤ 200 lines.

- [ ] **Step 1: Update `.github/workflows/ci.yml`**
Replace individual maintenance script invocations with `python -m bedrock.tools.sync_standards --check`, `python -m bedrock.tools.run_all`, and execution of `scripts/audits/audit_s1*.py`.
      Replace individual maintenance script invocations with `python -m bedrock.tools.sync_standards --check`, `python -m bedrock.tools.run_all`, and execution of `scripts/audits/audit_s1*.py`.
- [ ] **Step 2: Update `CLAUDE.md` and `GEMINI.md`**
Update audit commands to reference `.\scripts\run_audit.ps1` and `python scripts/run_qa.py`. Verify lines ≤ 200.
      Update audit commands to reference `.\scripts\run_audit.ps1` and `python scripts/run_qa.py`. Verify lines ≤ 200.
- [ ] **Step 3: Run full local audit sweep**
Run:
      Run:

```powershell
.\scripts\run_audit.ps1 -All
python scripts/run_qa.py --mode full
```

Expected output: All platform audits, domain audits, and tests pass.

- [ ] **Step 4: Commit, push PR, and merge to master**

```bash
git -C C:\Dev\MLBTracker add .github/workflows/ci.yml CLAUDE.md GEMINI.md
git -C C:\Dev\MLBTracker commit -m "ci: update consistency gates to use bedrock.tools and scripts/audits"
git -C C:\Dev\MLBTracker push -u origin chore/migrate-bedrock-v010
gh pr create --repo djntechnic/MLBTracker --base master --head chore/migrate-bedrock-v010 --title "chore: migrate to bedrock v0.10.0 standards and unified tooling" --body "Consolidates standards to s001-s012 and s101-s102, deploys bedrock.toml, partitions scripts/audits/, and integrates run_qa orchestrator."
gh pr checks --watch
git -C C:\Dev\MLBTracker checkout master
git -C C:\Dev\MLBTracker pull origin master
```

Expected output: PR merged cleanly to master.

---

## Phase 5: Ecosystem-Wide Verification & Lock-In

### Task 5.1: Ecosystem Cross-Repo Audit Sweep & Clean Working Tree Verification

**Agent Recommendation:**

- Claude: `model: sonnet`, `effort: medium`
- AGY: `model: pro`, `thinking: medium`

**Files:**

- Audit across: `claude-kit`, `bedrock`, `CollectIt`, `MLBTracker`

**Interfaces:**

- Consumes: All 4 repositories on `master`.
- Produces: 100% clean verification across standards, pins, and working trees.

- [ ] **Step 1: Verify dual-pin lockstep integrity across consumers**
Run:
      Run:

```bash
python -m bedrock.tools.audit_s012_pins --root C:\Dev\CollectIt
python -m bedrock.tools.audit_s012_pins --root C:\Dev\MLBTracker
```

Expected output: Both exit 0, confirming pins match `v0.10.0`.

- [ ] **Step 2: Verify taxonomy and casing compliance across all repositories**
Run:
      Run:

```bash
python -m bedrock.tools.audit_taxonomy_and_casing --root C:\Dev\bedrock
python -m bedrock.tools.audit_taxonomy_and_casing --root C:\Dev\CollectIt
python -m bedrock.tools.audit_taxonomy_and_casing --root C:\Dev\MLBTracker
```

Expected output: All 3 invocations exit 0.

- [ ] **Step 3: Verify standards mirror integrity in consumers**
Run:
      Run:

```bash
python -m bedrock.tools.sync_standards --check --root C:\Dev\CollectIt
python -m bedrock.tools.sync_standards --check --root C:\Dev\MLBTracker
```

Expected output: Both exit 0 with 0 drift.

- [ ] **Step 4: Verify clean git status across all 4 repositories**
Run:
      Run:

```powershell
"claude-kit", "bedrock", "CollectIt", "MLBTracker" | ForEach-Object {
    $res = git -C "C:\Dev\$_" status --porcelain
    if ($res) { Write-Error "Dirty repository: $_" } else { Write-Host "Repo $_ is 100% clean" -ForegroundColor Green }
}
```

Expected output: All repositories report 100% clean.

---

## Self-Review & Quality Checklist

1. **Spec Coverage:** Every requirement in `2026-09-12-consolidated-standards-tooling-and-testing-roadmap-design.md` has a direct task implementing it (S001–S012, 1:1 audit scripts, `bedrock.toml`, `run_qa.py`, script partitioning, two-stage NTFS renames, scheduled Windows tasks, `claude-kit` ownership, and repo-wide sweeps).
2. **No Placeholders:** All code steps provide exact commands, exact parameters, and expected outcomes. Zero "TBD" or "TODO".
3. **Commit Cadence & PR Strategy:** Atomic commits after every task; single coordinated PR per consumer repo targeting `master`.
4. **Agent & Level-of-Effort Recommendations:** Provided for each task for both Claude Code and Antigravity.
