# Architectural Specification: Agentic Tooling Standardization & Zero-Duplication Substrate

**Date:** 2026-09-12  
**Target Repositories:** `C:\Dev\claude-kit`, `C:\Dev\bedrock`, `C:\Dev\CollectIt`, `C:\Dev\MLBTracker`  
**Host Environment:** Windows 11 Pro, PowerShell 7 (Host), VS Code with Antigravity Plugin  
**CLI Runtimes:** Claude Code CLI (`claude`), Antigravity CLI (`agy.exe`)

---

## 1. Executive Summary & Goals

This specification defines the canonical architecture for developer and agentic tooling across the `bedrock` substrate ecosystem (`bedrock`, `CollectIt`, `MLBTracker`). 

### Primary Objectives:
1. **Single Canonical Source of Truth:** Centralize all shared plugins, skills, agent definitions, and rules in `C:\Dev\claude-kit`. Eliminate duplicated skill folders and divergent markdown files.
2. **Zero-Elevation Linking via NTFS Directory Junctions:** Standardize all workspace links on NTFS Directory Junctions (`New-Item -ItemType Junction`), guaranteeing reliable discovery without requiring Windows Developer Mode or UAC elevation.
3. **Polyglot Agent Architecture with Specificity Preservation:** Support both Claude Code CLI and Antigravity (CLI and VS Code) by storing canonical dual-target agent definitions in `claude-kit` and using an automated compiler (`Sync-AgenticTooling.ps1`) to project tailored configurations (`.claude/agents/*.md` for Claude; `.agents/skills/<agent>/SKILL.md` for Antigravity).
4. **Strict `.gitignore` Baselines & Leak Prevention:** Lock down all repositories against transient agent runtimes, cache files, and machine-specific local files while allowing canonical `.code-workspace` and `.antigravityrc` base templates to be checked into version control.
5. **Zero-Token Headless PowerShell Profile Guard:** Implement an early-exit bailout in `$PROFILE` to prevent terminal banners, PSReadLine modules, and prompt decorations from polluting agent tool execution streams.

---

## 2. Directory Layout & Architecture Map

### 2.1 Canonical Root: `C:\Dev\claude-kit`

`claude-kit` houses shared plugins, canonical agent source definitions, documentation, and the synchronization engine:

```text
C:\Dev\claude-kit\
├── .claude-plugin\
│   └── marketplace.json
├── docs\
│   └── specs\
│       └── 2026-09-12-agentic-tooling-standardization.md
├── plugins\
│   ├── bedrock-doctrine\
│   │   ├── .claude-plugin\
│   │   │   └── plugin.json
│   │   ├── agents\                         # Canonical source definitions
│   │   │   └── quality-gatekeeper.json     # Multi-target definition
│   │   └── skills\
│   │       └── bump-bedrock-pin\
│   │           └── SKILL.md
│   └── dev-doctrine\
│       ├── .claude-plugin\
│       │   └── plugin.json
│       ├── agents\
│       └── skills\
│           ├── anti-ui-slop\
│           │   └── SKILL.md
│           ├── issue-triage\
│           │   └── SKILL.md
│           ├── react-best-practices\
│           │   └── SKILL.md
│           └── sql-sentinel\
│               └── SKILL.md
├── scripts\
│   ├── Sync-AgenticTooling.ps1             # Master junction & agent compiler
│   └── Audit-AgenticTooling.ps1            # Verification & parity checker
├── .antigravityrc                          # Canonical workspace config
├── .gitignore                              # Standardized baseline
└── claude-kit.code-workspace               # Relative workspace config
```

### 2.2 Domain Repositories (`CollectIt`, `MLBTracker`, `bedrock`)

Consumer repositories consume shared skills via NTFS junctions from `claude-kit`, but retain **purely domain-specific** skills, agents, and hooks locally:

