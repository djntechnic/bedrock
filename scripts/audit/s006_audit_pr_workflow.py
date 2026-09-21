#!/usr/bin/env python
"""Runner shim for Standard S006 audit."""
import sys
from bedrock.tools.s006_audit_pr_workflow import main

if __name__ == "__main__":
    sys.exit(main())
