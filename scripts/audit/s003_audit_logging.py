#!/usr/bin/env python
"""Runner shim for Standard S003 audit."""
import sys
from bedrock.tools.s003_audit_logging import main

if __name__ == "__main__":
    sys.exit(main())
