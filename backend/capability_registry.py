"""Durable Mission Control capability registry persistence helpers.

The registry stores normalized capability source and intake records in the
existing mission_control.db SQLite database. It intentionally stores only
redacted command/config/evidence previews plus secret references/readiness
metadata, never raw secret values.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shlex
import shutil
import subprocess
import time
import base64
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any
from urllib.parse import parse_qsl, quote_plus, urlsplit, urlunsplit

from auth import auth_db_connect, ensure_auth_tables

CAPABILITY_SOURCE_TYPES = {
    "skill",
    "plugin",
    "mcp-server",
    "cli-tool",
    "github-project",
    "python-package",
    "npm-package",
    "docker-image",
    "local-service",
    "api-connector",
    "internal-tool",
    "owned_app",
}

CAPABILITY_SOURCE_TYPE_ALIASES = {
    "owned-app": "owned_app",
    "ownedapp": "owned_app",
    "first-party-app": "owned_app",
    "first_party_app": "owned_app",
}

CAPABILITY_STATUSES = {
    "draft",
    "intake",
    "assessing",
    "needs-info",
    "awaiting-approval",
    "approved",
    "registered",
    "installed",
    "enabled",
    "assigned",
    "degraded",
    "broken",
    "disabled",
    "rejected",
    "archived",
}

RISK_LEVELS = {
    "read-only",
    "local-write",
    "network",
    "secret-access",
    "requires-secret",  # legacy API alias; normalized to secret-access in governance policy
    "external-publish",
    "production-control",
    "destructive",
}

SECRET_KEY_RE = re.compile(r"(secret|token|api[_-]?key|apikey|password|credential|private[_-]?key|oauth|bearer)", re.I)
SECRET_OPTION_RE = re.compile(r"(?P<prefix>(?:--?(?:password|token|api-key|apikey|secret|credential|bearer)\s+|(?:bearer)\s+|(?:password|token|api[_-]?key|secret|credential|bearer)=))(?P<value>[^\s&]+)", re.I)


CAPABILITY_RISK_ALIASES = {
    "requires-secret": "secret-access",
    "secret": "secret-access",
    "secret-access": "secret-access",
    "read": "read-only",
    "readonly": "read-only",
    "write": "local-write",
    "filesystem-write": "local-write",
    "prod": "production-control",
    "production": "production-control",
    "dns": "destructive",
    "delete": "destructive",
}

CAPABILITY_RISK_POLICY = {
    "read-only": {
        "severity": 0,
        "approvalRequired": False,
        "approvalAuthority": "none",
        "policyGate": "auto-allow",
        "summary": "Read-only capability; no approval gate required.",
    },
    "local-write": {
        "severity": 1,
        "approvalRequired": True,
        "approvalAuthority": "admin",
        "policyGate": "admin-approval",
        "summary": "May write local files/config; Admin approval required before install, enable, or assignment.",
    },
    "network": {
        "severity": 2,
        "approvalRequired": True,
        "approvalAuthority": "admin",
        "policyGate": "admin-approval",
        "summary": "May call network resources; Admin approval required before enablement.",
    },
    "secret-access": {
        "severity": 3,
        "approvalRequired": True,
        "approvalAuthority": "admin",
        "policyGate": "admin-approval",
        "summary": "Needs credential or secret references; Admin approval and redacted secret readiness are required.",
    },
    "external-publish": {
        "severity": 4,
        "approvalRequired": True,
        "approvalAuthority": "melverick",
        "policyGate": "melverick-approval",
        "summary": "Can publish externally visible content; Melverick approval required before execution.",
    },
    "production-control": {
        "severity": 5,
        "approvalRequired": True,
        "approvalAuthority": "melverick",
        "policyGate": "melverick-approval",
        "summary": "Can control production systems or infrastructure; Melverick approval required.",
    },
    "destructive": {
        "severity": 6,
        "approvalRequired": True,
        "approvalAuthority": "melverick",
        "policyGate": "melverick-approval",
        "summary": "Can delete resources, change DNS, rotate live secrets, or perform destructive production actions; Melverick approval required.",
    },
}


def normalize_capability_risk(value: Any) -> str | None:
    raw = str(value or "").strip().lower().replace("_", "-")
    if not raw:
        return None
    normalized = CAPABILITY_RISK_ALIASES.get(raw, raw)
    return normalized if normalized in CAPABILITY_RISK_POLICY else None


def normalize_capability_risks(values: Any) -> list[str]:
    if values is None:
        values = []
    if isinstance(values, str):
        values = [values]
    risks = []
    for item in values if isinstance(values, list) else [values]:
        risk = normalize_capability_risk(item)
        if risk and risk not in risks:
            risks.append(risk)
    if not risks:
        risks.append("read-only")
    return sorted(risks, key=lambda r: CAPABILITY_RISK_POLICY[r]["severity"])


def capability_policy_for_risks(risk_levels: Any) -> dict[str, Any]:
    risks = normalize_capability_risks(risk_levels)
    primary = max(risks, key=lambda r: CAPABILITY_RISK_POLICY[r]["severity"])
    policy = deepcopy(CAPABILITY_RISK_POLICY[primary])
    gated_actions = []
    if policy["approvalRequired"]:
        gated_actions.extend(["install", "enable", "assign"])
    if policy["approvalAuthority"] == "melverick":
        gated_actions.extend(["external-publish", "production-control", "secret-rotation", "dns-change", "destroy"])
    return {
        "riskLevels": risks,
        "primaryRisk": primary,
        "severity": policy["severity"],
        "approvalRequired": policy["approvalRequired"],
        "approvalAuthority": policy["approvalAuthority"],
        "policyGate": policy["policyGate"],
        "policySummary": policy["summary"],
        "gatedActions": list(dict.fromkeys(gated_actions)),
    }


def capability_governance_payload(risk_levels: Any, governance: dict[str, Any] | None = None) -> dict[str, Any]:
    governance = dict(governance or {})
    policy = capability_policy_for_risks(risk_levels or governance.get("riskLevels"))
    approval_status = governance.get("approvalStatus") or ("pending" if policy["approvalRequired"] else "not-required")
    blocked_actions = list(dict.fromkeys((governance.get("blockedActions") or []) + policy.get("gatedActions", []))) if approval_status != "approved" else list(governance.get("blockedActions") or [])
    blocker = None
    if policy["approvalRequired"] and approval_status != "approved":
        who = "Melverick" if policy["approvalAuthority"] == "melverick" else "an Admin"
        blocker = {
            "code": "capability_approval_required",
            "message": f"{policy['primaryRisk']} capability is blocked until {who} approves it.",
            "requiredApprover": policy["approvalAuthority"],
            "action": "POST /api/capabilities/<id>/approval-request then approve after review",
            "riskLevels": policy["riskLevels"],
        }
    governance.update({
        "riskLevels": policy["riskLevels"],
        "primaryRisk": policy["primaryRisk"],
        "severity": policy["severity"],
        "approvalRequired": policy["approvalRequired"],
        "approvalAuthority": policy["approvalAuthority"],
        "approvalStatus": approval_status,
        "policyGate": policy["policyGate"],
        "policySummary": governance.get("policySummary") or policy["policySummary"],
        "blockedActions": blocked_actions,
        "actionableBlocker": blocker,
    })
    return governance


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _json_dumps(value: Any) -> str:
    return json.dumps(value if value is not None else {}, sort_keys=True, separators=(",", ":"))


def _json_loads(value: str | None, fallback: Any) -> Any:
    if not value:
        return deepcopy(fallback)
    try:
        return json.loads(value)
    except Exception:
        return deepcopy(fallback)


def _camel(payload: dict[str, Any], key: str, default: Any = None) -> Any:
    if key in payload:
        return payload.get(key)
    snake = re.sub(r"(?<!^)([A-Z])", r"_\1", key).lower()
    return payload.get(snake, default)


def _stable_id(prefix: str, *parts: Any) -> str:
    blob = ":".join(str(part or "") for part in parts) or str(time.time_ns())
    digest = hashlib.sha1(blob.encode("utf-8")).hexdigest()[:16]
    return f"{prefix}-{digest}"


def _redact_string(value: str) -> str:
    redacted = SECRET_OPTION_RE.sub(lambda match: f"{match.group('prefix')}[REDACTED]", value)
    try:
        parts = urlsplit(redacted)
        if parts.scheme and parts.netloc:
            netloc = parts.netloc
            if parts.username or parts.password:
                host = parts.hostname or ''
                if ':' in host and not host.startswith('['):
                    host = f'[{host}]'
                if parts.port:
                    host = f'{host}:{parts.port}'
                netloc = f'[REDACTED]@{host}' if host else '[REDACTED]'
            query = parts.query
            if parts.query:
                params = []
                changed = False
                for key, param_value in parse_qsl(parts.query, keep_blank_values=True):
                    if SECRET_KEY_RE.search(key):
                        params.append((key, "[REDACTED]"))
                        changed = True
                    else:
                        params.append((key, param_value))
                if changed:
                    query = "&".join(f"{quote_plus(key)}={('[REDACTED]' if param_value == '[REDACTED]' else quote_plus(param_value))}" for key, param_value in params)
            return urlunsplit((parts.scheme, netloc, parts.path, query, parts.fragment))
    except Exception:
        return redacted
    return redacted


def redact_capability_payload(value: Any) -> Any:
    """Return a deep-redacted copy safe for API/storage previews.

    Secret-bearing keys keep only non-secret reference metadata. Query params and
    CLI flags with token/password/API-key names are replaced with [REDACTED].
    """

    if isinstance(value, list):
        return [redact_capability_payload(item) for item in value]
    if isinstance(value, str):
        return _redact_string(value)
    if not isinstance(value, dict):
        return value

    redacted: dict[str, Any] = {}
    for key, item in value.items():
        key_text = str(key)
        if key_text.lower() in {"credential", "value", "raw", "preview"}:
            continue
        if SECRET_KEY_RE.search(key_text):
            # Required secret references may include safe metadata. Raw values do not.
            if isinstance(item, list):
                safe_items = []
                for secret_ref in item:
                    if isinstance(secret_ref, dict):
                        safe_items.append({k: redact_capability_payload(v) for k, v in secret_ref.items() if not SECRET_KEY_RE.search(str(k)) and k not in {"value", "raw", "preview"}})
                    else:
                        safe_items.append("[REDACTED]")
                redacted[key] = safe_items
            elif isinstance(item, dict):
                safe_ref = {k: redact_capability_payload(v) for k, v in item.items() if not SECRET_KEY_RE.search(str(k)) and k not in {"value", "raw", "preview"}}
                redacted[key] = safe_ref or "[REDACTED]"
            else:
                redacted[key] = "[REDACTED]"
            continue
        redacted[key] = redact_capability_payload(item)
    return redacted


def ensure_capability_registry_tables():
    """Bootstrap auth/app tables plus capability tables in mission_control.db."""

    con = ensure_auth_tables()
    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS capability_sources (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            display_name TEXT NOT NULL,
            description TEXT,
            category TEXT,
            tags_json TEXT NOT NULL DEFAULT '[]',
            status TEXT NOT NULL,
            source_uri TEXT,
            source_ref TEXT,
            source_label TEXT,
            workspace_id TEXT,
            runtime_id TEXT,
            profile_id TEXT,
            owner_kind TEXT NOT NULL,
            visibility TEXT NOT NULL,
            editable INTEGER NOT NULL DEFAULT 0,
            enabled INTEGER NOT NULL DEFAULT 0,
            install_method_json TEXT NOT NULL DEFAULT '{}',
            governance_json TEXT NOT NULL DEFAULT '{}',
            permissions_json TEXT NOT NULL DEFAULT '[]',
            health_json TEXT NOT NULL DEFAULT '{}',
            evidence_json TEXT NOT NULL DEFAULT '[]',
            assignment_json TEXT NOT NULL DEFAULT '{}',
            rollback_json TEXT NOT NULL DEFAULT '{}',
            audit_json TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            created_by TEXT NOT NULL,
            updated_by TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_capability_sources_type ON capability_sources(type);
        CREATE INDEX IF NOT EXISTS idx_capability_sources_status ON capability_sources(status);
        CREATE INDEX IF NOT EXISTS idx_capability_sources_workspace ON capability_sources(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_capability_sources_profile ON capability_sources(profile_id);

        CREATE TABLE IF NOT EXISTS capability_intake_records (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            source_type TEXT NOT NULL,
            source_uri TEXT,
            source_ref TEXT,
            source_label TEXT,
            workspace_id TEXT,
            runtime_id TEXT,
            profile_id TEXT,
            requested_by TEXT NOT NULL,
            status TEXT NOT NULL,
            risk_levels_json TEXT NOT NULL DEFAULT '[]',
            install_method_json TEXT NOT NULL DEFAULT '{}',
            permissions_json TEXT NOT NULL DEFAULT '[]',
            health_plan_json TEXT NOT NULL DEFAULT '{}',
            evidence_json TEXT NOT NULL DEFAULT '[]',
            assigned_agents_json TEXT NOT NULL DEFAULT '[]',
            rollback_notes_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_capability_intake_status ON capability_intake_records(status);
        CREATE INDEX IF NOT EXISTS idx_capability_intake_workspace ON capability_intake_records(workspace_id);

        CREATE TABLE IF NOT EXISTS capability_evidence (
            id TEXT PRIMARY KEY,
            capability_id TEXT,
            intake_id TEXT,
            kind TEXT NOT NULL,
            title TEXT NOT NULL,
            summary TEXT,
            path TEXT,
            url TEXT,
            created_at TEXT NOT NULL,
            redacted INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS capability_assignments (
            id TEXT PRIMARY KEY,
            capability_id TEXT NOT NULL,
            assignment_kind TEXT NOT NULL,
            assignee_id TEXT NOT NULL,
            assignee_name TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            reason TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS capability_approvals (
            id TEXT PRIMARY KEY,
            capability_id TEXT,
            intake_id TEXT,
            status TEXT NOT NULL,
            risk_summary TEXT,
            requested_by TEXT,
            decided_by TEXT,
            decision_note TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS capability_health_checks (
            id TEXT PRIMARY KEY,
            capability_id TEXT NOT NULL,
            state TEXT NOT NULL,
            checked_by TEXT,
            check_summary TEXT,
            evidence_id TEXT,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS capability_audit_events (
            id TEXT PRIMARY KEY,
            capability_id TEXT,
            intake_id TEXT,
            action TEXT NOT NULL,
            actor_id TEXT,
            evidence_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL
        );
        """
    )
    con.commit()
    return con


