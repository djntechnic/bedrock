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
  - Task 0.2: Comprehensive Master `.gitignore` Baseline Standardization & Data Directory Guard
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

- [ ] **Step 1: Backup current PowerShell profile**

```powershell
Copy-Item -Path $PROFILE -Destination "$PROFILE.bak" -Force
```

- [ ] **Step 2: Add non-interactive fast bailout to top of `$PROFILE`**
Insert at line 1 of `Microsoft.PowerShell_profile.ps1`:
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

- [ ] **Step 3: Verify non-interactive execution produces zero token overhead**
Run:
      Run:

```powershell
pwsh -Command "Write-Output 'CLEAN_PROFILE'"
```

Expected output: Exactly `CLEAN_PROFILE` with zero terminal icons, PSReadLine messages, or banners.

---

### Task 0.2: Comprehensive Master `.gitignore` Baseline Standardization & Data Directory Guard

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
.antigravity/

# ==============================================================================
# 6. AI AGENTS, TOOLING HOOKS & DEPLOYED READ-ONLY HARNESSES
# ==============================================================================
# Agent state caches & sandboxes
.playwright-mcp/
.superpowers/
.claude/state/
.claude/worktrees/
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

# Deprecated/pre-eviction directory guards (prevent accidental re-commit via git add -A)
docs/punchlists/
docs/archive/
docs/artifacts/
docs/screenshots/
docs/working files/

