"""Tests for the ledger-freshness gate."""
import textwrap
import pytest

from bedrock.tools import audit_ledger_freshness as gate


def _ledger(tmp_path, body: str):
    path = tmp_path / "bedrock_issues_to_file.md"
    path.write_text(textwrap.dedent(body), encoding="utf-8")
    return str(path)


def test_an_entry_naming_an_open_issue_passes(tmp_path):
    path = _ledger(tmp_path, """
        | # | Entry | Issue |
        | --- | --- | --- |
        | 1 | Something | [bedrock#12](https://github.com/djntechnic/bedrock/issues/12) |

        ## 1. Something
        - **Fix in bedrock:** one line.
    """)
    assert gate.audit(path, open_issues={12}) == []


def test_an_entry_naming_a_closed_issue_without_a_tag_fails(tmp_path):
    path = _ledger(tmp_path, """
        | # | Entry | Issue |
        | --- | --- | --- |
        | 1 | Something | [bedrock#12](https://github.com/djntechnic/bedrock/issues/12) |

        ## 1. Something
        - **Fix in bedrock:** one line.
    """)
    failures = gate.audit(path, open_issues=set())
    assert len(failures) == 1
    assert "12" in failures[0]


def test_a_closed_issue_is_allowed_when_the_entry_names_the_fixing_tag(tmp_path):
    path = _ledger(tmp_path, """
        | # | Entry | Issue |
        | --- | --- | --- |
        | 1 | Something | [bedrock#12](https://github.com/djntechnic/bedrock/issues/12) |

        ## 1. Something
        - **Status:** fixed in bedrock v0.5.0; workaround still in place.
    """)
    assert gate.audit(path, open_issues=set()) == []


def test_an_unfiled_entry_fails(tmp_path):
    path = _ledger(tmp_path, """
        | # | Entry | Issue |
        | --- | --- | --- |
        | 1 | Something | to file |

        ## 1. Something
        - **Fix in bedrock:** one line.
    """)
    failures = gate.audit(path, open_issues={12})
    assert len(failures) == 1
    assert "unfiled" in failures[0].lower()


def test_a_missing_ledger_is_not_an_error(tmp_path):
    """A consumer with no ledger has nothing to be stale."""
    assert gate.audit(str(tmp_path / "absent.md"), open_issues=set()) == []
