#!/usr/bin/env python
"""Runner shim for Standard S100 audit."""
import sys
from bedrock.tools.s100_audit_domain_registry import main

if __name__ == "__main__":
    sys.exit(main())