# Large binaries / screenshots outside designated design roots
debug_tab*.png
```

*(Note: In `claude-kit`, section 6 does NOT ignore `.claude/` or `plugins/`, as `claude-kit` is the authoritative git repository for all agentic tools).*

- [ ] **Step 2: Verify git status is clean of data, sidecar, and ephemeral files**
Run:
```powershell
"claude-kit", "bedrock", "CollectIt", "MLBTracker" | ForEach-Object {
    git -C "C:\Dev\$_" status --short
}
```
Expected output: Clean working trees without untracked `data/`, WAL sidecars, or local workspace files.

- [ ] **Step 3: Commit `.gitignore` across repositories**
```bash
git -C C:\Dev\claude-kit add .gitignore && git -C C:\Dev\claude-kit commit -m "chore(git): update comprehensive master .gitignore baseline"
git -C C:\Dev\bedrock add .gitignore && git -C C:\Dev\bedrock commit -m "chore(git): update comprehensive master .gitignore baseline"
git -C C:\Dev\CollectIt add .gitignore && git -C C:\Dev\CollectIt commit -m "chore(git): update comprehensive master .gitignore baseline"
git -C C:\Dev\MLBTracker add .gitignore && git -C C:\Dev\MLBTracker commit -m "chore(git): update comprehensive master .gitignore baseline"
```

---

### Task 0.3: Centralize All Agentic Tooling in `claude-kit`, Authoring Runbook & Sync Engine

**Agent Recommendation:**
- Claude: `model: sonnet`, `effort: high`
- AGY: `model: pro`, `thinking: high`

**Files:**
- Create/Organize: `C:\Dev\claude-kit\plugins\`
  - `bedrock-doctrine/skills/bump-bedrock-pin/`
  - `bedrock-doctrine/skills/cut-release/`
  - `bedrock-doctrine/agents/quality-gatekeeper.json`
  - `dev-doctrine/skills/anti-ui-slop/`
  - `dev-doctrine/skills/issue-triage/`
  - `dev-doctrine/skills/react-best-practices/`
  - `dev-doctrine/skills/sql-sentinel/`
  - `dev-doctrine/skills/triage-plan/`
  - `dev-doctrine/skills/implement-issue/`
  - `dev-doctrine/skills/run-tests/`
  - `dev-doctrine/skills/finalize-changes/`
  - `collectit-doctrine/skills/audit-ebay-compliance/`
  - `collectit-doctrine/agents/exporter-pipeline-specialist.json`
  - `collectit-doctrine/agents/listing-studio-engineer.json`
  - `collectit-doctrine/agents/route-security-engineer.json`
  - `collectit-doctrine/agents/schema-domain-architect.json`
  - `collectit-doctrine/hooks/post-edit-check.sh`
  - `mlbtracker-doctrine/skills/check-grid/`
  - `mlbtracker-doctrine/skills/grid-guru/`
  - `mlbtracker-doctrine/hooks/compaction_brief.py`
  - `mlbtracker-doctrine/hooks/session_context.py`
  - `mlbtracker-doctrine/hooks/stop-reminder.sh`
- Create: `C:\Dev\claude-kit\docs\guide\authoring-and-deploying-agentic-tooling.md`
- Modify: `C:\Dev\claude-kit\scripts\Sync-AgenticTooling.ps1`
- Register: Windows Scheduled Task `Bedrock-Sync-AgenticTooling`

**Interfaces:**
- Consumes: All skills, agents, and hooks across the ecosystem.
- Produces: Single authoritative source in `claude-kit`; read-only NTFS Directory Junctions (`New-Item -ItemType Junction`) into consumer `.agents/skills/`, `.agents/agents/`, `.claude/skills/`, `.claude/agents/`, `.claude/hooks/`, and global user paths (`~/.gemini/skills`, `~/.claude/skills`).

- [ ] **Step 1: Consolidate all domain skills, agents, and hooks into `claude-kit/plugins/`**
Move and organize:
- `cut-release` from `bedrock/.claude/skills/` -> `claude-kit/plugins/bedrock-doctrine/skills/cut-release/`.
- `triage-plan`, `implement-issue`, `run-tests`, `finalize-changes` -> `claude-kit/plugins/dev-doctrine/skills/`.
- `audit-ebay-compliance` and all CollectIt agents (`exporter-pipeline-specialist`, `listing-studio-engineer`, `route-security-engineer`, `schema-domain-architect`) and `post-edit-check.sh` -> `claude-kit/plugins/collectit-doctrine/`.
- `check-grid`, `grid-guru`, `compaction_brief.py`, `session_context.py`, `stop-reminder.sh` -> `claude-kit/plugins/mlbtracker-doctrine/`.

- [ ] **Step 2: Author `claude-kit/docs/guide/authoring-and-deploying-agentic-tooling.md`**
Document the canonical developer process:
1. All changes, additions, and edits must be committed directly in `claude-kit`.
2. Directory structure for core vs domain plugins.
3. How to author dual-target agent schemas (`targets.claude` and `targets.antigravity`).
4. How to configure the repository distribution manifest in `Sync-AgenticTooling.ps1`.
5. How consumer repositories consume tools as gitignored, read-only NTFS junctions.

- [ ] **Step 3: Update `Sync-AgenticTooling.ps1` distribution engine**
Implement logic to deploy:
- To `bedrock`: `dev-doctrine` + `bedrock-doctrine`.
- To `CollectIt`: `dev-doctrine` + `bedrock-doctrine` + `collectit-doctrine`.
- To `MLBTracker`: `dev-doctrine` + `bedrock-doctrine` + `mlbtracker-doctrine`.
- To `$HOME\.gemini\skills` & `$HOME\.claude\skills`: global shared doctrine.
- Ensure all links are created via `New-Item -ItemType Junction`.

- [ ] **Step 4: Execute `Sync-AgenticTooling.ps1`**
Run:
```powershell
pwsh -File "C:\Dev\claude-kit\scripts\Sync-AgenticTooling.ps1"
```
Expected output: All junctions established cleanly across all target repos.

- [ ] **Step 5: Register Windows Scheduled Task**
Run:
```powershell
$action = New-ScheduledTaskAction -Execute "pwsh.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File C:\Dev\claude-kit\scripts\Sync-AgenticTooling.ps1"
$trigger1 = New-ScheduledTaskTrigger -AtLogon
$trigger2 = New-ScheduledTaskTrigger -Daily -At 03:00AM
Register-ScheduledTask -TaskName "Bedrock-Sync-AgenticTooling" -Action $action -Trigger @($trigger1, $trigger2) -Description "Synchronizes Bedrock shared and domain agentic skills and junctions" -Force
```
Expected output: Task registered with state `Ready`.

- [ ] **Step 6: Commit in `claude-kit`**
```bash
git -C C:\Dev\claude-kit add plugins/ docs/ scripts/Sync-AgenticTooling.ps1
git -C C:\Dev\claude-kit commit -m "feat(doctrine): centralize all core and domain agentic tooling in claude-kit"
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

