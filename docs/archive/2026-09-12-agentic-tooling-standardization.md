# Agentic Tooling Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish `C:\Dev\claude-kit` as the single canonical source of truth for all agentic tools across `bedrock`, `CollectIt`, and `MLBTracker`, eliminate code duplication via NTFS Directory Junctions, implement polyglot agent generation, enforce strict `.gitignore` baselines, and guarantee zero-token headless PowerShell profile execution.

**Architecture:** 
- Centralize shared skills and multi-target agent definitions inside `C:\Dev\claude-kit\plugins\`.
- Use a robust PowerShell engine (`Sync-AgenticTooling.ps1`) to compile platform-specific agent representations and establish NTFS Directory Junctions (`New-Item -ItemType Junction`) into consumer repos and global directories.
- Deploy uniform `.gitignore` rules across all repos to prevent ephemeral agent churn and leaks.
- Update `$PROFILE` with a fast-path bailout for non-interactive / agent runner subshells.

**Tech Stack:** PowerShell 7, Windows 11 NTFS, JSON/YAML schemas, Claude Code CLI, Antigravity CLI (`agy`), VS Code Antigravity Extension.

**Spec:** `C:\Dev\claude-kit\docs\specs\2026-09-12-agentic-tooling-standardization.md`

## Global Constraints
- Read-only safety on unapproved targets: All directory modifications must target approved paths only.
- Zero-Elevation Linking: Must use NTFS Junctions (`-ItemType Junction`), avoiding symlinks that require Developer Mode or UAC prompts.
- Zero Broken Tests (§S05): Audits and unit tests in all target repositories must pass cleanly.
- Strict Path Boundaries: Domain-specific skills stay in domain repositories (`bedrock`, `CollectIt`, `MLBTracker`); shared skills stay in `claude-kit`.
- Shell Safety: UTF-8 encoding must be preserved; `$PROFILE` must execute in <10ms for non-interactive shells.

---

### Task 1: Headless PowerShell `$PROFILE` Zero-Token Guard

**Files:**
- Modify: `$PROFILE` (located at `C:\Users\SuperDan\Documents\PowerShell\Microsoft.PowerShell_profile.ps1`)
- Test: Scoped PowerShell CLI invocations

**Interfaces:**
- Consumes: Environment flags (`$env:VSCODE_NONINTERACTIVE`, `$env:ANTIGRAVITY_NONINTERACTIVE`, `$env:CLAUDE_CODE_ENTRYPOINT`, `$env:CLAUDE_NONINTERACTIVE`) and stream redirection indicators.
- Produces: Clean, silent non-interactive execution for agent subprocesses while preserving interactive tools for human sessions.

- [ ] **Step 1: Inspect current profile contents and backup**
Run:
```powershell
Copy-Item -Path $PROFILE -Destination "$PROFILE.bak" -Force
```

- [ ] **Step 2: Update `$PROFILE` with early bailout guard**
Insert fast-path check at the very top of `$PROFILE`:
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
    # Exit immediately. Do not load PSReadLine, Terminal-Icons, posh-git, or print banners.
    return
}
```

- [ ] **Step 3: Verify non-interactive execution emits zero preamble**
Run:
```powershell
pwsh -Command "Write-Output 'ZERO_TOKEN_CLEAN'"
```
Expected: Output must contain ONLY `ZERO_TOKEN_CLEAN` with no startup banners, module loading messages, or ANSI artifacts.

---

### Task 2: Standardize `.gitignore` Baselines Across All Repositories

**Files:**
- Modify: `C:\Dev\claude-kit\.gitignore`
- Modify: `C:\Dev\bedrock\.gitignore`
- Modify: `C:\Dev\CollectIt\.gitignore`
- Modify: `C:\Dev\MLBTracker\.gitignore`

**Interfaces:**
- Consumes: Ephemeral directory paths (`.claude/state/`, `.claude/worktrees/`, `.playwright-mcp/`, `.superpowers/sdd/**`, `scratch/`, `.testmondata*`).
- Produces: Clean git status across all repos while allowing tracked canonical `.code-workspace` and `.antigravityrc` files.

- [ ] **Step 1: Write test script to audit ignored patterns**
Create scratch test script to assert that ephemeral paths are ignored across all 4 repos.

- [ ] **Step 2: Update `.gitignore` in `claude-kit`, `bedrock`, `CollectIt`, and `MLBTracker`**
Ensure the following standard block is uniformly present in all 4 `.gitignore` files:
```gitignore
# ==============================================================================
# AI AGENTS, WORKSPACES & LOCAL OVERRIDES
# ==============================================================================
.antigravityrc.local
.claude/settings.local.json
*.local.json

# Agent runtime caches, state & worktrees
.claude/state/
.claude/worktrees/
.playwright-mcp/
.superpowers/sdd/**
scratch/
docs/project/punchlists/
docs/reference/punchlists/

# Local workspace files
*.code-workspace.local

# pytest-testmon delta caches
.testmondata*

# Local SQLite databases & sidecars
*.db-wal
*.db-shm
*.db-journal
```

- [ ] **Step 3: Run git status check on all repos**
Run:
```powershell
"claude-kit", "bedrock", "CollectIt", "MLBTracker" | ForEach-Object {
    Write-Host "Repo: $_" -ForegroundColor Cyan
    git -C "C:\Dev\$_" status --short
}
```
Expected: No untracked `.antigravityrc.local`, `.claude/state/`, or `.testmondata` files appear.

