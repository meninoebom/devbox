"""Spec gate: toy embedder is deterministic; the retrieval-miss injector drops the
gold chunk; an Ablation failing a held-out eval is rejected; Tripwire precision/
recall is computed on a held-out set.
"""

from app.services import agent_floor
from app.services.embeddings import ToyEmbedder


def test_toy_embedder_is_deterministic():
    e = ToyEmbedder()
    assert e.embed("the invoice total") == e.embed("the invoice total")
    assert e.embed("the invoice total") != e.embed("something else entirely")


def test_retrieval_miss_drops_the_gold_chunk():
    assert agent_floor.retrieval_demo(miss=False)["found"] is True
    assert agent_floor.retrieval_demo(miss=True)["found"] is False


def test_attribution_bisect_matches_the_injected_layer():
    # Across many generations, the first missing stage is exactly the injected fault.
    for _ in range(30):
        inst = agent_floor.generate_attribution()
        assert agent_floor.bisect_attribution(inst["stages"]) == inst["fault_layer"]


def test_ablation_rejects_a_held_out_failure():
    inst = agent_floor.generate_ablation()
    # A,B pass the visible evals but drop C, which a held-out eval needs -> reject.
    overfit = agent_floor.check_ablation(["A", "B"], inst)
    assert overfit["accepted"] is False
    assert overfit["visible_ok"] is True and overfit["holdout_ok"] is False

    # A,B,C passes everything within budget.
    good = agent_floor.check_ablation(["A", "B", "C"], inst)
    assert good["accepted"] is True


def test_tripwire_precision_recall_on_held_out_set():
    variants = agent_floor.generate_tripwire()
    # A sound assertion (context stays tight) generalizes to the held-out set.
    good = agent_floor.score_tripwire(
        {"target": "tokens", "op": "lte", "value": 100}, variants, holdout_only=True
    )
    assert good["precision"] == 1.0 and good["recall"] == 1.0

    # A lazy assertion that passes everything has poor precision (lets faults through).
    lazy = agent_floor.score_tripwire(
        {"target": "answered", "op": "eq", "value": True}, variants, holdout_only=True
    )
    assert lazy["precision"] < 1.0
