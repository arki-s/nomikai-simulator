import { CHARACTERS } from "../characters";
import { ACTION_LABELS } from "../rules";
import type { SimulationEvent } from "../types";

export function TurnEvents({ events }: { events: SimulationEvent[] }) {
  const signed = (value: number) => value > 0 ? `+${value}` : String(value);
  // 確定イベントのみを表示し、AIの文章から状態変化を推測しない。
  return (
    <section aria-label="このターンの出来事" aria-live="polite" aria-atomic="true" className="rounded-2xl border border-stone-300 p-6 dark:border-stone-700">
      <h2 className="mb-4 text-lg font-bold">このターンの出来事</h2>
      {events.length === 0 && <p className="text-stone-600 dark:text-stone-300">準備ができました。「次のターン」で飲み会を進めてください。</p>}
      {events.map((event) => {
        const name = CHARACTERS.find(({ id }) => id === event.characterId)!.name;
        return event.type === "action" ? (
          <div key={`${event.turn}-action`}>
            <p className="text-xl font-bold">{name}：{ACTION_LABELS[event.action]}</p>
            <p className="mt-2 tabular-nums">酔い {signed(event.delta.drunkenness)} ／ 満腹 {signed(event.delta.fullness)}</p>
            <p className="mt-3 text-sm text-stone-600 dark:text-stone-300">{event.reason}</p>
          </div>
        ) : (
          <div key={`${event.turn}-speech`} className="mt-5 rounded-xl bg-stone-100 p-4 dark:bg-stone-800">
            <p className="mb-2 text-sm font-bold">{name}の発言</p>
            <p className="whitespace-pre-wrap break-words leading-7">「{event.text}」</p>
            <p className="mt-3 text-xs text-stone-600 dark:text-stone-300">{event.source === "ai" ? "AI生成のセリフ" : "定型セリフ（AIを利用できないため）"}</p>
          </div>
        );
      })}
    </section>
  );
}
