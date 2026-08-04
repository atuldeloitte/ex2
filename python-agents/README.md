# python-agents

The multi-agent brain of the system: a LangGraph supervisor that routes each
customer message to a specialist agent, backed by an MCP server that exposes
the Node.js inventory microservices as tools.

## Components

- `mcp_server/server.py` — MCP server (streamable-http, port 8000). Wraps
  `stock-service` as tools (`list_stock`, `get_stock_item`, `create_stock_item`,
  `update_stock_item`, `adjust_stock`, `delete_stock_item`, `list_low_stock`,
  `get_inventory_summary`). Every tool takes `customer_id` so one server
  instance serves every customer without mixing up their data.
- `agents/supervisor.py` — the LangGraph graph. A `supervisor` node classifies
  each message ("inventory" vs "general") and routes it; `inventory_agent`
  is a ReAct agent wired to the MCP tools; `general_agent` handles anything
  else.
- `agents/memory.py` — an `AsyncSqliteSaver` checkpointer. Conversations are
  keyed by `thread_id = customer_id`, so each customer's conversation history
  and agent state persists across turns and across restarts. It's the async
  variant because both the CLI (`graph.ainvoke`) and the AG-UI server need
  async checkpoint methods, which the sync `SqliteSaver` doesn't implement.
- `main.py` — interactive CLI: `python main.py --customer-id acme`.
- `agui_server.py` — FastAPI app exposing the same graph over
  [AG-UI](https://github.com/ag-ui-protocol/ag-ui) (streamable HTTP, port
  8010 by default) for the `frontend/` chat UI, via `ag-ui-langgraph`.

## Run

1. Start `stock-service` first (see `../node-services/stock-service`).
2. Set up the venv and MCP server:
   ```bash
   python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
   cp .env.example .env   # fill in ANTHROPIC_API_KEY
   set -a && source .env && set +a
   .venv/bin/python mcp_server/server.py
   ```
3. Either the CLI, or the AG-UI server for the web frontend (in a new terminal,
   with the venv/env vars set the same way):
   ```bash
   .venv/bin/python main.py --customer-id acme
   # or
   .venv/bin/python agui_server.py
   ```

Try asking things like "what's low on stock for acme?", "add 10 units of
WIDGET-001", or "what's my total inventory value?" — those get routed to the
inventory agent, which calls the MCP tools scoped to that customer. Ask
something unrelated and it's routed to the general agent instead. Run the
CLI again later with the same `--customer-id` and the conversation history is
still there, loaded from `agent_memory.db`.

## Extending

Adding a new Node.js inventory module (orders, suppliers, ...) means: stand
up the service, add tools for it to `mcp_server/server.py`, and either let
`inventory_agent` pick them up automatically (it loads all tools from the MCP
server) or add a new specialist node + supervisor route if the domain is
different enough to warrant its own agent.

## Note on dependencies

- `mcp` is pinned to `<2.0.0` because `langchain-mcp-adapters` (as of 0.3.1)
  hasn't been updated for the breaking changes in `mcp` 2.0.0's internal APIs
  (`mcp.server.fastmcp.FastMCP` was renamed/restructured, `mcp.shared.context`
  lost `RequestContext`). If you bump `mcp`, re-check that adapter first.
- `agents/state.py` imports `TypedDict` from `typing_extensions`, not `typing`.
  Pydantic v2 refuses to build a schema from a stdlib `typing.TypedDict` on
  Python <3.12, which `ag-ui-langgraph`'s schema introspection needs to do.
- `agui_server.py` defines `SafeLangGraphAgent`, a small subclass working
  around a real bug in `ag-ui-langgraph` 0.0.42: its `get_schema_keys()`
  means to fall back gracefully when schema introspection fails, but its
  `except` clause only catches `ValueError`, not pydantic's
  `PydanticUserError` (a `RuntimeError` subclass) - which is exactly what the
  TypedDict issue above raises. Without the subclass, one request can crash
  the whole server. If a future `ag-ui-langgraph` release fixes this, the
  subclass can be dropped.
