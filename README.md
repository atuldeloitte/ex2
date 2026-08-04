# Multi-Agent Inventory System

A multi-agent inventory assistant: small Node.js microservices own the
business data, a Python MCP server exposes them as tools, a LangGraph
multi-agent system (supervisor + specialists) talks to customers and
remembers context per customer, and a React chatbot frontend is the one
surface for everything - checking stock, adding or updating products, and
seeing total inventory value.

```
 browser                customer message
    |                          |
    v                          v
+-----------+   AG-UI    +-------------------+        +--------------------+        +--------------------+
| frontend/ | <--HTTP--> |  LangGraph graph  |        |    MCP server      |        |   Node.js modules  |
| React chat|  (stream)  |  (python-agents)  |        | (python-agents/    |        | (node-services/)   |
+-----------+            |                   |        |  mcp_server)        |        |                    |
                          |  supervisor  ---> |        |                     |        |                    |
                          |    |-> inventory  | --MCP->|  list_stock          |--HTTP->|  stock-service     |
                          |    |    agent     |        |  update_stock_item   |        |  (per-customer     |
                          |    |-> general    |        |  get_inventory_summary|       |   stock + price)   |
                          |         agent     |        |  ...                 |        |                    |
                          |                   |        |                     |        |  (more modules to  |
                          |  AsyncSqliteSaver  |        |                     |        |   come: orders,    |
                          |  memory, keyed by |        |                     |        |   suppliers, ...)  |
                          |  customer_id      |        |                     |        |                    |
                          +-------------------+        +--------------------+        +--------------------+
```

- **Chatbot-only interface**: the frontend has no separate CRUD forms - every
  action (add a product, check stock, update a price, get total inventory
  value) happens by talking to the agent. `agui_server.py` exposes the exact
  same LangGraph graph the CLI uses, over the
  [AG-UI](https://github.com/ag-ui-protocol/ag-ui) protocol, so the frontend
  is just another AG-UI client.
- **Multi-tenant by customer**: every layer is scoped by `customer_id` — the
  Node routes (`/customers/:customerId/...`), the MCP tools (`customer_id`
  argument on every call), the agent memory (`thread_id = customer_id` in the
  LangGraph checkpointer), and the frontend's AG-UI thread. One deployment
  serves many customers without their data or conversation history mixing.
- **Remembers context**: LangGraph's `AsyncSqliteSaver` checkpointer persists
  conversation state to disk, keyed per customer, so the assistant remembers
  earlier turns even across restarts.
- **Small, focused Node.js modules**: `stock-service` is the first of
  several planned inventory microservices (orders, suppliers, warehouse
  locations, ...), each a separate small project under `node-services/`.

## Layout

```
node-services/
  stock-service/     Node.js/Express - per-customer stock levels + price
python-agents/
  mcp_server/         Python MCP server wrapping the Node services as tools
  agents/              LangGraph supervisor + specialist agents
  main.py              CLI entrypoint
  agui_server.py       AG-UI (FastAPI) endpoint for the web frontend
frontend/
  src/                 React + TypeScript chatbot UI (@ag-ui/client)
```

## Run it end to end

```bash
# 1. stock-service
cd node-services/stock-service
npm install && cp .env.example .env
npm start                              # http://localhost:4001

# 2. MCP server (new terminal)
cd python-agents
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env                   # set ANTHROPIC_API_KEY
set -a && source .env && set +a
.venv/bin/python mcp_server/server.py  # http://127.0.0.1:8000

# 3a. Agent CLI (new terminal) ...
cd python-agents
set -a && source .env && set +a
.venv/bin/python main.py --customer-id acme

# 3b. ... or the AG-UI server + web frontend, instead of/alongside the CLI
cd python-agents
set -a && source .env && set +a
.venv/bin/python agui_server.py        # http://localhost:8010

cd frontend                            # new terminal
npm install && cp .env.example .env
npm run dev                            # http://localhost:5173
```

See each project's own README for details:
[`node-services/stock-service/README.md`](node-services/stock-service/README.md),
[`python-agents/README.md`](python-agents/README.md),
[`frontend/README.md`](frontend/README.md).

## Adding the next inventory module

1. Copy the shape of `stock-service`: an Express app scoped under
   `/customers/:customerId/...`, its own `package.json`.
2. Add tools for it in `python-agents/mcp_server/server.py` (same
   `customer_id`-first convention).
3. The existing `inventory_agent` picks up new MCP tools automatically; add
   a new specialist node in `agents/supervisor.py` only if the domain is
   different enough to deserve its own agent and its own supervisor route.
4. Nothing to do on the frontend - it only ever talks to the agent, not to
   individual services.
