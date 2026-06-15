#!/usr/bin/env python3
"""Seed pilot OSS capability catalog/intake records for Mission Control.

This script writes metadata only. It does not install, enable, or run any third-party service.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path('/opt/hermes-mission-control')
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import capability_registry as cr
SEED_PATH = ROOT / 'source/docs/capability-registry-pilot-oss-seed.json'
TASK_ID = 't_44349e44'
ACTOR = f'kanban:{TASK_ID}'


def _exists(table: str, record_id: str) -> bool:
    con = cr.ensure_capability_registry_tables()
    try:
        row = con.execute(f'SELECT id FROM {table} WHERE id=?', (record_id,)).fetchone()
        return bool(row)
    finally:
        con.close()


def _capability_payload(seed: dict, item: dict) -> dict:
    slug = item['slug']
    install = dict(item['installMode'])
    install.update({
        'requiredSecrets': item.get('requiredSecrets') or [],
        'requiredPermissions': item.get('permissions') or [],
        'smokeTestCommand': item['smokeTest'],
        'sourceUrl': item['sourceUrl'],
        'installApproved': False,
        'productionInstallPerformed': False,
    })
    evidence = [{
        'id': f'ev-pilot-oss-{slug}-source-url',
        'kind': 'source-url',
        'title': f"{item['displayName']} upstream source",
        'summary': 'Seed source URL verified with HTTP HEAD 200 before record creation; no install performed.',
        'url': item['sourceUrl'],
    }]
    return {
        'id': f'cap-pilot-oss-{slug}',
        'type': item['sourceType'],
        'name': slug,
        'displayName': item['displayName'],
        'description': f"Pilot OSS capability seed for {item['displayName']} ({item['category']}).",
        'category': item['category'],
        'tags': ['pilot-oss-capability', 'seeded-by-kanban', item['category']],
        'status': 'awaiting-approval',
        'sourceUri': item['sourceUrl'],
        'sourceRef': item['sourceRef'],
        'sourceLabel': 'GitHub',
        'workspaceId': seed['workspaceId'],
        'ownerKind': 'admin',
        'visibility': 'admin',
        'editable': True,
        'enabled': False,
        'installMethod': install,
        'governance': {
            'riskLevels': item['riskFlags'],
            'approvalStatus': 'pending',
            'approvalNote': 'Pilot seed record only; Admin/Melverick approval required before install, enablement, assignment, or production service changes.',
            'productionInstallPerformed': False,
        },
        'permissions': item.get('permissions') or [],
        'health': {'state': 'not-run', 'smokeTestCommand': item['smokeTest'], 'productionInstallPerformed': False},
        'evidence': evidence,
        'assignment': {'recommendation': item['assignmentRecommendation'], 'assignedAgents': [], 'assignedRoutines': [], 'assignedTasks': []},
        'rollback': {
            'supported': True,
            'note': item['rollbackNote'],
            'disableSteps': ['disable generated wrapper/assignment'],
            'uninstallSteps': [item['rollbackNote']],
            'restartRequired': bool(item['installMode'].get('requiresRestart')),
        },
        'audit': [{'action': 'seeded-pilot-oss-capability', 'actor': ACTOR, 'note': seed['intent']}],
        'createdBy': ACTOR,
        'updatedBy': ACTOR,
    }


def _intake_payload(seed: dict, item: dict) -> dict:
    slug = item['slug']
    cap_payload = _capability_payload(seed, item)
    return {
        'id': f'intake-pilot-oss-{slug}',
        'title': f"Pilot OSS intake: {item['displayName']}",
        'description': f"Seed intake record for {item['displayName']}. Source URL, category, install mode, risks, required secrets, smoke test, assignment recommendation, and rollback note captured. No production install performed.",
        'sourceType': item['sourceType'],
        'sourceUri': item['sourceUrl'],
        'sourceRef': item['sourceRef'],
        'sourceLabel': 'GitHub',
        'workspaceId': seed['workspaceId'],
        'requestedBy': ACTOR,
        'status': 'awaiting-approval',
        'riskLevels': item['riskFlags'],
        'installMethod': cap_payload['installMethod'],
        'permissions': item.get('permissions') or [],
        'healthPlan': {'state': 'not-run', 'smokeTestCommand': item['smokeTest'], 'sandboxMode': 'dry-run-before-approval', 'productionInstallPerformed': False},
        'evidence': cap_payload['evidence'],
        'assignedAgents': [{
            'id': item['assignmentRecommendation'].get('profile'),
            'name': item['assignmentRecommendation'].get('profile'),
            'enabled': False,
            'reason': item['assignmentRecommendation'].get('rationale'),
        }],
        'rollbackNotes': cap_payload['rollback'],
    }


def main() -> None:
    seed = json.loads(SEED_PATH.read_text(encoding='utf-8'))
    created: list[str] = []
    updated: list[str] = []
    for item in seed['records']:
        cap_payload = _capability_payload(seed, item)
        cap_id = cap_payload['id']
        if _exists('capability_sources', cap_id):
            cr.update_capability_record(cap_id, cap_payload)
            updated.append(cap_id)
        else:
            cr.create_capability_record(cap_payload)
            created.append(cap_id)

        intake_payload = _intake_payload(seed, item)
        intake_id = intake_payload['id']
        if _exists('capability_intake_records', intake_id):
            cr.update_capability_intake_record(intake_id, intake_payload)
            updated.append(intake_id)
        else:
            cr.create_capability_intake_record(intake_payload)
            created.append(intake_id)

    summary = cr.list_capability_records({'q': 'pilot-oss'})['summary']
    print(json.dumps({'created': created, 'updated': updated, 'seedRecords': len(seed['records']), 'capabilitySummary': summary}, indent=2))


if __name__ == '__main__':
    main()
