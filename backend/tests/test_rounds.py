"""Spec gate (offline parts): par is finite, wins are assertions, and cadence is
NOT a streak. The lab-dependent checks (injector signature, optimal fix flips green,
masking fix stays red) run in the smoke gate, which has the specimen.
"""

from app.models.round import Round
from app.services.assertions import AssertionSpec
from app.services.faults import FAMILIES


def test_no_streak_or_consecutive_column():
    cols = {c.name.lower() for c in Round.__table__.columns}
    banned = [c for c in cols if "streak" in c or "consecutive" in c]
    assert banned == [], f"cadence must not be a streak counter (frozen decision): {banned}"


def test_every_family_is_generated_with_finite_par_and_assertion_win():
    assert FAMILIES, "there must be at least one fault family"
    for fam in FAMILIES.values():
        assert isinstance(fam.par_changes, int) and fam.par_changes >= 1
        assert isinstance(fam.win, AssertionSpec)  # win routes through the engine
        assert isinstance(fam.signature, AssertionSpec)
        assert fam.baseline_query.strip()
        assert fam.par_note.strip()
