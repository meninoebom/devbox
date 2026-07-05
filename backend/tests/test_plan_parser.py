"""Spec gate: PlanParser normalizes EXPLAIN JSON and flags the right nodes.

Pure, fixture-based, no I/O. Part of the cumulative gate — must stay green in
every later phase.
"""

from app.services.plan_parser import parse

# A Gather over a Seq Scan whose row estimate is badly wrong (42 est -> 5000 act)
# and which dominates the runtime. The scan should be flagged both HOT and
# MISESTIMATE; the parent Gather neither.
EXPLAIN = [
    {
        "Plan": {
            "Node Type": "Gather",
            "Total Cost": 8288.0,
            "Plan Rows": 84,
            "Actual Rows": 100,
            "Actual Total Time": 12.0,
            "Actual Loops": 1,
            "Plans": [
                {
                    "Node Type": "Seq Scan",
                    "Relation Name": "books",
                    "Total Cost": 7277.0,
                    "Plan Rows": 42,
                    "Actual Rows": 5000,
                    "Actual Total Time": 10.0,
                    "Actual Loops": 1,
                    "Filter": "(author_id = 42)",
                }
            ],
        },
        "Planning Time": 0.5,
        "Execution Time": 12.5,
    }
]


def test_shape_and_timing():
    tree = parse(EXPLAIN)
    assert tree["root"]["node_type"] == "Gather"
    assert tree["execution_ms"] == 12.5
    assert tree["planning_ms"] == 0.5


def test_hot_node_is_the_scan():
    tree = parse(EXPLAIN)
    scan = tree["root"]["children"][0]
    assert tree["worst_hot_id"] == scan["id"]
    assert scan["is_hot"] is True
    assert tree["root"]["is_hot"] is False


def test_misestimate_flagged_only_when_large():
    tree = parse(EXPLAIN)
    scan = tree["root"]["children"][0]
    assert scan["is_misestimate"] is True  # 5000/42 ~= 119x
    assert tree["worst_estimate_id"] == scan["id"]
    assert tree["root"]["is_misestimate"] is False  # 100/84 ~= 1.2x


def test_exclusive_time_never_negative():
    tree = parse(EXPLAIN)

    def check(node):
        if node["exclusive_ms"] is not None:
            assert node["exclusive_ms"] >= 0
        for c in node["children"]:
            check(c)

    check(tree["root"])


def test_detail_describes_the_node():
    tree = parse(EXPLAIN)
    scan = tree["root"]["children"][0]
    assert "on books" in scan["detail"]
    assert "filter" in scan["detail"].lower()
