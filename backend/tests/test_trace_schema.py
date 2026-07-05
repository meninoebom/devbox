"""Spec gate: per-lane detail validation at the trace write boundary.

Enforces the frozen decision that TraceEvent.detail is schemaless in storage but
validated per lane on the way in, and that lanes without a producer pass through.
"""

import pytest
from pydantic import ValidationError

from app.models.trace import Lane
from app.schemas.trace import validate_detail


def test_sql_lane_validates_and_returns_dict():
    out = validate_detail(Lane.SQL, {"sql": "SELECT 1", "params": None})
    assert out["sql"] == "SELECT 1"


def test_http_lane_requires_core_fields():
    out = validate_detail(
        Lane.HTTP,
        {"method": "GET", "path": "/x", "response_status": 200},
    )
    assert out["method"] == "GET"
    assert out["response_status"] == 200


def test_unmapped_lane_passes_through_untouched():
    # cache has no producer yet; detail must survive as-is.
    payload = {"anything": 1, "nested": {"k": "v"}}
    assert validate_detail(Lane.CACHE, payload) == payload


def test_bad_sql_detail_raises():
    with pytest.raises(ValidationError):
        validate_detail(Lane.SQL, {})  # missing required `sql`
