"""Pytest bootstrap for Mission Control tests.

The frontend/source test directory imports the production server module from
/opt/hermes-mission-control/app.py. Keep that application root importable so
sibling modules such as auth.py resolve without requiring each operator to set
PYTHONPATH by hand.
"""

import sys
from pathlib import Path

APP_ROOT = Path("/opt/hermes-mission-control")
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))


def pytest_runtest_setup(item):
    """Reload env-bound app helpers for tests that import app.py dynamically.

    Several Mission Control tests set HMC_* environment variables immediately
    before dynamically importing /opt/hermes-mission-control/app.py. The app
    imports auth.py with normal Python module caching, so without clearing auth
    between tests its APP_DB/HERMES_HOME constants can point at an earlier
    tmp_path and leak user-agent preferences across otherwise isolated tests.
    """

    sys.modules.pop("auth", None)
