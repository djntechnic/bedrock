"""
Module:  test_importer_retry.py
Layer:   api/tests
Desc:    Tests for retry-with-exponential-backoff in BaseImporter.execute_import.
         Covers: successful import (no retry), transient failure then success,
         parse error (no retry), exhausting all retries, and reading the retry
         count from config. time.sleep is patched out so tests run instantly.
"""
import sqlite3
from unittest.mock import patch, MagicMock

import pytest

from bedrock.importers.base import BaseImporter, _is_transient_error


class _StubImporter(BaseImporter):
    """A BaseImporter whose run() replays a scripted sequence of outcomes."""

    def __init__(self, outcomes):
        super().__init__("stub")
        # outcomes: list of either an Exception instance (raise) or a value (return).
        self._outcomes = list(outcomes)
        self.run_calls = 0

    def run(self, *args, **kwargs):
        self.run_calls += 1
        outcome = self._outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


@pytest.fixture
def patched_db():
    """Patch the db used by BaseImporter so no real DB or lifecycle SQL runs."""
    with patch("bedrock.importers.base.db") as mock_db:
        mock_db.get_config.return_value = 2  # default api_max_import_retries
        yield mock_db


@pytest.fixture(autouse=True)
def no_sleep():
    """Skip real backoff sleeps."""
    with patch("bedrock.importers.base.time.sleep") as s:
        yield s


# --------------------------------------------------------------------------- #
# Transient-error classifier
# --------------------------------------------------------------------------- #
def test_classifier_locked_is_transient():
    assert _is_transient_error(sqlite3.OperationalError("database is locked"))


def test_classifier_busy_is_transient():
    assert _is_transient_error(sqlite3.OperationalError("database is busy"))


def test_classifier_other_operational_error_not_transient():
    assert not _is_transient_error(sqlite3.OperationalError("no such table: foo"))


def test_classifier_connection_error_is_transient():
    assert _is_transient_error(ConnectionError("reset by peer"))


def test_classifier_oserror_is_transient():
    assert _is_transient_error(OSError("disk hiccup"))


def test_classifier_value_error_not_transient():
    assert not _is_transient_error(ValueError("bad column"))


def test_classifier_key_error_not_transient():
    assert not _is_transient_error(KeyError("missing"))


# --------------------------------------------------------------------------- #
# execute_import retry behaviour
# --------------------------------------------------------------------------- #
def test_successful_import_no_retry(patched_db):
    """A clean run() executes exactly once and returns its result."""
    imp = _StubImporter(["done"])
    result = imp.execute_import()
    assert result == "done"
    assert imp.run_calls == 1
    # No retry was logged.
    retry_logged = any(
        call.args and call.args[0] == "IMPORT_RETRY"
        for call in patched_db.log_activity.call_args_list
    )
    assert not retry_logged


def test_transient_failure_then_success(patched_db):
    """A transient error is retried and a subsequent success is returned."""
    imp = _StubImporter([sqlite3.OperationalError("database is locked"), "done"])
    result = imp.execute_import()
    assert result == "done"
    assert imp.run_calls == 2
    # One retry should have been logged.
    retry_calls = [
        c for c in patched_db.log_activity.call_args_list
        if c.args and c.args[0] == "IMPORT_RETRY"
    ]
    assert len(retry_calls) == 1


def test_parse_error_not_retried(patched_db):
    """A permanent parse error fails immediately without any retry."""
    imp = _StubImporter([ValueError("unparseable row")])
    with pytest.raises(ValueError):
        imp.execute_import()
    assert imp.run_calls == 1
    patched_db.log_activity.assert_any_call  # fail_run logs IMPORT_FAILED via db
    # No retry logged.
    retry_logged = any(
        c.args and c.args[0] == "IMPORT_RETRY"
        for c in patched_db.log_activity.call_args_list
    )
    assert not retry_logged


def test_exhausts_all_retries(patched_db):
    """Persistent transient errors exhaust the retry budget then re-raise."""
    patched_db.get_config.return_value = 2
    # Always transient: 1 initial + 2 retries = 3 attempts.
    imp = _StubImporter([
        sqlite3.OperationalError("database is locked"),
        sqlite3.OperationalError("database is locked"),
        sqlite3.OperationalError("database is locked"),
    ])
    with pytest.raises(sqlite3.OperationalError):
        imp.execute_import()
    assert imp.run_calls == 3
    retry_calls = [
        c for c in patched_db.log_activity.call_args_list
        if c.args and c.args[0] == "IMPORT_RETRY"
    ]
    assert len(retry_calls) == 2


def test_retry_count_read_from_config(patched_db):
    """The retry budget is taken from db.get_config('api_max_import_retries')."""
    patched_db.get_config.return_value = 4
    # 1 initial + 4 retries = 5 attempts, all failing transiently.
    imp = _StubImporter([sqlite3.OperationalError("database is locked")] * 5)
    with pytest.raises(sqlite3.OperationalError):
        imp.execute_import()
    assert imp.run_calls == 5
    patched_db.get_config.assert_any_call("api_max_import_retries", 2)


def test_zero_retries_config(patched_db):
    """api_max_import_retries=0 means a transient error fails on the first attempt."""
    patched_db.get_config.return_value = 0
    imp = _StubImporter([sqlite3.OperationalError("database is locked")])
    with pytest.raises(sqlite3.OperationalError):
        imp.execute_import()
    assert imp.run_calls == 1
