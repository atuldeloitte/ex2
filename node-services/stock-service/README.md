# stock-service

Small Node.js/Express microservice that tracks per-customer stock levels. Multi-tenant: every route is scoped under `/customers/:customerId/...`, so each customer's inventory is isolated.

## Run

```bash
npm install
cp .env.example .env
npm start
```

Defaults to `http://localhost:4001`. Seeded with a demo customer `acme` (SKUs `WIDGET-001`, `GADGET-002`).

## API

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/customers/:customerId/stock` | List all stock items for a customer |
| GET | `/customers/:customerId/stock/low` | List items at or below their reorder threshold |
| GET | `/customers/:customerId/stock/:sku` | Get one item |
| POST | `/customers/:customerId/stock` | Create an item `{ sku, name, quantity, reorderThreshold }` |
| PATCH | `/customers/:customerId/stock/:sku` | Update fields on an item |
| POST | `/customers/:customerId/stock/:sku/adjust` | Adjust quantity by `{ delta }` (negative to decrement); rejects if it would go below 0 |
| DELETE | `/customers/:customerId/stock/:sku` | Remove an item |

This is the first of what's meant to be several small inventory microservices (orders, suppliers, warehouse locations, ...) — each following the same per-customer routing convention, so the MCP server / agents can address any of them the same way.
