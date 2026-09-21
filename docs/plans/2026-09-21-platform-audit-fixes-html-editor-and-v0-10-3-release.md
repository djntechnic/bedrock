# Platform Audit Fixes, HTML Code Editor Subsystem, and v0.10.3 Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `triage-plan` (which invokes `superpowers:subagent-driven-development`) to dispatch each task to its specialized agent in `.claude/agents/`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve four platform audit defects (#87, #88, #89, #90), incorporate a reusable CodeMirror 6 HTML syntax/formatting/linting editor subsystem into `@djntechnic/bedrock-ui`, cut unified release `v0.10.3`, and bump dual-pins in lockstep across `MLBTracker` and `CollectIt` with deep integration into CollectIt's `OutputPane.tsx`.

**Architecture:** Structured in four progressive stages: (1) Core Platform & Audit Tool Remediation in `packages/bedrock-api`, (2) Reusable `<HtmlCodeEditor>` Subsystem in `packages/bedrock-ui`, (3) Coordinated Platform Release `v0.10.3` via `cut-release`, and (4) Downstream Pin Bumps & CollectIt Integration via `bump-bedrock-pin`.

**Tech Stack:** Python 3.11, FastAPI, Pydantic v2, TypeScript 5, React 18, CodeMirror 6 (`@uiw/react-codemirror`, `@codemirror/lang-html`, `@codemirror/lint`), `htmlhint`, `js-beautify`, Vitest, Pytest, PowerShell 7 (`pwsh`), Git, GitHub CLI (`gh`).

