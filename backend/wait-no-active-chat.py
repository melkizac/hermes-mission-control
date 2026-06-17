#!/usr/bin/env python3
"""Wait for Mission Control chat workers to finish before stopping the web service.

Used by systemd ExecStopPre so deployments do not kill in-flight chat tasks and
leave the browser with a user-only request row.
"""
import json
import os
import sys
import time
from pathlib import Path

state_file = Path(os.environ.get('HMC_PROCESSING_STATE_FILE', '/opt/hermes-mission-control/processing-requests.json'))
max_wait = float(os.environ.get('HMC_STOP_DRAIN_SECONDS', '900'))
stale_after = float(os.environ.get('HMC_STOP_DRAIN_STALE_SECONDS', '1800'))
start = time.time()
last_seen = []

while time.time() - start < max_wait:
    try:
        data = json.loads(state_file.read_text(errors='replace')) if state_file.exists() else {}
    except Exception:
        data = {}
    updated_at = float(data.get('updated_at') or 0)
    requests = [r for r in data.get('requests') or [] if not r.get('cancelled')]
    now = time.time()
    # A state file older than stale_after cannot represent a live worker in this
    # service instance. Ignore it so a previous hard kill cannot block restart.
    if updated_at and now - updated_at > stale_after:
        requests = []
    if not requests:
        print('Mission Control stop drain: no active chat workers')
        sys.exit(0)
    last_seen = requests
    printable = ', '.join(f"{r.get('id')}@{int(now - float(r.get('started_at') or now))}s" for r in requests[:5])
    print(f'Mission Control stop drain: waiting for {len(requests)} active chat worker(s): {printable}', flush=True)
    time.sleep(3)

print(f'Mission Control stop drain: timed out after {int(max_wait)}s; active={last_seen}', file=sys.stderr)
sys.exit(1)
