import { createInitialState } from "./simulation";
import { advanceOpening, isOpening } from "./opening";
import type { ParticipantState, SimulationConfig } from "./types";

// 従来の通常ターンのテストは開始演出を正しく完了させた状態から検証する。
export function runningState(config?: SimulationConfig) {
  let state = createInitialState(config);
  while (isOpening(state)) state = advanceOpening(state).state;
  return state;
}
export function person(drunkenness = 0, fullness = 0): ParticipantState {
  return { drunkenness, fullness, nonAlcoholOnly: drunkenness >= 60, firstDrinkId: null };
}
