# @amotion/adapters-langgraph

Initial LangGraph-facing adapter helpers for amotion.

This package is intentionally thin. It does not own the user's graph and it
does not persist `AgentRuntime`. Instead it provides:

- serializable amotion graph state
- a policy node that rebuilds `AgentRuntime` from checkpointed state
- route helpers for `proceed / verify / replan / escalate / abort`
- confirmation interrupt helpers that require explicit irreversible-action annotation
- observable tool success/error signal helpers
- a deterministic fake-graph comparative bench

## Phase 1 Scope

The first implementation avoids importing LangGraph directly. The API is shaped
for LangGraph state/node/routing patterns, while tests use a deterministic fake
graph so the adapter can produce comparative metrics before the public API
hardens.

The fake bench compares:

```text
naive loop      -> retries until max steps
governed loop   -> feeds tool signals into AgentRuntime and routes by policy
```

Metrics include tool calls, wasted calls, step exhaustion, abort latency, and
success regression on a recoverable case.

## Non-Goals

- No automatic irreversibility detection.
- No automatic stall detection.
- Retry detection is exposed only as best-effort.
- User affect is not route authority.
- Parallel branch merge is deduplicated by signal record id; complex graph
  semantics should provide stable ids.

