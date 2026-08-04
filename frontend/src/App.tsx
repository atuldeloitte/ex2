import { useEffect, useMemo, useRef, useState } from "react";
import { HttpAgent } from "@ag-ui/client";
import type { Message } from "@ag-ui/client";

const AGUI_URL = import.meta.env.VITE_AGUI_URL ?? "http://localhost:8010/agentic_chat";

function toolCallSummary(message: Message): string[] {
  if (message.role !== "assistant" || !message.toolCalls) return [];
  return message.toolCalls.map((tc) => `calling ${tc.function.name}(${tc.function.arguments})`);
}

export default function App() {
  const [customerId, setCustomerId] = useState("acme");
  const [pendingCustomerId, setPendingCustomerId] = useState("acme");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const agent = useMemo(() => {
    return new HttpAgent({
      url: AGUI_URL,
      threadId: customerId,
      initialState: { customer_id: customerId },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  useEffect(() => {
    setMessages([]);
    setError(null);
    const { unsubscribe } = agent.subscribe({
      onEvent: ({ messages: liveMessages }) => setMessages([...liveMessages]),
      onRunFailed: ({ error: err }) => setError(err.message),
      onRunFinalized: () => setIsRunning(false),
    });
    return unsubscribe;
  }, [agent]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || isRunning) return;
    setInput("");
    setError(null);
    setIsRunning(true);
    agent.addMessage({ id: crypto.randomUUID(), role: "user", content: text });
    try {
      await agent.runAgent();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  }

  function switchCustomer() {
    const next = pendingCustomerId.trim();
    if (next && next !== customerId) setCustomerId(next);
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Inventory Assistant</h1>
        <div className="customer-switcher">
          <label htmlFor="customer-id">Customer</label>
          <input
            id="customer-id"
            value={pendingCustomerId}
            onChange={(e) => setPendingCustomerId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && switchCustomer()}
          />
          <button onClick={switchCustomer}>Switch</button>
        </div>
      </header>

      <p className="hint">
        Everything happens in chat: try "what's low on stock?", "add 20 units of SKU-100 called
        Foo Widget at $4.50", "what's my total inventory value?", or "update the price of
        WIDGET-001 to 12.99".
      </p>

      <main className="chat">
        {messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => (
            <div key={m.id} className={`bubble ${m.role}`}>
              {typeof m.content === "string" && m.content.length > 0 && <p>{m.content}</p>}
              {toolCallSummary(m).map((line, i) => (
                <p key={i} className="tool-call">
                  {line}
                </p>
              ))}
            </div>
          ))}
        {isRunning && <div className="bubble assistant pending">thinking...</div>}
        <div ref={bottomRef} />
      </main>

      {error && <div className="error">{error}</div>}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Message the assistant for ${customerId}...`}
          disabled={isRunning}
        />
        <button type="submit" disabled={isRunning || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