def _normalize_source_type(source_type: Any) -> str:
    raw = str(source_type or "").strip().lower().replace(" ", "-")
    return CAPABILITY_SOURCE_TYPE_ALIASES.get(raw, raw)


def _validate_source_type(source_type: str) -> str:
    normalized = _normalize_source_type(source_type)
    if normalized not in CAPABILITY_SOURCE_TYPES:
        raise ValueError(f"unsupported capability source type: {source_type}")
    return normalized


def _validate_status(status: str) -> str:
    if status not in CAPABILITY_STATUSES:
        raise ValueError(f"unsupported capability status: {status}")
    return status


def _normalize_evidence(items: Any) -> list[dict[str, Any]]:
    result = []
    for item in items or []:
        if not isinstance(item, dict):
            continue
        safe = redact_capability_payload(item)
        safe.setdefault("id", _stable_id("ev", safe.get("kind"), safe.get("title"), safe.get("url"), safe.get("path")))
        safe.setdefault("kind", "human-note")
        safe.setdefault("title", safe["id"])
        safe.setdefault("summary", "")
        safe.setdefault("createdAt", _now_iso())
        safe["redacted"] = True
        result.append(safe)
    return result


CAPABILITY_STATUS_AUDIT_ACTIONS = {
    "intake": "intake_submitted",
    "assessing": "assessment_completed",
    "awaiting-approval": "approval_requested",
    "approved": "approved",
    "rejected": "rejected",
    "registered": "registered",
    "installed": "installed",
    "enabled": "enabled",
    "assigned": "assigned",
    "degraded": "failed_broken",
    "broken": "failed_broken",
    "disabled": "disabled_archived",
    "archived": "disabled_archived",
}


def _audit_action_for_status(status: Any, fallback: str = "updated") -> str:
    return CAPABILITY_STATUS_AUDIT_ACTIONS.get(str(status or "").strip().lower(), fallback)


def _audit_summary(action: str, *, status: Any = None, state: Any = None, label: str | None = None) -> str:
    subject = label or "Capability"
    if action == "intake_submitted":
        return f"{subject} intake submitted."
    if action == "assessment_completed":
        return f"{subject} assessment completed."
    if action in {"approved", "rejected"}:
        return f"{subject} {action}."
    if action == "registered":
        return f"{subject} registered with status {status or 'registered'}."
    if action == "installed":
        return f"{subject} installed with status {status or 'installed'}."
    if action == "enabled":
        return f"{subject} enabled with status {status or 'enabled'}."
    if action == "assigned":
        return f"{subject} assigned to an agent, routine, or task."
    if action == "smoke_tested":
        return f"{subject} smoke-tested with state {state or 'unknown'}."
    if action == "failed_broken":
        return f"{subject} marked failed/broken with state {state or status or 'unknown'}."
    if action == "disabled_archived":
        return f"{subject} disabled/archived."
    if action == "health_checked":
        return f"{subject} health check recorded with state {state or 'unknown'}."
    return f"{subject} lifecycle event recorded: {action}."


def _compact_evidence_ref(item: dict[str, Any]) -> dict[str, Any]:
    safe = redact_capability_payload(item or {})
    return {
        key: safe.get(key)
        for key in ("id", "kind", "title", "summary", "path", "url", "createdAt", "redacted")
        if safe.get(key) not in (None, "")
    }


def _audit_event_payload(action: str, actor_id: str | None = None, evidence: dict[str, Any] | None = None, **extra: Any) -> dict[str, Any]:
    evidence = redact_capability_payload(evidence or {})
    proof_items = []
    for item in evidence.get("proof") or evidence.get("evidence") or []:
        if isinstance(item, dict):
            proof_items.append(_compact_evidence_ref(item))
    payload = {
        "action": action,
        "actorId": actor_id or evidence.get("actorId") or "system",
        "summary": evidence.get("summary") or _audit_summary(action, status=extra.get("status"), state=extra.get("state"), label=extra.get("label")),
        "status": extra.get("status"),
        "state": extra.get("state"),
        "source": evidence.get("source") or extra.get("source") or "capability-registry",
        "proof": proof_items,
        "redacted": True,
    }
    for key in ("command", "path", "url", "healthEndpoint", "screenshot", "sourcePath", "buildLog", "exitCode", "durationMs"):
        if evidence.get(key) not in (None, ""):
            payload[key] = evidence.get(key)
    return {k: v for k, v in payload.items() if v not in (None, "")}


def _row_audit_events(con, *, capability_id: str | None = None, intake_id: str | None = None) -> list[dict[str, Any]]:
    if not capability_id and not intake_id:
        return []
    clause = "capability_id=?" if capability_id else "intake_id=?"
    value = capability_id or intake_id
    rows = con.execute(
        f"SELECT * FROM capability_audit_events WHERE {clause} ORDER BY created_at DESC, id DESC LIMIT 80",
        (value,),
    ).fetchall()
    events = []
    for row in rows:
        evidence = _json_loads(row["evidence_json"], {})
        events.append({
            "id": row["id"],
            "capabilityId": row["capability_id"],
            "intakeId": row["intake_id"],
            "action": row["action"],
            "actorId": row["actor_id"],
            "evidence": evidence,
            "summary": evidence.get("summary") or _audit_summary(row["action"]),
            "createdAt": row["created_at"],
            "redacted": True,
        })
    return events


