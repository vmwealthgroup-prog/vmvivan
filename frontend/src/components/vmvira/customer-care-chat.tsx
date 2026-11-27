import { useEffect, useRef, useState, type FormEvent } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { sendCustomerCareMessage } from "@/lib/customer-care.functions";

type ChatMessage = { role: "user" | "assistant"; content: string };

export function CustomerCareChat() {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hello! I’m the VMVIRA customer-care assistant. How can I help you today?" },
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setConversationId(crypto.randomUUID()); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy || !conversationId) return;
    const next = [...messages, { role: "user" as const, content: message }];
    setMessages(next);
    setDraft("");
    setBusy(true);
    setError("");
    try {
      const result = await sendCustomerCareMessage({
        data: { conversationId, message, history: next.slice(-10) },
      });
      setMessages((current) => [...current, { role: "assistant", content: result.answer }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to reach customer care. Please use the contact form.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="fixed bottom-5 right-5 z-50 font-sans">
    {open ? <section aria-label="VMVIRA customer care chat" className="mb-3 flex h-[min(640px,75vh)] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden border border-line bg-surface shadow-2xl">
      <header className="flex items-center justify-between border-b border-line bg-bg px-4 py-3">
        <div><p className="font-medium">VMVIRA Customer Care</p><p className="text-xs text-muted">AI assistant · Please don’t share passwords or OTPs</p></div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="grid size-9 place-items-center border border-line"><X size={18}/></button>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
        {messages.map((item, index) => <div key={`${index}-${item.role}`} className={`max-w-[88%] whitespace-pre-wrap rounded-sm px-3 py-2 text-sm ${item.role === "user" ? "ml-auto bg-primary text-primary-fg" : "border border-line bg-bg text-fg"}`}>{item.content}</div>)}
        {busy && <p className="text-xs text-muted">VMVIRA assistant is typing…</p>}
        {error && <p role="alert" className="border border-red-500/40 bg-red-500/10 p-2 text-xs text-fg">{error} You can also use the Contact section on this page.</p>}
        <div ref={endRef}/>
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-line p-3">
        <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} placeholder="Type your question…" aria-label="Your message" className="min-w-0 flex-1 border border-line bg-bg px-3 text-sm text-fg outline-none focus:border-primary" />
        <button type="submit" disabled={busy || !draft.trim() || !conversationId} aria-label="Send message" className="grid size-11 shrink-0 place-items-center bg-primary text-primary-fg disabled:opacity-50"><Send size={17}/></button>
      </form>
    </section> : null}
    <button type="button" onClick={() => setOpen((value) => !value)} className="ml-auto flex min-h-14 items-center gap-2 bg-primary px-5 font-medium text-primary-fg shadow-xl" aria-expanded={open}>
      {open ? <X size={19}/> : <MessageCircle size={19}/>} {open ? "Close" : "Chat with us"}
    </button>
  </div>;
}
