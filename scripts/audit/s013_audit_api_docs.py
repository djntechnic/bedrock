#!/usr/bin/env python
"""Runner shim for Standard S013 audit."""
import sys
from bedrock.tools.s013_audit_api_docs import main

if __name__ == "__main__":
    sys.exit(main())