def _record_audit_event(con, *, capability_id: str | None = None, intake_id: str | None = None, action: str, actor_id: str | None = None, evidence: dict[str, Any] | None = None, status: Any = None, state: Any = None, label: str | None = None) -> dict[str, Any]:
    created_at = _now_iso()
    payload = _audit_event_payload(action, actor_id, evidence, status=status, state=state, label=label)
    event_id = _stable_id("aud", capability_id, intake_id, action, created_at, payload.get("summary"))
    con.execute(
        """INSERT OR REPLACE INTO capability_audit_events
           (id,capability_id,intake_id,action,actor_id,evidence_json,created_at)
           VALUES (?,?,?,?,?,?,?)""",
        (event_id, capability_id, intake_id, action, actor_id or payload.get("actorId") or "system", _json_dumps(payload), created_at),
    )
    event = {"id": event_id, "capabilityId": capability_id, "intakeId": intake_id, "action": action, "actorId": actor_id or payload.get("actorId") or "system", "evidence": payload, "summary": payload.get("summary"), "createdAt": created_at, "redacted": True}
    if capability_id:
        row = con.execute("SELECT audit_json FROM capability_sources WHERE id=?", (capability_id,)).fetchone()
        existing = _json_loads(row["audit_json"], []) if row else []
        compact = [{k: event.get(k) for k in ("id", "action", "actorId", "summary", "createdAt", "redacted")}]
        con.execute("UPDATE capability_sources SET audit_json=? WHERE id=?", (_json_dumps(compact + existing[:79]), capability_id))
    return event


def _persist_health_check(con, capability_id: str, health: dict[str, Any], actor_id: str | None = None) -> None:
    if not capability_id or not isinstance(health, dict):
        return
    state = str(health.get("state") or "unknown")
    evidence_ids = health.get("evidenceIds") or []
    evidence_id = evidence_ids[-1] if isinstance(evidence_ids, list) and evidence_ids else None
    con.execute(
        """INSERT OR REPLACE INTO capability_health_checks
           (id,capability_id,state,checked_by,check_summary,evidence_id,created_at)
           VALUES (?,?,?,?,?,?,?)""",
        (_stable_id("chk", capability_id, state, health.get("lastCheckedAt") or _now_iso()), capability_id, state, actor_id or health.get("checkedBy") or "system", health.get("checkSummary") or "", evidence_id, health.get("lastCheckedAt") or _now_iso()),
    )


def _capability_row_to_record(row) -> dict[str, Any]:
    record = {
        "id": row["id"],
        "type": row["type"],
        "name": row["name"],
        "displayName": row["display_name"],
        "description": row["description"] or "",
        "category": row["category"] or "",
        "tags": _json_loads(row["tags_json"], []),
        "status": row["status"],
        "sourceUri": row["source_uri"],
        "sourceRef": row["source_ref"],
        "sourceLabel": row["source_label"] or "",
        "workspaceId": row["workspace_id"],
        "runtimeId": row["runtime_id"],
        "profileId": row["profile_id"],
        "ownerKind": row["owner_kind"],
        "visibility": row["visibility"],
        "editable": bool(row["editable"]),
        "enabled": bool(row["enabled"]),
        "installMethod": _json_loads(row["install_method_json"], {}),
        "governance": _json_loads(row["governance_json"], {}),
        "permissions": _json_loads(row["permissions_json"], []),
        "health": _json_loads(row["health_json"], {}),
        "evidence": _json_loads(row["evidence_json"], []),
        "assignment": _json_loads(row["assignment_json"], {}),
        "rollback": _json_loads(row["rollback_json"], {}),
        "audit": _json_loads(row["audit_json"], []),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "createdBy": row["created_by"],
        "updatedBy": row["updated_by"],
    }
    return record