```text
<repo-root>/
├── .agents\
│   └── skills\
│       ├── anti-ui-slop         -> Junction [claude-kit/plugins/dev-doctrine/skills/anti-ui-slop]
│       ├── bump-bedrock-pin     -> Junction [claude-kit/plugins/bedrock-doctrine/skills/bump-bedrock-pin]
│       ├── issue-triage         -> Junction [claude-kit/plugins/dev-doctrine/skills/issue-triage]
│       ├── react-best-practices -> Junction [claude-kit/plugins/dev-doctrine/skills/react-best-practices]
│       ├── sql-sentinel         -> Junction [claude-kit/plugins/dev-doctrine/skills/sql-sentinel]
│       ├── <domain-skill-1>     # Local domain skill (e.g. audit-ebay-compliance in CollectIt)
│       └── <domain-skill-2>     # Local domain skill (e.g. grid-guru in MLBTracker)
├── .claude\
│   ├── agents\                  # Generated / domain Claude agents
│   ├── hooks\                   # Local Claude Code execution hooks
│   └── skills\                  # Domain Claude skills (or junctions)
├── .antigravityrc               # Committed canonical base
├── .antigravityrc.local         # Ignored machine-specific overrides
├── .gitignore                   # Standardized baseline
└── <repo>.code-workspace        # Committed relative workspace file
```

---

## 3. Tool Classification & Lifecycle Matrix

| Asset Name | Current Type | Scope | Target Location | Rationale & Status |
| :--- | :--- | :--- | :--- | :--- |
| `bump-bedrock-pin` | Skill | **Shared (Global)** | `claude-kit/plugins/bedrock-doctrine/skills/bump-bedrock-pin` | Governs dual-pin lockstep between `bedrock-api` and `@djntechnic/bedrock-ui`. Required by all consumers. |
| `anti-ui-slop` | Skill | **Shared (Global)** | `claude-kit/plugins/dev-doctrine/skills/anti-ui-slop` | Enforces design tokens, UIZZE evidence, and state coverage across frontends. |
| `react-best-practices` | Skill | **Shared (Global)** | `claude-kit/plugins/dev-doctrine/skills/react-best-practices` | Vercel performance and clean React guidelines. |
| `sql-sentinel` | Skill | **Shared (Global)** | `claude-kit/plugins/dev-doctrine/skills/sql-sentinel` | Prevents N+1 queries, bare literals, and unindexed joins across repos. |
| `issue-triage` | Skill | **Shared (Global)** | `claude-kit/plugins/dev-doctrine/skills/issue-triage` | Cross-repo issue authoring with systematic debugging & brainstorming. |
| `quality-gatekeeper` | Subagent / Skill | **Shared (Global)** | `claude-kit/plugins/bedrock-doctrine/agents/quality-gatekeeper.json` | Tiered audit, test suite gating, and PR readiness verification. |
| `cut-release` | Skill | **Domain (bedrock)** | `bedrock/.agents/skills/cut-release` | Strictly used to bump bedrock packages, update changelog, and push tags. Not used by consumers. |
| `audit-ebay-compliance` | Skill | **Domain (CollectIt)** | `CollectIt/.agents/skills/audit-ebay-compliance` | Strictly validates HTML templates against eBay's active content policies. |
| `listing-studio-engineer` | Subagent | **Domain (CollectIt)** | `CollectIt/.claude/agents/listing-studio-engineer.md` | Focused on CollectIt's dual-pane Listing Studio and iframe synchronization. |
| `exporter-pipeline-specialist`| Subagent | **Domain (CollectIt)** | `CollectIt/.claude/agents/exporter-pipeline-specialist.md` | Governs photo archiving, R2 monotonically increasing keys, and CSV layouts. |
| `route-security-engineer` | Subagent | **Domain (CollectIt)** | `CollectIt/.claude/agents/route-security-engineer.md` | CollectIt §S10/§S11 FastAPI route guard permissions and module tagging. |
| `schema-domain-architect` | Subagent | **Domain (CollectIt)** | `CollectIt/.claude/agents/schema-domain-architect.md` | SQLite schema migrations, catalog synchronization, and atomic sequence allocation. |
| `check-grid` | Skill | **Domain (MLBTracker)**| `MLBTracker/.agents/skills/check-grid` | Audits 7-layer grid architecture adherence against `useGridConfig` and `<DataGrid>`. |
| `grid-guru` | Skill | **Domain (MLBTracker)**| `MLBTracker/.agents/skills/grid-guru` | Expert runbook for scaffolding and refactoring TanStack grids. |
| `grid-refact` | Skill | **Deprecate / Remove**| N/A | Redundant with `grid-guru` and standard 7-layer grid standards. |
| `compact-test-runner` | Skill / Hook | **Shared (Global)** | `claude-kit/plugins/dev-doctrine/skills/run-tests` | Standardized thin test runner running delta/scoped tests with immediate exit-code capture. |
| `tcdb-disambiguation-sync` | Skill | **Domain (MLBTracker)**| `MLBTracker/.agents/skills/tcdb-disambiguation-sync` | Baseball card checklist ingestion and entity resolution. |