---

### Task 3: Build Canonical Multi-Target Agent Compiler Schema & Engine

**Files:**
- Create: `C:\Dev\claude-kit\plugins\bedrock-doctrine\agents\quality-gatekeeper.json`
- Create: `C:\Dev\claude-kit\plugins\dev-doctrine\agents\` (if needed for shared developer agents)
- Create: `C:\Dev\claude-kit\scripts\Sync-AgenticTooling.ps1`
- Create: `C:\Dev\claude-kit\scripts\Audit-AgenticTooling.ps1`

**Interfaces:**
- Consumes: Canonical multi-target agent definitions in JSON/YAML.
- Produces: 
  - Compiled `.claude/agents/*.md` with Claude metadata.
  - Compiled `.agents/skills/<agent>/SKILL.md` with Antigravity metadata.
  - NTFS Junctions across `CollectIt`, `MLBTracker`, `bedrock`, and global user discovery paths (`$HOME\.gemini\skills`, `$HOME\.claude\skills`).

- [ ] **Step 1: Define canonical `quality-gatekeeper.json`**
Write `C:\Dev\claude-kit\plugins\bedrock-doctrine\agents\quality-gatekeeper.json` with multi-target specifications for Claude and Antigravity.

- [ ] **Step 2: Implement compiler in `Sync-AgenticTooling.ps1`**
Include:
1. Logic to compile agent definitions into Claude `.claude/agents/<name>.md`.
2. Logic to compile agent definitions into Antigravity `.agents/skills/<name>/SKILL.md`.
3. `Ensure-Junction` helper using `New-Item -ItemType Junction` to link shared skills:
   - `anti-ui-slop`
   - `bump-bedrock-pin`
   - `issue-triage`
   - `react-best-practices`
   - `sql-sentinel`
4. Distribution to consumer repos (`bedrock`, `CollectIt`, `MLBTracker`) and `$HOME` paths (`.gemini\skills`, `.claude\skills`).

- [ ] **Step 3: Implement validation checker in `Audit-AgenticTooling.ps1`**
Verify that all junctions resolve to existing target folders and report link health.

- [ ] **Step 4: Execute `Sync-AgenticTooling.ps1`**
Run:
```powershell
pwsh -File C:\Dev\claude-kit\scripts\Sync-AgenticTooling.ps1
```
Expected: Successful output creating/verifying all NTFS Junctions and compiled agent definitions.

- [ ] **Step 5: Execute `Audit-AgenticTooling.ps1`**
Run:
```powershell
pwsh -File C:\Dev\claude-kit\scripts\Audit-AgenticTooling.ps1
```
Expected: 100% pass with 0 broken links or missing targets.

---

### Task 4: Clean Up Inconsistent Symlinks & Deprecated Tools

**Files:**
- Clean up: `C:\Dev\MLBTracker\.agents\skills\grid-refact` (retire/delete redundant skill)
- Convert: Convert existing `SymbolicLink` directories in `CollectIt`, `MLBTracker`, `bedrock`, and `$HOME\.gemini\skills` to uniform `Junction` points.

**Interfaces:**
- Consumes: Output from `Audit-AgenticTooling.ps1`.
- Produces: Uniform `LinkType: Junction` for all linked skills across the entire filesystem.

- [ ] **Step 1: Remove deprecated `grid-refact` from MLBTracker**
Remove redundant skill folder `C:\Dev\MLBTracker\.agents\skills\grid-refact` and `.claude\skills\grid-refact`.

- [ ] **Step 2: Re-run `Sync-AgenticTooling.ps1` to replace symlinks with NTFS junctions**
Ensure all existing links are upgraded to pure Directory Junctions.

- [ ] **Step 3: Verify link types across repos**
Run:
```powershell
Get-Item C:\Dev\CollectIt\.agents\skills\*, C:\Dev\MLBTracker\.agents\skills\*, C:\Dev\bedrock\.agents\skills\* |
    Select-Object FullName, LinkType, Target
```
Expected: All shared items show `LinkType: Junction`.

---

### Task 5: End-to-End Cross-Harness Verification

**Files:**
- Test across: `claude`, `agy`, and VS Code environment

**Interfaces:**
- Consumes: Active environment and CLI runners.
- Produces: Proof of skill and agent invocation in both harnesses.

- [ ] **Step 1: Test Antigravity skill discovery**
Run:
```powershell
Get-ChildItem $HOME\.gemini\skills | Select-Object Name, LinkType, Target
```
Verify skills resolve to `claude-kit`.

- [ ] **Step 2: Run scoped test suites and audits in consumer repos**
Run:
```powershell
cd C:\Dev\bedrock && python -m unittest discover -s packages/bedrock-api/tests
cd C:\Dev\CollectIt && python scripts/maintenance/audit_bedrock_pins.py
cd C:\Dev\MLBTracker && python scripts/maintenance/audit_bedrock_pins.py
```
Expected: All exit codes 0.

- [ ] **Step 3: Commit and push changes in `claude-kit`**
Stage and commit `docs/specs/`, `docs/plans/`, `plugins/`, and `scripts/` in `C:\Dev\claude-kit`.

---

## Execution Handoff

Plan complete and saved to `C:\Dev\claude-kit\docs\plans\2026-09-12-agentic-tooling-standardization.md`.

Two execution options:
1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Which approach would you prefer?
