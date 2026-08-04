"""MCP server that exposes the stock-service inventory module as tools.

Every tool takes `customer_id` as its first argument so a single server
instance can serve many customers without leaking data between them; each
call is proxied straight through to the Node.js stock-service over HTTP.
"""
import os

import httpx
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

load_dotenv()

STOCK_SERVICE_URL = os.environ.get("STOCK_SERVICE_URL", "http://localhost:4001")
MCP_SERVER_HOST = os.environ.get("MCP_SERVER_HOST", "127.0.0.1")
MCP_SERVER_PORT = int(os.environ.get("MCP_SERVER_PORT", "8000"))

mcp = FastMCP("inventory", host=MCP_SERVER_HOST, port=MCP_SERVER_PORT)


async def _request(method: str, path: str, **kwargs):
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.request(method, f"{STOCK_SERVICE_URL}{path}", **kwargs)
        if response.status_code == 404:
            return {"error": "not_found"}
        response.raise_for_status()
        if response.status_code == 204:
            return {"deleted": True}
        return response.json()


@mcp.tool()
async def list_stock(customer_id: str) -> dict:
    """List every stock item for a given customer."""
    return await _request("GET", f"/customers/{customer_id}/stock")


@mcp.tool()
async def list_low_stock(customer_id: str) -> dict:
    """List stock items at or below their reorder threshold for a customer."""
    return await _request("GET", f"/customers/{customer_id}/stock/low")


@mcp.tool()
async def get_stock_item(customer_id: str, sku: str) -> dict:
    """Get a single stock item by SKU for a customer."""
    return await _request("GET", f"/customers/{customer_id}/stock/{sku}")


@mcp.tool()
async def create_stock_item(
    customer_id: str,
    sku: str,
    name: str,
    quantity: int = 0,
    reorder_threshold: int = 5,
) -> dict:
    """Create a new stock item for a customer."""
    return await _request(
        "POST",
        f"/customers/{customer_id}/stock",
        json={
            "sku": sku,
            "name": name,
            "quantity": quantity,
            "reorderThreshold": reorder_threshold,
        },
    )


@mcp.tool()
async def adjust_stock(customer_id: str, sku: str, delta: int) -> dict:
    """Adjust a stock item's quantity by delta (negative to decrement). Fails if it would go below zero."""
    return await _request(
        "POST", f"/customers/{customer_id}/stock/{sku}/adjust", json={"delta": delta}
    )


@mcp.tool()
async def delete_stock_item(customer_id: str, sku: str) -> dict:
    """Delete a stock item for a customer."""
    return await _request("DELETE", f"/customers/{customer_id}/stock/{sku}")


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
