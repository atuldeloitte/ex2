import os

from langgraph.checkpoint.sqlite import SqliteSaver


def open_checkpointer():
    """Durable per-customer memory: conversations are keyed by thread_id = customer_id,
    so context is remembered across turns and across process restarts."""
    db_path = os.environ.get("AGENT_MEMORY_DB", "agent_memory.db")
    return SqliteSaver.from_conn_string(db_path)
