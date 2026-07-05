"""The agent floor — Attribution, Tripwire, Ablation, and a retrieval-miss demo.
All verdicts route through the assertion engine (in the service). These formats are
deterministic simulations, so no model key is needed to play or to gate.
"""

from fastapi import APIRouter
from pydantic import BaseModel

from app.services import agent_floor

router = APIRouter(prefix="/api/agent", tags=["agent-floor"])


# --- Attribution ---


@router.post("/attribution")
async def attribution():
    inst = agent_floor.generate_attribution()
    return {"stages": inst["stages"]}  # fault layer hidden until you call it


class BisectBody(BaseModel):
    stages: list[dict]
    layer: str


@router.post("/attribution/check")
async def attribution_check(body: BisectBody):
    guilty = agent_floor.bisect_attribution(body.stages)
    return {"correct": body.layer == guilty, "fault_layer": guilty}


# --- Tripwire ---


@router.post("/tripwire")
async def tripwire():
    variants = agent_floor.generate_tripwire()
    visible = [
        {"id": v["id"], "subject": v["subject"], "is_good": v["is_good"]}
        for v in variants
        if not v["holdout"]
    ]
    return {"visible": visible, "holdout_count": sum(1 for v in variants if v["holdout"])}


class TripwireAttempt(BaseModel):
    assertion: dict


@router.post("/tripwire/attempt")
async def tripwire_attempt(body: TripwireAttempt):
    variants = agent_floor.generate_tripwire()
    return {
        "holdout": agent_floor.score_tripwire(body.assertion, variants, holdout_only=True),
        "overall": agent_floor.score_tripwire(body.assertion, variants),
    }


# --- Ablation ---


@router.post("/ablation")
async def ablation():
    return agent_floor.generate_ablation()


class AblationSubmit(BaseModel):
    config_fields: list[str]


@router.post("/ablation/check")
async def ablation_check(body: AblationSubmit):
    return agent_floor.check_ablation(body.config_fields, agent_floor.generate_ablation())


# --- Retrieval miss ---


@router.get("/retrieval-demo")
async def retrieval(miss: bool = False):
    return agent_floor.retrieval_demo(miss)
