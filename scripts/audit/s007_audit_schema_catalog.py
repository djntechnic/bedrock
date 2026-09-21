#!/usr/bin/env python
"""Runner shim for Standard S007 audit."""
import sys
from bedrock.tools.s007_audit_schema_catalog import main

if __name__ == "__main__":
    sys.exit(main())
