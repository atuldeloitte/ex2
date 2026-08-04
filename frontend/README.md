# frontend

A minimal React + TypeScript chat UI. This is a chatbot-only interface: there
are no separate "add product" forms or stock tables — everything (checking
stock, adding or updating products, seeing total inventory value) happens by
talking to the agent, the same way it would over `python-agents/main.py`.

It connects to the [AG-UI](https://github.com/ag-ui-protocol/ag-ui) endpoint
exposed by `python-agents/agui_server.py` using
[`@ag-ui/client`](https://www.npmjs.com/package/@ag-ui/client)'s `HttpAgent`,
which streams the same LangGraph supervisor/inventory-agent run this repo's
CLI uses.

## How it maps onto the rest of the system

- The "Customer" field in the header sets both the AG-UI `threadId` and the
  `customer_id` passed in as agent state, so switching it switches which
  customer's inventory/context you're talking to and the checkpointer memory
  (`agent_memory.db`) is keyed by exactly this ID - same as the CLI's
  `--customer-id`.
- Every chat turn calls `agent.runAgent()`, which POSTs to the AG-UI endpoint
  and streams events back (`RUN_STARTED`, text deltas, tool calls, ...); the
  UI just re-renders `agent.messages` on every event.

## Run

```bash
npm install
cp .env.example .env   # VITE_AGUI_URL should point at agui_server.py
npm run dev             # http://localhost:5173
```

Requires `node-services/stock-service`, `python-agents/mcp_server/server.py`,
and `python-agents/agui_server.py` all running (see the root README).

## Troubleshooting

- **CORS error in the browser console**: `agui_server.py`'s
  `AGUI_ALLOWED_ORIGINS` must include the exact origin this dev server is
  served from (`http://localhost:5173` and `http://127.0.0.1:5173` are both
  allowed by default - they're different origins to a browser).
- **A message sends but immediately shows "network error"**: the AG-UI
  backend hit an unhandled error mid-stream (most commonly a missing/invalid
  `ANTHROPIC_API_KEY` in `python-agents/.env`) and closed the connection
  before it could send a clean error event. Check `agui_server.py`'s logs.
