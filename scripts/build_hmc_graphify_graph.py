#!/usr/bin/env python3
"""Build a code-only Graphify graph for Hermes Mission Control.

This intentionally avoids docs, generated bundles, uploaded assets, DB/runtime state,
and images so the graph is cheap and deterministic: AST extraction only, no LLM/API
semantic extraction required.

Run from the HMC repo root:
    python scripts/build_hmc_graphify_graph.py

Requires graphifyy installed, preferably via:
    uv tool install --upgrade graphifyy
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from graphify.analyze import god_nodes, surprising_connections  # type: ignore[import-not-found]
from graphify.build import build  # type: ignore[import-not-found]
from graphify.cluster import cluster, score_all  # type: ignore[import-not-found]
from graphify.detect import detect  # type: ignore[import-not-found]
from graphify.export import to_json  # type: ignore[import-not-found]
from graphify.extract import extract  # type: ignore[import-not-found]


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "graphify-out"

EXCLUDED_PARTS = {
    ".git",
    ".pytest_cache",
    "__pycache__",
    "dist",
    "node_modules",
    "uploads",
    "backups",
    "logs",
    "output",
    "secrets",
    "production-locks",
    "user-runtimes",
    "security-reports",
    "graphify-out",
}

# Code-only pilot: skip docs/assets so no LLM semantic extraction is needed.
EXCLUDED_SUFFIXES = {
    ".md",
    ".mdx",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".db",
    ".sqlite",
    ".sqlite3",
    ".jsonl",
    ".bak",
    ".backup",
}


def is_allowed_code_file(path: Path) -> bool:
    try:
        rel = path.resolve().relative_to(ROOT)
    except ValueError:
        return False
    if any(part in EXCLUDED_PARTS for part in rel.parts):
        return False
    if any(part.startswith("dist-backup") for part in rel.parts):
        return False
    if path.suffix.lower() in EXCLUDED_SUFFIXES:
        return False
    return True


def git_short_sha() -> str | None:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=ROOT,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except Exception:
        return None


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    detection = detect(ROOT)
    detected_code = [Path(p) for p in detection.get("files", {}).get("code", [])]
    code_files = sorted({p.resolve() for p in detected_code if is_allowed_code_file(p)})

    if not code_files:
        print("No Graphify-supported code files found after HMC excludes.", file=sys.stderr)
        return 1

    print(f"[hmc-graphify] root: {ROOT}")
    print(f"[hmc-graphify] code files: {len(code_files)}")
    ast = extract(code_files, cache_root=ROOT)
    print(
        f"[hmc-graphify] AST: {len(ast.get('nodes', []))} nodes, "
        f"{len(ast.get('edges', []))} edges"
    )

    graph = build([ast], dedup=True, root=ROOT)
    if graph.number_of_nodes() == 0:
        print("Graphify extraction produced an empty graph.", file=sys.stderr)
        return 1

    communities = cluster(graph)
    graph_json = OUT / "graph.json"
    to_json(graph, communities, str(graph_json), force=True)

    analysis = {
        "hmc_code_only": True,
        "built_from_commit": git_short_sha(),
        "files": {"code": [str(p) for p in code_files]},
        "communities": {str(k): v for k, v in communities.items()},
        "cohesion": {str(k): v for k, v in score_all(graph, communities).items()},
        "gods": god_nodes(graph),
        "surprises": surprising_connections(graph, communities),
        "tokens": {
            "input": ast.get("input_tokens", 0),
            "output": ast.get("output_tokens", 0),
        },
    }
    (OUT / ".graphify_analysis.json").write_text(
        json.dumps(analysis, indent=2), encoding="utf-8"
    )
    (OUT / "manifest.json").write_text(
        json.dumps(
            {
                "hmc_code_only": True,
                "code": [str(p) for p in code_files],
                "document": [],
                "paper": [],
                "image": [],
                "video": [],
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    print(
        f"[hmc-graphify] wrote {graph_json}: "
        f"{graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges, "
        f"{len(communities)} communities"
    )
    print("[hmc-graphify] next: graphify cluster-only . --graph graphify-out/graph.json --no-label --no-viz")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
