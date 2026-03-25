"use client";

import { useState } from "react";

type Message = {
  name: string;
  text: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const startNomikai = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/nomikai");

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "飲み会の開催に失敗しました");
        return;
      }

      setMessages(data.messages || []);
    } catch (e) {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: "24px", maxWidth: "800px", margin: "0 auto" }}>
      <h1>🍻 飲み会シミュレーター</h1>
      <p>AIが勝手に飲み会を開催する地獄装置</p>

      <button
        onClick={startNomikai}
        disabled={loading}
        style={{
          padding: "12px 16px",
          borderRadius: "8px",
          border: "1px solid #ccc",
          cursor: "pointer",
          marginTop: "12px",
        }}
      >
        {loading ? "開催中..." : "飲み会開始"}
      </button>

      {error && (
        <p style={{ color: "crimson", marginTop: "16px" }}>{error}</p>
      )}

      <div style={{ marginTop: "24px", display: "grid", gap: "12px" }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              padding: "12px",
              border: "1px solid #ddd",
              borderRadius: "8px",
            }}
          >
            <strong>{m.name}</strong>
            <p style={{ margin: "8px 0 0" }}>{m.text}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
