"""The agent floor — generated agent puzzles, all verdicts via the assertion engine.

Deterministic simulations (no live model), so the gate is offline and the concepts
are exercised for real:
- Attribution: a datum flows db->sql->retrieval->context->answer; a fault at one
  stage drops it. You bisect to the first stage where it went missing.
- Tripwire: author an assertion separating good systems from faulty ones; scored
  precision/recall on a HELD-OUT variant set (overfitting shows up there).
- Ablation: prune an agent config; visible AND held-out evals must still pass, so
  overfitting to the visible set is rejected.
- retrieval_miss: shrink top-k below the gold chunk's rank and it drops out.
"""

from __future__ import annotations

import random

from app.services.assertions import AssertionSpec, evaluate
from app.services.embeddings import get_embedder
from app.services.vector_store import VectorStore

STAGES = ["db", "sql", "retrieval", "context", "answer"]


# --- Attribution ---


def generate_attribution() -> dict:
    fault_idx = random.randrange(len(STAGES))
    stages = [{"stage": s, "gold_present": i < fault_idx} for i, s in enumerate(STAGES)]
    return {"stages": stages, "fault_layer": STAGES[fault_idx]}


def bisect_attribution(stages: list[dict]) -> str | None:
    """The guilty layer is the first stage where the gold datum is absent."""
    for row in stages:
        if not row["gold_present"]:
            return row["stage"]
    return None


# --- Tripwire ---


def generate_tripwire(n_visible: int = 6, n_holdout: int = 6) -> list[dict]:
    """Good systems keep context tight (<= 100 tokens); the fault is context bloat."""
    variants = []
    for i in range(n_visible + n_holdout):
        good = i % 2 == 0
        tokens = random.randint(20, 90) if good else random.randint(130, 300)
        variants.append(
            {
                "id": i,
                "subject": {"tokens": tokens, "answered": True},
                "is_good": good,
                "holdout": i >= n_visible,
            }
        )
    return variants


def score_tripwire(assertion: dict, variants: list[dict], holdout_only: bool = False) -> dict:
    """The player's assertion is meant to pass GOOD systems and fail faulty ones."""
    spec = AssertionSpec(**assertion)
    tp = fp = fn = tn = 0
    for v in variants:
        if holdout_only and not v["holdout"]:
            continue
        passed = evaluate(spec, v["subject"]).passed
        if v["is_good"] and passed:
            tp += 1
        elif v["is_good"]:
            fn += 1
        elif passed:
            fp += 1
        else:
            tn += 1
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    return {
        "precision": round(precision, 3),
        "recall": round(recall, 3),
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
    }


# --- Ablation ---


def generate_ablation() -> dict:
    """A bloated agent config; visible evals need A,B; a held-out eval needs C."""
    return {
        "baseline": ["A", "B", "C", "D", "E"],
        "visible_required": ["A", "B"],
        "holdout_required": ["C"],
        "token_budget": 3,
    }


def check_ablation(config_fields: list[str], instance: dict) -> dict:
    """An answer contains a field iff it is in the config. Cutting a field the
    held-out eval needs passes the visible evals but is rejected (overfitting)."""
    fields = set(config_fields)
    visible_ok = all(f in fields for f in instance["visible_required"])
    holdout_ok = all(f in fields for f in instance["holdout_required"])
    within_budget = len(fields) <= instance["token_budget"]
    accepted = visible_ok and holdout_ok and within_budget
    if accepted:
        reason = "accepted"
    elif not visible_ok:
        reason = "failed a visible eval"
    elif not holdout_ok:
        reason = "passed visible but failed a HELD-OUT eval (overfit)"
    else:
        reason = "over the token budget"
    return {
        "visible_ok": visible_ok,
        "holdout_ok": holdout_ok,
        "within_budget": within_budget,
        "tokens": len(fields),
        "accepted": accepted,
        "reason": reason,
    }


# --- Retrieval miss (over the sqlite-vec store) ---

_CORPUS = [
    "the cat sat on the mat",
    "dogs bark at night in the yard",
    "the invoice total was 4200 dollars and paid",
    "sunlight warms the roof at noon",
    "the quarterly report is due friday",
]
_GOLD = _CORPUS[2]
_QUERY = "what was the invoice total"


def retrieval_demo(miss: bool = False) -> dict:
    emb = get_embedder()
    store = VectorStore(emb.dim)
    try:
        for text in _CORPUS:
            store.add(text, emb.embed(text))
        ranked = store.search(emb.embed(_QUERY), len(_CORPUS))
        gold_rank = next((i for i, h in enumerate(ranked) if h["text"] == _GOLD), None)
        if gold_rank is None:
            gold_rank = len(_CORPUS)
        # The injector: shrink k below the gold's rank so it drops out of top-k.
        k = gold_rank if miss else gold_rank + 1
        hits = ranked[:k]
        found = any(h["text"] == _GOLD for h in hits)
        return {"found": found, "k": k, "gold_rank": gold_rank, "hits": [h["text"] for h in hits]}
    finally:
        store.close()
