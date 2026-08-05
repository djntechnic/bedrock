"""
Module:  base.py
Layer:   api/jobs/importers
Desc:    Abstract base class for data importers. Standardises the lifecycle 
         of ingestion jobs including logging, error handling, and file movement.
"""
import os
import time
import uuid
import random
import shutil
import sqlite3
import traceback
from datetime import datetime
from abc import ABC, abstractmethod
from bedrock.core.database import db
from bedrock.core.schema_catalog import Tables as T


def _is_transient_error(exc: Exception) -> bool:
    """
    Classify an exception as transient (worth retrying) vs permanent.

    Transient: filesystem/connection hiccups and SQLite lock/busy contention.
    Permanent: parse/validation errors (ValueError, KeyError, pandas errors)
    which will fail identically on every retry and must surface immediately.

    Args:
        exc: The exception raised during the import run.

    Returns:
        bool: True if a retry may succeed; False if the error is deterministic.
    """
    # SQLite contention — only "locked"/"busy" OperationalErrors are transient.
    if isinstance(exc, sqlite3.OperationalError):
        msg = str(exc).lower()
        return "locked" in msg or "busy" in msg

    # Network / IO level failures.
    # NOTE: OSError is the base of IOError and ConnectionError in Py3, but we
    # list them explicitly for clarity of intent.
    if isinstance(exc, (ConnectionError, OSError, IOError)):
        return True

    return False

