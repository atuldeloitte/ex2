import argparse
import asyncio

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage

from agents.memory import open_checkpointer
from agents.supervisor import build_graph

load_dotenv()


async def run(customer_id: str):
    async with open_checkpointer() as checkpointer:
        graph = build_graph(checkpointer)
        config = {"configurable": {"thread_id": customer_id}}

        print(f"Inventory assistant ready for customer '{customer_id}'. Ctrl-C to exit.")
        while True:
            try:
                text = input("> ").strip()
            except (EOFError, KeyboardInterrupt):
                break
            if not text:
                continue

            result = await graph.ainvoke(
                {"messages": [HumanMessage(content=text)], "customer_id": customer_id},
                config=config,
            )
            print(result["messages"][-1].content)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Multi-agent inventory assistant")
    parser.add_argument("--customer-id", required=True, help="Customer/tenant id, e.g. 'acme'")
    args = parser.parse_args()
    asyncio.run(run(args.customer_id))