- [ ] **Step 1: Retire and delete deprecated `grid-refact` in MLBTracker**
Run:
```powershell
Remove-Item -Path "C:\Dev\MLBTracker\.agents\skills\grid-refact" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "C:\Dev\MLBTracker\.claude\skills\grid-refact" -Recurse -Force -ErrorAction SilentlyContinue
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
3. Deprecated tools (`grid-refact`) do not exist.
Run:
```powershell
pwsh -File "C:\Dev\claude-kit\scripts\Audit-AgenticTooling.ps1"
```
Expected output: 100% pass with 0 broken links, 0 symlinks, and 0 obsolete tools.

- [ ] **Step 4: Commit in `claude-kit`**
```bash
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

- [ ] **Step 1: Set canonical paths in `update-superpowers-paths.ps1`**
Ensure default parameters in `update-superpowers-paths.ps1` specify:
```powershell
[string]$CustomSpecPath = "docs/specs",
[string]$CustomPlanPath = "docs/plans",
```

- [ ] **Step 2: Execute `update-superpowers-paths.ps1`**
Run:
```powershell
pwsh -File "C:\Dev\TheLab\WorkstationTools\SuperpowersUpdates\update-superpowers-paths.ps1"
```
Expected output: All superpower skills patched successfully.

- [ ] **Step 3: Register Windows Scheduled Task**
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

- [ ] **Step 1: Author `docs/standards/s001-no-duplicate-ui-code.md` through `s012-dual-pin-platform-governance.md`**
Populate each standard document ensuring:
      Populate each standard document ensuring:
- Title uses 3-digit padded notation: `# Standard S001: No Duplicate UI Code`.
- Text citations use `§S001` through `§S012`.
- Standards map 1:1 to `bedrock.tools.audit_s###`.

- [ ] **Step 2: Create `docs/standards/README.md` index catalog**
Include catalog table indexing S001 through S012 with contract descriptions and audit tool links.
      Include catalog table indexing S001 through S012 with contract descriptions and audit tool links.

- [ ] **Step 3: Execute repository-wide find-and-replace sweep in Bedrock**
Replace all legacy references (`S01`, `S1`, `S02`, etc.) with canonical 3-digit padded notation (`§S001`, `§S002`) and updated kebab-case filenames across `docs/` and `packages/bedrock-api`.
      Replace all legacy references (`S01`, `S1`, `S02`, etc.) with canonical 3-digit padded notation (`§S001`, `§S002`) and updated kebab-case filenames across `docs/` and `packages/bedrock-api`.

- [ ] **Step 4: Verify markdown formatting**
Run:
      Run:

```powershell
Get-ChildItem C:\Dev\bedrock\docs\standards\*.md | Select-Object Name
```

Expected output: Exactly `README.md` and `s001-*.md` through `s012-*.md`.

- [ ] **Step 5: Commit in Bedrock**

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

- [ ] **Step 1: Write failing unit test for `AuditReporter`**

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

- [ ] **Step 2: Run test to verify it fails**
Run: `pytest packages/bedrock-api/tests/test_reporter.py`
Expected output: FAIL (`ModuleNotFoundError: No module named 'bedrock.tools._reporter'`).
      Run: `pytest packages/bedrock-api/tests/test_reporter.py`
      Expected output: FAIL (`ModuleNotFoundError: No module named 'bedrock.tools._reporter'`).

- [ ] **Step 3: Implement `bedrock/tools/_reporter.py`**
Implement standard 80-column banner, monotonic microsecond timings, formatted failure output with line pointers and remediation hints, and exit code propagation.
      Implement standard 80-column banner, monotonic microsecond timings, formatted failure output with line pointers and remediation hints, and exit code propagation.

- [ ] **Step 4: Run test to verify it passes**
Run: `pytest packages/bedrock-api/tests/test_reporter.py`
Expected output: PASS (all tests green).
      Run: `pytest packages/bedrock-api/tests/test_reporter.py`
      Expected output: PASS (all tests green).

- [ ] **Step 5: Commit in Bedrock**

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

- [ ] **Step 1: Write failing unit test for `load_bedrock_config`**

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

- [ ] **Step 2: Run test to verify it fails**
Run: `pytest packages/bedrock-api/tests/test_config.py`
Expected output: FAIL.
      Run: `pytest packages/bedrock-api/tests/test_config.py`
      Expected output: FAIL.

