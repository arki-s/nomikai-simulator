import { getCharacter } from "../characters";
import { getVenue } from "../venues";
import { ACTION_LABELS } from "../rules";
import type { SimulationEvent, VenueId } from "../types";

export function TurnEvents({ events, venueId, announce = true }: { events: SimulationEvent[]; venueId: VenueId; announce?: boolean }) {
  const signed = (value: number) => value > 0 ? `+${value}` : String(value);
  // 累積ログでは読み上げ通知を止め、毎ターン全履歴を読み直させない。
  return (
    <section aria-label={announce ? "このターンの出来事" : `ターン${events[0]?.turn}の出来事`} aria-live={announce ? "polite" : undefined} aria-atomic={announce ? true : undefined} className="rounded-2xl border border-stone-300 p-5 dark:border-stone-700">
      <h2 className="mb-3 font-bold">{announce ? "このターンの出来事" : `ターン ${events[0]?.turn}`}</h2>
      {events.length === 0 && <p className="text-sm text-stone-600 dark:text-stone-300">準備ができました。「次のターン」で飲み会を進めてください。</p>}
      {events.map((event) => {
        const name = getCharacter(event.characterId).name;
        if (event.type === "action") {
          const item = "menuItemId" in event ? getVenue(venueId).menu.find((item) => item.id === event.menuItemId) : undefined;
          return <div key={`${event.turn}-action`}>
            <p className="font-bold">{name}：{ACTION_LABELS[event.action]}{item ? `（${item.name}）` : ""}</p>
            <p className="mt-2 text-sm tabular-nums">酔い {signed(event.delta.drunkenness)} ／ 満腹 {signed(event.delta.fullness)}</p>
            <details className="mt-3 text-xs leading-6 text-stone-600 dark:text-stone-300"><summary className="cursor-pointer">行動の理由</summary>{event.reason}</details>
          </div>;
        }
        return <div key={`${event.turn}-speech`} className="mt-4 rounded-xl bg-stone-100 p-4 dark:bg-stone-800">
          <p className="mb-2 text-sm font-bold">{name}の発言</p>
          <p className="whitespace-pre-wrap break-words leading-7">「{event.text}」</p>
          <p className="mt-2 text-xs text-stone-600 dark:text-stone-300">{event.source === "ai" ? "AI生成のセリフ" : event.fallbackReason === "budget_exhausted" ? "定型セリフ（AI生成試行の上限に到達）" : "定型セリフ（AI未設定・生成失敗など）"}</p>
        </div>;
      })}
    </section>
  );
}
