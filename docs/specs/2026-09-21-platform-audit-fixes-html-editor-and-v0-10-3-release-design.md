# Platform Audit Fixes, HTML Code Editor Subsystem, and v0.10.3 Release Design

**Date:** 2026-09-21  
**Author:** Pair Programming Agent & djntechnic  
**Status:** Approved  
**Target Release:** `v0.10.3`  
**Governing Standards:** Bedrock Platform Invariants §S001–§S014  

---

## 1. Executive Summary & Goals

This design addresses four platform audit defects logged from consumer usage (#87, #88, #89, #90), introduces a reusable `<HtmlCodeEditor>` component into `@djntechnic/bedrock-ui` powered by CodeMirror 6, htmlhint, and js-beautify, cuts the unified `v0.10.3` release of `bedrock-api` and `@djntechnic/bedrock-ui`, and executes downstream dual-pin upgrades across `MLBTracker` and `CollectIt` with deep integration into CollectIt's `OutputPane.tsx`.

---

## 2. Platform Audit Defect Remediation

### 2.1 Issue #87: `_config.py` raises `TypeError` on unexpected `bedrock.toml` keys
- **Problem Statement:** In `packages/bedrock-api/bedrock/tools/_config.py`, `_build_section()` converts raw TOML dictionaries directly into `**kwargs` when calling dataclass constructors (`section_cls(**kwargs)`). When consumer repositories contain deprecated, template-drifted, or unrecognized keys (e.g. `skip_exemptions = true` under `[tool.bedrock.audit.s005]`), the Python dataclass raises an unhandled `TypeError`, aborting the entire audit runner.
- **Root Cause:** Direct dictionary unpacking without field introspection against `@dataclass` field definitions.
- **Resolution:**
  Filter `kwargs` against `dataclasses.fields(section_cls)`:
  ```python
  import dataclasses
  from loguru import logger

  valid_fields = {f.name for f in dataclasses.fields(section_cls)}
  filtered_kwargs = {}
  for key, value in kwargs.items():
      if key in valid_fields:
          filtered_kwargs[key] = value
      else:
          logger.warning(
              f"Ignoring unrecognized key '{key}' in [tool.bedrock.audit.{section_name}] "
              f"for dataclass {section_cls.__name__}"
          )
  return section_cls(**filtered_kwargs)
  ```
- **Files Impacted:**
  - `packages/bedrock-api/bedrock/tools/_config.py`
  - `packages/bedrock-api/tests/test_tools_config.py` (or `test_audit_s005_to_s008.py`)
- **Verification:** Unit test asserting that passing extra keys in TOML under `[tool.bedrock.audit.s005]` successfully loads without `TypeError` and preserves platform exemptions.

---

### 2.2 Issue #88: `run_audit.ps1` dispatches `bedrock.tools.run_all` when `-Domain` is specified
- **Problem Statement:** In `packages/bedrock-api/bedrock/templates/scripts/run_audit.ps1`, the switch logic evaluates platform audits whenever `$Domain` is invoked if fallthrough defaults are not strictly gated, causing platform audits to execute during domain-specific checks.
- **Root Cause:** Conditional branching did not isolate switches when `-Domain` was exclusively requested.
- **Resolution:**
  Refactor `run_audit.ps1` dispatch logic:
  ```powershell
  if (-not $Platform -and -not $Domain -and -not $All) {
      $All = $true
  }
  if ($All) {
      $Platform = $true
      $Domain = $true
  }
  if ($Platform) {
      python -m bedrock.tools.run_all --root .
      if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
  if ($Domain) {
      $domainScripts = Get-ChildItem -Path "scripts/audits" -Filter "audit_s1*.py" -ErrorAction SilentlyContinue
      if ($domainScripts.Count -eq 0) {
          Write-Host "==> No domain audit scripts found under scripts/audits/. Skipping."
      } else {
          foreach ($script in $domainScripts) {
              python $script.FullName
              if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
          }
      }
  }
  ```
- **Files Impacted:**
  - `packages/bedrock-api/bedrock/templates/scripts/run_audit.ps1`
  - `docs/specs/2026-09-12-ecosystem-standards-and-tooling-architecture.md`
- **Verification:** Test runner verifying `-Domain` executes strictly domain checks and exits 0 when no domain scripts are present.

---

### 2.3 Issue #89: `audit_s011` and `audit_s012` assume internal platform repo paths
- **Problem Statement:** `AuditS011Config.nav_config` defaults to `packages/bedrock-ui/src/navigation/navConfig.ts`. `AuditS012Config.requirements` defaults to `packages/bedrock-api/requirements.txt` and `package_json` to `packages/bedrock-ui/package.json`. In consumer repos lacking explicit overrides in `bedrock.toml`, `audit_s011` and `audit_s012` fail with file-not-found errors.
- **Root Cause:** Dataclass defaults hardcode the Bedrock monorepo structure instead of resolving consumer paths.
- **Resolution:**
  Implement candidate fallback path resolution:
  - For `nav_config`:
    1. Explicit `bedrock.toml` configuration if provided.
    2. `frontend/src/components/domain/navigation.ts`
    3. `frontend/src/navigation.ts`
    4. `packages/bedrock-ui/src/navigation/navConfig.ts`
  - For `requirements`:
    1. Explicit `bedrock.toml` configuration if provided.
    2. `requirements.txt`
    3. `packages/bedrock-api/requirements.txt`
  - For `package_json`:
    1. Explicit `bedrock.toml` configuration if provided.
    2. `frontend/package.json`
    3. `package.json`
    4. `packages/bedrock-ui/package.json`
- **Files Impacted:**
  - `packages/bedrock-api/bedrock/tools/_config.py`
  - `packages/bedrock-api/bedrock/tools/audit_s011_navigation.py`
  - `packages/bedrock-api/bedrock/tools/audit_s012_pins.py`
  - `packages/bedrock-api/tests/test_audit_s009_to_s012.py`
- **Verification:** Unit tests asserting clean zero-exit runs against mock directory structures representing consumer apps without internal `packages/...` directories.

---

### 2.4 Issue #90: Design token scanner does not respect root .gitignore for vendor asset directories
- **Problem Statement:** `audit_s009_design_tokens._source_files()` traverses all `.ts`, `.tsx`, `.css` in the root tree. Vendor files, fixtures, and data dumps under `data/`, `imports/`, and `exports/` trigger hundreds of false-positive hex color violations.
- **Root Cause:** Data and vendor directories are omitted from `DEFAULT_IGNORED_DIRS`.
- **Resolution:**
  Add `"data"`, `"imports"`, and `"exports"` to `DEFAULT_IGNORED_DIRS` in `_config.py` and ensure `_source_files` in `audit_s009_design_tokens.py` filters them out:
  ```python
  DEFAULT_IGNORED_DIRS = {
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
- **Files Impacted:**
  - `packages/bedrock-api/bedrock/tools/_config.py`
  - `packages/bedrock-api/bedrock/tools/audit_s009_design_tokens.py`
  - `packages/bedrock-api/tests/test_audit_s009_to_s012.py`
- **Verification:** Test placing a fixture at `data/vendor/styles.css` with `#ffffff` and verifying zero violations found by `audit_s009`.

---

## 3. Reusable HTML Code Editor Subsystem (`@djntechnic/bedrock-ui`)

### 3.1 Overview & Responsibilities
In compliance with §S001 (Zero UI Duplication), the HTML editor, formatting engine, and linter are implemented centrally in `@djntechnic/bedrock-ui`.
- **Syntax Highlighting & Interaction:** CodeMirror 6 via `@uiw/react-codemirror` and `@codemirror/lang-html`.
- **Formatting:** `js-beautify.html` configured to respect semantic HTML and preserve placeholders (`{{token}}`).
- **Linting:** Real-time lint diagnostics using `htmlhint` mapped to `@codemirror/lint` squiggly markers and tooltip popovers.
- **Theming:** Full compliance with §S009 using Bedrock CSS semantic tokens (`var(--text-primary)`, `var(--primary)`, `var(--warning)`, `var(--border)`, `var(--surface-sunken)`).

### 3.2 Package Manifest Changes (`package.json`)
Add dependencies to `package.json`:
- `@uiw/react-codemirror`: `^4.23.0`
- `@codemirror/lang-html`: `^6.4.9`
- `@codemirror/lint`: `^6.8.4`
- `htmlhint`: `^1.1.4`
- `js-beautify`: `^1.15.1`
- DevDependencies: `@types/js-beautify`: `^1.14.3`

### 3.3 Component Architecture (`HtmlCodeEditor.tsx`)
File: `packages/bedrock-ui/src/components/editor/HtmlCodeEditor.tsx`

```typescript
export interface HtmlCodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  showLineNumbers?: boolean;
  showLintDiagnostics?: boolean;
  height?: string;
  className?: string;
  onFormat?: (formattedValue: string) => void;
}
```

#### Formatting Helper (`beautifyHtml`):
File: `packages/bedrock-ui/src/components/editor/beautifyHtml.ts`
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

#### Linting Extension (`htmlLinter`):
File: `packages/bedrock-ui/src/components/editor/htmlLinter.ts`
Uses `HTMLHint.verify(content, rules)` to generate `Diagnostic[]` for `@codemirror/lint`:
- Checks for unclosed tags, attribute quotes, duplicate attributes, and tag pairing.
- Displays line/column squigglies with severity classification.

### 3.4 Export Surface
Exported from `packages/bedrock-ui/src/index.ts`:
- `HtmlCodeEditor`, `type HtmlCodeEditorProps`
- `beautifyHtml`
- `createHtmlLinterExtension`

---

## 4. CollectIt `OutputPane.tsx` Integration

### 4.1 Consumer Flow
In `CollectIt/frontend/src/components/listing-studio/OutputPane.tsx`:
1. Import `HtmlCodeEditor`, `beautifyHtml` from `@djntechnic/bedrock-ui`.
2. State Management:
   - `manualEdit: boolean` (default: `false`, controlled by switch "Enable Manual Edit").
   - `editedContent: string | null` (stores manual edits, resets on item/template switch).
   - `activeContent = manualEdit && editedContent !== null ? editedContent : (minified ? exportHtml : html)`.
3. Toolbar Actions:
   - **"Format HTML" Button:** Calls `beautifyHtml(activeContent)`. If manual edit is active, updates `editedContent`. If read-only, displays formatted view without modifying underlying export payload.
   - **"Reset" Button:** Appears when `editedContent !== null` to revert manual changes back to engine output.
   - **"Export form" Switch:** Toggles between formatted description HTML and File Exchange minified CSV HTML.
   - **"Download .txt" & "Copy" Buttons:** Download and copy `activeContent`. When manual edit is disabled, copies the exact raw engine output byte-for-byte.
4. Replace existing `<pre>` block with `<HtmlCodeEditor>`.

---

## 5. Release Orchestration (`v0.10.3`)

### 5.1 Pre-Release Verification
Run local gates in `bedrock`:
1. `npm test` and `npm run typecheck` in repo root.
2. `pytest packages/bedrock-api/tests` with dev dependencies installed.
3. Validate synchronized version via:
   `python -m bedrock.tools.audit_release_version v0.10.3`

### 5.2 Release Artifacts
1. Update `package.json` to `"version": "0.10.3"`.
2. Update `packages/bedrock-api/pyproject.toml` to `version = "0.10.3"`.
3. Document `## v0.10.3` in `CHANGELOG.md`.
4. Commit to `master`.
5. Tag: `git tag -a v0.10.3 <full-sha> -m "v0.10.3 - Platform audit hardening and HtmlCodeEditor component"`.
6. Push tag: `git push origin v0.10.3`.
7. Create GitHub release: `gh release create v0.10.3 --notes-file build/release-notes.md`.

---

## 6. Downstream Pin Bumps & Acceptance Gates

### 6.1 `MLBTracker`
1. Verify remote tag `v0.10.3`.
2. Update `requirements.txt` and `frontend/package.json` to `v0.10.3`.
3. Run `npm install --package-lock-only --ignore-scripts`.
4. Prove installation in `node_modules` and Python environment.
5. Run full gates: `python scripts/maintenance/audit_bedrock_pins.py`, `pwsh scripts/run_audit.ps1`, unit tests.

### 6.2 `CollectIt`
1. Verify remote tag `v0.10.3`.
2. Update `requirements.txt` and `frontend/package.json` to `v0.10.3`.
3. Regenerate lockfile and verify package contents.
4. Update `OutputPane.tsx` and `OutputPane.test.tsx` to integrate `<HtmlCodeEditor>`.
5. Run full gates: `python scripts/maintenance/audit_bedrock_pins.py`, `pwsh scripts/run_audit.ps1`, frontend tests, and backend pytest.
