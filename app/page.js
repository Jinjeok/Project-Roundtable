"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "project-roundtable-session-id";
const QUICK_ACTIONS = [
  "문틈으로 안을 살펴본다",
  "목소리의 주인에게 말을 건다",
  "무기를 꺼내 들고 예배당으로 들어간다",
  "/help",
];

async function callGame(body) {
  const response = await fetch("/api/game", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "요청을 처리하지 못했습니다.");
  }
  return data;
}

export default function GameConsole() {
  const [session, setSession] = useState(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const chatEndRef = useRef(null);
  const logEndRef = useRef(null);

  useEffect(() => {
    const storedId = window.localStorage.getItem(STORAGE_KEY);
    callGame({ action: "start", sessionId: storedId })
      .then((data) => {
        setSession(data);
        window.localStorage.setItem(STORAGE_KEY, data.id);
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setBusy(false));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages.length, session?.debugLogs.length]);

  async function send(value) {
    const message = String(value ?? input).trim();
    if (!message || !session || busy) return;

    setBusy(true);
    setError("");
    setInput("");
    try {
      setSession(
        await callGame({ action: "message", sessionId: session.id, input: message })
      );
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setBusy(false);
    }
  }

  function copyConversation() {
    if (!session) return;
    const text = session.messages
      .map((m) => {
        const speaker = m.role === "player" ? "플레이어" : "Warden";
        return `${speaker}\n${m.content}`;
      })
      .join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function newSession() {
    if (busy) return;

    setBusy(true);
    setError("");
    window.localStorage.removeItem(STORAGE_KEY);
    try {
      const data = await callGame({ action: "start" });
      setSession(data);
      window.localStorage.setItem(STORAGE_KEY, data.id);
    } catch (startError) {
      setError(startError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">DEVELOPMENT CONSOLE</p>
          <h1>Project Round Table</h1>
        </div>
        <div className="status">
          <span>{session?.config.provider || "연결 중"}</span>
          {session?.config.openAIMode && <span>{session.config.openAIMode}</span>}
          {session?.config.gpt54Limit && (
            <span>GPT-5.4 {session.config.gpt54Limit.toLocaleString()} tokens/day</span>
          )}
          <button type="button" onClick={newSession} disabled={busy}>
            새 게임
          </button>
        </div>
      </header>

      <section className="workspace">
        <section className="panel chatPanel">
          <div className="panelHeader">
            <h2>플레이</h2>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>현재 HP {session?.state.characterHP ?? "-"}</span>
              <button
                type="button"
                onClick={copyConversation}
                disabled={!session || session.messages.length === 0}
                title="대화 전체 복사"
                style={{ fontSize: "0.75rem", padding: "2px 8px" }}
              >
                {copied ? "복사됨 ✓" : "대화 복사"}
              </button>
            </div>
          </div>
          <div className="messages">
            {session?.messages.map((message) => (
              <article className={`message ${message.role}`} key={message.id}>
                <p className="sender">{message.role === "player" ? "플레이어" : "Warden"}</p>
                <p className="content">{message.content}</p>
              </article>
            ))}
            {busy && session && <p className="thinking">Warden이 상황을 정리하고 있습니다...</p>}
            <div ref={chatEndRef} />
          </div>
          <div className="quickActions">
            {QUICK_ACTIONS.map((action) => (
              <button key={action} type="button" onClick={() => send(action)} disabled={busy}>
                {action}
              </button>
            ))}
          </div>
          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <textarea
              aria-label="행동 입력"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && event.metaKey) {
                  event.preventDefault();
                  send();
                }
              }}
              placeholder="무엇을 하시겠습니까? 예: 등불을 들고 안으로 들어간다"
              value={input}
            />
            <button type="submit" disabled={busy || !input.trim()}>
              진행
            </button>
          </form>
          {error && <p className="error">{error}</p>}
        </section>

        <aside className="panel debugPanel">
          <div className="panelHeader">
            <h2>Debug Log</h2>
            <span>{session?.debugLogs.length || 0} events</span>
          </div>
          <div className="logs">
            {session?.debugLogs.map((log) => (
              <article className={`log ${log.level}`} key={log.id}>
                <div>
                  <time>{new Date(log.timestamp).toLocaleTimeString("ko-KR")}</time>
                  <strong>{log.event}</strong>
                </div>
                <pre>{JSON.stringify(log.detail, null, 2)}</pre>
              </article>
            ))}
            <div ref={logEndRef} />
          </div>
        </aside>
      </section>
    </main>
  );
}
