"""Runner shim for Standard S015 audit."""
import sys

from bedrock.tools.s015_audit_release_notes import main

sys.exit(main())
