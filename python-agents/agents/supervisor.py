import os
from typing import Literal

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, StateGraph
from pydantic import BaseModel, Field

from agents.inventory_agent import inventory_node
from agents.state import AgentState

ROUTER_PROMPT = (
    "You route customer support messages for an inventory management system. "
    "If the message is about stock levels, SKUs, quantities, reordering, or "
    "creating/adjusting/deleting inventory items, route to 'inventory'. "
    "Otherwise (greetings, small talk, unrelated questions), route to 'general'."
)


class RouteDecision(BaseModel):
    destination: Literal["inventory", "general"] = Field(
        description="Which specialist should handle this message"
    )


def _model():
    return ChatAnthropic(model=os.environ.get("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest"))


async def supervisor_node(state: AgentState) -> dict:
    last_human = next(
        (m for m in reversed(state["messages"]) if isinstance(m, HumanMessage)), None
    )
    router = _model().with_structured_output(RouteDecision)
    decision = await router.ainvoke(
        [SystemMessage(content=ROUTER_PROMPT), last_human or HumanMessage(content="")]
    )
    return {"next": decision.destination}


async def general_node(state: AgentState) -> dict:
    system = SystemMessage(
        content="You are a helpful assistant for an inventory management platform. "
        "You only handle general conversation - inventory-specific questions are "
        "routed elsewhere. Be concise."
    )
    response = await _model().ainvoke([system, *state["messages"]])
    return {"messages": [response]}


def build_graph(checkpointer):
    graph = StateGraph(AgentState)
    graph.add_node("supervisor", supervisor_node)
    graph.add_node("inventory_agent", inventory_node)
    graph.add_node("general_agent", general_node)

    graph.set_entry_point("supervisor")
    graph.add_conditional_edges(
        "supervisor",
        lambda state: state["next"],
        {"inventory": "inventory_agent", "general": "general_agent"},
    )
    graph.add_edge("inventory_agent", END)
    graph.add_edge("general_agent", END)

    return graph.compile(checkpointer=checkpointer)
