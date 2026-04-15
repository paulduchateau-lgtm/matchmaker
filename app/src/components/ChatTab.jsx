import { useState, useEffect, useRef } from "react";
import { Send, Trash2, MessageSquare, Loader2 } from "lucide-react";
import { getChatHistory, sendChatMessage, clearChat } from "../lib/api";

export function ChatTab({ workspaceId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    getChatHistory(workspaceId).then(setMessages).catch(console.error);
  }, [workspaceId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg, id: "temp-" + Date.now() }]);
    setSending(true);
    try {
      const response = await sendChatMessage(workspaceId, userMsg);
      setMessages((prev) => [...prev, response]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Erreur : " + err.message, id: "err-" + Date.now() }]);
    } finally {
      setSending(false);
    }
  }

  async function handleClear() {
    if (!confirm("Effacer l'historique de conversation ?")) return;
    await clearChat(workspaceId);
    setMessages([]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 380px)", minHeight: 400 }}>
      <div className="section-header">
        <h2 className="section-title">Chat</h2>
        {messages.length > 0 && (
          <button className="btn btn--danger btn--sm" onClick={handleClear}>
            <Trash2 size={14} /> Effacer
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: "var(--sp-3)", paddingBottom: "var(--sp-4)" }}>
        {messages.length === 0 && (
          <div className="empty-state" style={{ paddingTop: "var(--sp-10)" }}>
            <div className="empty-state__icon"><MessageSquare size={40} /></div>
            <div className="empty-state__title">Discutez avec Matchmaker</div>
            <p>Affinez vos besoins, demandez des suggestions de matching, ou posez des questions sur votre AO.</p>
            <div style={{ marginTop: "var(--sp-4)", display: "flex", flexDirection: "column", gap: "var(--sp-2)", alignItems: "center" }}>
              {["Quelles ressources correspondent le mieux au préambule ?",
                "Il me faut des services orientés QVT pour cette AO",
                "Comment mettre en avant nos références dans le secteur bancaire ?",
              ].map((s, i) => (
                <button key={i} className="btn btn--secondary btn--sm" onClick={() => { setInput(s); }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={msg.id || i} style={{
            alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "80%",
          }}>
            <div style={{
              background: msg.role === "user" ? "rgba(165, 217, 0, 0.12)" : "#2A2926",
              border: "1px solid " + (msg.role === "user" ? "rgba(165, 217, 0, 0.25)" : "#363530"),
              borderRadius: "var(--radius-t2)",
              padding: "var(--sp-3) var(--sp-4)",
            }}>
              {msg.role === "assistant" && (
                <span className="ds-label" style={{ color: "var(--color-green)", marginBottom: "var(--sp-2)", display: "block" }}>
                  Matchmaker
                </span>
              )}
              <div style={{ whiteSpace: "pre-wrap", fontSize: "var(--text-body)", lineHeight: "var(--leading-relaxed)", color: "var(--color-paper)" }}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}

        {sending && (
          <div style={{ alignSelf: "flex-start" }}>
            <div style={{ background: "#2A2926", border: "1px solid #363530", borderRadius: "var(--radius-t2)", padding: "var(--sp-3) var(--sp-4)" }}>
              <Loader2 size={16} className="spin" style={{ color: "var(--color-green)" }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} style={{ display: "flex", gap: "var(--sp-2)", borderTop: "1px solid #363530", paddingTop: "var(--sp-3)" }}>
        <input
          className="form-input"
          style={{ flex: 1 }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Posez une question ou affinez vos critères..."
          disabled={sending}
        />
        <button type="submit" className="btn btn--primary" disabled={sending || !input.trim()}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
