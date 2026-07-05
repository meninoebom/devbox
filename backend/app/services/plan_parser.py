"""PlanParser — Postgres EXPLAIN (ANALYZE, FORMAT JSON) into a normalized tree.

Pure function over the EXPLAIN payload, no I/O, so it is trivially testable against
fixtures. It also derives the two highlights the Workbench cares about: the node
that actually costs the most time (exclusive of its children), and the node whose
row estimate was most wrong. Those are the two things that explain "why is this
slow" faster than reading raw EXPLAIN text.
"""

from __future__ import annotations

from typing import Any


def _one_line(node: dict) -> str:
    """A short human description of what a plan node is doing."""
    parts: list[str] = []
    if node.get("Relation Name"):
        parts.append(f"on {node['Relation Name']}")
    if node.get("Index Name"):
        parts.append(f"using {node['Index Name']}")
    if node.get("Index Cond"):
        parts.append(node["Index Cond"])
    elif node.get("Filter"):
        parts.append(f"filter {node['Filter']}")
    if node.get("Hash Cond"):
        parts.append(node["Hash Cond"])
    return " ".join(parts)


def _misestimate_ratio(plan_rows: int | None, actual_rows: int | None) -> float:
    """How wrong the row estimate was, as a symmetric ratio >= 1 (1.0 = perfect)."""
    if plan_rows is None or actual_rows is None:
        return 1.0
    hi = max(plan_rows, actual_rows)
    lo = max(min(plan_rows, actual_rows), 1)
    return hi / lo


def parse(explain_json: Any) -> dict:
    """Normalize an EXPLAIN FORMAT JSON payload into a plan tree with highlights."""
    root_obj = explain_json[0] if isinstance(explain_json, list) else explain_json
    plan = root_obj.get("Plan", {})

    flat: list[dict] = []
    counter = 0

    def walk(node: dict) -> dict:
        nonlocal counter
        node_id = counter
        counter += 1

        loops = node.get("Actual Loops")
        actual_total = node.get("Actual Total Time")
        inclusive_ms = (
            actual_total * loops
            if actual_total is not None and loops is not None
            else None
        )

        children = [walk(c) for c in node.get("Plans", [])]
        child_inclusive = sum((c["_inclusive_ms"] or 0) for c in children)
        # Under parallel plans, summed worker times can exceed the parent's wall
        # time and make this go negative; clamp to 0 rather than show nonsense.
        # (Parallel timings are approximate here; we optimize for flagging the
        # right node, not exact per-node milliseconds.)
        exclusive_ms = (
            max(0.0, inclusive_ms - child_inclusive) if inclusive_ms is not None else None
        )

        plan_rows = node.get("Plan Rows")
        actual_rows = node.get("Actual Rows")  # per-loop, as EXPLAIN reports it

        out = {
            "id": node_id,
            "node_type": node.get("Node Type", "?"),
            "relation": node.get("Relation Name"),
            "cost": node.get("Total Cost", 0.0),
            "plan_rows": plan_rows,
            "actual_rows": actual_rows,
            "loops": loops,
            "actual_ms": round(inclusive_ms, 3) if inclusive_ms is not None else None,
            "exclusive_ms": round(exclusive_ms, 3) if exclusive_ms is not None else None,
            "detail": _one_line(node),
            "misestimate_ratio": round(_misestimate_ratio(plan_rows, actual_rows), 1),
            "is_hot": False,
            "is_misestimate": False,
            "children": children,
            # private carriers for highlight math, stripped before returning
            "_inclusive_ms": inclusive_ms,
            "_exclusive_ms": exclusive_ms,
        }
        flat.append(out)
        return out

    root = walk(plan)

    hot = max(flat, key=lambda n: (n["_exclusive_ms"] or -1.0), default=None)
    mis = max(flat, key=lambda n: n["misestimate_ratio"], default=None)
    # Only flag a misestimate if it is actually meaningful (>= 10x off).
    if hot is not None:
        hot["is_hot"] = True
    if mis is not None and mis["misestimate_ratio"] >= 10:
        mis["is_misestimate"] = True

    for n in flat:
        n.pop("_inclusive_ms", None)
        n.pop("_exclusive_ms", None)

    return {
        "root": root,
        "planning_ms": root_obj.get("Planning Time"),
        "execution_ms": root_obj.get("Execution Time"),
        "worst_hot_id": hot["id"] if hot else None,
        "worst_estimate_id": mis["id"] if mis and mis["is_misestimate"] else None,
    }
