"""Tests for the design-tokens drift gate (DESIGN.md vs. a registered palette)."""
import pathlib
import textwrap

from bedrock.tools import audit_design_tokens as gate

DESIGN_DOC = pathlib.Path(".stitch/DESIGN.md")
PALETTES = pathlib.Path("frontend/src/theme/palettes.ts")


# Every role REQUIRED_TOKENS demands (token names with the leading `--`
# stripped, matching the frontmatter's naming). A "complete" fixture declares
# all of these so rule 4 (missing platform-required token) doesn't fire as
# an incidental side effect of an otherwise-unrelated test.
_ALL_ROLES = sorted(token[2:] for token in gate.REQUIRED_TOKENS)


def _full_frontmatter_map(hex_value: str) -> dict:
    return {role: hex_value for role in _ALL_ROLES}


def _write_design_doc(tmp_path: pathlib.Path, dark_hex: str = "#0a0a0a", light_hex: str = "#ffffff") -> None:
    """A complete DESIGN.md: every REQUIRED_TOKENS role documented for both
    palettes, all sharing one hex per theme for simplicity."""
    doc = tmp_path / DESIGN_DOC
    doc.parent.mkdir(parents=True, exist_ok=True)
    dark_lines = "\n".join(f'  {role}: "{dark_hex}"' for role in _ALL_ROLES)
    light_lines = "\n".join(f'  {role}: "{light_hex}"' for role in _ALL_ROLES)
    # Built with an explicit join rather than textwrap.dedent(f"""...{x}...""")
    # - the injected multi-line blocks have their own (different) indentation,
    # so dedent would compute the common leading whitespace across the whole
    # result rather than just the literal template lines, and under-strip.
    content = "\n".join(
        ["---", "colors:", dark_lines, "colorsLight:", light_lines, "---", "# Design", ""]
    )
    doc.write_text(content, encoding="utf-8")


def _write_palettes(tmp_path: pathlib.Path, dark_hsl: str, light_hsl: str) -> None:
    """A complete palettes.ts matching `_write_design_doc`'s default hexes -
    every REQUIRED_TOKENS token present in both palettes, `--background`
    driven by the given HSL triples so callers can perturb just that one."""
    path = tmp_path / PALETTES
    path.parent.mkdir(parents=True, exist_ok=True)
    other_dark_hsl = gate.hex_to_hsl("#0a0a0a")
    other_light_hsl = gate.hex_to_hsl("#ffffff")
    dark_vars = "\n".join(
        f'    "--{role}": "{dark_hsl if role == "background" else other_dark_hsl}",'
        for role in _ALL_ROLES
    )
    light_vars = "\n".join(
        f'    "--{role}": "{light_hsl if role == "background" else other_light_hsl}",'
        for role in _ALL_ROLES
    )
    # See `_write_design_doc` for why this is a plain join rather than
    # textwrap.dedent on an f-string with injected multi-line blocks.
    content = "\n".join(
        [
            "export const BENCH_DARK: ThemePalette = {",
            "  cssVars: {",
            dark_vars,
            "  },",
            "};",
            "",
            "export const BENCH_LIGHT: ThemePalette = {",
            "  cssVars: {",
            light_vars,
            "  },",
            "};",
            "",
        ]
    )
    path.write_text(content, encoding="utf-8")


def _run(tmp_path: pathlib.Path) -> list[str]:
    return gate.audit(tmp_path, DESIGN_DOC, PALETTES)


# hex_to_hsl(#0a0a0a) and hex_to_hsl(#ffffff), computed once so the fixtures
# below can assert a matching pair without hand-deriving each triple.
_DARK_HSL = gate.hex_to_hsl("#0a0a0a")
_LIGHT_HSL = gate.hex_to_hsl("#ffffff")


def test_a_matching_doc_and_palettes_pair_produces_no_findings(tmp_path):
    """The baseline: both halves agree, so there is nothing to report."""
    _write_design_doc(tmp_path)
    _write_palettes(tmp_path, _DARK_HSL, _LIGHT_HSL)

    assert _run(tmp_path) == []


def test_rule1_a_token_defined_in_the_palette_but_undocumented_is_a_finding(tmp_path):
    """Rule 1: both halves must declare the same token names."""
    _write_design_doc(tmp_path)
    path = tmp_path / PALETTES
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        textwrap.dedent(
            f"""\
            export const BENCH_DARK: ThemePalette = {{
              cssVars: {{
                "--background": "{_DARK_HSL}",
                "--extra-token": "0 0% 0%",
              }},
            }};

            export const BENCH_LIGHT: ThemePalette = {{
              cssVars: {{
                "--background": "{_LIGHT_HSL}",
                "--extra-token": "0 0% 0%",
              }},
            }};
            """
        ),
        encoding="utf-8",
    )

    problems = _run(tmp_path)
    assert any("--extra-token" in p and "does not document" in p for p in problems)


def test_rule2_a_hex_that_converts_to_a_different_hsl_triple_is_a_finding(tmp_path):
    """Rule 2: the documented hex must convert to exactly the HSL triple the
    palette carries - a deliberately wrong triple here (not derived from the
    hex) must be caught."""
    _write_design_doc(tmp_path)
    _write_palettes(tmp_path, "1 2% 3%", _LIGHT_HSL)

    problems = _run(tmp_path)
    assert any("converts to" in p for p in problems)


