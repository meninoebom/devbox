"""The assertion engine — the ONE pass/fail verifier in DevBox.

Frozen decision (autonomous-build-spec.md): assertions are pure, deterministic
functions over an extracted "subject" (a flat dict of metrics) that return an
`AssertionResult`. No I/O, no DB. Puzzles, agent evals, rep benchmarks, and
case-file receipts will all route their verdicts through `evaluate()` — nothing
else constructs a pass/fail verdict.

Subjects are flat dicts keyed by dotted metric names (e.g. "sql.count",
"plan.root_type"), built by `metrics_from_trace` / `metrics_from_run`.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

_MISSING = object()

# The allowed comparison operators. Kept tiny and total on purpose.
OPS: dict[str, Any] = {
    "lt": lambda a, b: a < b,
    "lte": lambda a, b: a <= b,
    "gt": lambda a, b: a > b,
    "gte": lambda a, b: a >= b,
    "eq": lambda a, b: a == b,
    "ne": lambda a, b: a != b,
    "contains": lambda a, b: b in a,
    "not_contains": lambda a, b: b not in a,
}


class AssertionSpec(BaseModel):
    target: str
    op: str
    value: Any


class AssertionResult(BaseModel):
    passed: bool
    target: str
    op: str
    value: Any
    actual: Any = None
    detail: str = ""


def resolve_target(subject: dict[str, Any], target: str) -> Any:
    """Look a metric up by its dotted key. Returns the sentinel if absent."""
    return subject.get(target, _MISSING)


def evaluate(spec: AssertionSpec, subject: dict[str, Any]) -> AssertionResult:
    """Apply one assertion to a subject. Total: never raises, always returns a
    result (a bad op or a missing target is a failed assertion, not an error)."""
    actual = resolve_target(subject, spec.target)
    if actual is _MISSING:
        return AssertionResult(
            passed=False,
            target=spec.target,
            op=spec.op,
            value=spec.value,
            actual=None,
            detail=f"target '{spec.target}' not present in subject",
        )
    fn = OPS.get(spec.op)
    if fn is None:
        return AssertionResult(
            passed=False,
            target=spec.target,
            op=spec.op,
            value=spec.value,
            actual=actual,
            detail=f"unknown op '{spec.op}'",
        )
    try:
        passed = bool(fn(actual, spec.value))
        detail = f"{spec.target}={actual!r} {spec.op} {spec.value!r} -> {passed}"
    except TypeError as e:
        passed = False
        detail = f"type error comparing {actual!r} {spec.op} {spec.value!r}: {e}"
    return AssertionResult(
        passed=passed,
        target=spec.target,
        op=spec.op,
        value=spec.value,
        actual=actual,
        detail=detail,
    )


# --- Subject extraction: traces and workbench runs into flat metric dicts ---


def metrics_from_trace(trace: dict[str, Any]) -> dict[str, Any]:
    """Flatten a TraceRead-shaped dict into assertable metrics."""
    events = trace.get("events", [])
    lanes = [e.get("lane") for e in events]
    sql_events = [e for e in events if e.get("lane") == "sql"]
    http = next((e["detail"] for e in events if e.get("lane") == "http"), {})
    return {
        "kind": trace.get("kind"),
        "duration_ms": trace.get("duration_ms"),
        "lanes": lanes,
        "sql.count": len(sql_events),
        "sql.total_ms": round(sum(e.get("duration_ms") or 0 for e in sql_events), 3),
        "http.status": http.get("response_status"),
    }


def _walk_node_types(node: dict[str, Any]) -> list[str]:
    types = [node.get("node_type", "?")]
    for c in node.get("children", []):
        types.extend(_walk_node_types(c))
    return types


def metrics_from_run(run: dict[str, Any], plan: dict[str, Any] | None) -> dict[str, Any]:
    """Flatten a workbench run + its plan into assertable metrics."""
    out: dict[str, Any] = {
        "rows": run.get("row_count"),
        "exec_ms": run.get("duration_ms"),
    }
    if plan and plan.get("root"):
        node_types = _walk_node_types(plan["root"])
        out["plan.root_type"] = plan["root"].get("node_type")
        out["plan.node_types"] = node_types
        out["plan.has_seq_scan"] = any("Seq Scan" in t for t in node_types)
        out["plan.uses_index"] = any("Index" in t for t in node_types)
    return out