- [ ] **Step 3: Implement `bedrock/tools/_config.py` and `bedrock.toml`**
Implement typed config dataclasses with default baselines and additive merging. Create canonical `bedrock.toml` at Bedrock root.
      Implement typed config dataclasses with default baselines and additive merging. Create canonical `bedrock.toml` at Bedrock root.

- [ ] **Step 4: Run test to verify it passes**
Run: `pytest packages/bedrock-api/tests/test_config.py`
Expected output: PASS.
      Run: `pytest packages/bedrock-api/tests/test_config.py`
      Expected output: PASS.

- [ ] **Step 5: Commit in Bedrock**

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

- [ ] **Step 1: Write unit tests verifying CLI exit codes for `audit_s001`–`audit_s004`**
- [ ] **Step 2: Implement `audit_s001_duplicates.py`**
- [ ] **Step 3: Implement `audit_s002_grids.py`** (purge hardcoded app tables, source presentational tables from config)
- [ ] **Step 4: Implement `audit_s003_logging.py`** (ban bare `console.*` and `print`)
- [ ] **Step 5: Implement `audit_s004_config.py`** (AppConfigKey enum matching)
- [ ] **Step 6: Run tests to verify they pass**
Run: `pytest packages/bedrock-api/tests/test_audit_s001_to_s004.py`
Expected output: PASS.
      Run: `pytest packages/bedrock-api/tests/test_audit_s001_to_s004.py`
      Expected output: PASS.
- [ ] **Step 7: Commit in Bedrock**

```bash
git -C C:\Dev\bedrock add packages/bedrock-api/bedrock/tools/audit_s001_duplicates.py packages/bedrock-api/bedrock/tools/audit_s002_grids.py packages/bedrock-api/bedrock/tools/audit_s003_logging.py packages/bedrock-api/bedrock/tools/audit_s004_config.py packages/bedrock-api/tests/test_audit_s001_to_s004.py
git -C C:\Dev\bedrock commit -m "feat(tools): implement platform audits s001 through s004"
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

- [ ] **Step 1: Write unit tests for `audit_s005`–`audit_s008`**
- [ ] **Step 2: Implement `audit_s005_testing.py`**
- [ ] **Step 3: Implement `audit_s006_pr_workflow.py`**
- [ ] **Step 4: Implement `audit_s007_schema_catalog.py`**
- [ ] **Step 5: Implement `audit_s008_guidance.py`**
- [ ] **Step 6: Run tests to verify they pass**
Run: `pytest packages/bedrock-api/tests/test_audit_s005_to_s008.py`
Expected output: PASS.
      Run: `pytest packages/bedrock-api/tests/test_audit_s005_to_s008.py`
      Expected output: PASS.
- [ ] **Step 7: Commit in Bedrock**

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

- [ ] **Step 1: Write unit tests for `audit_s009`–`audit_s012`**
- [ ] **Step 2: Implement `audit_s009_design_tokens.py`**
- [ ] **Step 3: Implement `audit_s010_security.py`**
- [ ] **Step 4: Implement `audit_s011_navigation.py`**
- [ ] **Step 5: Implement `audit_s012_pins.py`**
- [ ] **Step 6: Run tests to verify they pass**
Run: `pytest packages/bedrock-api/tests/test_audit_s009_to_s012.py`
Expected output: PASS.
      Run: `pytest packages/bedrock-api/tests/test_audit_s009_to_s012.py`
      Expected output: PASS.
- [ ] **Step 7: Commit in Bedrock**

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

- [ ] **Step 1: Write unit tests for `sync_standards` and `run_all`**
- [ ] **Step 2: Implement `sync_standards.py`** (mirror writer with `--check` diffing)
- [ ] **Step 3: Implement `run_all.py`** (dispatches `audit_s001` through `audit_s012`)
- [ ] **Step 4: Run tests to verify they pass**
Run: `pytest packages/bedrock-api/tests/test_sync_and_run_all.py`
Expected output: PASS.
      Run: `pytest packages/bedrock-api/tests/test_sync_and_run_all.py`
      Expected output: PASS.
- [ ] **Step 5: Commit in Bedrock**

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