---

## 4. Cross-Harness Consistency & Polyglot Agent Architecture

### 4.1 Divergence Analysis

| Feature | Claude Code CLI (`claude`) | Antigravity CLI (`agy`) & VS Code Plugin |
| :--- | :--- | :--- |
| **Skill Frontmatter** | `name`, `description` | `name`, `description` (fully compatible) |
| **Agent Discovery** | Reads `.claude/agents/*.md` | Discovers `.agents/skills/` and global `~/.gemini/skills/` |
| **Model Selection** | `model: sonnet \| opus \| haiku` | `model: inherit \| flash \| pro` |
| **Effort / Reasoning** | `effort: low \| medium \| high` | `thinking: low \| medium \| high` |
| **Tool Declarations** | `[Read, Edit, Write, Glob, Grep, Bash]` | Native names (`view_file`, `replace_file_content`, `run_command`, etc.) |

### 4.2 Canonical Agent Definition Schema (`.json` or `.yaml`)

To preserve model-specific precision and prevent "generic agent" drift, agents are authored once in `claude-kit/plugins/<plugin>/agents/<agent-name>.json`:

```json
{
  "name": "quality-gatekeeper",
  "description": "Final quality gatekeeper. Enforces zero broken tests, audits schema names, checks clean git working tree, and validates PR readiness.",
  "targets": {
    "claude": {
      "model": "sonnet",
      "effort": "high",
      "tools": ["Read", "Glob", "Grep", "Bash"]
    },
    "antigravity": {
      "model": "pro",
      "thinking": "high",
      "tools": ["view_file", "grep_search", "find_by_name", "run_command"]
    }
  },
  "directives": [
    "Zero-Tolerance Defect Contract (§S5): Zero broken tests ship to master. Never excuse a test failure as 'out of scope'.",
    "Script Exit Codes: Always inspect the script exit code directly (command; echo 'exit=$?'). Never pipe output through tail or pagers.",
    "Lockstep Dependency Pins: Confirm requirements.txt and package.json point to the exact same git release tag.",
    "Clean Working Tree: Ensure git status --porcelain is clean and no local config, state, or scratch files are tracked.",
    "Comprehensive Gating: Run the full test suite, type check, and required project audits before committing and drafting the PR."
  ]
}
```

### 4.3 Automated Compilation via `Sync-AgenticTooling.ps1`

When executed, the compiler:
1. Emits `.claude/agents/quality-gatekeeper.md` with Claude frontmatter.
2. Emits `.agents/skills/quality-gatekeeper/SKILL.md` with Antigravity-friendly step-by-step instructions.

---

## 5. NTFS Junction & Synchronization Engine

### 5.1 Why Pure NTFS Junctions?
- **Zero-Elevation Requirement:** Can be created by normal user processes without administrator elevation or Windows Developer Mode.
- **Universal Runtime Support:** Node.js, Python, Git, Claude CLI, and Antigravity treat directory junctions as transparent directory paths.
- **Immediate Propagation:** Changes made in `claude-kit` are immediately visible in all consumer repositories.

### 5.2 Junction Mapping Table

```text
Source in claude-kit                                  -> Target Junction Path
---------------------------------------------------------------------------------------------------------------
plugins/dev-doctrine/skills/anti-ui-slop              -> <repo>/.agents/skills/anti-ui-slop
plugins/bedrock-doctrine/skills/bump-bedrock-pin     -> <repo>/.agents/skills/bump-bedrock-pin
plugins/dev-doctrine/skills/issue-triage             -> <repo>/.agents/skills/issue-triage
plugins/dev-doctrine/skills/react-best-practices     -> <repo>/.agents/skills/react-best-practices
plugins/dev-doctrine/skills/sql-sentinel             -> <repo>/.agents/skills/sql-sentinel

Global User Discovery:
plugins/dev-doctrine/skills/*                         -> $HOME/.gemini/skills/*
plugins/bedrock-doctrine/skills/*                     -> $HOME/.gemini/skills/*
plugins/dev-doctrine/skills/*                         -> $HOME/.claude/skills/*
plugins/bedrock-doctrine/skills/*                     -> $HOME/.claude/skills/*
```

---

## 6. Standardized `.gitignore` Baseline & Ephemeral Leak Prevention

To prevent continuous trivial check-ins and agent context dirtiness, all repositories (`bedrock`, `CollectIt`, `MLBTracker`, and `claude-kit`) must implement this uniform block.

