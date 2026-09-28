import { useEffect, useRef, useState } from "react";
import { appendTurnResult, createInitialState, defaultConfig, latestEvents, recentSpeeches } from "./simulation";
import { MAX_TURNS } from "./types";
import type { SimulationConfig, TurnResponse } from "./types";
import { isTurnResponse } from "./validation";

export function useNomikai() {
  // 全イベントを唯一の履歴とし、最新表示・AI文脈をそこから導出する。
  const [result, setResult] = useState<TurnResponse | null>(null);
  const [config, setConfig] = useState<SimulationConfig>(defaultConfig);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef<AbortController | null>(null);
  useEffect(() => () => inFlight.current?.abort(), []);

  function start(selected: SimulationConfig = config) {
    if (inFlight.current) return;
    const state = createInitialState(selected);
    setConfig(state.config);
    setResult({ state, events: [] });
    setError("");
  }
  function configure() {
    if (inFlight.current) return;
    setResult(null);
    setError("");
  }
  async function nextTurn() {
    // 再描画前の連打も同期的なrefで遮断する。失敗時の自動再送はしない。
    if (inFlight.current || !result || result.state.turn >= MAX_TURNS) return;
    const previous = result;
    const controller = new AbortController();
    inFlight.current = controller;
    setLoading(true);
    setError("");
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch("/api/nomikai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: previous.state, recentSpeeches: recentSpeeches(previous.events) }), signal: controller.signal,
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const message = typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
          ? data.error : "ターンを進められませんでした";
        throw new Error(message);
      }
      if (!isTurnResponse(data, previous.state)) throw new Error("応答の形式が不正です");
      if (controller.signal.aborted) return;
      // 成功した1ターンの状態とログを一緒に反映し、途中の表示ずれを防ぐ。
      setResult(appendTurnResult(previous, data));
    } catch (cause) {
      setError(controller.signal.aborted
        ? "通信がタイムアウトしました。状態とログは変更していません。"
        : cause instanceof TypeError
          ? "通信エラーが発生しました。状態とログは変更していません。"
          : cause instanceof Error ? cause.message : "通信エラーが発生しました");
    } finally {
      clearTimeout(timeout);
      inFlight.current = null;
      setLoading(false);
    }
  }
  return { result, config, loading, error, start, configure, nextTurn,
    turnEvents: result ? latestEvents(result) : [], finished: result !== null && result.state.turn >= MAX_TURNS };
}
