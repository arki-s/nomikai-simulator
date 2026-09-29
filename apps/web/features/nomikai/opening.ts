import { getCharacter } from "./characters";
import { getVenue } from "./venues";
import type { CharacterId, OpeningEvent, SimulationState, TurnResponse } from "./types";

// 注文・待機・到着・乾杯を通常ターンから分離し、AI予算や飲食の効果を消費させない。
export const openingLength = (state: SimulationState) => state.config.participantIds.length + 4;
export const isOpening = (state: SimulationState) => state.openingStep < openingLength(state);
export function firstDrink(state: SimulationState, id: CharacterId) {
  const nonAlcohol = getCharacter(id).alcoholPolicy === "non_alcohol_only";
  const drink = getVenue(state.config.venueId).menu.find((item) => item.kind === "drink" && (nonAlcohol ? !item.alcoholic : item.id === "beer"));
  if (!drink) throw new Error("最初の飲み物がありません");
  return drink;
}
export function advanceOpening(state: SimulationState): TurnResponse {
  if (!isOpening(state) || state.turn !== 0) throw new Error("開始演出は終了しています");
  const next = structuredClone(state);
  const step = ++next.openingStep;
  const ids = state.config.participantIds;
  let event: OpeningEvent;
  const base = { type: "opening" as const, turn: 0 as const, step };
  if (step === 1) event = { ...base, stage: "ask", speakerIds: [ids[0]], text: "何飲む？" };
  else if (step <= ids.length + 1) {
    const id = ids[step - 2];
    const item = firstDrink(state, id);
    next.participants[id]!.firstDrinkId = item.id;
    event = { ...base, stage: "order", speakerIds: [id], menuItemId: item.id, text: `${item.name}をお願いします！` };
  } else if (step === ids.length + 2) event = { ...base, stage: "wait", speakerIds: [], text: "……まだかな。メニューを眺めたり、目が合って少し笑ったり。" };
  else if (step === ids.length + 3) event = { ...base, stage: "serve", speakerIds: [], text: "全員の飲み物が届きました。グラスを手に取り、顔を見合わせます。" };
  else event = { ...base, stage: "toast", speakerIds: [...ids], text: "乾杯！" };
  return { state: next, events: [event] };
}
