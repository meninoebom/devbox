"""The model client seam — what makes the Mechanic testable and offline-gatable.

The loop talks to a `ModelClient`, never to a vendor SDK directly. `ScriptedClient`
returns a fixed sequence (deterministic, no network, no key) so the gate can drive
the whole loop; `AnthropicClient` is the runtime backend. This is also the future
"hand-rolled vs SDK" dial: the loop does not change, only the client behind it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


@dataclass
class ToolCall:
    id: str
    name: str
    input: dict


@dataclass
class ModelResponse:
    """One model turn: either final text, or one-or-more tool_use requests."""

    text: str | None = None
    tool_calls: list[ToolCall] = field(default_factory=list)

    @property
    def wants_tool(self) -> bool:
        return bool(self.tool_calls)


class ModelClient(Protocol):
    async def complete(
        self, system: str, messages: list[dict], tools: list[dict]
    ) -> ModelResponse: ...


class ScriptedClient:
    """Returns a preloaded sequence of ModelResponses. For the gate."""

    def __init__(self, script: list[ModelResponse]):
        self._script = list(script)
        self._i = 0
        self.calls: list[dict] = []

    async def complete(self, system, messages, tools) -> ModelResponse:
        self.calls.append({"system": system, "messages": messages})
        if self._i >= len(self._script):
            return ModelResponse(text="(script exhausted)")
        r = self._script[self._i]
        self._i += 1
        return r


class NoKeyClient:
    """Used when no API key is configured: answers with a friendly nudge instead
    of erroring, so the endpoint is always well-behaved."""

    async def complete(self, system, messages, tools) -> ModelResponse:
        return ModelResponse(
            text=(
                "The Mechanic needs ANTHROPIC_API_KEY set (e.g. via Doppler) to think. "
                "It is not configured on this instance."
            )
        )


class AnthropicClient:
    """Runtime backend. Not exercised by the gate (needs a key); the loop that
    uses it is fully covered via ScriptedClient."""

    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model

    async def complete(self, system, messages, tools) -> ModelResponse:
        import anthropic

        client = anthropic.AsyncAnthropic(api_key=self.api_key)
        resp = await client.messages.create(
            model=self.model,
            system=system,
            messages=messages,
            tools=tools,
            max_tokens=1024,
        )
        text_parts: list[str] = []
        tool_calls: list[ToolCall] = []
        for block in resp.content:
            if block.type == "text":
                text_parts.append(block.text)
            elif block.type == "tool_use":
                tool_calls.append(ToolCall(id=block.id, name=block.name, input=dict(block.input)))
        return ModelResponse(
            text="".join(text_parts) if text_parts else None,
            tool_calls=tool_calls,
        )
