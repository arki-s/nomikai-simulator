import { DESSERT_WEIGHT, NON_ALCOHOL_THRESHOLD } from "./types";
import type { ActionType, Character, MenuItem, ParticipantState, Venue } from "./types";

export const ACTION_LABELS: Record<ActionType, string> = {
  drink: "飲む", eat: "食べる", talk: "話す", rest: "休む",
};
export type RuleContext = { state: ParticipantState; character: Character; venue: Venue };

export function actionWeights({ state, character, venue }: RuleContext): Record<ActionType, number> {
  const weights: Record<ActionType, number> = { drink: 3, eat: state.fullness < 30 ? 6 : 3, talk: 3, rest: 1 };
  for (const action of Object.keys(weights) as ActionType[]) {
    weights[action] = Math.max(0, weights[action] + (character.actionBias[action] ?? 0) + (venue.actionBias[action] ?? 0));
  }
  // 補正後に禁止条件を適用し、性格や店舗の加点で禁止行動が復活するのを防ぐ。
  if (!menuCandidates({ state, character, venue }, "drink").length) weights.drink = 0;
  if (!menuCandidates({ state, character, venue }, "eat").length) weights.eat = 0;
  // 休むは飲食できない場合だけの選択肢。人物・店舗の加点で通常時に復活させない。
  weights.rest = weights.drink === 0 && weights.eat === 0 ? Math.max(1, weights.rest) : 0;
  weights.talk = Math.max(1, weights.talk);
  return weights;
}

function sample(random: () => number) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error("乱数は0以上1未満である必要があります");
  return value;
}

export function selectAction(context: RuleContext, random: () => number): ActionType {
  const weights = actionWeights(context);
  let position = sample(random) * Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  for (const action of Object.keys(weights) as ActionType[]) {
    if (position < weights[action]) return action;
    position -= weights[action];
  }
  return "talk";
}

// 飲める候補を抽選とAPI検証で共有し、禁止メニューの抜け道を作らない。
export function menuCandidates({ state, character, venue }: RuleContext, action: "drink" | "eat"): MenuItem[] {
  if (state.fullness >= 100) return [];
  if (action === "eat") return venue.menu.filter((item) => item.kind === "eat");
  const nonAlcohol = character.alcoholPolicy === "non_alcohol_only" || state.nonAlcoholOnly || state.drunkenness >= NON_ALCOHOL_THRESHOLD;
  const drinks = venue.menu.filter((item) => item.kind === "drink" && item.alcoholic !== nonAlcohol);
  return state.firstDrinkId ? drinks.filter((item) => item.id === state.firstDrinkId) : drinks;
}
export function selectMenuItem(context: RuleContext, action: "drink" | "eat", random: () => number): MenuItem {
  const candidates = menuCandidates(context, action);
  if (!candidates.length) throw new Error("対応するメニューがありません");
  const weight = (item: MenuItem) => item.kind === "eat" && item.category === "dessert" && context.character.likesDessert ? DESSERT_WEIGHT : 1;
  let position = sample(random) * candidates.reduce((sum, item) => sum + weight(item), 0);
  for (const item of candidates) {
    if (position < weight(item)) return item;
    position -= weight(item);
  }
  return candidates[candidates.length - 1];
}

export function applyAction(state: ParticipantState, action: ActionType, character: Character, item?: MenuItem) {
  if ((action === "drink" || action === "eat") && item?.kind !== action) throw new Error("行動とメニューが一致しません");
  if ((action === "talk" || action === "rest") && item) throw new Error("この行動にメニューは不要です");
  if (action === "drink" && item?.kind === "drink" && item.alcoholic && (character.alcoholPolicy === "non_alcohol_only" || state.nonAlcoholOnly || state.drunkenness >= NON_ALCOHOL_THRESHOLD)) throw new Error("この人物はノンアルのみ飲めます");
  // 医学モデルではなくゲームの効果として整数化し、実際の差だけをイベントへ渡す。
  const drunkenness = action === "drink" && item?.kind === "drink" ? Math.round(item.drunkenness * character.alcoholMultiplier) : action === "rest" ? -5 : 0;
  // 飲料も満腹に加算し、ノンアルは酔いだけを変化させない。
  const fullness = (action === "eat" || action === "drink") && item ? item.fullness : action === "rest" ? -5 : 0;
  const clamp = (value: number) => Math.max(0, Math.min(100, value));
  const nextState: ParticipantState = { ...state, firstDrinkId: action === "drink" ? null : state.firstDrinkId, drunkenness: clamp(state.drunkenness + drunkenness), fullness: clamp(state.fullness + fullness) };
  // 閾値到達後は休んでも飲酒に戻らず、この開催中の方針として保持する。
  nextState.nonAlcoholOnly = state.nonAlcoholOnly || character.alcoholPolicy === "non_alcohol_only" || state.drunkenness >= NON_ALCOHOL_THRESHOLD || nextState.drunkenness >= NON_ALCOHOL_THRESHOLD;
  return { nextState, delta: { drunkenness: nextState.drunkenness - state.drunkenness, fullness: nextState.fullness - state.fullness } };
}

export function actionReason(context: RuleContext, action: ActionType, item?: MenuItem): string {
  const { state, character, venue } = context;
  const weights = actionWeights(context);
  const reasons = [`人物・店舗・状態で補正した重みから抽選（飲む${weights.drink}・食べる${weights.eat}・話す${weights.talk}・休む${weights.rest}）`, `${venue.name}：${venue.ruleLabel}`];
  if (state.fullness < 30) reasons.push("空腹のため食べる基本重みを6に変更");
  if (state.fullness === 100) reasons.push("満腹のため飲む・食べる候補を除外");
  if (weights.rest > 0) reasons.push("飲食できないため休む候補を追加（酔い・満腹を各5回復）");
  else reasons.push("飲食できるため休む候補を除外");
  if (state.nonAlcoholOnly || state.drunkenness >= NON_ALCOHOL_THRESHOLD) reasons.push("この開催ではノンアルのみ選択");
  if (action === "eat" && character.likesDessert) reasons.push(`甘党のためデザートの選択重みを${DESSERT_WEIGHT}に変更`);
  if (action === "drink" && item?.kind === "drink") reasons.push(`${item.name}の酔い効果${item.drunkenness} × 酔いやすさ${character.alcoholMultiplier}（四捨五入）、満腹効果${item.fullness}`);
  if (action === "eat" && item?.kind === "eat") reasons.push(`${item.name}の満腹効果${item.fullness}`);
  return reasons.join("。") + "。";
}
