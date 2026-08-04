# Multi-Agent Inventory System

A multi-agent inventory assistant: small Node.js microservices own the
business data, a Python MCP server exposes them as tools, and a LangGraph
multi-agent system (supervisor + specialists) talks to customers and
remembers context per customer.

```
 customer message
        |
        v
+-------------------+        +--------------------+        +--------------------+
|  LangGraph graph  |        |    MCP server      |        |   Node.js modules  |
|  (python-agents)  |        | (python-agents/    |        | (node-services/)   |
|                   |        |  mcp_server)        |        |                    |
|  supervisor  ---> |        |                     |        |                    |
|    |-> inventory  | --MCP->|  list_stock          |--HTTP->|  stock-service     |
|    |    agent     |        |  adjust_stock        |        |  (per-customer     |
|    |-> general    |        |  create_stock_item   |        |   stock levels)    |
|         agent     |        |  ...                 |        |                    |
|                   |        |                     |        |  (more modules to  |
|  SqliteSaver      |        |                     |        |   come: orders,    |
|  memory, keyed by |        |                     |        |   suppliers, ...)  |
|  customer_id      |        |                     |        |                    |
+-------------------+        +--------------------+        +--------------------+
```

- **Multi-tenant by customer**: every layer is scoped by `customer_id` — the
  Node routes (`/customers/:customerId/...`), the MCP tools (`customer_id`
  argument on every call), and the agent memory (`thread_id = customer_id`
  in the LangGraph checkpointer). One deployment serves many customers
  without their data or conversation history mixing.
- **Remembers context**: LangGraph's `SqliteSaver` checkpointer persists
  conversation state to disk, keyed per customer, so the assistant
  remembers earlier turns even across restarts.
- **Small, focused Node.js modules**: `stock-service` is the first of
  several planned inventory microservices (orders, suppliers, warehouse
  locations, ...), each a separate small project under `node-services/`.

## Layout

```
node-services/
  stock-service/     Node.js/Express - per-customer stock levels
python-agents/
  mcp_server/         Python MCP server wrapping the Node services as tools
  agents/              LangGraph supervisor + specialist agents
  main.py              CLI entrypoint
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

# 3. Agent CLI (new terminal)
cd python-agents
set -a && source .env && set +a
.venv/bin/python main.py --customer-id acme
```

See each project's own README for details:
[`node-services/stock-service/README.md`](node-services/stock-service/README.md),
[`python-agents/README.md`](python-agents/README.md).

## Adding the next inventory module

1. Copy the shape of `stock-service`: an Express app scoped under
   `/customers/:customerId/...`, its own `package.json`.
2. Add tools for it in `python-agents/mcp_server/server.py` (same
   `customer_id`-first convention).
3. The existing `inventory_agent` picks up new MCP tools automatically; add
   a new specialist node in `agents/supervisor.py` only if the domain is
   different enough to deserve its own agent and its own supervisor route.
