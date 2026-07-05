"""Embeddings behind a two-method interface (frozen decision): a deterministic toy
backend that teaches the mechanics offline, and a real backend for real similarity.
Switchable. The toy embedder is what the gate exercises; it must be deterministic.
"""

from __future__ import annotations

import hashlib
import math
from typing import Protocol

DIM = 64


class Embedder(Protocol):
    dim: int

    def embed(self, text: str) -> list[float]: ...


class ToyEmbedder:
    """Deterministic bag-of-words hashing into a fixed-dim unit vector. Same text ->
    same vector (no network); texts sharing tokens land closer together."""

    dim = DIM

    def embed(self, text: str) -> list[float]:
        vec = [0.0] * self.dim
        for tok in text.lower().split():
            h = int(hashlib.md5(tok.encode()).hexdigest(), 16)
            vec[h % self.dim] += 1.0
        norm = math.sqrt(sum(x * x for x in vec)) or 1.0
        return [x / norm for x in vec]


class RealEmbedder:
    """Runtime-only; a real provider (e.g. Voyage) would live here. Not gate-covered,
    exactly like the Mechanic's real model client."""

    dim = DIM

    def __init__(self, api_key: str):
        self.api_key = api_key

    def embed(self, text: str) -> list[float]:
        raise NotImplementedError("real embeddings are not configured on this instance")


def get_embedder() -> Embedder:
    # Toy by default; swap to RealEmbedder when a provider is configured.
    return ToyEmbedder()