class BaseImporter(ABC):
    """
    Abstract base class for all data importers.
    Provides standard logging, error handling, and lifecycle management.
    """
    
    def __init__(self, source_name):
        """
        Initialize the importer instance.

        Args:
            source_name: String identifier for the importer (e.g., 'lahman').
        """
        self.source_name = source_name
        self.import_run_id = str(uuid.uuid4())
        self.started_ts = datetime.utcnow()
        self.total_rows = 0
        self.committed_rows = 0
        self.staged_rows = 0
        self.skipped_rows = 0

    def start_run(self, source_version=None):
        """
        Initialize the import run in the database for audit tracking.

        Args:
            source_version: Optional string identifying the data version.
        """
        sql = f"""
            INSERT INTO {T.IMPORT_RUNS} (import_run_id, source, status, started_ts, source_version)
            VALUES (%s, %s, 'running', %s, %s)
        """
        # Record the start of the job.
        db.execute(sql, (self.import_run_id, self.source_name, self.started_ts.strftime("%Y-%m-%d %H:%M:%S"), str(source_version) if source_version else None))
        db.log_activity("IMPORT_START", f"Started {self.source_name} import (Run ID: {self.import_run_id})")

    def complete_run(self):
        """Mark the import run as successfully completed."""
        duration = (datetime.utcnow() - self.started_ts).total_seconds()
        sql = f"""
            UPDATE {T.IMPORT_RUNS} 
            SET status = 'completed', 
                completed_ts = CURRENT_TIMESTAMP, 
                duration_seconds = %s,
                total_rows = %s,
                committed_rows = %s,
                staged_rows = %s,
                skipped_rows = %s
            WHERE import_run_id = %s
        """
        # Finalise the run record with timing and row count metrics.
        db.execute(sql, (duration, self.total_rows, self.committed_rows, self.staged_rows, self.skipped_rows, self.import_run_id))
        
        detail = f"Rows: {self.total_rows} total, {self.committed_rows} committed, {self.skipped_rows} skipped"
        db.log_activity("IMPORT_COMPLETE", f"Completed {self.source_name} import", detail)

    def fail_run(self, error_message):
        """
        Mark the import run as failed and log the error.

        Args:
            error_message: Detailed error information.
        """
        # Truncate error message if it's too long for the schema.
        short_error = (error_message[:497] + '...') if len(error_message) > 500 else error_message
        
        sql = f"""
            UPDATE {T.IMPORT_RUNS} 
            SET status = 'failed', 
                error_message = %s, 
                completed_ts = CURRENT_TIMESTAMP
            WHERE import_run_id = %s
        """
        db.execute(sql, (short_error, self.import_run_id))
        db.log_activity("IMPORT_FAILED", f"Failed {self.source_name} import", short_error)

    @abstractmethod
    def run(self, *args, **kwargs):
        """
        Main execution logic. Must be implemented by specific importer subclasses.
        """
        pass

    @staticmethod
    def move_file(src_path: str, dst_dir: str) -> str:
        """
        Move a file into a target directory. Creates the directory if it doesn't exist.

        Args:
            src_path: Full path to the source file.
            dst_dir: Path to the destination directory.

        Returns:
            str: The new full path of the moved file.
        """
        os.makedirs(dst_dir, exist_ok=True)
        dst_path = os.path.join(dst_dir, os.path.basename(src_path))
        shutil.move(src_path, dst_path)
        return dst_path

    def execute_import(self, *args, **kwargs):
        """
        High-level wrapper for the run() method. 
        Orchestrates file movement protocol and run lifecycle.
        """
        source_version = kwargs.get('source_version')
        file_path = kwargs.pop('file_path', None)

        in_progress_path = None

        if file_path:
            # Determine directory structure for the file movement protocol.
            raw_dir        = os.path.dirname(file_path)
            source_root    = os.path.dirname(raw_dir)   # e.g. imports/ba_rankings
            in_progress_dir = os.path.join(source_root, 'in_progress')
            complete_dir    = os.path.join(source_root, 'complete')
            error_dir       = os.path.join(source_root, 'error')

            # Skip processing if the file already exists in the complete/ folder.
            complete_path = os.path.join(complete_dir, os.path.basename(file_path))
            if os.path.exists(complete_path):
                print(f"[SKIP] Already completed: {os.path.basename(file_path)}")
                db.log_activity("IMPORT_SKIP", f"Already completed: {os.path.basename(file_path)}")
                return None

            # Move file to in_progress/ before starting.
            in_progress_path = self.move_file(file_path, in_progress_dir)
            # Ensure the specific path argument expected by the subclass is updated.
            for key in ('excel_path', 'pdf_path'):
                if key in kwargs:
                    kwargs[key] = in_progress_path
                    break

        self.start_run(source_version=source_version)

        # Retry budget: number of *additional* attempts after the first try.
        # Only transient errors consume retries; parse errors fail immediately.
        max_retries = db.get_config("api_max_import_retries", 2)
        try:
            max_retries = max(0, int(max_retries))
        except (TypeError, ValueError):
            max_retries = 2

        attempt = 0
        while True:
            try:
                print(f"Starting import: {self.source_name} (Run ID: {self.import_run_id}, attempt {attempt + 1})")
                result = self.run(*args, **kwargs)
                self.complete_run()
                # Move file to complete/ on success.
                if in_progress_path:
                    self.move_file(in_progress_path, complete_dir)
                    print(f"[MOVED] {os.path.basename(in_progress_path)} -> complete/")
                print(f"Import completed: {self.source_name}")
                return result
            except Exception as e:
                transient = _is_transient_error(e)
                retries_left = attempt < max_retries

                if transient and retries_left:
                    # Exponential backoff with ±20% jitter. The file stays in
                    # in_progress/ between attempts (no move to error/ yet).
                    backoff = 2 ** attempt
                    jitter = backoff * random.uniform(-0.2, 0.2)
                    sleep_for = max(0.0, backoff + jitter)
                    attempt += 1
                    db.log_activity(
                        "IMPORT_RETRY",
                        f"Retrying {self.source_name} import (attempt {attempt + 1}/{max_retries + 1})",
                        f"Transient error: {e}. Backing off {sleep_for:.2f}s.",
                    )
                    print(f"Import transient failure: {self.source_name}. Retry {attempt}/{max_retries} in {sleep_for:.2f}s. Error: {e}")
                    time.sleep(sleep_for)
                    continue

                # Permanent error, or retries exhausted — fail for good.
                error_msg = f"{str(e)}\n{traceback.format_exc()}"
                self.fail_run(error_msg)
                if in_progress_path and os.path.exists(in_progress_path):
                    self.move_file(in_progress_path, error_dir)
                    print(f"[MOVED] {os.path.basename(in_progress_path)} -> error/")
                print(f"Import failed: {self.source_name}. Error: {e}")
                raise
