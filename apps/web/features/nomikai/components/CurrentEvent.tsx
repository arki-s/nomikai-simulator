import { getCharacter } from "../characters";
import { getVenue } from "../venues";
import { ACTION_LABELS } from "../rules";
import type { SimulationEvent, VenueId } from "../types";

export function CurrentEvent({ events, venueId }: { events: SimulationEvent[]; venueId: VenueId }) {
  const opening = events.find((event) => event.type === "opening");
  const action = events.find((event) => event.type === "action");
  const speech = events.find((event) => event.type === "speech");
  const item = action && getVenue(venueId).menu.find((item) => item.id === action.menuItemId);
  const signed = (value: number) => value > 0 ? `+${value}` : String(value);
  const title = opening ? opening.speakerIds.length > 1 ? "全員で乾杯！" : opening.speakerIds.length ? getCharacter(opening.speakerIds[0]).name : "飲み会のようす"
    : action ? `${getCharacter(action.characterId).name}：${ACTION_LABELS[action.action]}${item ? `（${item.name}）` : ""}` : "飲み会のようす";
  // 最初に発言を読めるよう上部に集約。長文や理由の展開はこの枠内で読み、舞台を押し下げない。
  return <section aria-label="今回の出来事・セリフ" aria-live="polite" aria-atomic="true" className="h-40 overflow-y-auto rounded-xl border border-amber-300 bg-amber-50 p-3 text-stone-900" tabIndex={0}>
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <h2 className="font-bold">{title}</h2>
      {action && <p className="text-xs tabular-nums">酔い {signed(action.delta.drunkenness)} ／ 満腹 {signed(action.delta.fullness)}</p>}
    </div>
    <p className="mt-2 whitespace-pre-wrap break-words leading-6">{opening?.text ?? (speech ? `「${speech.text}」` : action ? action.action === "rest" ? "ひと息ついて、お腹と酔いを落ち着かせています。" : `${item?.name ?? ACTION_LABELS[action.action]}${item ? "を楽しみました。" : "。"}` : "準備中です。")}</p>
    <div className="mt-2 text-xs text-stone-600">
      {opening && <p>開始演出・定型文（通常ターン・AI試行は消費しません）</p>}
      {speech && <p>{speech.source === "ai" ? "AI生成のセリフ" : speech.fallbackReason === "budget_exhausted" ? "定型セリフ：AI試行上限に到達" : "定型セリフ：AI未設定・生成失敗など"}</p>}
      {action && <details className="mt-1 leading-5"><summary className="cursor-pointer">行動の理由</summary>{action.reason}</details>}
    </div>
  </section>;
}
