"""
Module:  vulture_whitelist.py
Layer:   scripts/maintenance
Desc:    Suppresses `vulture`'s known false-positive classes across
         `bedrock-api`. Vulture's static reachability analysis cannot see the
         three call shapes that dominate this codebase's "unused" noise:

           1. FastAPI route dependencies - a parameter injected via
              `Depends(...)` is "used" by the ASGI framework's runtime
              introspection of the function signature, not by any call site
              vulture's AST walk can find.
           2. Pydantic validators/config - `@field_validator` methods and
              `model_config` keys are invoked by Pydantic's metaclass during
              (de)serialization, never by name from application code.
           3. `AuditReporter` / `run_all` dataclass fields - `_CheckResult`
              and `AuditRunResult` (bedrock/tools/_reporter.py,
              bedrock/tools/run_all.py) are populated positionally and read
              via `asdict()` for the `--json` report path, so individual
              fields have no direct attribute-access call site.

         This file is not executed by the test suite. `vulture` parses it
         alongside real source and treats every name referenced here as used,
         per https://github.com/jendrikseipp/vulture#handling-false-positives.
         Regenerate candidates with:
             vulture packages/bedrock-api/bedrock --min-confidence 60

Usage:   python -m vulture packages/bedrock-api/bedrock scripts/maintenance/vulture_whitelist.py
"""


class _FastAPIRouteDependency:
    db = None
    current_user = None
    current_admin = None
    request = None
    response = None
    background_tasks = None
    session = None
    credentials = None


_route_dep = _FastAPIRouteDependency()
_route_dep.db
_route_dep.current_user
_route_dep.current_admin
_route_dep.request
_route_dep.response
_route_dep.background_tasks
_route_dep.session
_route_dep.credentials


class _PydanticModel:
    model_config = None
    orm_mode = None
    from_attributes = None

    def validate_field(self, value):
        return value


_pydantic_model = _PydanticModel()
_pydantic_model.model_config
_pydantic_model.orm_mode
_pydantic_model.from_attributes
_pydantic_model.validate_field


class _AuditCheckResult:
    description = None
    status = None
    details = None
    message = None
    file_path = None
    line = None
    hint = None


_check_result = _AuditCheckResult()
_check_result.description
_check_result.status
_check_result.details
_check_result.message
_check_result.file_path
_check_result.line
_check_result.hint


class _AuditRunResult:
    code = None
    status = None
    exit_code = None
    elapsed_ms = None
    output = None


_run_result = _AuditRunResult()
_run_result.code
_run_result.status
_run_result.exit_code
_run_result.elapsed_ms
_run_result.output