**Spec:** [`docs/specs/2026-09-21-platform-audit-fixes-html-editor-and-v0-10-3-release-design.md`](file:///c:/Dev/bedrock/docs/specs/2026-09-21-platform-audit-fixes-html-editor-and-v0-10-3-release-design.md)

---

## Global Constraints & Standards

- **§S001 (Zero UI Duplication):** Reusable components belong strictly in `@djntechnic/bedrock-ui`.
- **§S003 (Structured Logging):** Pino (frontend) and Loguru (backend) only. Raw `console.*` and `print()` are strictly banned.
- **§S005 (Mandatory Test Coverage):** Zero broken tests tolerated. Hermetic test execution only.
- **§S006 (Defect Isolation):** Unrelated bugs encountered during execution must be logged to out-of-scope backlog; never fix inline without plan authorization.
- **§S008 (Kebab-Case Naming):** All documents, plans, and files adhere to kebab-case naming standards.
- **§S009 (Design System Tokens):** Semantic CSS tokens only. Raw hex codes and arbitrary Tailwind shades are prohibited.
- **§S012 (Dual-Pin Platform Governance):** Coordinated version agreement across `requirements.txt` and `package.json` to tag `v0.10.3`.
- **Execution Invariant:** Always evaluate shell exit codes directly (`$LASTEXITCODE` / `echo "exit=$LASTEXITCODE"`). Never mask status via pipes. Scratch exploration must reside strictly in `scratch/`.
- **Python Interpreter:** Execute tests and scripts with `.venv/Scripts/python` or active virtual environment.

---

## Domain Specialist Delegation Matrix

| Task       | Domain / Subsystem                                     | Assigned Specialist Agent                |
| :--------- | :----------------------------------------------------- | :--------------------------------------- |
| **Task 1** | Platform Tools Config Sanitization (#87)               | `.claude/agents/backend-api-engineer.md` |
| **Task 2** | Audit Runner Script Dispatch Isolation (#88)           | `.claude/agents/backend-api-engineer.md` |
| **Task 3** | Consumer Path Fallback Resolution (#89)                | `.claude/agents/backend-api-engineer.md` |
| **Task 4** | Design Token Data Directory Exclusions (#90)           | `.claude/agents/backend-api-engineer.md` |
| **Task 5** | Reusable `<HtmlCodeEditor>` Subsystem                  | `.claude/agents/frontend-ui-engineer.md` |
| **Task 6** | Platform Release `v0.10.3` Execution                   | `.claude/agents/quality-gatekeeper.md`   |
| **Task 7** | MLBTracker Dual-Pin Bump                               | `.claude/agents/quality-gatekeeper.md`   |
| **Task 8** | CollectIt Dual-Pin Bump & `OutputPane.tsx` Integration | `.claude/agents/frontend-ui-engineer.md` |

---

## Tasks

### Task 1: Fix `_config.py` Unhandled TypeError on Unexpected Keys (#87)

**Specialist Agent:** `.claude/agents/backend-api-engineer.md`

**Files:**

- Modify: `packages/bedrock-api/bedrock/tools/_config.py:200-215`
- Test: `packages/bedrock-api/tests/test_audit_s005_to_s008.py`

**Interfaces:**

- Consumes: `load_bedrock_config(root: Path) -> BedrockConfig`
- Produces: Sanitized `@dataclass` instantiation in `_build_section()` filtering unmapped keyword arguments.

- [x] **Step 1: Write the failing regression test**

In `packages/bedrock-api/tests/test_audit_s005_to_s008.py`, add a test that loads a TOML configuration containing unknown/deprecated keys:

```python
def test_load_bedrock_config_ignores_unexpected_keys(tmp_path: Path):
    from bedrock.tools._config import load_bedrock_config

    toml_content = """
    [tool.bedrock]
    [tool.bedrock.audit.s005]
    exemptions = ["tests/legacy/**"]
    skip_exemptions = true
    legacy_numeric_setting = 42
    """
    (tmp_path / "bedrock.toml").write_text(toml_content, encoding="utf-8")
    config = load_bedrock_config(tmp_path)
    assert config.audit_s005.exemptions is not None
    assert "tests/legacy/**" in config.audit_s005.exemptions
```

- [x] **Step 2: Run test to verify it fails**

Run:

```powershell
python -m pytest packages/bedrock-api/tests/test_audit_s005_to_s008.py -k "test_load_bedrock_config_ignores_unexpected_keys" -v
echo "exit=$LASTEXITCODE"
```

Expected: FAIL with `TypeError: AuditS005Config.__init__() got an unexpected keyword argument 'skip_exemptions'`.

- [x] **Step 3: Implement kwargs filtering in `_config.py`**

In `packages/bedrock-api/bedrock/tools/_config.py`, update `_build_section`:

```python
import dataclasses
from loguru import logger

def _build_section(section_cls: type[T], raw_section: dict[str, Any] | None) -> T:
    if raw_section is None:
        return section_cls()
    kwargs = dict(raw_section)
    if "exemptions" in kwargs and isinstance(kwargs["exemptions"], list):
        kwargs["exemptions"] = _merge_exemptions(list(kwargs["exemptions"]))

    valid_fields = {f.name for f in dataclasses.fields(section_cls)}
    filtered_kwargs = {}
    for key, value in kwargs.items():
        if key in valid_fields:
            filtered_kwargs[key] = value
        else:
            logger.warning(
                f"Ignoring unrecognized key '{key}' in audit section for {section_cls.__name__}"
            )
    return section_cls(**filtered_kwargs)
```

- [x] **Step 4: Run test to verify it passes**

Run:

```powershell
python -m pytest packages/bedrock-api/tests/test_audit_s005_to_s008.py -k "test_load_bedrock_config_ignores_unexpected_keys" -v
echo "exit=$LASTEXITCODE"
```

Expected: PASS with exit code `0`.

- [x] **Step 5: Commit**

```bash
git add packages/bedrock-api/bedrock/tools/_config.py packages/bedrock-api/tests/test_audit_s005_to_s008.py
git commit -m "fix(tools): sanitize dataclass kwargs in _build_section against unknown keys (#87)"
```

---

### Task 2: Fix `run_audit.ps1` Dispatch Switch Isolation (#88)

**Specialist Agent:** `.claude/agents/backend-api-engineer.md`

**Files:**

- Modify: `packages/bedrock-api/bedrock/templates/scripts/run_audit.ps1`
- Modify: `docs/specs/2026-09-12-ecosystem-standards-and-tooling-architecture.md:590-630`
- Test: `packages/bedrock-api/tests/test_audit_runner_dispatch.py`

**Interfaces:**

- Consumes: PowerShell switches `[switch]$All`, `[switch]$Platform`, `[switch]$Domain`
- Produces: Strict mutual isolation so `-Domain` exclusively executes `scripts/audits/audit_s1*.py`.

- [x] **Step 1: Write unit test validating dispatch isolation**

Create `packages/bedrock-api/tests/test_audit_runner_dispatch.py`:

```python
import subprocess
from pathlib import Path

def test_run_audit_template_dispatch_domain_isolation():
    template_path = Path("packages/bedrock-api/bedrock/templates/scripts/run_audit.ps1")
    assert template_path.exists(), "Template script must exist"
    content = template_path.read_text(encoding="utf-8")
    # Verify that -Domain does not evaluate platform tools
    assert 'if ($Platform)' in content
    assert 'if ($Domain)' in content
    assert '$All = $true' in content
```

- [x] **Step 2: Run test to verify initial state**

Run:

```powershell
python -m pytest packages/bedrock-api/tests/test_audit_runner_dispatch.py -v
echo "exit=$LASTEXITCODE"
```

- [x] **Step 3: Update `run_audit.ps1` template and spec documentation**

In `packages/bedrock-api/bedrock/templates/scripts/run_audit.ps1`:

```powershell
[CmdletBinding()]
param(
    [switch]$All,
    [switch]$Platform,
    [switch]$Domain
)

$ErrorActionPreference = "Stop"

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
    python -m bedrock.tools.run_all --root .
    if ($LASTEXITCODE -ne 0) {
        $Failed = $true
    }
}

if ($Domain) {
    Write-Host "==> Running Domain Audits..." -ForegroundColor Cyan
    $domainScripts = Get-ChildItem -Path "scripts/audits" -Filter "audit_s1*.py" -ErrorAction SilentlyContinue
    if (-not $domainScripts -or $domainScripts.Count -eq 0) {
        Write-Host "==> No domain audit scripts found under scripts/audits/. Skipping." -ForegroundColor Yellow
    } else {
        foreach ($script in $domainScripts) {
            Write-Host "--> Running $($script.Name)..." -ForegroundColor Gray
            python $script.FullName
            if ($LASTEXITCODE -ne 0) {
                $Failed = $true
            }
        }
    }
}

if ($Failed) {
    Write-Error "Audit failed."
    exit 1
}

Write-Host "==> All requested audits passed." -ForegroundColor Green
exit 0
```

Also update the embedded template in `docs/specs/2026-09-12-ecosystem-standards-and-tooling-architecture.md`.

- [x] **Step 4: Run test to verify it passes**

Run:

```powershell
python -m pytest packages/bedrock-api/tests/test_audit_runner_dispatch.py -v
echo "exit=$LASTEXITCODE"
```

Expected: PASS with exit code `0`.

- [x] **Step 5: Commit**

```bash
git add packages/bedrock-api/bedrock/templates/scripts/run_audit.ps1 packages/bedrock-api/tests/test_audit_runner_dispatch.py docs/specs/2026-09-12-ecosystem-standards-and-tooling-architecture.md
git commit -m "fix(templates): isolate -Domain switch in run_audit.ps1 dispatch (#88)"
```

---

### Task 3: Multi-Candidate Consumer Path Fallbacks for `audit_s011` and `audit_s012` (#89)

**Specialist Agent:** `.claude/agents/backend-api-engineer.md`

**Files:**

- Modify: `packages/bedrock-api/bedrock/tools/_config.py`
- Modify: `packages/bedrock-api/bedrock/tools/audit_s011_navigation.py`
- Modify: `packages/bedrock-api/bedrock/tools/audit_s012_pins.py`
- Test: `packages/bedrock-api/tests/test_audit_s009_to_s012.py`

**Interfaces:**

- Consumes: Target repository root (`--root <path>`) and parsed `BedrockConfig`
- Produces: Candidate path resolution across standard consumer directory layouts.

- [x] **Step 1: Write the failing regression test**

In `packages/bedrock-api/tests/test_audit_s009_to_s012.py`, add tests asserting candidate path resolution:

```python
def test_audit_s011_resolves_consumer_navigation_path(tmp_path: Path):
    from bedrock.tools import audit_s011_navigation
    # Mock consumer repository with standard navigation path
    nav_file = tmp_path / "frontend" / "src" / "components" / "domain" / "navigation.ts"
    nav_file.parent.mkdir(parents=True)
    nav_file.write_text("export const NAV_ITEMS = [];\n", encoding="utf-8")
    (tmp_path / "bedrock.toml").write_text("[tool.bedrock]\n[tool.bedrock.audit.s011]\nexemptions = []\n", encoding="utf-8")

    result = audit_s011_navigation.audit(tmp_path)
    assert not any("does not exist" in v for v in result.violations)

def test_audit_s012_resolves_consumer_dual_pin_paths(tmp_path: Path):
    from bedrock.tools import audit_s012_pins
    # Mock consumer repository with root requirements.txt and frontend/package.json
    req = tmp_path / "requirements.txt"
    req.write_text("bedrock-api @ git+https://github.com/djntechnic/bedrock@v0.10.2#subdirectory=packages/bedrock-api\n", encoding="utf-8")
    pkg = tmp_path / "frontend" / "package.json"
    pkg.parent.mkdir(parents=True)
    pkg.write_text('{"dependencies": {"@djntechnic/bedrock-ui": "github:djntechnic/bedrock#v0.10.2"}}\n', encoding="utf-8")
    (tmp_path / "bedrock.toml").write_text("[tool.bedrock]\n[tool.bedrock.audit.s012]\nexemptions = []\n", encoding="utf-8")

    result = audit_s012_pins.audit(tmp_path)
    assert not any("could not find a resolvable dual-pin source" in v for v in result.violations)
```

- [x] **Step 2: Run test to verify it fails**

Run:

```powershell
python -m pytest packages/bedrock-api/tests/test_audit_s009_to_s012.py -k "test_audit_s011_resolves_consumer_navigation_path or test_audit_s012_resolves_consumer_dual_pin_paths" -v
echo "exit=$LASTEXITCODE"
```

Expected: FAIL.

- [x] **Step 3: Implement candidate resolution logic**

In `packages/bedrock-api/bedrock/tools/audit_s011_navigation.py`:
Resolve navigation config by checking candidates:

1. `root / config.audit_s011.nav_config` (if exists and explicitly specified)
2. `root / "frontend" / "src" / "components" / "domain" / "navigation.ts"`
3. `root / "frontend" / "src" / "navigation.ts"`
4. `root / "packages" / "bedrock-ui" / "src" / "navigation" / "navConfig.ts"`

In `packages/bedrock-api/bedrock/tools/audit_s012_pins.py`:
Resolve `requirements` by checking:

1. `root / config.audit_s012.requirements` (if exists)
2. `root / "requirements.txt"`
3. `root / "packages" / "bedrock-api" / "requirements.txt"`

Resolve `package_json` by checking:

1. `root / config.audit_s012.package_json` (if exists)
2. `root / "frontend" / "package.json"`
3. `root / "package.json"`
4. `root / "packages" / "bedrock-ui" / "package.json"`

- [x] **Step 4: Run tests to verify they pass**

Run:

```powershell
python -m pytest packages/bedrock-api/tests/test_audit_s009_to_s012.py -k "test_audit_s011_resolves_consumer_navigation_path or test_audit_s012_resolves_consumer_dual_pin_paths" -v
echo "exit=$LASTEXITCODE"
```

Expected: PASS with exit code `0`.

- [x] **Step 5: Commit**

```bash
git add packages/bedrock-api/bedrock/tools/_config.py packages/bedrock-api/bedrock/tools/audit_s011_navigation.py packages/bedrock-api/bedrock/tools/audit_s012_pins.py packages/bedrock-api/tests/test_audit_s009_to_s012.py
git commit -m "fix(audit): support multi-candidate consumer paths in audit_s011 and audit_s012 (#89)"
```

---

### Task 4: Exclude Data and Vendor Asset Directories from Design Token Scans (#90)

**Specialist Agent:** `.claude/agents/backend-api-engineer.md`

**Files:**

- Modify: `packages/bedrock-api/bedrock/tools/_config.py:20-35`
- Modify: `packages/bedrock-api/bedrock/tools/audit_s009_design_tokens.py:70-85`
- Test: `packages/bedrock-api/tests/test_audit_s009_to_s012.py`

**Interfaces:**

- Consumes: Target repository directory scan
- Produces: Filtered source file list excluding `data/`, `imports/`, and `exports/`.

- [x] **Step 1: Write the failing regression test**

In `packages/bedrock-api/tests/test_audit_s009_to_s012.py`:

```python
def test_audit_s009_ignores_vendor_data_directories(tmp_path: Path):
    from bedrock.tools import audit_s009_design_tokens
    # Place a vendor stylesheet with raw hex inside data/vendor/
    vendor_css = tmp_path / "data" / "vendor" / "bootstrap.min.css"
    vendor_css.parent.mkdir(parents=True)
    vendor_css.write_text("body { color: #ffffff; background: #000000; }", encoding="utf-8")
    (tmp_path / "bedrock.toml").write_text("[tool.bedrock]\n[tool.bedrock.audit.s009]\nexemptions = []\n", encoding="utf-8")

    result = audit_s009_design_tokens.audit(tmp_path)
    assert not any("bootstrap.min.css" in v for v in result.violations)
```

- [x] **Step 2: Run test to verify it fails**

Run:

```powershell
python -m pytest packages/bedrock-api/tests/test_audit_s009_to_s012.py -k "test_audit_s009_ignores_vendor_data_directories" -v
echo "exit=$LASTEXITCODE"
```

Expected: FAIL with design token violation in `bootstrap.min.css`.

- [x] **Step 3: Update `DEFAULT_IGNORED_DIRS` in `_config.py` and `audit_s009_design_tokens.py`**

In `packages/bedrock-api/bedrock/tools/_config.py`:

```python
DEFAULT_IGNORED_DIRS: set[str] = {
    ".git",
    ".venv",
    "node_modules",
    "dist",
    "build",
    "data",
    "imports",
    "exports",
    "__pycache__",
    ".pytest_cache",
}
```

In `packages/bedrock-api/bedrock/tools/audit_s009_design_tokens.py`:
Ensure `_source_files(root: Path)` filters against `DEFAULT_IGNORED_DIRS` for any path part.

- [x] **Step 4: Run test to verify it passes**

Run:

```powershell
python -m pytest packages/bedrock-api/tests/test_audit_s009_to_s012.py -k "test_audit_s009_ignores_vendor_data_directories" -v
echo "exit=$LASTEXITCODE"
```

Expected: PASS with exit code `0`.

- [x] **Step 5: Run full backend audit suite to verify zero regressions**

Run:

```powershell
python -m pytest packages/bedrock-api/tests/ -v
echo "exit=$LASTEXITCODE"
```

Expected: All tests PASS with exit code `0`.

- [x] **Step 6: Commit**

```bash
git add packages/bedrock-api/bedrock/tools/_config.py packages/bedrock-api/bedrock/tools/audit_s009_design_tokens.py packages/bedrock-api/tests/test_audit_s009_to_s012.py
git commit -m "fix(audit_s009): exclude data, imports, and exports directories from design token scan (#90)"
```

---

### Task 5: Implement Reusable `<HtmlCodeEditor>` Subsystem in `@djntechnic/bedrock-ui`

**Specialist Agent:** `.claude/agents/frontend-ui-engineer.md`

**Files:**

- Modify: `package.json`
- Create: `packages/bedrock-ui/src/components/editor/HtmlCodeEditor.tsx`
- Create: `packages/bedrock-ui/src/components/editor/beautifyHtml.ts`
- Create: `packages/bedrock-ui/src/components/editor/htmlLinter.ts`
- Create: `packages/bedrock-ui/src/components/editor/editorTheme.ts`
- Modify: `packages/bedrock-ui/src/index.ts`
- Test: `packages/bedrock-ui/src/components/editor/HtmlCodeEditor.test.tsx`
- Test: `packages/bedrock-ui/src/components/editor/beautifyHtml.test.ts`

**Interfaces:**

- Consumes: Bedrock design tokens (§S009), `@uiw/react-codemirror`, `htmlhint`, `js-beautify`
- Produces: Exported `<HtmlCodeEditor>` component, `beautifyHtml()` function, and types.

- [x] **Step 1: Install frontend dependencies in `package.json`**

In `package.json`:
Add to `peerDependencies` (or `dependencies`):

- `"@uiw/react-codemirror": "^4.23.0"`
- `"@codemirror/lang-html": "^6.4.9"`
- `"@codemirror/lint": "^6.8.4"`
- `"htmlhint": "^1.1.4"`
- `"js-beautify": "^1.15.1"`
  Add to `devDependencies`:
- `"@types/js-beautify": "^1.14.3"`

Run:

```powershell
npm install --no-audit --no-fund
echo "exit=$LASTEXITCODE"
```

- [x] **Step 2: Write failing unit test for `beautifyHtml`**

Create `packages/bedrock-ui/src/components/editor/beautifyHtml.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { beautifyHtml } from "./beautifyHtml";

describe("beautifyHtml", () => {
  it("formats unindented HTML tags with 2 spaces", () => {
    const raw = "<div><p>Hello World</p></div>";
    const formatted = beautifyHtml(raw);
    expect(formatted).toBe("<div>\n  <p>Hello World</p>\n</div>\n");
  });

  it("preserves whitespace inside <pre> tags", () => {
    const raw = "<div><pre>  formatted   text  </pre></div>";
    const formatted = beautifyHtml(raw);
    expect(formatted).toContain("  formatted   text  ");
  });
});
```

- [x] **Step 3: Implement `beautifyHtml.ts`**

Create `packages/bedrock-ui/src/components/editor/beautifyHtml.ts`:

```typescript
import { html as beautify } from "js-beautify";

export function beautifyHtml(content: string): string {
  if (!content) return content;
  return beautify(content, {
    indent_size: 2,
    indent_char: " ",
    max_preserve_newlines: 1,
    preserve_newlines: true,
    wrap_line_length: 120,
    unformatted: ["pre", "code"],
    end_with_newline: true,
  });
}
```

Verify `beautifyHtml.test.ts` passes:

```powershell
npm test -- packages/bedrock-ui/src/components/editor/beautifyHtml.test.ts
echo "exit=$LASTEXITCODE"
```

- [x] **Step 4: Implement `editorTheme.ts` and `htmlLinter.ts`**

Create `packages/bedrock-ui/src/components/editor/editorTheme.ts` mapping CodeMirror classes to CSS variables:

```typescript
import { EditorView } from "@codemirror/view";
import { Extension } from "@codemirror/state";

export const bedrockEditorTheme: Extension = EditorView.theme(
  {
    "&": {
      color: "var(--color-text-primary, #0f172a)",
      backgroundColor: "var(--color-bg-subtle, #f8fafc)",
      fontSize: "0.875rem",
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    },
    ".cm-content": {
      caretColor: "var(--color-primary, #2563eb)",
    },
    ".cm-gutters": {
      backgroundColor: "var(--color-bg-muted, #f1f5f9)",
      color: "var(--color-text-muted, #64748b)",
      borderRight: "1px solid var(--color-border, #e2e8f0)",
    },
    "&.cm-focused .cm-cursor": {
      borderLeftColor: "var(--color-primary, #2563eb)",
    },
  },
  { dark: false },
);
```

Create `packages/bedrock-ui/src/components/editor/htmlLinter.ts`:

```typescript
import { linter, Diagnostic } from "@codemirror/lint";
import { HTMLHint } from "htmlhint";

export const htmlLinterExtension = linter((view) => {
  const diagnostics: Diagnostic[] = [];
  const text = view.state.doc.toString();
  if (!text) return diagnostics;

  const messages = HTMLHint.verify(text, {
    "tagname-lowercase": true,
    "attr-lowercase": false,
    "attr-value-double-quotes": false,
    "tag-pair": true,
    "spec-char-escape": false,
    "id-unique": true,
    "src-not-empty": true,
    "attr-no-duplication": true,
  });

  for (const msg of messages) {
    const line = view.state.doc.line(Math.min(msg.line, view.state.doc.lines));
    const from = Math.min(line.from + msg.col - 1, line.to);
    const to = Math.min(from + 1, line.to);

    diagnostics.push({
      from,
      to,
      severity: msg.type === "error" ? "error" : "warning",
      message: msg.message,
    });
  }
  return diagnostics;
});
```

- [x] **Step 5: Implement `HtmlCodeEditor.tsx`**

Create `packages/bedrock-ui/src/components/editor/HtmlCodeEditor.tsx`:

```typescript
import React, { useMemo } from "react";
import CodeMirror, { Extension } from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";
import { EditorView } from "@codemirror/view";
import { bedrockEditorTheme } from "./editorTheme";
import { htmlLinterExtension } from "./htmlLinter";

export interface HtmlCodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  showLineNumbers?: boolean;
  showLintDiagnostics?: boolean;
  height?: string;
  className?: string;
}

export const HtmlCodeEditor: React.FC<HtmlCodeEditorProps> = ({
  value,
  onChange,
  readOnly = true,
  showLineNumbers = true,
  showLintDiagnostics = true,
  height = "100%",
  className,
}) => {
  const extensions = useMemo<Extension[]>(() => {
    const exts: Extension[] = [html(), bedrockEditorTheme, EditorView.lineWrapping];
    if (showLintDiagnostics) {
      exts.push(htmlLinterExtension);
    }
    if (readOnly) {
      exts.push(EditorView.editable.of(false));
    }
    return exts;
  }, [readOnly, showLintDiagnostics]);

  return (
    <div className={`overflow-hidden border border-border rounded-lg ${className ?? ""}`}>
      <CodeMirror
        value={value}
        height={height}
        readOnly={readOnly}
        extensions={extensions}
        basicSetup={{
          lineNumbers: showLineNumbers,
          foldGutter: true,
          highlightActiveLine: !readOnly,
          autocompletion: !readOnly,
        }}
        onChange={onChange}
      />
    </div>
  );
};
```

- [x] **Step 6: Write component test `HtmlCodeEditor.test.tsx`**

Create `packages/bedrock-ui/src/components/editor/HtmlCodeEditor.test.tsx`:

```typescript
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { HtmlCodeEditor } from "./HtmlCodeEditor";

describe("HtmlCodeEditor", () => {
  it("renders editor with given HTML content", () => {
    const { container } = render(
      <HtmlCodeEditor value="<div>Hello Testing</div>" readOnly={true} />
    );
    expect(container.textContent).toContain("Hello Testing");
  });
});
```

- [x] **Step 7: Export from `packages/bedrock-ui/src/index.ts`**

Export `HtmlCodeEditor`, `type HtmlCodeEditorProps`, `beautifyHtml`, and `htmlLinterExtension`.

- [x] **Step 8: Build and typecheck package**

Run:

```powershell
npm run build
npm run build:types
npm run typecheck
npm test
echo "exit=$LASTEXITCODE"
```

Expected: PASS with exit code `0`.

- [x] **Step 9: Commit**

```bash
git add package.json packages/bedrock-ui/src/components/editor/ packages/bedrock-ui/src/index.ts packages/bedrock-ui/dist/
git commit -m "feat(ui): add reusable HtmlCodeEditor subsystem with formatting and linting"
```

---

### Task 6: Cut Release `v0.10.3` (`/cut-release`)

**Specialist Agent:** `.claude/agents/quality-gatekeeper.md`

**Files:**

- Modify: `package.json` (`"version": "0.10.3"`)
- Modify: `packages/bedrock-api/pyproject.toml` (`version = "0.10.3"`)
- Modify: `CHANGELOG.md`

**Interfaces:**

- Consumes: Passing test suites and verified dist builds
- Produces: Tag `v0.10.3` pushed to remote, published GitHub release notes.

- [x] **Step 1: Bump version numbers in both manifests**

Update `package.json`: `"version": "0.10.3"`.
Update `packages/bedrock-api/pyproject.toml`: `version = "0.10.3"`.

- [x] **Step 2: Add `CHANGELOG.md` entry for `## v0.10.3`**

Document:

- Bug fixes: #87 (TOML kwargs sanitization), #88 (run_audit.ps1 dispatch), #89 (multi-candidate consumer path fallbacks), #90 (data/vendor exclusions in design token audit).
- Feature: Reusable `<HtmlCodeEditor>` component, formatting via `beautifyHtml`, and HTMLHint diagnostics in `@djntechnic/bedrock-ui`.

- [x] **Step 3: Run pre-release validation gates**

```powershell
# Frontend
npm test
npm run typecheck

# Backend
python -m pytest packages/bedrock-api/tests/

# Version Audit
python -m bedrock.tools.audit_release_version v0.10.3
echo "exit=$LASTEXITCODE"
```

Expected: All gates exit with code `0`.

- [x] **Step 4: Commit and tag `v0.10.3`**

```bash
git add package.json packages/bedrock-api/pyproject.toml CHANGELOG.md
git commit -m "release: v0.10.3 - Platform audit hardening and HtmlCodeEditor component"
$commitSha = git rev-parse HEAD
git tag -a v0.10.3 $commitSha -m "v0.10.3 - Platform audit hardening and HtmlCodeEditor component"
git push origin master
git push origin v0.10.3
```

- [x] **Step 5: Publish GitHub Release**

```bash
python -c '
from pathlib import Path
content = Path("CHANGELOG.md").read_text(encoding="utf-8")
parts = content.split("## v")
notes = parts[1] if len(parts) > 1 else ""
Path("build/release-notes.md").parent.mkdir(exist_ok=True)
Path("build/release-notes.md").write_text("## v" + notes.split("\n## ")[0], encoding="utf-8")
'
gh release create v0.10.3 --title "v0.10.3 - Platform audit hardening and HtmlCodeEditor" --notes-file build/release-notes.md
```

- [x] **Step 6: Prove tag is visible remotely**

```powershell
git ls-remote --tags https://github.com/djntechnic/bedrock | Select-String "v0.10.3"
```

Expected: Remote returns `refs/tags/v0.10.3`.

---

### Task 7: MLBTracker Dual-Pin Bump to `v0.10.3`

**Specialist Agent:** `.claude/agents/quality-gatekeeper.md`

**Files in `c:\Dev\MLBTracker`:**

- Modify: `requirements.txt`
- Modify: `frontend/package.json`

**Interfaces:**

- Consumes: Tag `v0.10.3` from `djntechnic/bedrock`
- Produces: Updated lockfile and verified audit suites in `MLBTracker`.

- [ ] **Step 1: Check remote tag existence from `MLBTracker`**

```powershell
cd C:\Dev\MLBTracker
git ls-remote --tags https://github.com/djntechnic/bedrock | Select-String "v0.10.3"
```

- [ ] **Step 2: Update dual pins in `requirements.txt` and `frontend/package.json`**

In `C:\Dev\MLBTracker\requirements.txt`:

```
bedrock-api @ git+https://github.com/djntechnic/bedrock@v0.10.3#subdirectory=packages/bedrock-api
```

In `C:\Dev\MLBTracker\frontend\package.json`:

```json
"@djntechnic/bedrock-ui": "github:djntechnic/bedrock#v0.10.3"
```

- [ ] **Step 3: Regenerate lockfile and verify installation**

```powershell
cd C:\Dev\MLBTracker\frontend
npm install --package-lock-only --ignore-scripts
rm -r -fo node_modules/@djntechnic
npm install --ignore-scripts
Get-Content node_modules/@djntechnic/bedrock-ui/package.json | Select-String '"version"'
```

Expected: Displays `"version": "0.10.3"`.

- [ ] **Step 4: Run MLBTracker verification suite**

```powershell
cd C:\Dev\MLBTracker
python scripts/maintenance/audit_bedrock_pins.py
pwsh scripts/run_audit.ps1
pytest
npm test
echo "exit=$LASTEXITCODE"
```

Expected: All tests and audits pass cleanly with exit code `0`.

- [ ] **Step 5: Commit changes in MLBTracker**

```bash
cd C:\Dev\MLBTracker
git add requirements.txt frontend/package.json frontend/package-lock.json
git commit -m "chore: bump bedrock dual-pins to v0.10.3"
```

---

### Task 8: CollectIt Dual-Pin Bump & `OutputPane.tsx` Integration

**Specialist Agent:** `.claude/agents/frontend-ui-engineer.md`

**Files in `c:\Dev\CollectIt`:**

- Modify: `requirements.txt`
- Modify: `frontend/package.json`
- Modify: `frontend/src/components/listing-studio/OutputPane.tsx`
- Modify: `frontend/src/components/listing-studio/OutputPane.test.tsx`

**Interfaces:**

- Consumes: `<HtmlCodeEditor>` and `beautifyHtml` exported from `@djntechnic/bedrock-ui` `v0.10.3`
- Produces: Integrated CodeMirror editor in `OutputPane.tsx` with manual edit toggle, formatting, linting, and byte-identical export.

- [ ] **Step 1: Update dual pins in `requirements.txt` and `frontend/package.json`**

In `C:\Dev\CollectIt\requirements.txt`:

```
bedrock-api @ git+https://github.com/djntechnic/bedrock@v0.10.3#subdirectory=packages/bedrock-api
```

In `C:\Dev\CollectIt\frontend\package.json`:

```json
"@djntechnic/bedrock-ui": "github:djntechnic/bedrock#v0.10.3"
```

- [ ] **Step 2: Regenerate lockfile and install in CollectIt**

```powershell
cd C:\Dev\CollectIt\frontend
npm install --package-lock-only --ignore-scripts
rm -r -fo node_modules/@djntechnic
npm install --ignore-scripts
Get-Content node_modules/@djntechnic/bedrock-ui/package.json | Select-String '"version"'
```

Expected: Displays `"version": "0.10.3"`.

- [ ] **Step 3: Integrate `<HtmlCodeEditor>` in `OutputPane.tsx`**

In `C:\Dev\CollectIt\frontend\src\components\listing-studio/OutputPane.tsx`:

1. Import `HtmlCodeEditor` and `beautifyHtml` from `@djntechnic/bedrock-ui`.
2. Add state `manualEdit: boolean` (default `false`) and `customText: string | null` (default `null`).
3. Add toolbar switches:
   - "Enable Manual Edit" (`<Switch checked={manualEdit} onCheckedChange={setManualEdit} />`)
   - "Format HTML" `<Button size="sm" variant="outline" onClick={handleFormat}>`
   - "Reset" `<Button size="sm" variant="ghost" onClick={() => setCustomText(null)}>` (when `customText !== null`)
4. Replace `<pre className="token-code...">{beautifyForDisplay(text)}</pre>` with:

```tsx
<HtmlCodeEditor
  value={displayText}
  readOnly={!manualEdit}
  onChange={(val) => setCustomText(val)}
  className="flex-1 rounded-xl ring-1 ring-border"
/>
```

- [ ] **Step 4: Update `OutputPane.test.tsx`**

Ensure `OutputPane.test.tsx` exercises:

- Read-only default rendering.
- Manual edit switch enables editing.
- "Format HTML" action formats content.
- Copy action preserves byte-identical export content when manual edit is disabled.

- [ ] **Step 5: Run CollectIt full verification suite**

```powershell
cd C:\Dev\CollectIt
python scripts/maintenance/audit_bedrock_pins.py
pwsh scripts/run_audit.ps1
npm test
npm run typecheck
pytest
echo "exit=$LASTEXITCODE"
```

Expected: All tests and audits pass cleanly with exit code `0`.

- [ ] **Step 6: Commit changes in CollectIt**

```bash
cd C:\Dev\CollectIt
git add requirements.txt frontend/package.json frontend/package-lock.json frontend/src/components/listing-studio/OutputPane.tsx frontend/src/components/listing-studio/OutputPane.test.tsx
git commit -m "feat(studio): integrate HtmlCodeEditor with formatting and bump bedrock pin to v0.10.3"
```
