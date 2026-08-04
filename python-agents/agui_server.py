"""AG-UI-compliant HTTP endpoint for the LangGraph supervisor/inventory agent.

Wraps the same compiled graph used by main.py with ag-ui-langgraph, so any
AG-UI client (this repo's React frontend, or any other) can drive the agent
over a single streaming HTTP endpoint.
"""
import os
from contextlib import asynccontextmanager

from ag_ui_langgraph import LangGraphAgent, add_langgraph_fastapi_endpoint
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from agents.memory import open_checkpointer
from agents.supervisor import build_graph

load_dotenv()

AGUI_PATH = os.environ.get("AGUI_PATH", "/agentic_chat")
ALLOWED_ORIGINS = os.environ.get(
    "AGUI_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")


class SafeLangGraphAgent(LangGraphAgent):
    """ag-ui-langgraph 0.0.42's get_schema_keys() means to fall back to
    constant_schema_keys when schema introspection fails, but its except
    clause only catches ValueError - not pydantic's PydanticUserError, which
    is a RuntimeError subclass. That's exactly what LangGraph's TypedDict
    state schemas raise on Python <3.12 (see pydantic error u/typed-dict-
    version), so it crashes the whole request instead of falling back. This
    replicates the library's own intended fallback for that case."""

    def get_schema_keys(self, config):
        try:
            return super().get_schema_keys(config)
        except RuntimeError:
            return {
                "input": self.constant_schema_keys,
                "output": self.constant_schema_keys,
                "config": [],
                "context": [],
            }


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with open_checkpointer() as checkpointer:
        graph = build_graph(checkpointer)
        agent = SafeLangGraphAgent(
            name="inventory_assistant",
            graph=graph,
            description=(
                "Multi-agent inventory assistant: chat to check stock, add or "
                "update products, and see total inventory value."
            ),
        )
        add_langgraph_fastapi_endpoint(app, agent, path=AGUI_PATH)
        yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("AGUI_SERVER_PORT", "8010")))
