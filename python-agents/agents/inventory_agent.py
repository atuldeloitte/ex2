import os

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.prebuilt import create_react_agent

_agent = None


async def _get_agent():
    """Lazily build (once) the inventory ReAct agent from the MCP server's tools."""
    global _agent
    if _agent is not None:
        return _agent

    mcp_url = os.environ.get("MCP_SERVER_URL", "http://127.0.0.1:8000/mcp")
    client = MultiServerMCPClient(
        {"inventory": {"url": mcp_url, "transport": "streamable_http"}}
    )
    tools = await client.get_tools()

    model = ChatAnthropic(model=os.environ.get("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest"))
    _agent = create_react_agent(model, tools)
    return _agent


async def inventory_node(state: dict) -> dict:
    agent = await _get_agent()
    customer_id = state["customer_id"]

    system = SystemMessage(
        content=(
            f"You are the inventory specialist for customer_id='{customer_id}'. "
            "Always pass this exact customer_id to every tool call you make - "
            "never guess or use a different customer_id. Be concise."
        )
    )
    input_messages = [system, *state["messages"]]
    result = await agent.ainvoke({"messages": input_messages})

    new_messages = result["messages"][len(input_messages):]
    return {"messages": new_messages}
