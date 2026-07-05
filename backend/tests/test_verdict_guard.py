"""Spec gate (frozen decision): the assertion engine is the ONLY place a pass/fail
verdict is constructed. `AssertionResult(...)` must not appear anywhere in app/
except assertions.py. This keeps puzzles, evals, and rep benchmarks routing their
verdicts through the one engine instead of inventing ad-hoc pass/fail.
"""

import pathlib

APP = pathlib.Path(__file__).resolve().parent.parent / "app"


def test_assertion_result_only_constructed_in_engine():
    offenders = []
    for py in APP.rglob("*.py"):
        if py.name == "assertions.py":
            continue
        if "AssertionResult(" in py.read_text(encoding="utf-8"):
            offenders.append(str(py.relative_to(APP)))
    assert offenders == [], (
        f"pass/fail verdicts must come from the assertion engine; "
        f"AssertionResult constructed in: {offenders}"
    )
