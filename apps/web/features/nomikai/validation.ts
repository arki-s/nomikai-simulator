import { getCharacter } from "./characters";
import { getVenue } from "./venues";
import { actorAt, isSimulationConfig, participantState } from "./simulation";
import { actionWeights, applyAction } from "./rules";
import { MAX_AI_ATTEMPTS, MAX_RECENT_SPEECHES, MAX_SPEECH_LENGTH, MAX_TURNS } from "./types";
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
  const participants = value.participants;
  return Object.keys(participants).length === value.config.participantIds.length && value.config.participantIds.every((id) => {
    const state = participants[id];
    return record(state) && integer(state.drunkenness, 0, 100) && integer(state.fullness, 0, 100);
  });
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
  if (!record(value) || !isSimulationState(value.state) || value.state.turn !== previous.turn + 1
    || !Array.isArray(value.events)) return false;
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
    if (!item || item.kind !== kind) return false;
  } else if (action.menuItemId !== undefined) return false;
  const expected = applyAction(before, kind, character, item);
  // 増減の自己申告だけでなく、固定ルールと非行動者の不変性も照合する。
  if (action.delta.drunkenness !== expected.delta.drunkenness || action.delta.fullness !== expected.delta.fullness
    || !previous.config.participantIds.every((id) => {
      const target = id === actor ? expected.nextState : participantState(previous, id);
      const actual = participantState(next, id);
      return actual.drunkenness === target.drunkenness && actual.fullness === target.fullness;
    })) return false;
  const attempted = kind === "talk" && previous.aiAttempts < MAX_AI_ATTEMPTS;
  if (next.aiAttempts !== previous.aiAttempts + Number(attempted)) return false;
  if (kind !== "talk") return value.events.length === 1;
  if (value.events.length !== 2 || !isSpeech(speech, next.config) || speech.turn !== next.turn) return false;
  return attempted ? speech.source === "ai" || speech.fallbackReason === "unavailable"
    : speech.source === "fallback" && speech.fallbackReason === "budget_exhausted";
}
