import { advanceOpening, firstDrink, isOpening, openingLength } from "./opening";
import { getCharacter } from "./characters";
import { getVenue } from "./venues";
import { actorAt, createInitialState, isSimulationConfig, participantState } from "./simulation";
import { actionWeights, applyAction, menuCandidates } from "./rules";
import { NON_ALCOHOL_THRESHOLD, MAX_AI_ATTEMPTS, MAX_RECENT_SPEECHES, MAX_SPEECH_LENGTH, MAX_TURNS } from "./types";
import type { ActionType, SimulationConfig, SimulationState, SpeechEvent, TurnRequest, TurnResponse } from "./types";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function integer(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}
export function isSimulationState(value: unknown): value is SimulationState {
  if (!record(value) || !isSimulationConfig(value.config) || !integer(value.turn, 0, MAX_TURNS)
    || !integer(value.aiAttempts, 0, Math.min(MAX_AI_ATTEMPTS, value.turn as number)) || !record(value.participants)) return false;
  if (!integer(value.openingStep, 0, value.config.participantIds.length + 4)) return false;
  const state = value as unknown as SimulationState;
  const participants = value.participants;
  if (Object.keys(participants).length !== value.config.participantIds.length || !value.config.participantIds.every((id) => {
    const person = participants[id];
    if (!record(person) || !integer(person.drunkenness, 0, 100) || !integer(person.fullness, 0, 100)
      || typeof person.nonAlcoholOnly !== "boolean" || !(person.firstDrinkId === null || person.firstDrinkId === firstDrink(state, id).id)) return false;
    // 配膳された最初の一杯が未消費なら、それ以前に飲酒済みにはならない。
    if (person.firstDrinkId !== null && person.drunkenness !== 0) return false;
    if (getCharacter(id).alcoholPolicy === "non_alcohol_only" && (!person.nonAlcoholOnly || person.drunkenness !== 0)) return false;
    if (person.drunkenness >= NON_ALCOHOL_THRESHOLD && !person.nonAlcoholOnly) return false;
    return true;
  })) return false;
  // 開始演出中と乾杯直後は完全に再計算でき、架空の注文や状態変化を拒否できる。
  if (isOpening(state) || state.turn === 0) {
    if (state.turn !== 0 || state.aiAttempts !== 0) return false;
    let expected = createInitialState(state.config);
    for (let step = 0; step < state.openingStep; step++) expected = advanceOpening(expected).state;
    return same(state.participants, expected.participants);
  }
  return true;
}
export function isSpeech(value: unknown, config: SimulationConfig): value is SpeechEvent {
  return record(value) && value.type === "speech" && integer(value.turn, 1, MAX_TURNS)
    && value.characterId === actorAt(config, (value.turn as number) - 1)
    && typeof value.text === "string" && value.text.trim().length > 0 && value.text.length <= MAX_SPEECH_LENGTH
    && (value.source === "ai" ? value.fallbackReason === undefined
      : value.source === "fallback" && ["unavailable", "budget_exhausted"].includes(String(value.fallbackReason)));
}
export function isTurnRequest(value: unknown): value is TurnRequest {
  if (!record(value) || !isSimulationState(value.state) || !Array.isArray(value.recentSpeeches)
    || value.recentSpeeches.length > MAX_RECENT_SPEECHES) return false;
  const state = value.state;
  let previousTurn = 0;
  let visibleAttempts = 0;
  // 全履歴は受け取らないが、見えている発言と回数の矛盾は入口で拒否する。
  return value.recentSpeeches.every((speech: unknown) => {
    if (!isSpeech(speech, state.config) || speech.turn <= previousTurn || speech.turn > state.turn) return false;
    previousTurn = speech.turn;
    if (speech.source === "fallback" && speech.fallbackReason === "budget_exhausted") return state.aiAttempts === MAX_AI_ATTEMPTS;
    visibleAttempts++;
    return visibleAttempts <= state.aiAttempts;
  });
}
export function isTurnResponse(value: unknown, previous: SimulationState): value is TurnResponse {
  if (!record(value) || !isSimulationState(value.state) || !Array.isArray(value.events)) return false;
  if (isOpening(previous)) return same(value, advanceOpening(previous));
  if (previous.turn >= MAX_TURNS || value.state.turn !== previous.turn + 1 || value.state.openingStep !== openingLength(previous)) return false;
  const next = value.state;
  if (next.config.venueId !== previous.config.venueId || next.config.participantIds.join(",") !== previous.config.participantIds.join(",")) return false;
  const actor = actorAt(previous.config, previous.turn);
  const [action, speech] = value.events;
  if (!record(action) || action.type !== "action" || action.characterId !== actor
    || action.turn !== next.turn || !["drink", "eat", "talk", "rest"].includes(String(action.action))
    || typeof action.reason !== "string" || !action.reason.trim() || !record(action.delta)) return false;
  const kind = action.action as ActionType;
  const character = getCharacter(actor);
  const venue = getVenue(previous.config.venueId);
  const before = participantState(previous, actor);
  if (actionWeights({ state: before, character, venue })[kind] === 0) return false;
  const item = venue.menu.find((item) => item.id === action.menuItemId);
  if (kind === "drink" || kind === "eat") {
    if (!item || !menuCandidates({ state: before, character, venue }, kind).some((candidate) => candidate.id === item.id)) return false;
  } else if (action.menuItemId !== undefined) return false;
  const expected = applyAction(before, kind, character, item);
  // 増減の自己申告だけでなく、固定ルールと非行動者の不変性も照合する。
  if (action.delta.drunkenness !== expected.delta.drunkenness || action.delta.fullness !== expected.delta.fullness
    || !previous.config.participantIds.every((id) => {
      const target = id === actor ? expected.nextState : participantState(previous, id);
      const actual = participantState(next, id);
      return same(actual, target);
    })) return false;
  const attempted = kind === "talk" && previous.aiAttempts < MAX_AI_ATTEMPTS;
  if (next.aiAttempts !== previous.aiAttempts + Number(attempted)) return false;
  if (kind !== "talk") return value.events.length === 1;
  if (value.events.length !== 2 || !isSpeech(speech, next.config) || speech.turn !== next.turn) return false;
  return attempted ? speech.source === "ai" || speech.fallbackReason === "unavailable"
    : speech.source === "fallback" && speech.fallbackReason === "budget_exhausted";
}

// キーの並び順に依存せず、JSONで運ばれる状態とイベントを照合する。
function same(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  if (Array.isArray(actual) && Array.isArray(expected)) return actual.length === expected.length && actual.every((item, index) => same(item, expected[index]));
  if (!record(actual) || !record(expected)) return false;
  return Object.keys(actual).length === Object.keys(expected).length && Object.keys(expected).every((key) => same(actual[key], expected[key]));
}