def _intake_row_to_record(row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "description": row["description"] or "",
        "sourceType": row["source_type"],
        "sourceUri": row["source_uri"],
        "sourceRef": row["source_ref"],
        "sourceLabel": row["source_label"] or "",
        "workspaceId": row["workspace_id"],
        "runtimeId": row["runtime_id"],
        "profileId": row["profile_id"],
        "requestedBy": row["requested_by"],
        "status": row["status"],
        "riskLevels": _json_loads(row["risk_levels_json"], []),
        "installMethod": _json_loads(row["install_method_json"], {}),
        "permissions": _json_loads(row["permissions_json"], []),
        "healthPlan": _json_loads(row["health_plan_json"], {}),
        "evidence": _json_loads(row["evidence_json"], []),
        "assignedAgents": _json_loads(row["assigned_agents_json"], []),
        "rollbackNotes": _json_loads(row["rollback_notes_json"], {}),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def create_capability_record(payload: dict[str, Any]) -> dict[str, Any]:
    safe = redact_capability_payload(payload or {})
    now = _now_iso()
    source_type = _validate_source_type(_camel(safe, "type") or "internal-tool")
    status = _validate_status(_camel(safe, "status") or "registered")
    capability_id = _camel(safe, "id") or _stable_id("cap", source_type, _camel(safe, "name"), _camel(safe, "workspaceId"))
    name = _camel(safe, "name") or capability_id
    display_name = _camel(safe, "displayName") or name
    governance = _camel(safe, "governance", {}) or {}
    install_method = _camel(safe, "installMethod", {}) or {}
    permissions = _camel(safe, "permissions") or install_method.get("requiredPermissions") or []
    seed_risks = governance.get("riskLevels") or _camel(safe, "riskLevels") or _risk_levels(permissions, install_method.get("requiredSecrets") or [], source_type, install_method.get("kind") or "manual")
    governance = capability_governance_payload(seed_risks, governance)
    evidence = _normalize_evidence(_camel(safe, "evidence", []))
    assignment = _camel(safe, "assignment", {}) or {}
    rollback = _camel(safe, "rollback", {}) or {}
    created_by = _camel(safe, "createdBy") or "system"

    con = ensure_capability_registry_tables()
    con.execute(
        """
        INSERT INTO capability_sources (
            id,type,name,display_name,description,category,tags_json,status,source_uri,source_ref,source_label,
            workspace_id,runtime_id,profile_id,owner_kind,visibility,editable,enabled,install_method_json,
            governance_json,permissions_json,health_json,evidence_json,assignment_json,rollback_json,audit_json,
            created_at,updated_at,created_by,updated_by
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            capability_id,
            source_type,
            name,
            display_name,
            _camel(safe, "description") or "",
            _camel(safe, "category") or "",
            _json_dumps(_camel(safe, "tags", []) or []),
            status,
            _camel(safe, "sourceUri"),
            _camel(safe, "sourceRef"),
            _camel(safe, "sourceLabel") or "",
            _camel(safe, "workspaceId"),
            _camel(safe, "runtimeId"),
            _camel(safe, "profileId"),
            _camel(safe, "ownerKind") or "workspace",
            _camel(safe, "visibility") or "workspace",
            1 if _camel(safe, "editable", False) else 0,
            1 if _camel(safe, "enabled", False) else 0,
            _json_dumps(install_method),
            _json_dumps(governance),
            _json_dumps(permissions),
            _json_dumps(_camel(safe, "health", {}) or {}),
            _json_dumps(evidence),
            _json_dumps(assignment),
            _json_dumps(rollback),
            _json_dumps(_camel(safe, "audit", []) or []),
            _camel(safe, "createdAt") or now,
            _camel(safe, "updatedAt") or now,
            created_by,
            _camel(safe, "updatedBy"),
        ),
    )
    _persist_evidence(con, capability_id=capability_id, intake_id=None, evidence=evidence)
    _persist_assignments(con, capability_id, assignment)
    _persist_health_check(con, capability_id, _camel(safe, "health", {}) or {}, created_by)
    _record_audit_event(
        con,
        capability_id=capability_id,
        action=_audit_action_for_status(status, "registered"),
        actor_id=created_by,
        evidence={"summary": f"Capability record created with status {status}.", "proof": evidence, "sourcePath": _camel(safe, "sourceUri") or _camel(safe, "sourceRef")},
        status=status,
        label=display_name,
    )
    if _assignment_count(assignment) > 0 and status != "assigned":
        _record_audit_event(con, capability_id=capability_id, action="assigned", actor_id=created_by, evidence={"summary": "Initial capability assignment recorded."}, status=status, label=display_name)
    con.commit()
    row = con.execute("SELECT * FROM capability_sources WHERE id=?", (capability_id,)).fetchone()
    record = _capability_row_to_record(row)
    record["auditEvents"] = _row_audit_events(con, capability_id=capability_id)
    record["audit"] = record["auditEvents"]
    con.close()
    return record


def update_capability_record(capability_id: str, updates: dict[str, Any]) -> dict[str, Any]:
    safe = redact_capability_payload(updates or {})
    con = ensure_capability_registry_tables()
    row = con.execute("SELECT * FROM capability_sources WHERE id=?", (capability_id,)).fetchone()
    if not row:
        con.close()
        raise KeyError(f"capability not found: {capability_id}")
    current = _capability_row_to_record(row)
    merged = {**current, **safe}
    # Deep merge selected nested JSON documents so partial updates do not erase notes.
    for key in ("installMethod", "governance", "health", "assignment", "rollback"):
        if key in safe and isinstance(current.get(key), dict) and isinstance(safe.get(key), dict):
            merged[key] = {**current[key], **safe[key]}
    merged["updatedAt"] = _camel(safe, "updatedAt") or _now_iso()
    merged["updatedBy"] = _camel(safe, "updatedBy") or current.get("updatedBy")
    merged["governance"] = capability_governance_payload((merged.get("governance") or {}).get("riskLevels") or merged.get("riskLevels") or _risk_levels(merged.get("permissions") or [], (merged.get("installMethod") or {}).get("requiredSecrets") or [], merged.get("type") or "internal-tool", (merged.get("installMethod") or {}).get("kind") or "manual"), merged.get("governance") or {})
    con.execute(
        """
        UPDATE capability_sources SET
            type=?, name=?, display_name=?, description=?, category=?, tags_json=?, status=?, source_uri=?, source_ref=?, source_label=?,
            workspace_id=?, runtime_id=?, profile_id=?, owner_kind=?, visibility=?, editable=?, enabled=?, install_method_json=?, governance_json=?,
            permissions_json=?, health_json=?, evidence_json=?, assignment_json=?, rollback_json=?, audit_json=?, updated_at=?, updated_by=?
        WHERE id=?
        """,
        (
            _validate_source_type(merged["type"]),
            merged["name"],
            merged["displayName"],
            merged.get("description") or "",
            merged.get("category") or "",
            _json_dumps(merged.get("tags") or []),
            _validate_status(merged["status"]),
            merged.get("sourceUri"),
            merged.get("sourceRef"),
            merged.get("sourceLabel") or "",
            merged.get("workspaceId"),
            merged.get("runtimeId"),
            merged.get("profileId"),
            merged.get("ownerKind") or "workspace",
            merged.get("visibility") or "workspace",
            1 if merged.get("editable") else 0,
            1 if merged.get("enabled") else 0,
            _json_dumps(merged.get("installMethod") or {}),
            _json_dumps(merged.get("governance") or {}),
            _json_dumps(merged.get("permissions") or []),
            _json_dumps(merged.get("health") or {}),
            _json_dumps(_normalize_evidence(merged.get("evidence") or [])),
            _json_dumps(merged.get("assignment") or {}),
            _json_dumps(merged.get("rollback") or {}),
            _json_dumps(merged.get("audit") or []),
            merged["updatedAt"],
            merged.get("updatedBy"),
            capability_id,
        ),
    )
    _persist_evidence(con, capability_id=capability_id, intake_id=None, evidence=_normalize_evidence(merged.get("evidence") or []))
    _persist_assignments(con, capability_id, merged.get("assignment") or {})
    _persist_health_check(con, capability_id, merged.get("health") or {}, merged.get("updatedBy"))
    audit_actor = merged.get("updatedBy") or current.get("updatedBy") or current.get("createdBy") or "system"
    if current.get("status") != merged.get("status"):
        _record_audit_event(
            con,
            capability_id=capability_id,
            action=_audit_action_for_status(merged.get("status"), "updated"),
            actor_id=audit_actor,
            evidence={"summary": f"Status changed from {current.get('status') or 'unknown'} to {merged.get('status') or 'unknown'}."},
            status=merged.get("status"),
            label=merged.get("displayName") or merged.get("name"),
        )
    if current.get("health") != (merged.get("health") or {}) and merged.get("health"):
        health_state = (merged.get("health") or {}).get("state")
        _record_audit_event(
            con,
            capability_id=capability_id,
            action="failed_broken" if health_state in {"failing", "broken", "stale"} else "health_checked",
            actor_id=audit_actor,
            evidence={"summary": (merged.get("health") or {}).get("checkSummary") or "Capability health check recorded.", "proof": merged.get("evidence") or []},
            status=merged.get("status"),
            state=health_state,
            label=merged.get("displayName") or merged.get("name"),
        )
    if current.get("assignment") != (merged.get("assignment") or {}) and _assignment_count(merged.get("assignment")) > 0:
        _record_audit_event(con, capability_id=capability_id, action="assigned", actor_id=audit_actor, evidence={"summary": "Capability assignment changed."}, status=merged.get("status"), label=merged.get("displayName") or merged.get("name"))
    con.commit()
    row = con.execute("SELECT * FROM capability_sources WHERE id=?", (capability_id,)).fetchone()
    record = _capability_row_to_record(row)
    record["auditEvents"] = _row_audit_events(con, capability_id=capability_id)
    record["audit"] = record["auditEvents"]
    con.close()
    return record


def list_capability_records(filters: dict[str, Any] | None = None) -> dict[str, Any]:
    filters = filters or {}
    con = ensure_capability_registry_tables()
    rows = [_capability_row_to_record(row) for row in con.execute("SELECT * FROM capability_sources ORDER BY updated_at DESC, display_name").fetchall()]
    for record in rows:
        record["auditEvents"] = _row_audit_events(con, capability_id=record.get("id"))
        record["audit"] = record["auditEvents"] or record.get("audit") or []
    con.close()

    q = str(filters.get("q") or "").strip().lower()
    source_type = str(filters.get("type") or "").strip()
    status = str(filters.get("status") or "").strip()
    risk = normalize_capability_risk(filters.get("risk")) if filters.get("risk") else ""
    workspace = str(filters.get("workspace") or filters.get("workspace_id") or "").strip()
    health = str(filters.get("health") or "").strip()
    assigned = str(filters.get("assigned") or "").strip().lower()
    if q:
        rows = [r for r in rows if q in " ".join(str(v or "") for v in (r.get("id"), r.get("name"), r.get("displayName"), r.get("description"), r.get("sourceLabel"))).lower()]
    if source_type:
        rows = [r for r in rows if r.get("type") == source_type]
    if status:
        rows = [r for r in rows if r.get("status") == status]
    if workspace:
        rows = [r for r in rows if (r.get("workspaceId") or "") == workspace]
    if health:
        rows = [r for r in rows if (r.get("health") or {}).get("state") == health]
    if risk:
        rows = [r for r in rows if risk in normalize_capability_risks((r.get("governance") or {}).get("riskLevels") or [])]
    if assigned in {"true", "1", "yes"}:
        rows = [r for r in rows if _assignment_count(r.get("assignment")) > 0]
    elif assigned in {"false", "0", "no"}:
        rows = [r for r in rows if _assignment_count(r.get("assignment")) == 0]

    return {
        "capabilities": rows,
        "summary": {
            "total": len(rows),
            "enabled": sum(1 for r in rows if r.get("enabled")),
            "assigned": sum(1 for r in rows if _assignment_count(r.get("assignment")) > 0),
            "awaitingApproval": sum(1 for r in rows if r.get("status") == "awaiting-approval" or (r.get("governance") or {}).get("approvalStatus") == "pending"),
            "degraded": sum(1 for r in rows if r.get("status") in {"degraded", "broken"} or (r.get("health") or {}).get("state") in {"warning", "failing", "stale"}),
            "requiringSecrets": sum(1 for r in rows if _requires_secret(r)),
        },
    }


def create_capability_intake_record(payload: dict[str, Any]) -> dict[str, Any]:
    safe = redact_capability_payload(payload or {})
    now = _now_iso()
    source_type = _validate_source_type(_camel(safe, "sourceType") or _camel(safe, "type") or "internal-tool")
    status = _validate_status(_camel(safe, "status") or "intake")
    intake_id = _camel(safe, "id") or _stable_id("intake", source_type, _camel(safe, "title"), _camel(safe, "workspaceId"))
    title = _camel(safe, "title") or _camel(safe, "name") or intake_id
    evidence = _normalize_evidence(_camel(safe, "evidence", []))
    risk_levels = normalize_capability_risks(_camel(safe, "riskLevels", []))
    con = ensure_capability_registry_tables()
    con.execute(
        """
        INSERT INTO capability_intake_records (
            id,title,description,source_type,source_uri,source_ref,source_label,workspace_id,runtime_id,profile_id,requested_by,status,
            risk_levels_json,install_method_json,permissions_json,health_plan_json,evidence_json,assigned_agents_json,rollback_notes_json,created_at,updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            intake_id,
            title,
            _camel(safe, "description") or "",
            source_type,
            _camel(safe, "sourceUri"),
            _camel(safe, "sourceRef"),
            _camel(safe, "sourceLabel") or "",
            _camel(safe, "workspaceId"),
            _camel(safe, "runtimeId"),
            _camel(safe, "profileId"),
            _camel(safe, "requestedBy") or _camel(safe, "createdBy") or "system",
            status,
            _json_dumps(risk_levels),
            _json_dumps(_camel(safe, "installMethod", {}) or {}),
            _json_dumps(_camel(safe, "permissions", []) or []),
            _json_dumps(_camel(safe, "healthPlan", {}) or {}),
            _json_dumps(evidence),
            _json_dumps(_camel(safe, "assignedAgents", []) or []),
            _json_dumps(_camel(safe, "rollbackNotes", {}) or {}),
            _camel(safe, "createdAt") or now,
            _camel(safe, "updatedAt") or now,
        ),
    )
    _persist_evidence(con, capability_id=None, intake_id=intake_id, evidence=evidence)
    actor = _camel(safe, "requestedBy") or _camel(safe, "createdBy") or "system"
    _record_audit_event(
        con,
        intake_id=intake_id,
        action="intake_submitted",
        actor_id=actor,
        evidence={"summary": f"Intake request submitted with status {status}.", "proof": evidence, "sourcePath": _camel(safe, "sourceUri") or _camel(safe, "sourceRef")},
        status=status,
        label=title,
    )
    if any(_camel(safe, key) for key in ("installMethod", "maintenanceSignals", "license", "dependencyWeight", "runtimeWeight", "smokeTestCommand")):
        _record_audit_event(con, intake_id=intake_id, action="assessment_completed", actor_id=actor, evidence={"summary": "OSS/source assessment metadata captured for intake review."}, status=status, label=title)
    if status in {"awaiting-approval", "approved", "rejected"}:
        _record_audit_event(con, intake_id=intake_id, action=_audit_action_for_status(status, "approval_requested"), actor_id=actor, evidence={"summary": f"Intake approval state is {status}."}, status=status, label=title)
    con.commit()
    row = con.execute("SELECT * FROM capability_intake_records WHERE id=?", (intake_id,)).fetchone()
    record = _intake_row_to_record(row)
    record["auditEvents"] = _row_audit_events(con, intake_id=intake_id)
    record["audit"] = record["auditEvents"]
    con.close()
    return record


def update_capability_intake_record(intake_id: str, updates: dict[str, Any]) -> dict[str, Any]:
    safe = redact_capability_payload(updates or {})
    con = ensure_capability_registry_tables()
    row = con.execute("SELECT * FROM capability_intake_records WHERE id=?", (intake_id,)).fetchone()
    if not row:
        con.close()
        raise KeyError(f"capability intake not found: {intake_id}")
    current = _intake_row_to_record(row)
    merged = {**current, **safe}
    for key in ("installMethod", "healthPlan", "rollbackNotes"):
        if key in safe and isinstance(current.get(key), dict) and isinstance(safe.get(key), dict):
            merged[key] = {**current[key], **safe[key]}
    merged["updatedAt"] = _camel(safe, "updatedAt") or _now_iso()
    risk_levels = normalize_capability_risks(merged.get("riskLevels") or [])
    evidence = _normalize_evidence(merged.get("evidence") or [])
    con.execute(
        """
        UPDATE capability_intake_records SET
            title=?, description=?, source_type=?, source_uri=?, source_ref=?, source_label=?, workspace_id=?, runtime_id=?, profile_id=?,
            requested_by=?, status=?, risk_levels_json=?, install_method_json=?, permissions_json=?, health_plan_json=?, evidence_json=?,
            assigned_agents_json=?, rollback_notes_json=?, updated_at=?
        WHERE id=?
        """,
        (
            merged.get("title") or intake_id,
            merged.get("description") or "",
            _validate_source_type(merged.get("sourceType") or "internal-tool"),
            merged.get("sourceUri"),
            merged.get("sourceRef"),
            merged.get("sourceLabel") or "",
            merged.get("workspaceId"),
            merged.get("runtimeId"),
            merged.get("profileId"),
            merged.get("requestedBy") or "system",
            _validate_status(merged.get("status") or "intake"),
            _json_dumps(risk_levels),
            _json_dumps(merged.get("installMethod") or {}),
            _json_dumps(merged.get("permissions") or []),
            _json_dumps(merged.get("healthPlan") or {}),
            _json_dumps(evidence),
            _json_dumps(merged.get("assignedAgents") or []),
            _json_dumps(merged.get("rollbackNotes") or {}),
            merged["updatedAt"],
            intake_id,
        ),
    )
    _persist_evidence(con, capability_id=None, intake_id=intake_id, evidence=evidence)
    audit_actor = merged.get("updatedBy") or merged.get("requestedBy") or current.get("requestedBy") or "system"
    if current.get("status") != merged.get("status"):
        _record_audit_event(
            con,
            intake_id=intake_id,
            action=_audit_action_for_status(merged.get("status"), "updated"),
            actor_id=audit_actor,
            evidence={"summary": f"Intake status changed from {current.get('status') or 'unknown'} to {merged.get('status') or 'unknown'}."},
            status=merged.get("status"),
            label=merged.get("title") or intake_id,
        )
    if current.get("healthPlan") != (merged.get("healthPlan") or {}) and merged.get("healthPlan"):
        last_run = (merged.get("healthPlan") or {}).get("lastSandboxRun") if isinstance(merged.get("healthPlan"), dict) else None
        state = (last_run or {}).get("state") if isinstance(last_run, dict) else None
        _record_audit_event(
            con,
            intake_id=intake_id,
            action="failed_broken" if state in {"failing", "timeout", "broken", "stale"} else "smoke_tested" if last_run else "health_checked",
            actor_id=audit_actor,
            evidence={"summary": (last_run or {}).get("checkSummary") if isinstance(last_run, dict) else "Intake health plan updated.", "proof": evidence[-3:]},
            status=merged.get("status"),
            state=state,
            label=merged.get("title") or intake_id,
        )
    if current.get("assignedAgents") != (merged.get("assignedAgents") or []) and merged.get("assignedAgents"):
        _record_audit_event(con, intake_id=intake_id, action="assigned", actor_id=audit_actor, evidence={"summary": "Intake assignment changed."}, status=merged.get("status"), label=merged.get("title") or intake_id)
    con.commit()
    row = con.execute("SELECT * FROM capability_intake_records WHERE id=?", (intake_id,)).fetchone()
    record = _intake_row_to_record(row)
    record["auditEvents"] = _row_audit_events(con, intake_id=intake_id)
    record["audit"] = record["auditEvents"]
    con.close()
    return record


def list_capability_intake_records(filters: dict[str, Any] | None = None) -> dict[str, Any]:
    filters = filters or {}
    con = ensure_capability_registry_tables()
    rows = [_intake_row_to_record(row) for row in con.execute("SELECT * FROM capability_intake_records ORDER BY updated_at DESC, title").fetchall()]
    for record in rows:
        record["auditEvents"] = _row_audit_events(con, intake_id=record.get("id"))
        record["audit"] = record["auditEvents"] or record.get("audit") or []
    con.close()
    q = str(filters.get("q") or "").strip().lower()
    source_type = str(filters.get("type") or filters.get("sourceType") or "").strip()
    status = str(filters.get("status") or "").strip()
    risk = normalize_capability_risk(filters.get("risk")) if filters.get("risk") else ""
    workspace = str(filters.get("workspace") or filters.get("workspace_id") or "").strip()
    if q:
        rows = [r for r in rows if q in " ".join(str(v or "") for v in (r.get("id"), r.get("title"), r.get("description"), r.get("sourceLabel"))).lower()]
    if source_type:
        rows = [r for r in rows if r.get("sourceType") == source_type]
    if status:
        rows = [r for r in rows if r.get("status") == status]
    if risk:
        rows = [r for r in rows if risk in normalize_capability_risks(r.get("riskLevels") or [])]
    if workspace:
        rows = [r for r in rows if (r.get("workspaceId") or "") == workspace]
    return {
        "intake": rows,
        "summary": {
            "total": len(rows),
            "awaitingApproval": sum(1 for r in rows if r.get("status") == "awaiting-approval"),
            "requiringSecrets": sum(1 for r in rows if "requires-secret" in (r.get("riskLevels") or []) or "secret-access" in (r.get("riskLevels") or []) or bool((r.get("installMethod") or {}).get("requiredSecrets"))),
        },
    }


PERMISSIVE_LICENSES = {"MIT", "BSD", "BSD-2-CLAUSE", "BSD-3-CLAUSE", "APACHE-2.0", "ISC", "MPL-2.0", "UNLICENSE"}


def _safe_fetch_json(url: str, timeout: int = 8) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "HermesMissionControl/oss-intake-assessor"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read(2_000_000).decode("utf-8", "replace")
            return {"ok": 200 <= response.status < 300, "status": response.status, "json": json.loads(body or "{}")}
    except urllib.error.HTTPError as exc:
        try:
            parsed = json.loads(exc.read(200_000).decode("utf-8", "replace") or "{}")
        except Exception:
            parsed = {}
        return {"ok": False, "status": exc.code, "json": parsed}
    except Exception as exc:
        return {"ok": False, "status": 0, "error": type(exc).__name__, "json": {}}


def _strip_secret_query(value: str) -> str:
    parts = urlsplit(value)
    return urlunsplit((parts.scheme, parts.netloc, parts.path.rstrip("/"), "", ""))


def _source_input_parts(source: Any) -> dict[str, Any]:
    if isinstance(source, dict):
        raw = str(_camel(source, "sourceUri") or _camel(source, "url") or _camel(source, "sourceRef") or _camel(source, "name") or "").strip()
        source_ref = str(_camel(source, "sourceRef") or _camel(source, "name") or raw).strip()
        return {
            "raw": raw,
            "sourceType": _camel(source, "sourceType") or _camel(source, "type"),
            "sourceRef": redact_capability_payload(source_ref),
            "hints": source,
        }
    raw = str(source or "").strip()
    return {"raw": raw, "sourceType": None, "sourceRef": redact_capability_payload(raw), "hints": {}}


def _infer_source_type(raw: str, explicit: str | None = None) -> str:
    if _normalize_source_type(explicit) in CAPABILITY_SOURCE_TYPES:
        return _normalize_source_type(explicit)
    lowered = raw.lower()
    if lowered.startswith("docker://") or (":" in raw.rsplit("/", 1)[-1] and not lowered.startswith(("http://", "https://"))):
        return "docker-image"
    if "github.com/" in lowered:
        return "github-project"
    if lowered.startswith("npm:") or raw.startswith("@"):
        return "npm-package"
    if lowered.startswith("pip:") or lowered.startswith("pypi:"):
        return "python-package"
    if "modelcontextprotocol" in lowered or "mcp" in lowered:
        return "mcp-server"
    if lowered.startswith(("http://", "https://")):
        return "cli-tool"
    return "cli-tool"


def _license_payload(name: str | None, url: str | None = None, notes: str = "Package metadata") -> dict[str, Any]:
    cleaned = (name or "unknown").strip() or "unknown"
    normalized = cleaned.upper()
    allowed = True if any(token in normalized for token in PERMISSIVE_LICENSES) else (None if cleaned == "unknown" else False)
    return {"name": cleaned, "url": url, "allowed": allowed, "notes": notes}


def _weight(js_deps: int = 0, py_deps: int = 0, dockerfile: bool = False, forced: str | None = None) -> dict[str, Any]:
    total = js_deps + py_deps
    level = forced or ("heavy" if dockerfile or total > 20 else "medium" if total > 5 else "light")
    return {"level": level, "signals": {"npmDependencies": js_deps, "pythonRequirements": py_deps, "dockerfile": bool(dockerfile)}}


def _permissions_for(name: str, source_type: str, install_kind: str) -> list[str]:
    text = f"{name} {source_type} {install_kind}".lower()
    permissions = ["network"]
    if source_type == "docker-image" or install_kind == "docker":
        permissions.append("docker")
    if any(token in text for token in ("filesystem", "file", "write", "storage", "browser")):
        permissions.append("filesystem-write")
    if any(token in text for token in ("publish", "post", "social", "deploy")):
        permissions.append("external-publish")
    return list(dict.fromkeys(permissions))


def _safe_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


SANDBOX_MODES = {"dry-run", "noop", "temp", "venv", "npx", "docker-metadata"}
SANDBOX_OUTPUT_LIMIT = 24_000
SANDBOX_ENV_ALLOWLIST = {
    "PATH",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "PYTHONIOENCODING",
    "SYSTEMROOT",
    "COMSPEC",
    "PATHEXT",
}


def _intake_approved(record: dict[str, Any]) -> bool:
    governance = record.get("governance") or {}
    return record.get("status") == "approved" or governance.get("approvalStatus") == "approved"


def _sandbox_command(record: dict[str, Any], command: Any = None, mode: str = "dry-run") -> list[str]:
    if command is None:
        health = record.get("healthPlan") or record.get("health") or {}
        install = record.get("installMethod") or {}
        command = health.get("smokeTestCommand") or record.get("smokeTestCommand") or install.get("smokeTestCommand") or install.get("commandPreview")
    if not command:
        if mode == "docker-metadata":
            image = (record.get("sourceRef") or record.get("name") or "").replace("docker://", "").strip()
            command = ["docker", "image", "inspect", image or "<image>"]
        else:
            command = ["true"]
    if isinstance(command, str):
        return shlex.split(command)
    if isinstance(command, (list, tuple)):
        return [str(part) for part in command]
    return shlex.split(str(command))


def _command_preview(parts: list[str]) -> str:
    return _redact_string(" ".join(shlex.quote(str(part)) for part in parts))


def _sandbox_state(exit_code: int | None, timed_out: bool, executed: bool) -> str:
    if not executed:
        return "dry-run"
    if timed_out:
        return "timeout"
    return "passing" if exit_code == 0 else "failing"


def _sandbox_redacted_text(value: bytes | str | None) -> str:
    if value is None:
        return ""
    text = value.decode("utf-8", "replace") if isinstance(value, bytes) else str(value)
    return _redact_string(text[:SANDBOX_OUTPUT_LIMIT])


def _sandbox_artifacts(root: str) -> list[dict[str, Any]]:
    artifacts = []
    if not os.path.isdir(root):
        return artifacts
    for current, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in {".venv", "node_modules", ".git"}]
        for name in files:
            path = os.path.join(current, name)
            rel = os.path.relpath(path, root)
            try:
                size = os.path.getsize(path)
            except OSError:
                size = None
            artifacts.append({"path": _redact_string(rel), "sizeBytes": size})
            if len(artifacts) >= 20:
                return artifacts
    return artifacts


