import type { ActionType, ParticipantState } from "./types";

export const ACTION_LABELS: Record<ActionType, string> = {
  drink: "飲む", eat: "食べる", talk: "話す", rest: "休む",
};
const EFFECTS: Record<ActionType, ParticipantState> = {
  drink: { drunkenness: 10, fullness: 0 },
  eat: { drunkenness: 0, fullness: 15 },
  talk: { drunkenness: 0, fullness: 0 },
  rest: { drunkenness: -5, fullness: -5 },
};

export function actionWeights(state: ParticipantState): Record<ActionType, number> {
  // 状態に応じて候補を制限し、AIの文章とは独立して行動を決める。
  return {
    drink: state.drunkenness >= 80 ? 0 : 3,
    eat: state.fullness === 100 ? 0 : state.fullness < 30 ? 6 : 3,
    talk: 3,
    rest: state.drunkenness >= 80 ? 6 : 1,
  };
}

export function selectAction(state: ParticipantState, random: () => number): ActionType {
  // 抽選を再現して検証できるよう、乱数を外から渡す。
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error("乱数は0以上1未満である必要があります");
  const weights = actionWeights(state);
  let position = value * Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  for (const action of Object.keys(weights) as ActionType[]) {
    if (position < weights[action]) return action;
    position -= weights[action];
  }
  return "rest";
}

export function applyAction(state: ParticipantState, action: ActionType) {
  const clamp = (value: number) => Math.max(0, Math.min(100, value));
  const nextState = {
    drunkenness: clamp(state.drunkenness + EFFECTS[action].drunkenness),
    fullness: clamp(state.fullness + EFFECTS[action].fullness),
  };
  return {
    nextState,
    // 丸めた後の実際の差を記録し、イベントとメーターを一致させる。
    delta: {
      drunkenness: nextState.drunkenness - state.drunkenness,
      fullness: nextState.fullness - state.fullness,
    },
  };
}

export function actionReason(state: ParticipantState): string {
  const reasons = ["行動の重みに応じて抽選"];
  if (state.fullness < 30) reasons.push("空腹のため食事を選びやすい");
  if (state.fullness === 100) reasons.push("満腹のため食事を除外");
  if (state.drunkenness >= 80) reasons.push("酔いが強いため飲酒を除外し休憩を選びやすい");
  return reasons.join("。") + "。";
}
