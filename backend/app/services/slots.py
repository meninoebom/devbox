"""Pluggable slots — register a hand-built implementation and benchmark it against
a reference through the same assertion machinery. First slot: a CacheBackend.

The interface a submission must implement: `Cache(capacity)` with `.get(key)` (->
value or None) and `.set(key, value)`. The submission's source is exec'd in a
restricted namespace. This runs the user's OWN code on their OWN machine (a local
single-user tool), with builtins pared down to a safe set; it is not a sandbox for
hostile code.
"""

from __future__ import annotations

import builtins
from collections import OrderedDict
from dataclasses import dataclass

from app.services.assertions import AssertionSpec, evaluate

CAPACITY = 3

# A deterministic op sequence. With capacity 3, a correct LRU evicts 'b' when 'd'
# is inserted (because 'a' was just read), so get('b') must be None.
_WORKLOAD = [
    ("set", "a", 1),
    ("set", "b", 2),
    ("set", "c", 3),
    ("get", "a", None),
    ("set", "d", 4),
    ("get", "b", None),
    ("get", "a", None),
    ("get", "c", None),
    ("get", "d", None),
]

_ALLOWED_BUILTINS = [
    "len",
    "range",
    "dict",
    "list",
    "tuple",
    "set",
    "min",
    "max",
    "int",
    "str",
    "bool",
    "abs",
    "enumerate",
    "iter",
    "next",
    "sorted",
    "None",
    "True",
    "False",
    "KeyError",
]


class ReferenceLRU:
    def __init__(self, capacity: int):
        self.cap = capacity
        self.d: OrderedDict = OrderedDict()

    def get(self, key):
        if key not in self.d:
            return None
        self.d.move_to_end(key)
        return self.d[key]

    def set(self, key, value):
        if key in self.d:
            self.d.move_to_end(key)
        self.d[key] = value
        if len(self.d) > self.cap:
            self.d.popitem(last=False)


def _run_workload(cache) -> list:
    out = []
    for op, k, v in _WORKLOAD:
        if op == "set":
            cache.set(k, v)
        else:
            out.append(cache.get(k))
    return out


def load_impl(source: str, class_name: str = "Cache"):
    safe = {n: getattr(builtins, n) for n in _ALLOWED_BUILTINS if hasattr(builtins, n)}
    safe["__build_class__"] = builtins.__build_class__  # needed to define a class
    ns: dict = {}
    g = {"__builtins__": safe, "__name__": "cache_impl", "OrderedDict": OrderedDict}
    exec(source, g, ns)  # noqa: S102
    if class_name not in ns:
        raise ValueError(f"source must define a class named '{class_name}'")
    return ns[class_name]


@dataclass
class BenchmarkResult:
    correct: bool
    hits: int
    ref_hits: int
    detail: str


def benchmark_cache(source: str) -> BenchmarkResult:
    """Run the submitted cache and the reference over the workload; the verdict
    (do their get-results match?) goes through the assertion engine."""
    cls = load_impl(source)
    user_res = _run_workload(cls(CAPACITY))
    ref_res = _run_workload(ReferenceLRU(CAPACITY))
    verdict = evaluate(
        AssertionSpec(target="matches", op="eq", value=True),
        {"matches": user_res == ref_res},
    )
    hits = sum(1 for r in user_res if r is not None)
    ref_hits = sum(1 for r in ref_res if r is not None)
    return BenchmarkResult(
        correct=verdict.passed,
        hits=hits,
        ref_hits=ref_hits,
        detail=f"yours={user_res} vs reference={ref_res}",
    )
