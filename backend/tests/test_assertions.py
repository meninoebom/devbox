"""Spec gate: the assertion engine truth table + subject extraction."""

import pytest

from app.services.assertions import (
    AssertionSpec,
    evaluate,
    metrics_from_run,
    metrics_from_trace,
)

SUBJECT = {"sql.count": 2, "plan.root_type": "Gather", "plan.has_seq_scan": True}


@pytest.mark.parametrize(
    "target,op,value,expected",
    [
        ("sql.count", "lte", 3, True),
        ("sql.count", "lt", 2, False),
        ("sql.count", "eq", 2, True),
        ("plan.root_type", "eq", "Gather", True),
        ("plan.root_type", "ne", "Seq Scan", True),
        ("plan.has_seq_scan", "eq", True, True),
    ],
)
def test_truth_table(target, op, value, expected):
    r = evaluate(AssertionSpec(target=target, op=op, value=value), SUBJECT)
    assert r.passed is expected
    assert r.actual == SUBJECT[target]


def test_missing_target_fails_not_raises():
    r = evaluate(AssertionSpec(target="nope", op="eq", value=1), SUBJECT)
    assert r.passed is False
    assert "not present" in r.detail


def test_unknown_op_fails_not_raises():
    r = evaluate(AssertionSpec(target="sql.count", op="wat", value=1), SUBJECT)
    assert r.passed is False
    assert "unknown op" in r.detail


def test_type_mismatch_fails_not_raises():
    r = evaluate(AssertionSpec(target="plan.root_type", op="lt", value=5), SUBJECT)
    assert r.passed is False  # "Gather" < 5 is a TypeError, caught


def test_metrics_from_trace():
    trace = {
        "kind": "request",
        "duration_ms": 12.0,
        "events": [
            {"lane": "http", "duration_ms": 12.0, "detail": {"response_status": 200}},
            {"lane": "sql", "duration_ms": 1.0, "detail": {"sql": "SELECT 1"}},
            {"lane": "sql", "duration_ms": 2.0, "detail": {"sql": "SELECT 2"}},
        ],
    }
    m = metrics_from_trace(trace)
    assert m["sql.count"] == 2
    assert m["http.status"] == 200
    assert "http" in m["lanes"]


def test_metrics_from_run():
    plan = {
        "root": {
            "node_type": "Gather",
            "children": [{"node_type": "Seq Scan", "children": []}],
        }
    }
    m = metrics_from_run({"row_count": 100, "duration_ms": 15.0}, plan)
    assert m["rows"] == 100
    assert m["plan.root_type"] == "Gather"
    assert m["plan.has_seq_scan"] is True
    assert m["plan.uses_index"] is False