def test_rule2_var_alias_is_exempt_from_hex_conversion_checking(tmp_path):
    """§ the source's documented exemption: a `var()` alias has no hex to
    document, so it must not be flagged by rule 2 even though it is not a
    6-digit hex and has no matching frontmatter entry."""
    _write_design_doc(tmp_path)
    path = tmp_path / PALETTES
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        textwrap.dedent(
            f"""\
            export const BENCH_DARK: ThemePalette = {{
              cssVars: {{
                "--background": "{_DARK_HSL}",
                "--scoreboard-accent": "var(--primary)",
              }},
            }};

            export const BENCH_LIGHT: ThemePalette = {{
              cssVars: {{
                "--background": "{_LIGHT_HSL}",
                "--scoreboard-accent": "var(--primary)",
              }},
            }};
            """
        ),
        encoding="utf-8",
    )

    problems = _run(tmp_path)
    assert not any("--scoreboard-accent" in p and "not a 6-digit hex" in p for p in problems)
    assert not any("--scoreboard-accent" in p and "does not document" in p for p in problems)


def test_rule3_dark_and_light_palettes_with_different_vocabularies_is_a_finding(tmp_path):
    """Rule 3: the two palettes must declare identical token vocabularies, so
    switching theme never leaves a token unset."""
    doc = tmp_path / DESIGN_DOC
    doc.parent.mkdir(parents=True, exist_ok=True)
    doc.write_text(
        textwrap.dedent(
            """\
            ---
            colors:
              background: "#0a0a0a"
              accent: "#123456"
            colorsLight:
              background: "#ffffff"
            ---
            # Design
            """
        ),
        encoding="utf-8",
    )
    path = tmp_path / PALETTES
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        textwrap.dedent(
            f"""\
            export const BENCH_DARK: ThemePalette = {{
              cssVars: {{
                "--background": "{_DARK_HSL}",
                "--accent": "{gate.hex_to_hsl('#123456')}",
              }},
            }};

            export const BENCH_LIGHT: ThemePalette = {{
              cssVars: {{
                "--background": "{_LIGHT_HSL}",
              }},
            }};
            """
        ),
        encoding="utf-8",
    )

    problems = _run(tmp_path)
    assert any("--accent" in p and "one palette and not the other" in p for p in problems)


def test_rule4_a_palette_missing_a_platform_required_token_is_a_finding(tmp_path):
    """Rule 4: every token bedrock's `@theme` block resolves must be present
    in both palettes, or the matching utility paints transparent."""
    _write_design_doc(tmp_path)
    _write_palettes(tmp_path, _DARK_HSL, _LIGHT_HSL)

    # Strip `--primary` back out of the otherwise-complete palette file, so
    # this is the one and only thing wrong with the fixture.
    path = tmp_path / PALETTES
    text = path.read_text(encoding="utf-8")
    lines = [line for line in text.splitlines(keepends=True) if '"--primary":' not in line]
    path.write_text("".join(lines), encoding="utf-8")

    problems = _run(tmp_path)
    assert any("--primary" in p and "is missing" in p for p in problems)


def test_rule5_an_editable_field_that_disagrees_with_the_documented_hex_is_a_finding(tmp_path):
    """Rule 5: the six editable hex fields on each palette must match the
    documented role they mirror, or the admin colour picker lies."""
    _write_design_doc(tmp_path)
    path = tmp_path / PALETTES
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        textwrap.dedent(
            f"""\
            export const BENCH_DARK: ThemePalette = {{
              colorBackground: "#ff0000",
              cssVars: {{
                "--background": "{_DARK_HSL}",
              }},
            }};

            export const BENCH_LIGHT: ThemePalette = {{
              cssVars: {{
                "--background": "{_LIGHT_HSL}",
              }},
            }};
            """
        ),
        encoding="utf-8",
    )

    problems = _run(tmp_path)
    assert any("colorBackground" in p for p in problems)


def test_no_design_doc_at_all_is_a_clean_pass(tmp_path):
    """A consumer that never adopted Stitch has nothing to check."""
    _write_palettes(tmp_path, _DARK_HSL, _LIGHT_HSL)

    assert _run(tmp_path) == []


def test_design_doc_present_but_no_palettes_file_is_a_clean_pass(tmp_path):
    """The MLBTracker mid-migration case: a `.stitch/DESIGN.md` exists but no
    palettes file has been registered yet. Nothing to check is not a
    violation - this gate must not block a repo that simply hasn't gotten
    there yet."""
    _write_design_doc(tmp_path)

    assert _run(tmp_path) == []


def test_a_palettes_file_that_registers_zero_palettes_is_a_clean_pass(tmp_path):
    """A palettes.ts that exists but declares neither BENCH_DARK nor
    BENCH_LIGHT (e.g. a stub, or a file mid-refactor) has nothing this gate
    can compare against DESIGN.md, so it must not manufacture findings."""
    _write_design_doc(tmp_path)
    path = tmp_path / PALETTES
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("export const unrelated = 1;\n", encoding="utf-8")

    assert _run(tmp_path) == []


def test_main_returns_1_when_there_are_findings(tmp_path):
    """Thin `main()` wiring: findings map to exit code 1."""
    _write_design_doc(tmp_path)
    _write_palettes(tmp_path, "1 2% 3%", _LIGHT_HSL)

    exit_code = gate.main(["--repo-root", str(tmp_path)])
    assert exit_code == 1


def test_main_returns_0_when_clean(tmp_path):
    """Thin `main()` wiring: no findings maps to exit code 0."""
    _write_design_doc(tmp_path)
    _write_palettes(tmp_path, _DARK_HSL, _LIGHT_HSL)

    exit_code = gate.main(["--repo-root", str(tmp_path)])
    assert exit_code == 0