### 6.1 Standard `.gitignore` Block

```gitignore
# ==============================================================================
# AI AGENTS, WORKSPACES & LOCAL OVERRIDES
# ==============================================================================
# Local agent configuration overrides
.antigravityrc.local
.claude/settings.local.json
*.local.json

# Agent runtime caches & hooks
.claude/state/
.claude/worktrees/
.playwright-mcp/
.superpowers/sdd/**
scratch/
docs/project/punchlists/
docs/reference/punchlists/

# Local workspace files (ignore user-local variants)
*.code-workspace.local

# pytest-testmon delta caches
.testmondata*

# Local SQLite databases & sidecars
*.db-wal
*.db-shm
*.db-journal
```

### 6.2 Tracking Policy for `.code-workspace` and `.antigravityrc`
- **Canonical Files (Tracked):**
  - `<repo>.code-workspace` is tracked in git. It must contain only relative directory references (`"path": "."`), editor layout configs, and search exclusions.
  - `.antigravityrc` is tracked in git with canonical autonomous policies and standard allowed commands.
- **Local Overrides (Ignored):**
  - All developer-specific path modifications must be made in `.antigravityrc.local` or `<repo>.code-workspace.local`.
- **Git `skip-worktree` Protection:**
  - If a local environment requires temporary path changes without risking accidental commits, run:
    ```bash
    git update-index --skip-worktree <repo>.code-workspace
    ```

---

## 7. Headless PowerShell Profile Guard (`$PROFILE`)

To guarantee zero token overhead, sub-10ms agent tool execution, and deterministic script output, `$PROFILE` must immediately bail out when invoked in non-interactive / agent execution mode.

### 7.1 Authoritative `$PROFILE` Implementation

```powershell
# ------------------------------------------------------------------------------
# Developer PowerShell 7 Profile (Zero-Token Agent Optimized)
# ------------------------------------------------------------------------------

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

# ------------------------------------------------------------------------------
# 2. Interactive Console Configuration Only (Human Developer Experience)
# ------------------------------------------------------------------------------
try {
    Import-Module PSReadLine -ErrorAction Stop
    Set-PSReadLineOption -PredictionSource History
    Set-PSReadLineOption -PredictionViewStyle ListView
    Set-PSReadLineOption -HistorySearchCursorMovesToEnd
    Set-PSReadLineKeyHandler -Key UpArrow -Function HistorySearchBackward
    Set-PSReadLineKeyHandler -Key DownArrow -Function HistorySearchForward
    Set-PSReadLineKeyHandler -Key Tab -Function MenuComplete
} catch {
    # Suppress PSReadLine cache errors
}

try {
    Import-Module Terminal-Icons -ErrorAction SilentlyContinue
    Import-Module posh-git -ErrorAction SilentlyContinue
} catch {
    # Suppress module parsing errors
}

# Aliases & Navigation
Set-Alias ll Get-ChildItem
Set-Alias grep Select-String

function home { Set-Location $HOME }
function dev { Set-Location "C:\Dev" }
function cdev {
    param([string]$ProjectName)
    if ([string]::IsNullOrWhiteSpace($ProjectName)) {
        Set-Location "C:\Dev"
    } else {
        $TargetPath = Join-Path "C:\Dev" $ProjectName
        if (Test-Path $TargetPath) { Set-Location $TargetPath } else { Write-Warning "Path not found: $TargetPath" }
    }
}

function reload-profile { . $PROFILE }

Write-Host "PowerShell 7 Environment Loaded: $PROFILE" -ForegroundColor Blue
```

---

## 8. Verification Plan & Audit Gates

1. **Junction Integrity Audit:**
   - Execute `Get-Item C:\Dev\<repo>\.agents\skills\* | Select-Object Name, LinkType, Target`.
   - Verify every shared skill has `LinkType: Junction` pointing to `C:\Dev\claude-kit\plugins\...`.
2. **Interactive Profile Guard Audit:**
   - Run `pwsh -Command "Write-Output 'TEST'"` and verify output contains **only** `TEST` (no banner, no ANSI codes, no module messages).
3. **Clean Working Tree Verification:**
   - Verify `git status --porcelain` in all 4 repositories is completely clean.
4. **Autonomous Agent Execution Test:**
   - Run `bump-bedrock-pin` and `anti-ui-slop` in Antigravity and Claude Code to verify frontmatter loading and execution.
