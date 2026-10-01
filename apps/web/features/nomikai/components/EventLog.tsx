import { eventKey } from "../simulation";
import type { SimulationEvent, VenueId } from "../types";
import { TurnEvents } from "./TurnEvents";

export function EventLog({ events, venueId }: { events: SimulationEvent[]; venueId: VenueId }) {
  // 20ターンの小さな履歴は通常のDOMで表示し、読み返し中の位置を強制変更しない。
  const turns = [...new Set(events.map(eventKey))];
  return <details aria-label="今回の出来事ログ" className="rounded-xl border border-stone-300 p-3 dark:border-stone-700">
    <summary className="cursor-pointer font-bold">今回の出来事ログ <span className="text-sm font-normal">{turns.length}ステップ</span></summary>
    {turns.length === 0 ? <p className="text-sm text-stone-600 dark:text-stone-300">まだ出来事はありません。</p> : <div className="max-h-[36rem] space-y-3 overflow-y-auto rounded-xl" tabIndex={0} aria-label="出来事ログのスクロール領域">{turns.map((turn) => <TurnEvents key={turn} events={events.filter((event) => eventKey(event) === turn)} venueId={venueId} announce={false} />)}</div>}
  </details>;
}
