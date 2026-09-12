# Cross-Repository Standards, Directory Taxonomy, Kebab-Case File Naming, and Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the canonical taxonomy and naming validation/remediation engine in `bedrock.tools`, restructure documentation into the 6-folder model across `bedrock`, `CollectIt`, and `MLBTracker`, execute NTFS-safe two-stage renames for templates and standards, synchronize agent harnesses, and enshrine pre-commit/CI quality gates.

**Architecture:** A centralized platform tool in `packages/bedrock-api/bedrock/tools/` provides both validation (`audit_taxonomy_and_casing.py`) and automated graph-aware two-stage NTFS remediation (`remediate_taxonomy_and_casing.py`). WorkstationTools scripts align plugin outputs, thin maintenance wrappers delegate from consumer repos, and standardized `@quality-gatekeeper` definitions enforce exit code 0 and clean git working trees.

**Tech Stack:** Python 3.11+, Pytest, Git CLI, PowerShell 7, Antigravity IDE / CLI (`agy`), GitHub CLI (`gh`).

**Spec:** [`C:\Dev\bedrock\docs\specs\2026-09-12-cross-repo-standards-tooling-and-naming-architecture.md`](file:///C:/Dev/bedrock/docs/specs/2026-09-12-cross-repo-standards-tooling-and-naming-architecture.md)

## Global Constraints

- Python modules and maintenance scripts strictly use `snake_case.py` (`^[a-z0-9_]+\.py$`).
- Shell/batch service launchers strictly use `snake_case` (`^[a-z0-9_]+\.(bat|ps1|cmd|vbs)$`).
- Agent and Git hooks strictly use `kebab-case` (`^[a-z0-9-]+\.(sh|bash)$`).
- Documentation and listing templates strictly use kebab-case (`^[a-z0-9-]+(\.[a-z0-9-]+)*\.(md|html)$`).
- Universal Exceptions: `README.md`, `CLAUDE.md`, and `GEMINI.md` remain uppercase.
- Two-Stage Windows NTFS Rename Invariant: All case-altering renames must execute via an intermediate `__tmp` path to avoid NTFS index corruption.
- Six-Folder Docs Taxonomy: Every document under `docs/` must reside in `guide/`, `reference/`, `standards/`, `specs/`, `plans/`, or `project/`.
- All transient punchlists, QA notes, and screenshots must be evicted to untracked root `scratch/`.
- Zero broken tests ship to master (§S05).

---

### Task 1: Bedrock Platform Audit Tooling (`bedrock.tools.audit_taxonomy_and_casing`)

**Files:**

- Create: `packages/bedrock-api/bedrock/tools/audit_taxonomy_and_casing.py`
- Test: `packages/bedrock-api/tests/test_audit_taxonomy_and_casing.py`
- Modify: `packages/bedrock-api/pyproject.toml:44-46`

**Interfaces:**

- Consumes: Filesystem inspection via `pathlib.Path`, regex pattern matching for naming rules.
- Produces: CLI script `audit-taxonomy` returning integer exit codes (0 = clean, 1 = violations, 2 = usage/environment error).

- [ ] **Step 1: Write the failing unit tests for audit tool**

Create `packages/bedrock-api/tests/test_audit_taxonomy_and_casing.py` testing rule validation:

```python
import pytest
from pathlib import Path
from bedrock.tools.audit_taxonomy_and_casing import (
    validate_file_casing,
    validate_docs_taxonomy,
    check_repository_hygiene,
)

def test_validate_file_casing_documentation():
    assert validate_file_casing("docs/standards/s01-no-duplicate-ui-code.md") == []
    assert validate_file_casing("README.md") == []
    assert validate_file_casing("CLAUDE.md") == []
    assert validate_file_casing("GEMINI.md") == []
    assert len(validate_file_casing("docs/standards/S01_No_Duplicate_UI_Code.md")) > 0
    assert len(validate_file_casing("docs/guide/ApiGuide.md")) > 0

def test_validate_file_casing_scripts():
    assert validate_file_casing("scripts/maintenance/audit_taxonomy.py") == []
    assert validate_file_casing("scripts/start_dev.bat") == []
    assert validate_file_casing(".claude/hooks/post-edit-check.sh") == []
    assert len(validate_file_casing("scripts/maintenance/audit-taxonomy.py")) > 0
    assert len(validate_file_casing("scripts/StartDev.bat")) > 0
    assert len(validate_file_casing(".claude/hooks/post_edit_check.sh")) > 0

def test_validate_docs_taxonomy_allowed_folders(tmp_path: Path):
    docs = tmp_path / "docs"
    docs.mkdir()
    for allowed in ["guide", "reference", "standards", "specs", "plans", "project"]:
        (docs / allowed).mkdir()
        (docs / allowed / "README.md").write_text("# Index")

    assert validate_docs_taxonomy(tmp_path) == []

def test_validate_docs_taxonomy_disallowed_folders(tmp_path: Path):
    docs = tmp_path / "docs"
    docs.mkdir()
    (docs / "punchlists").mkdir()
    (docs / "punchlists" / "sample.txt").write_text("todo")
    (docs / "archive").mkdir()

    errors = validate_docs_taxonomy(tmp_path)
    assert any("Disallowed folder 'docs/punchlists'" in err for err in errors)
    assert any("Disallowed folder 'docs/archive'" in err for err in errors)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest packages/bedrock-api/tests/test_audit_taxonomy_and_casing.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'bedrock.tools.audit_taxonomy_and_casing'`

- [ ] **Step 3: Implement `audit_taxonomy_and_casing.py`**

Create `packages/bedrock-api/bedrock/tools/audit_taxonomy_and_casing.py`:

```python
"""Module: bedrock/tools/audit_taxonomy_and_casing.py
Layer: bedrock/tools
Desc: Platform validator for repo directory taxonomy, file casing, and doc indexes.
"""
from __future__ import annotations

import argparse
import pathlib
import re
import sys

ALLOWED_DOCS_DIRS = {"guide", "reference", "standards", "specs", "plans", "project"}
UNIVERSAL_EXCEPTIONS = {"README.md", "CLAUDE.md", "GEMINI.md"}

RE_KEBAB_DOC = re.compile(r"^[a-z0-9-]+(\.[a-z0-9-]+)*\.md$")
RE_KEBAB_TEMPLATE = re.compile(r"^[a-z0-9-]+(\.[a-z0-9-]+)*\.(html|j2)$")
RE_PYTHON_SCRIPT = re.compile(r"^[a-z0-9_]+\.py$")
RE_SERVICE_LAUNCHER = re.compile(r"^[a-z0-9_]+\.(bat|ps1|cmd|vbs)$")
RE_HOOK_SCRIPT = re.compile(r"^[a-z0-9-]+\.(sh|bash)$")

def validate_file_casing(rel_path: str) -> list[str]:
    errors = []
    p = pathlib.PurePath(rel_path)
    name = p.name

    if name in UNIVERSAL_EXCEPTIONS:
        return errors

    parts = p.parts
    if len(parts) > 0 and parts[0] == "docs" and name.endswith(".md"):
        if not RE_KEBAB_DOC.match(name):
            errors.append(f"Markdown doc '{rel_path}' must be kebab-case (^[a-z0-9-]+(\.[a-z0-9-]+)*\.md$)")
    elif len(parts) > 0 and parts[0] == "templates" and (name.endswith(".html") or name.endswith(".j2")):
        if not RE_KEBAB_TEMPLATE.match(name):
            errors.append(f"Template '{rel_path}' must be kebab-case (^[a-z0-9-]+(\.[a-z0-9-]+)*\.(html|j2)$)")
    elif name.endswith(".py"):
        if not RE_PYTHON_SCRIPT.match(name):
            errors.append(f"Python script '{rel_path}' must be snake_case (^[a-z0-9_]+\.py$)")
    elif name.endswith((".bat", ".ps1", ".cmd", ".vbs")):
        if not RE_SERVICE_LAUNCHER.match(name):
            errors.append(f"Launcher '{rel_path}' must be snake_case (^[a-z0-9_]+\.(bat|ps1|cmd|vbs)$)")
    elif ".claude" in parts and "hooks" in parts and name.endswith((".sh", ".bash")):
        if not RE_HOOK_SCRIPT.match(name):
            errors.append(f"Hook '{rel_path}' must be kebab-case (^[a-z0-9-]+\.(sh|bash)$)")

    return errors

def validate_docs_taxonomy(repo_root: pathlib.Path) -> list[str]:
    errors = []
    docs_dir = repo_root / "docs"
    if not docs_dir.exists():
        return errors

    for item in docs_dir.iterdir():
        if item.is_dir():
            if item.name.startswith((".", "_")):
                continue
            if item.name not in ALLOWED_DOCS_DIRS:
                errors.append(f"Disallowed folder 'docs/{item.name}'. Allowed folders: {sorted(ALLOWED_DOCS_DIRS)}")
            else:
                readme = item / "README.md"
                if not readme.exists():
                    errors.append(f"Missing index 'docs/{item.name}/README.md'")
        elif item.is_file():
            if item.name not in UNIVERSAL_EXCEPTIONS and item.name.endswith(".md"):
                errors.append(f"Orphaned root doc 'docs/{item.name}'. All docs must live in one of {sorted(ALLOWED_DOCS_DIRS)}")

    return errors

def check_repository_hygiene(repo_root: pathlib.Path) -> tuple[list[str], list[str]]:
    casing_errors = []
    taxonomy_errors = validate_docs_taxonomy(repo_root)

    for path in repo_root.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(repo_root).as_posix()
        if any(part in rel for part in [".git", "node_modules", ".venv", "__pycache__", "build", "dist"]):
            continue
        errs = validate_file_casing(rel)
        casing_errors.extend(errs)

    return taxonomy_errors, casing_errors

def main() -> int:
    parser = argparse.ArgumentParser(description="Audit directory taxonomy and file casing.")
    parser.add_argument("--root", type=pathlib.Path, default=pathlib.Path.cwd(), help="Repository root")
    args = parser.parse_args()

    root = args.root.resolve()
    tax_errs, casing_errs = check_repository_hygiene(root)
    all_errs = tax_errs + casing_errs

    if all_errs:
        print(f"=== Taxonomy & Casing Audit Failed for {root} ===", file=sys.stderr)
        for err in all_errs:
            print(f"  [ERROR] {err}", file=sys.stderr)
        return 1

    print(f"[PASS] Taxonomy and file casing audit clean for {root}.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Register console script in `pyproject.toml`**

Update `packages/bedrock-api/pyproject.toml` under `[project.scripts]`:

```toml
[project.scripts]
bedrock-healthcheck = "bedrock.tools.healthcheck:main"
bedrock-audit-taxonomy = "bedrock.tools.audit_taxonomy_and_casing:main"
```

- [ ] **Step 5: Run tests and verify they pass**

Run: `pytest packages/bedrock-api/tests/test_audit_taxonomy_and_casing.py -v`
Expected: PASS (all tests green)

- [ ] **Step 6: Commit**

```bash
git add packages/bedrock-api/bedrock/tools/audit_taxonomy_and_casing.py packages/bedrock-api/tests/test_audit_taxonomy_and_casing.py packages/bedrock-api/pyproject.toml
git commit -m "feat(tools): add canonical audit_taxonomy_and_casing validator"
```

---

### Task 2: Bedrock Automated Remediation Engine (`bedrock.tools.remediate_taxonomy_and_casing`)

**Files:**

- Create: `packages/bedrock-api/bedrock/tools/remediate_taxonomy_and_casing.py`
- Test: `packages/bedrock-api/tests/test_remediate_taxonomy_and_casing.py`

**Interfaces:**

- Consumes: `git` CLI via subprocess, regex link rewriter, `audit_taxonomy_and_casing`.
- Produces: CLI execution module performing NTFS two-stage git renames and link rewrites.

- [ ] **Step 1: Write the failing unit tests for remediation tool**

Create `packages/bedrock-api/tests/test_remediate_taxonomy_and_casing.py`:

```python
import pytest
from pathlib import Path
from bedrock.tools.remediate_taxonomy_and_casing import (
    compute_kebab_name,
    rewrite_markdown_links,
    plan_two_stage_renames,
)

def test_compute_kebab_name():
    assert compute_kebab_name("S01_No_Duplicate_UI_Code.md") == "s01-no-duplicate-ui-code.md"
    assert compute_kebab_name("RynoGuy.com Premium eBay Template.html") == "rynoguy-premium-ebay-template.html"
    assert compute_kebab_name("BlackDiamondCards_eBay_Template.html") == "blackdiamondcards-ebay-template.html"
    assert compute_kebab_name("README.md") == "README.md"

def test_rewrite_markdown_links():
    content = "See [S01](docs/standards/S01_No_Duplicate_UI_Code.md) and §S08 in [S08](S08_Documentation_Layout_And_Naming.md)."
    mapping = {
        "docs/standards/S01_No_Duplicate_UI_Code.md": "docs/standards/s01-no-duplicate-ui-code.md",
        "S08_Documentation_Layout_And_Naming.md": "s08-documentation-layout-and-naming.md",
    }
    updated = rewrite_markdown_links(content, mapping)
    assert "docs/standards/s01-no-duplicate-ui-code.md" in updated
    assert "s08-documentation-layout-and-naming.md" in updated

def test_plan_two_stage_renames(tmp_path: Path):
    source = tmp_path / "Templates"
    source.mkdir()
    target = tmp_path / "templates"

    plan = plan_two_stage_renames(source, target)
    assert plan == [
        (source, tmp_path / "templates__tmp"),
        (tmp_path / "templates__tmp", target),
    ]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest packages/bedrock-api/tests/test_remediate_taxonomy_and_casing.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'bedrock.tools.remediate_taxonomy_and_casing'`

- [ ] **Step 3: Implement `remediate_taxonomy_and_casing.py`**

Create `packages/bedrock-api/bedrock/tools/remediate_taxonomy_and_casing.py`:

```python
"""Module: bedrock/tools/remediate_taxonomy_and_casing.py
Layer: bedrock/tools
Desc: Automated, idempotent refactor engine for cross-repo taxonomy, two-stage NTFS renames,
      and inbound link rewriting.
"""
from __future__ import annotations

import argparse
import os
import pathlib
import re
import subprocess
import sys

UNIVERSAL_EXCEPTIONS = {"README.md", "CLAUDE.md", "GEMINI.md"}

def compute_kebab_name(original: str) -> str:
    if original in UNIVERSAL_EXCEPTIONS:
        return original
    base, ext = os.path.splitext(original)

    # Handle Standard prefix: S01_Name -> s01-name
    m = re.match(r"^S(\d+)[_-](.*)$", base, re.IGNORECASE)
    if m:
        num, rest = m.groups()
        slug = re.sub(r"[_\s]+", "-", rest.strip()).lower()
        slug = re.sub(r"[^a-z0-9-]", "", slug)
        return f"s{int(num):02d}-{slug}{ext.lower()}"

    slug = base.replace(".com", "")
    slug = re.sub(r"([a-z0-9])([A-Z])", r"\1-\2", slug)
    slug = re.sub(r"[_\s.]+", "-", slug).lower()
    slug = re.sub(r"-+", "-", slug).strip("-")
    slug = re.sub(r"[^a-z0-9-]", "", slug)
    return f"{slug}{ext.lower()}"

def plan_two_stage_renames(source: pathlib.Path, target: pathlib.Path) -> list[tuple[pathlib.Path, pathlib.Path]]:
    if source.name.lower() == target.name.lower():
        tmp = source.parent / f"{target.name}__tmp"
        return [(source, tmp), (tmp, target)]
    return [(source, target)]

def rewrite_markdown_links(content: str, mapping: dict[str, str]) -> str:
    updated = content
    for old_ref, new_ref in mapping.items():
        updated = updated.replace(old_ref, new_ref)
    return updated

def execute_git_mv(src: pathlib.Path, dst: pathlib.Path, repo_root: pathlib.Path) -> None:
    subprocess.run(["git", "mv", str(src), str(dst)], cwd=str(repo_root), check=True)

def remediate_repo(repo_root: pathlib.Path, dry_run: bool = False) -> None:
    print(f"=== Planning Remediation for {repo_root} ===")
    rename_map: dict[str, str] = {}

    # 1. Discover Standards to rename
    standards_dir = repo_root / "docs" / "standards"
    if standards_dir.exists():
        for file in standards_dir.glob("*.md"):
            if file.name in UNIVERSAL_EXCEPTIONS:
                continue
            new_name = compute_kebab_name(file.name)
            if file.name != new_name:
                rename_map[file.as_posix()] = (file.parent / new_name).as_posix()
                rename_map[file.name] = new_name

    # 2. Discover Templates to rename
    templates_dir = repo_root / "Templates"
    if templates_dir.exists():
        new_templates = repo_root / "templates"
        rename_map[templates_dir.as_posix()] = new_templates.as_posix()
        for file in templates_dir.glob("*.html"):
            new_name = compute_kebab_name(file.name)
            rename_map[file.name] = new_name

    print(f"Found {len(rename_map)} items to remediate/rewrite.")
    if dry_run:
        for k, v in rename_map.items():
            print(f"  [PLAN] {k} -> {v}")
        return

    # Execute link rewrites in markdown files
    for md in repo_root.rglob("*.md"):
        if any(ign in md.parts for ign in [".git", "node_modules", ".venv"]):
            continue
        text = md.read_text(encoding="utf-8", errors="replace")
        new_text = rewrite_markdown_links(text, rename_map)
        if new_text != text:
            md.write_text(new_text, encoding="utf-8")
            print(f"  [REWRITTEN] {md.relative_to(repo_root)}")

    # Execute two-stage renames for standards
    if standards_dir.exists():
        for file in standards_dir.glob("*.md"):
            if file.name in UNIVERSAL_EXCEPTIONS:
                continue
            new_name = compute_kebab_name(file.name)
            if file.name != new_name:
                target = file.parent / new_name
                stages = plan_two_stage_renames(file, target)
                for s_src, s_dst in stages:
                    execute_git_mv(s_src, s_dst, repo_root)
                print(f"  [RENAMED] {file.name} -> {new_name}")

    # Execute directory rename for Templates -> templates
    if templates_dir.exists():
        stages = plan_two_stage_renames(templates_dir, repo_root / "templates")
        for s_src, s_dst in stages:
            execute_git_mv(s_src, s_dst, repo_root)
        print("  [RENAMED] Templates -> templates")

        # Rename template html files inside target
        new_templates = repo_root / "templates"
        for file in new_templates.glob("*.html"):
            kebab = compute_kebab_name(file.name)
            if file.name != kebab:
                stages = plan_two_stage_renames(file, file.parent / kebab)
                for s_src, s_dst in stages:
                    execute_git_mv(s_src, s_dst, repo_root)
                print(f"  [RENAMED] {file.name} -> {kebab}")

def main() -> int:
    parser = argparse.ArgumentParser(description="Remediate taxonomy and file casing.")
    parser.add_argument("--root", type=pathlib.Path, default=pathlib.Path.cwd(), help="Repo root")
    parser.add_argument("--dry-run", action="store_true", help="Print plan without mutations")
    args = parser.parse_args()

    remediate_repo(args.root.resolve(), dry_run=args.dry_run)
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `pytest packages/bedrock-api/tests/test_remediate_taxonomy_and_casing.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/bedrock-api/bedrock/tools/remediate_taxonomy_and_casing.py packages/bedrock-api/tests/test_remediate_taxonomy_and_casing.py
git commit -m "feat(tools): add canonical remediate_taxonomy_and_casing engine"
```

---

### Task 3: Bedrock Internal Remediation, Docs Relocation, & Release Tag

**Files:**

- Move: `bedrock/docs/*.md` -> `bedrock/docs/reference/`
- Relocate: `bedrock/docs/superpowers/specs/*` -> `bedrock/docs/specs/`
- Relocate: `bedrock/docs/superpowers/plans/*` -> `bedrock/docs/plans/`
- Evict: `bedrock/docs/punchlists/` -> `bedrock/scratch/`
- Modify: `bedrock/docs/reference/README.md`
- Modify: `bedrock/docs/specs/README.md`
- Modify: `bedrock/docs/plans/README.md`

**Interfaces:**

- Consumes: `git mv`, `bedrock.tools.audit_taxonomy_and_casing`.
- Produces: 100% compliant `bedrock` repository on the canonical 6-folder model.

- [ ] **Step 1: Relocate root markdown docs into `docs/reference/`**

```bash
git mv docs/app_assembly.md docs/reference/app_assembly.md
git mv docs/deployment.md docs/reference/deployment.md
git mv docs/extension_points.md docs/reference/extension_points.md
git mv docs/mail.md docs/reference/mail.md
git mv docs/media.md docs/reference/media.md
git mv docs/object_storage.md docs/reference/object_storage.md
git mv docs/pagination.md docs/reference/pagination.md
git mv docs/platform_guide.md docs/reference/platform_guide.md
git mv docs/roadmap.md docs/reference/roadmap.md
git mv docs/seo.md docs/reference/seo.md
```

- [ ] **Step 2: Relocate superpower specs & plans**

```bash
git mv docs/superpowers/specs/* docs/specs/ 2>$null || true
git mv docs/superpowers/plans/* docs/plans/ 2>$null || true
```

- [ ] **Step 3: Evict punchlists to untracked `scratch/`**

```powershell
mkdir scratch 2>$null
git rm -r --cached docs/punchlists
Move-Item -Path docs/punchlists/* -Destination scratch/ -Force
Remove-Item -Path docs/punchlists -Recurse -Force
```

- [ ] **Step 4: Update `docs/reference/README.md`, `docs/specs/README.md`, and `docs/plans/README.md`**

Ensure every folder has an accurate `README.md` indexing all files in that directory.

- [ ] **Step 5: Run the taxonomy audit**

Run: `python -m bedrock.tools.audit_taxonomy_and_casing --root .`
Expected: PASS (Exit code 0)

- [ ] **Step 6: Verify clean tree & commit**

```bash
git status --porcelain
git add -A
git commit -m "refactor(docs): consolidate bedrock docs into 6-folder taxonomy and evict punchlists"
```

---

### Task 4: Workstation & Claude-Kit Shared Doctrine Synchronization

**Files:**

- Modify: `C:\Dev\TheLab\WorkstationTools\SuperpowersUpdates\update-superpowers-paths.ps1`
- Modify: `C:\Dev\claude-kit\plugins\dev-doctrine\skills\bump-bedrock-pin\SKILL.md`
- Inspect: Junctions under `.agents/skills` and `.claude/skills` across all repos.

**Interfaces:**

- Consumes: PowerShell automation script, Claude plugin definitions.
- Produces: Updated superpowers skill files pointing directly to `docs/specs` and `docs/plans`.

- [ ] **Step 1: Update `update-superpowers-paths.ps1` defaults**

In `C:\Dev\TheLab\WorkstationTools\SuperpowersUpdates\update-superpowers-paths.ps1`, verify and set default parameters:

```powershell
    [string]$CustomSpecPath = "docs/specs",
    [string]$CustomPlanPath = "docs/plans",
```

- [ ] **Step 2: Run `update-superpowers-paths.ps1`**

Execute:

```powershell
pwsh -File "C:\Dev\TheLab\WorkstationTools\SuperpowersUpdates\update-superpowers-paths.ps1"
```

Expected: All target skills (`brainstorming`, `writing-plans`, etc.) patched to emit into `docs/specs` and `docs/plans`.

- [ ] **Step 3: Verify `@quality-gatekeeper` across `.claude/agents/` and `.agents/agents/`**

Ensure `.agents/agents/` junctions or mirrors `.claude/agents/` in each repository and enforces the taxonomy audit:

```markdown
# Directives

1. Zero-Tolerance Defect Contract (§S05): Zero broken tests ship to master.
2. Script Exit Codes: Always inspect script exit code directly (`echo "exit=$?"`).
3. Lockstep Dependency Pins: Confirm requirements.txt and package.json point to exact same tag.
4. Clean Working Tree: Ensure git status --porcelain is 100% clean.
5. Taxonomy & Casing: Run `python -m bedrock.tools.audit_taxonomy_and_casing` and verify exit code 0.
```

- [ ] **Step 4: Commit in claude-kit**

```bash
git add -A
git commit -m "feat(doctrine): align superpowers paths and quality-gatekeeper taxonomy contracts"
```

---

### Task 5: CollectIt Consumer Pin Bump & Full Remediation

**Files:**

- Modify: `CollectIt/requirements.txt` (bump `bedrock-api`)
- Modify: `CollectIt/frontend/package.json` (bump `@djntechnic/bedrock-ui`)
- Rename: `CollectIt/Templates/` -> `CollectIt/templates/`
- Relocate: `CollectIt/docs/ebay_templates_csv/` -> `CollectIt/templates/ebay-import-csv/`
- Rename: `CollectIt/docs/standards/S01_...` -> `CollectIt/docs/standards/s01-...`
- Evict: `CollectIt/docs/punchlists/`, `CollectIt/docs/archive/`, `CollectIt/docs/design/` -> `CollectIt/scratch/`
- Create: `CollectIt/scripts/maintenance/audit_taxonomy_and_casing.py`

**Interfaces:**

- Consumes: `python -m bedrock.tools.remediate_taxonomy_and_casing`, `audit_guidance.py`.
- Produces: Clean, kebab-compliant CollectIt repository passing all pre-PR gates.

- [ ] **Step 1: Bump bedrock pin in CollectIt**

Update `requirements.txt` and `package.json`, then regenerate lockfile:

```bash
cd frontend && npm install --package-lock-only --ignore-scripts
```

- [ ] **Step 2: Execute automated remediation in CollectIt**

Run:

```bash
python -m bedrock.tools.remediate_taxonomy_and_casing --root .
```

- [ ] **Step 3: Relocate ebay template CSVs**

```powershell
mkdir templates/ebay-import-csv 2>$null
git mv docs/ebay_templates_csv/* templates/ebay-import-csv/
Remove-Item docs/ebay_templates_csv -Force -ErrorAction SilentlyContinue
```

- [ ] **Step 4: Evict punchlists and archive to `scratch/`**

```powershell
mkdir scratch 2>$null
git rm -r --cached docs/punchlists docs/archive docs/design 2>$null
Move-Item docs/punchlists/* scratch/ -Force -ErrorAction SilentlyContinue
Move-Item docs/archive/* scratch/ -Force -ErrorAction SilentlyContinue
Move-Item docs/design/* scratch/ -Force -ErrorAction SilentlyContinue
Remove-Item docs/punchlists, docs/archive, docs/design -Recurse -Force -ErrorAction SilentlyContinue
```

- [ ] **Step 5: Add CollectIt maintenance delegation wrapper**

Create `scripts/maintenance/audit_taxonomy_and_casing.py`:

```python
#!/usr/bin/env python3
import sys
from bedrock.tools.audit_taxonomy_and_casing import main
if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 6: Run CollectIt audit gates**

```bash
python scripts/maintenance/audit_taxonomy_and_casing.py
python scripts/maintenance/audit_guidance.py
python scripts/maintenance/audit_ebay_compliance.py
pytest -m "not integration"
```

Expected: All audits pass with exit code 0.

- [ ] **Step 7: Verify clean tree & commit**

```bash
git status --porcelain
git add -A
git commit -m "refactor(taxonomy): normalize CollectIt templates, standards kebab-case, and evict punchlists"
```

---

### Task 6: MLBTracker Consumer Pin Bump & Full Remediation

**Files:**

- Modify: `MLBTracker/requirements.txt`
- Modify: `MLBTracker/frontend/package.json`
- Rename: `MLBTracker/docs/standards/S01_...` -> `MLBTracker/docs/standards/s01-...`
- Evict: `MLBTracker/docs/reference/punchlists/` -> `MLBTracker/scratch/`
- Modify: `MLBTracker/api/tests/test_repo_hygiene.py`
- Create: `MLBTracker/scripts/maintenance/audit_taxonomy_and_casing.py`

**Interfaces:**

- Consumes: `python -m bedrock.tools.remediate_taxonomy_and_casing`, `pytest`.
- Produces: Clean MLBTracker repo with updated repo hygiene tests.

- [ ] **Step 1: Bump bedrock pin in MLBTracker**

Update `requirements.txt` and `package.json`, then regenerate lockfile:

```bash
cd frontend && npm install --package-lock-only --ignore-scripts
```

- [ ] **Step 2: Execute automated remediation in MLBTracker**

Run:

```bash
python -m bedrock.tools.remediate_taxonomy_and_casing --root .
```

- [ ] **Step 3: Evict `docs/reference/punchlists` to `scratch/`**

```powershell
mkdir scratch 2>$null
git rm -r --cached docs/reference/punchlists 2>$null
Move-Item docs/reference/punchlists/* scratch/ -Force -ErrorAction SilentlyContinue
Remove-Item docs/reference/punchlists -Recurse -Force -ErrorAction SilentlyContinue
```

- [ ] **Step 4: Update `test_repo_hygiene.py`**

Update `MLBTracker/api/tests/test_repo_hygiene.py` to assert that all standards follow `s\d{2}-[a-z0-9-]+\.md` and no punchlists remain in `docs/`:

```python
def test_standards_are_kebab_cased():
    standards_dir = Path("docs/standards")
    for file in standards_dir.glob("*.md"):
        if file.name in ["README.md", "CLAUDE.md", "GEMINI.md"]:
            continue
        assert re.match(r"^s\d{2}-[a-z0-9-]+\.md$", file.name), f"{file.name} is not kebab-cased"
```

- [ ] **Step 5: Add MLBTracker maintenance delegation wrapper**

Create `scripts/maintenance/audit_taxonomy_and_casing.py`:

```python
#!/usr/bin/env python3
import sys
from bedrock.tools.audit_taxonomy_and_casing import main
if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 6: Run MLBTracker audit gates**

```bash
python scripts/maintenance/audit_taxonomy_and_casing.py
python scripts/maintenance/audit_guidance.py
pytest -m "not integration"
```

Expected: All audits pass with exit code 0.

- [ ] **Step 7: Verify clean tree & commit**

```bash
git status --porcelain
git add -A
git commit -m "refactor(taxonomy): normalize MLBTracker standards kebab-case and evict punchlists"
```

---

### Task 7: CI Enshrinement & Cross-Repo Ecosystem Verification

**Files:**

- Modify: `bedrock/.github/workflows/ci.yml`
- Modify: `CollectIt/.github/workflows/ci.yml`
- Modify: `MLBTracker/.github/workflows/ci.yml`

**Interfaces:**

- Consumes: GitHub Actions CI pipelines.
- Produces: Permanent, blocking CI quality gate enforcing taxonomy and casing.

- [ ] **Step 1: Add audit step to GitHub Actions workflows**

In `.github/workflows/ci.yml` across all 3 repos, add the blocking check:

```yaml
- name: Audit Directory Taxonomy & Casing
  run: python scripts/maintenance/audit_taxonomy_and_casing.py
```

_(In `bedrock`, run `python -m bedrock.tools.audit_taxonomy_and_casing`)._

- [ ] **Step 2: Run full cross-repo audit sweep**

Execute across `bedrock`, `CollectIt`, and `MLBTracker`:

```bash
python -m bedrock.tools.audit_taxonomy_and_casing --root C:\Dev\bedrock
python -m bedrock.tools.audit_taxonomy_and_casing --root C:\Dev\CollectIt
python -m bedrock.tools.audit_taxonomy_and_casing --root C:\Dev\MLBTracker
```

Expected: All 3 invocations return `[PASS] Taxonomy and file casing audit clean`.

- [ ] **Step 3: Final clean working tree verification**

Verify local status in each repository:

```bash
git status --porcelain
```

Expected: 100% empty output across all repos.