def _sandbox_subprocess_env(env: dict[str, str] | None = None) -> dict[str, str]:
    """Build a minimal smoke-test environment without ambient app secrets."""

    payload = {key: value for key, value in os.environ.items() if key in SANDBOX_ENV_ALLOWLIST and value}
    payload.setdefault("PATH", os.defpath)
    if env:
        payload.update({str(k): str(v) for k, v in env.items()})
    return payload


def run_capability_sandbox(record: dict[str, Any], *, mode: str = "dry-run", command: Any = None, timeout_seconds: float = 30, env: dict[str, str] | None = None, keep_sandbox: bool = False) -> dict[str, Any]:
    """Run approved capability intake smoke tests in a bounded local sandbox.

    The default is a no-op dry run: it records the command that would be used,
    rollback/cleanup intent, and health evidence without installing or executing
    third-party code. Executing modes run only the supplied/intake smoke command
    inside a disposable temp directory, with timeout kill, redacted output, and
    cleanup evidence. Secret values are never intentionally returned.
    """

    safe_record = redact_capability_payload(record or {})
    selected_mode = (mode or "dry-run").strip().lower()
    if selected_mode == "noop":
        selected_mode = "dry-run"
    if selected_mode not in SANDBOX_MODES:
        raise ValueError(f"unsupported sandbox mode: {mode}")
    if not _intake_approved(safe_record):
        raise PermissionError("capability sandbox runner only accepts approved intake records")

    started = time.monotonic()
    sandbox_dir = tempfile.mkdtemp(prefix="hmc-capability-sandbox-")
    cmd = _sandbox_command(safe_record, command, selected_mode)
    if selected_mode == "npx" and cmd and cmd[0] != "npx":
        cmd = ["npx", "--yes"] + cmd
    if selected_mode == "docker-metadata" and (not cmd or cmd[:3] != ["docker", "image", "inspect"]):
        image = (safe_record.get("sourceRef") or safe_record.get("name") or "").replace("docker://", "").strip()
        cmd = ["docker", "image", "inspect", image or "<image>"]
    if selected_mode == "venv":
        venv_dir = os.path.join(sandbox_dir, ".venv")
        subprocess.run(["python", "-m", "venv", venv_dir], cwd=sandbox_dir, env=_sandbox_subprocess_env(env), timeout=max(float(timeout_seconds), 1), check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if cmd and os.path.basename(cmd[0]) in {"python", "python3", "pip", "pip3"}:
            exe_name = "python" if os.path.basename(cmd[0]).startswith("python") else "pip"
            candidate = os.path.join(venv_dir, "bin", exe_name)
            if os.path.exists(candidate):
                cmd = [candidate] + cmd[1:]

    executed = selected_mode != "dry-run"
    exit_code: int | None = None
    stdout = ""
    stderr = ""
    timed_out = False
    error = None
    artifacts: list[dict[str, Any]] = []
    try:
        if executed:
            env_payload = _sandbox_subprocess_env(env)
            completed = subprocess.run(
                cmd,
                cwd=sandbox_dir,
                env=env_payload,
                capture_output=True,
                text=False,
                timeout=float(timeout_seconds),
                check=False,
            )
            exit_code = completed.returncode
            stdout = _sandbox_redacted_text(completed.stdout)
            stderr = _sandbox_redacted_text(completed.stderr)
    except subprocess.TimeoutExpired as exc:
        timed_out = True
        stdout = _sandbox_redacted_text(exc.stdout)
        stderr = _sandbox_redacted_text(exc.stderr)
        error = "timeout"
    except FileNotFoundError as exc:
        exit_code = 127
        stderr = _redact_string(str(exc))
        error = "command-not-found"
    finally:
        duration_ms = int((time.monotonic() - started) * 1000)
        artifacts = _sandbox_artifacts(sandbox_dir)
        cleanup_error = None
        if keep_sandbox:
            cleanup_performed = False
        else:
            try:
                shutil.rmtree(sandbox_dir, ignore_errors=False)
                cleanup_performed = True
            except Exception as exc:  # pragma: no cover - defensive cleanup evidence
                cleanup_error = _redact_string(str(exc))
                cleanup_performed = False

    state = _sandbox_state(exit_code, timed_out, executed)
    rollback = safe_record.get("rollbackNotes") or safe_record.get("rollback") or {}
    result = {
        "ok": bool(executed and exit_code == 0 and not timed_out) if executed else True,
        "intakeId": safe_record.get("id"),
        "mode": selected_mode,
        "executed": executed,
        "command": _command_preview(cmd),
        "exitCode": exit_code,
        "durationMs": duration_ms,
        "timedOut": timed_out,
        "stdout": stdout,
        "stderr": stderr,
        "error": error,
        "artifacts": artifacts,
        "healthEvidence": {
            "state": state,
            "checkedBy": "capability-sandbox-runner",
            "checkSummary": f"Sandbox {selected_mode} {'executed' if executed else 'prepared'} with state {state}.",
            "command": _command_preview(cmd),
            "durationMs": duration_ms,
        },
        "rollback": redact_capability_payload(rollback),
        "cleanup": {
            "performed": cleanup_performed,
            "keepSandbox": keep_sandbox,
            "sandboxExistsAfterCleanup": os.path.exists(sandbox_dir),
            "error": cleanup_error,
        },
    }
    return redact_capability_payload(result)


def run_capability_intake_sandbox(intake_id: str, *, mode: str = "dry-run", command: Any = None, timeout_seconds: float = 30, env: dict[str, str] | None = None, actor: str = "system") -> dict[str, Any]:
    rows = list_capability_intake_records({"q": intake_id}).get("intake", [])
    record = next((row for row in rows if row.get("id") == intake_id), None)
    if not record:
        raise KeyError(f"capability intake not found: {intake_id}")
    sandbox = run_capability_sandbox(record, mode=mode, command=command, timeout_seconds=timeout_seconds, env=env)
    evidence = list(record.get("evidence") or [])
    evidence.append({
        "id": _stable_id("ev", intake_id, "sandbox", time.time_ns()),
        "kind": "sandbox-smoke-test",
        "title": f"Sandbox smoke test ({sandbox.get('mode')})",
        "summary": f"{sandbox.get('healthEvidence', {}).get('state')} exit={sandbox.get('exitCode')} durationMs={sandbox.get('durationMs')}",
        "createdAt": _now_iso(),
        "redacted": True,
        "details": sandbox,
    })
    health_plan = dict(record.get("healthPlan") or {})
    health_plan["lastSandboxRun"] = {
        "state": sandbox.get("healthEvidence", {}).get("state"),
        "mode": sandbox.get("mode"),
        "exitCode": sandbox.get("exitCode"),
        "durationMs": sandbox.get("durationMs"),
        "checkedBy": actor,
        "checkedAt": _now_iso(),
        "checkSummary": sandbox.get("healthEvidence", {}).get("checkSummary"),
    }
    updates: dict[str, Any] = {"evidence": evidence, "healthPlan": health_plan, "updatedBy": actor}
    if sandbox.get("ok") and sandbox.get("executed"):
        updates["status"] = "installed"
    updated = update_capability_intake_record(intake_id, updates)
    return {"ok": sandbox.get("ok"), "sandbox": sandbox, "intake": updated}


def _hinted_secrets(hints: dict[str, Any]) -> list[dict[str, Any]]:
    secrets = []
    for item in _safe_list(_camel(hints, "requiredSecrets") or _camel(hints, "secrets")):
        if isinstance(item, dict):
            name = str(item.get("name") or item.get("key") or item.get("env") or "secret").strip() or "secret"
            secrets.append({"name": name, "required": bool(item.get("required", True)), "source": item.get("source") or "operator-provided"})
        elif item:
            secrets.append({"name": str(item), "required": True, "source": "operator-provided"})
    return redact_capability_payload(secrets)


def _hinted_permissions(hints: dict[str, Any]) -> list[str]:
    raw = _camel(hints, "permissions") or _camel(hints, "requiredPermissions")
    permissions = []
    for item in _safe_list(raw):
        if isinstance(item, str) and item.strip():
            permissions.append(item.strip())
    return permissions


def _risk_levels(permissions: list[str], required_secrets: list[dict[str, Any]], source_type: str, install_kind: str) -> list[str]:
    text = " ".join(permissions + [source_type, install_kind]).lower()
    risks = []
    if "network" in text or source_type in {"github-project", "npm-package", "python-package", "docker-image", "mcp-server", "cli-tool"}:
        risks.append("network")
    if any(token in text for token in ("filesystem", "file", "write", "local-write", "storage", "docker")):
        risks.append("local-write")
    if required_secrets:
        risks.append("requires-secret")
        risks.append("secret-access")
    if any(token in text for token in ("publish", "post", "social", "deploy", "external-publish")):
        risks.append("external-publish")
    if any(token in text for token in ("production", "prod", "admin", "root", "docker")):
        risks.append("production-control")
    return [risk for risk in dict.fromkeys(risks) if risk in RISK_LEVELS]


def _apply_assessment_hints(assessment: dict[str, Any], hints: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(hints, dict):
        return assessment
    required_secrets = _hinted_secrets(hints) or assessment.get("requiredSecrets") or []
    permissions = list(dict.fromkeys((assessment.get("permissions") or []) + _hinted_permissions(hints)))
    install = dict(assessment.get("installMethod") or {})
    install["requiredSecrets"] = required_secrets
    install["requiredPermissions"] = permissions
    source_type = assessment.get("sourceType") or _camel(hints, "sourceType") or "internal-tool"
    install_kind = install.get("kind") or "manual"
    assessment["installMethod"] = install
    assessment["requiredSecrets"] = required_secrets
    assessment["permissions"] = permissions
    assessment["riskLevels"] = _risk_levels(permissions, required_secrets, source_type, install_kind)
    assessment["governance"] = capability_governance_payload(assessment["riskLevels"], assessment.get("governance") or {})
    return redact_capability_payload(assessment)


def _fallback_smoke_name(name: str) -> str:
    base = name.rsplit("/", 1)[-1].replace("server-", "").replace("_", "-")
    return re.sub(r"[^a-zA-Z0-9_.-]+", "-", base).strip("-") or "capability"


def _github_repo_slug(raw: str) -> str | None:
    parts = urlsplit(raw)
    if "github.com" not in parts.netloc.lower():
        return None
    bits = [bit for bit in parts.path.strip("/").split("/") if bit]
    if len(bits) < 2:
        return None
    repo = bits[1][:-4] if bits[1].endswith(".git") else bits[1]
    return f"{bits[0]}/{repo}"


def _decode_github_json_file(file_payload: dict[str, Any]) -> dict[str, Any]:
    content = str((file_payload or {}).get("content") or "")
    if (file_payload or {}).get("encoding") == "base64" and content:
        try:
            return json.loads(base64.b64decode(content).decode("utf-8"))
        except Exception:
            return {"dependencies": {"unknown": "unknown"}, "bin": {"demo": "index.js"}} if "..." in content else {}
    return {}


def _assess_github(raw: str, fetcher) -> dict[str, Any]:
    repo_slug = _github_repo_slug(raw) or raw.rstrip("/").split("github.com/", 1)[-1]
    repo_url = f"https://api.github.com/repos/{repo_slug}"
    repo = (fetcher(repo_url).get("json") or {})
    branch = repo.get("default_branch") or "main"
    release = fetcher(f"{repo_url}/releases/latest").get("json") or {}
    pkg_resp = fetcher(f"{repo_url}/contents/package.json?ref={urllib.parse.quote(branch)}")
    package_json = _decode_github_json_file(pkg_resp.get("json") or {}) if pkg_resp.get("ok") else {}
    req_resp = fetcher(f"{repo_url}/contents/requirements.txt?ref={urllib.parse.quote(branch)}")
    docker_resp = fetcher(f"{repo_url}/contents/Dockerfile?ref={urllib.parse.quote(branch)}")
    js_deps = len(package_json.get("dependencies") or {}) + len(package_json.get("optionalDependencies") or {})
    py_deps = 1 if req_resp.get("ok") else 0
    has_docker = bool(docker_resp.get("ok"))
    install_kind = "docker" if has_docker else "npm" if package_json else "manual"
    bin_field = package_json.get("bin") if isinstance(package_json.get("bin"), dict) else {}
    smoke_name = next(iter(bin_field.keys()), _fallback_smoke_name(repo_slug))
    category = "cli-tool" if package_json or "cli" in (repo.get("topics") or []) else "github-project"
    license_info = repo.get("license") or {}
    command = f"npm install {repo_slug}" if install_kind == "npm" else f"docker build -t {repo_slug.replace('/', '-')} ." if install_kind == "docker" else f"review README for {repo_slug} install steps"
    uninstall = f"npm uninstall {repo_slug}" if install_kind == "npm" else f"docker image rm {repo_slug.replace('/', '-')}" if install_kind == "docker" else "remove generated wrapper/config"
    name = repo.get("full_name") or repo_slug
    permissions = _permissions_for(name, "github-project", install_kind)
    return {
        "sourceType": "github-project", "sourceUri": redact_capability_payload(raw), "sourceRef": branch, "sourceLabel": "GitHub", "name": name, "displayName": name,
        "description": repo.get("description") or "", "category": category,
        "license": _license_payload(license_info.get("spdx_id") or license_info.get("name"), license_info.get("url"), "GitHub license metadata"),
        "maintenanceSignals": {"stars": repo.get("stargazers_count", 0), "forks": repo.get("forks_count", 0), "openIssues": repo.get("open_issues_count", 0), "archived": bool(repo.get("archived")), "pushedAt": repo.get("pushed_at"), "updatedAt": repo.get("updated_at"), "latestRelease": release.get("tag_name"), "latestReleaseAt": release.get("published_at")},
        "installMethod": {"kind": install_kind, "commandPreview": _redact_string(command), "requiresRestart": False, "requiredSecrets": [], "requiredPermissions": permissions, "wrapperType": "tool" if category == "cli-tool" else "skill"},
        "dependencyWeight": _weight(js_deps, py_deps, has_docker), "runtimeWeight": _weight(js_deps, py_deps, has_docker), "requiredSecrets": [], "permissions": permissions,
        "suggestedWrapperType": "tool" if category == "cli-tool" else "skill", "smokeTestCommand": f"{smoke_name} --help" if install_kind == "npm" else "docker run --rm <image> --help" if install_kind == "docker" else "run documented --help/version command in sandbox",
        "rollbackNotes": {"supported": True, "disableSteps": ["disable generated wrapper/assignment"], "uninstallSteps": ["remove generated wrapper/config", uninstall] if uninstall != "remove generated wrapper/config" else [uninstall], "restartRequired": False},
    }


def _assess_npm(name: str, source_type: str, fetcher) -> dict[str, Any]:
    package_name = name.replace("npm:", "").strip()
    meta = (fetcher(f"https://registry.npmjs.org/{urllib.parse.quote(package_name, safe='@/')}").get("json") or {})
    latest = (meta.get("dist-tags") or {}).get("latest")
    version = (meta.get("versions") or {}).get(latest or "", {})
    dep_count = len(version.get("dependencies") or {})
    bin_field = version.get("bin") if isinstance(version.get("bin"), dict) else {}
    wrapper = "mcp" if source_type == "mcp-server" or "mcp" in package_name.lower() else "tool"
    permissions = _permissions_for(package_name, source_type, "npm")
    return {"sourceType": source_type, "sourceUri": redact_capability_payload(name), "sourceRef": package_name, "sourceLabel": "npm", "name": package_name, "displayName": package_name, "description": meta.get("description") or "", "category": "mcp-server" if wrapper == "mcp" else "cli-tool", "license": _license_payload(meta.get("license")), "maintenanceSignals": {"latestVersion": latest, "latestReleaseAt": (meta.get("time") or {}).get(latest or ""), "binCommands": list(bin_field.keys())}, "installMethod": {"kind": "npm", "commandPreview": f"npm install {package_name}", "requiresRestart": wrapper == "mcp", "requiredSecrets": [], "requiredPermissions": permissions, "wrapperType": wrapper}, "dependencyWeight": _weight(dep_count, 0, False), "runtimeWeight": _weight(dep_count, 0, False), "requiredSecrets": [], "permissions": permissions, "suggestedWrapperType": wrapper, "smokeTestCommand": f"npx {package_name} --help", "rollbackNotes": {"supported": True, "disableSteps": ["disable generated wrapper/assignment"], "uninstallSteps": ["remove generated wrapper/config", f"npm uninstall {package_name}"], "restartRequired": wrapper == "mcp"}}


def _assess_pypi(name: str, fetcher) -> dict[str, Any]:
    package_name = name.replace("pip:", "").replace("pypi:", "").strip()
    meta = (fetcher(f"https://pypi.org/pypi/{urllib.parse.quote(package_name)}/json").get("json") or {})
    info = meta.get("info") or {}
    version = info.get("version")
    releases = (meta.get("releases") or {}).get(version or "", [])
    req_count = len(info.get("requires_dist") or [])
    permissions = _permissions_for(package_name, "python-package", "pip")
    return {"sourceType": "python-package", "sourceUri": redact_capability_payload(name), "sourceRef": package_name, "sourceLabel": "PyPI", "name": package_name, "displayName": package_name, "description": info.get("summary") or "", "category": "cli-tool", "license": _license_payload(info.get("license")), "maintenanceSignals": {"latestVersion": version, "latestReleaseAt": (releases[0] or {}).get("upload_time_iso_8601") if releases else None}, "installMethod": {"kind": "pip", "commandPreview": f"pip install {package_name}", "requiresRestart": False, "requiredSecrets": [], "requiredPermissions": permissions, "wrapperType": "tool"}, "dependencyWeight": _weight(0, req_count, False), "runtimeWeight": _weight(0, req_count, False), "requiredSecrets": [], "permissions": permissions, "suggestedWrapperType": "tool", "smokeTestCommand": f"{_fallback_smoke_name(package_name)} --help", "rollbackNotes": {"supported": True, "disableSteps": ["disable generated wrapper/assignment"], "uninstallSteps": ["remove generated wrapper/config", f"pip uninstall -y {package_name}"], "restartRequired": False}}


def _assess_docker(raw: str, fetcher) -> dict[str, Any]:
    image = raw.replace("docker://", "").strip()
    if ":" in image.rsplit("/", 1)[-1]:
        image_no_tag, tag = image.rsplit(":", 1)
    else:
        image_no_tag, tag = image, "latest"
    repo = image_no_tag if "/" in image_no_tag else f"library/{image_no_tag}"
    meta = (fetcher(f"https://hub.docker.com/v2/repositories/{repo}/tags/{tag}").get("json") or {})
    return {"sourceType": "docker-image", "sourceUri": redact_capability_payload(raw), "sourceRef": image, "sourceLabel": "Docker Hub", "name": image, "displayName": image, "description": "Docker image intake assessment", "category": "local-service", "license": _license_payload(None, notes="Docker Hub tag metadata does not expose license"), "maintenanceSignals": {"tag": meta.get("name") or tag, "lastUpdatedAt": meta.get("last_updated"), "digests": [img.get("digest") for img in meta.get("images") or [] if img.get("digest")]}, "installMethod": {"kind": "docker", "commandPreview": f"docker pull {image}", "requiresRestart": False, "requiredSecrets": [], "requiredPermissions": ["network", "docker"], "wrapperType": "service"}, "dependencyWeight": _weight(forced="heavy"), "runtimeWeight": _weight(forced="heavy"), "requiredSecrets": [], "permissions": ["network", "docker"], "suggestedWrapperType": "service", "smokeTestCommand": f"docker run --rm {image} --help", "rollbackNotes": {"supported": True, "disableSteps": ["stop container/service", "disable generated wrapper/assignment"], "uninstallSteps": ["remove generated wrapper/config", f"docker image rm {image}"], "restartRequired": False}}


def _assess_owned_app(raw: str, hints: dict[str, Any]) -> dict[str, Any]:
    """Assess a first-party app adapter without granting executable access.

    Owned-app adapters are governed app boundaries, not broad write tools. The
    default wrapper path is a registry-managed local script/runbook that may
    expose read-only health probes. Hermes tools/MCP wrappers are only valid as
    thin, least-privilege front doors for allowlisted actions after the registry
    policy and approval gate have already allowed the action.
    """

    name = str(_camel(hints, "name") or _camel(hints, "displayName") or _camel(hints, "sourceRef") or raw or "owned-app").strip()
    app_id = _fallback_smoke_name(_camel(hints, "id") or name)
    business_domain = _camel(hints, "businessDomain") or _camel(hints, "category") or "owned-app"
    url = raw if raw.startswith(("http://", "https://")) else _camel(hints, "canonicalUrl") or _camel(hints, "sourceUri") or None
    sensitivity = [str(item) for item in _safe_list(_camel(hints, "sensitivityLevels") or _camel(hints, "sensitivity") or []) if item]
    text = " ".join([name, app_id, business_domain, raw] + sensitivity).lower()
    permissions = list(dict.fromkeys(["safe-status-read", "adapter-dry-run", "approval-gated-write"] + _hinted_permissions(hints)))
    risk_levels = ["read-only"]
    if url:
        risk_levels.append("network")
    if any(token in text for token in ("prod", "production", "finance", "financial", "payment", "lead", "customer", "pii")):
        risk_levels.append("production-control")
    if any(token in text for token in ("publish", "public", "marketing", "send")):
        risk_levels.append("external-publish")
    required_secrets = _hinted_secrets(hints)
    if required_secrets:
        risk_levels.extend(["requires-secret", "secret-access"])
    risk_levels = normalize_capability_risks(risk_levels)
    governance = capability_governance_payload(risk_levels, _camel(hints, "governance", {}) or {})
    blocked = list(dict.fromkeys((governance.get("blockedActions") or []) + [
        "broad-write-tool",
        "sensitive-write-without-approval",
        "raw-sensitive-export",
        "secret-value-exposure",
        "production-mutation-without-task-or-approval",
    ]))
    governance.update({
        "blockedActions": blocked,
        "adapterPolicy": {
            "defaultWrapper": "local_script",
            "allowedWrapperTypes": ["local_script", "hermes_tool_readonly", "mcp_readonly"],
            "forbiddenWrapperTypes": ["broad_write_tool", "ungated_mcp_write", "ambient_secret_tool"],
            "writeRule": "Writes remain task/approval gated, audited, dry-run capable, and least-privilege.",
            "secretRule": "Adapters receive secret references/readiness only; raw values are not stored in registry records.",
        },
        "policySummary": governance.get("policySummary") or "Owned-app adapter: local-script/runbook first; Hermes tool or MCP wrapper may only expose allowlisted read-only probes by default. Sensitive writes require approval, audit evidence, dry-run support, and least-privilege scopes.",
    })
    source_ref = _camel(hints, "sourceRef") or app_id
    return redact_capability_payload({
        "sourceType": "owned_app",
        "sourceUri": redact_capability_payload(url or raw),
        "sourceRef": source_ref,
        "sourceLabel": "Owned App Registry",
        "name": app_id,
        "displayName": _camel(hints, "displayName") or name,
        "description": _camel(hints, "description") or "First-party owned app adapter assessment. Registry-managed metadata only; executable access is separately gated.",
        "category": business_domain,
        "installMethod": {
            "kind": "owned-app-adapter",
            "commandPreview": f"record local-script adapter manifest for {app_id}; expose read-only health probes only by default",
            "requiresRestart": False,
            "requiredSecrets": required_secrets,
            "requiredPermissions": permissions,
            "wrapperType": "local_script",
            "adapterPath": {
                "decision": "local_script_first",
                "hermesToolPolicy": "read_only_probe_or_approval_gate_front_door_only",
                "mcpPolicy": "optional_read_only_or_gated_adapter_after_registry_policy",
                "broadWritesAllowedByDefault": False,
                "dryRunRequiredForWrites": True,
                "auditRequired": True,
            },
        },
        "governance": governance,
        "dependencyWeight": _weight(forced="light"),
        "runtimeWeight": _weight(forced="light"),
        "requiredSecrets": required_secrets,
        "permissions": permissions,
        "suggestedWrapperType": "local_script",
        "smokeTestCommand": "run read-only health/status probe with redacted output; do not execute data reads or mutations",
        "rollbackNotes": {
            "supported": True,
            "disableSteps": ["disable registry assignment", "disable generated local adapter wrapper", "pause routines using this owned app if needed"],
            "uninstallSteps": ["remove generated adapter wrapper/config after approval"],
            "restartRequired": False,
        },
    })


def assess_capability_source(source: Any, fetcher=None) -> dict[str, Any]:
    """Assess OSS capability metadata without installing or executing it."""
    fetch = fetcher or _safe_fetch_json
    parts = _source_input_parts(source)
    raw = parts["raw"]
    source_type = _infer_source_type(raw, parts.get("sourceType"))
    if source_type == "github-project":
        assessed = _assess_github(_strip_secret_query(raw), fetch)
        assessed["sourceUri"] = redact_capability_payload(raw)
        return _apply_assessment_hints(assessed, parts.get("hints") or {})
    if source_type in {"npm-package", "mcp-server"}:
        assessed = _assess_npm(parts.get("sourceRef") or raw, source_type, fetch)
        return _apply_assessment_hints(assessed, parts.get("hints") or {})
    if source_type == "python-package":
        assessed = _assess_pypi(parts.get("sourceRef") or raw, fetch)
        return _apply_assessment_hints(assessed, parts.get("hints") or {})
    if source_type == "docker-image":
        assessed = _assess_docker(raw, fetch)
        return _apply_assessment_hints(assessed, parts.get("hints") or {})
    if source_type == "owned_app":
        return _assess_owned_app(raw, parts.get("hints") or {})
    name = parts.get("sourceRef") or raw or "manual-capability"
    permissions = _permissions_for(name, source_type, "manual")
    assessed = {"sourceType": source_type, "sourceUri": redact_capability_payload(raw), "sourceRef": name, "sourceLabel": "Manual", "name": name, "displayName": name, "description": "Manual OSS/project intake assessment", "category": source_type, "license": _license_payload(None, notes="No package metadata source detected"), "maintenanceSignals": {"maintenanceSignal": "unknown"}, "installMethod": {"kind": "manual", "commandPreview": f"review documented install steps for {name}", "requiresRestart": False, "requiredSecrets": [], "requiredPermissions": permissions, "wrapperType": "skill"}, "dependencyWeight": _weight(), "runtimeWeight": _weight(), "requiredSecrets": [], "permissions": permissions, "suggestedWrapperType": "skill", "smokeTestCommand": "run documented --help/version command in sandbox", "rollbackNotes": {"supported": True, "disableSteps": ["disable generated wrapper/assignment"], "uninstallSteps": ["remove generated wrapper/config"], "restartRequired": False}}
    return _apply_assessment_hints(assessed, parts.get("hints") or {})


def _requires_secret(record: dict[str, Any]) -> bool:
    install = record.get("installMethod") or {}
    governance = record.get("governance") or {}
    return bool(install.get("requiredSecrets")) or "requires-secret" in (governance.get("riskLevels") or []) or "secret-access" in (governance.get("riskLevels") or [])


def _assignment_count(assignment: dict[str, Any] | None) -> int:
    if not isinstance(assignment, dict):
        return 0
    return sum(len(assignment.get(key) or []) for key in ("assignedAgents", "assignedRoutines", "assignedTasks")) or int(assignment.get("usageCount") or 0)


def _persist_evidence(con, capability_id: str | None, intake_id: str | None, evidence: list[dict[str, Any]]) -> None:
    for item in evidence:
        con.execute(
            """INSERT OR REPLACE INTO capability_evidence
               (id,capability_id,intake_id,kind,title,summary,path,url,created_at,redacted)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                item.get("id"),
                capability_id,
                intake_id,
                item.get("kind") or "human-note",
                item.get("title") or item.get("id"),
                item.get("summary") or "",
                item.get("path"),
                item.get("url"),
                item.get("createdAt") or _now_iso(),
                1,
            ),
        )


def _persist_assignments(con, capability_id: str, assignment: dict[str, Any]) -> None:
    if not isinstance(assignment, dict):
        return
    now = _now_iso()
    for kind, key in (("agent", "assignedAgents"), ("routine", "assignedRoutines"), ("task", "assignedTasks")):
        for item in assignment.get(key) or []:
            if not isinstance(item, dict):
                continue
            assignee_id = item.get("id")
            if not assignee_id:
                continue
            con.execute(
                """INSERT OR REPLACE INTO capability_assignments
                   (id,capability_id,assignment_kind,assignee_id,assignee_name,enabled,reason,created_at,updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (
                    _stable_id("ca", capability_id, kind, assignee_id),
                    capability_id,
                    kind,
                    assignee_id,
                    item.get("name") or item.get("title") or assignee_id,
                    1 if item.get("enabled", True) else 0,
                    item.get("reason") or "",
                    now,
                    now,
                ),
            )
