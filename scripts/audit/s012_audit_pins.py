#!/usr/bin/env python
"""Runner shim for Standard S012 audit."""
import sys
from bedrock.tools.s012_audit_pins import main

if __name__ == "__main__":
    sys.exit(main())
