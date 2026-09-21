#!/usr/bin/env python
"""Runner shim for Standard S014 audit."""
import sys
from bedrock.tools.s014_audit_ledger_freshness import main

if __name__ == "__main__":
    sys.exit(main())
