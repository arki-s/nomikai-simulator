"use client";

import { useEffect, useRef, useState } from "react";
import { createInitialState } from "./characters";
import { MAX_RECENT_SPEECHES, MAX_TURNS } from "./types";
import type { SimulationState, SpeechEvent, TurnResponse } from "./types";
import { isTurnResponse } from "./validation";

export function useNomikai() {
  // 状態とイベントを同時に差し替え、メーターと表示内容のずれを防ぐ。
  const [result, setResult] = useState<TurnResponse | null>(null);
  const [recentSpeeches, setRecentSpeeches] = useState<SpeechEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef<AbortController | null>(null);
  useEffect(() => () => inFlight.current?.abort(), []);

  function start() {
    if (inFlight.current) return;
    setResult({ state: createInitialState(), events: [] });
    setRecentSpeeches([]);
    setError("");
  }

  async function nextTurn() {
    // Reactの再描画前の連打も止めるため、同期的に更新できるrefを使う。
    if (inFlight.current || !result || result.state.turn >= MAX_TURNS) return;
    const previous: SimulationState = result.state;
    const controller = new AbortController();
    inFlight.current = controller;
    setLoading(true);
    setError("");
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch("/api/nomikai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: previous, recentSpeeches }), signal: controller.signal,
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const message = typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
          ? data.error : "ターンを進められませんでした";
        throw new Error(message);
      }
      if (!isTurnResponse(data, previous)) throw new Error("応答の形式が不正です");
      if (controller.signal.aborted) return;
      setResult(data);
      setRecentSpeeches((history) => [...history, ...data.events.filter((event): event is SpeechEvent => event.type === "speech")].slice(-MAX_RECENT_SPEECHES));
    } catch (cause) {
      // 成功前に状態を更新しないことで、通信失敗時に同じ地点から再試行できる。
      setError(controller.signal.aborted
        ? "通信がタイムアウトしました。状態は変更していません。"
        : cause instanceof TypeError
          ? "通信エラーが発生しました。状態は変更していません。"
          : cause instanceof Error ? cause.message : "通信エラーが発生しました");
    } finally {
      clearTimeout(timeout);
      inFlight.current = null;
      setLoading(false);
    }
  }
  return { result, loading, error, start, nextTurn, finished: result !== null && result.state.turn >= MAX_TURNS };
}
