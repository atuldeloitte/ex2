import os

from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver


def open_checkpointer():
    """Durable per-customer memory: conversations are keyed by thread_id = customer_id,
    so context is remembered across turns and across process restarts. Async because
    both the CLI (graph.ainvoke) and the AG-UI server need async checkpoint methods,
    which the sync SqliteSaver doesn't implement."""
    db_path = os.environ.get("AGENT_MEMORY_DB", "agent_memory.db")
    return AsyncSqliteSaver.from_conn_string(db_path)
