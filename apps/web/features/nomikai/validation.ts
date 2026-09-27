import { CHARACTERS } from "./characters";
import { MAX_RECENT_SPEECHES, MAX_SPEECH_LENGTH, MAX_TURNS } from "./types";
import type { CharacterId, SimulationState, SpeechEvent, TurnRequest, TurnResponse } from "./types";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function integer(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}
function characterId(value: unknown): value is CharacterId {
  return CHARACTERS.some((character) => character.id === value);
}
export function isSimulationState(value: unknown): value is SimulationState {
  if (!record(value) || !integer(value.turn, 0, MAX_TURNS) || !record(value.participants)) return false;
  const participants = value.participants;
  return Object.keys(participants).length === CHARACTERS.length && CHARACTERS.every(({ id }) => {
    const state = participants[id];
    return record(state) && integer(state.drunkenness, 0, 100) && integer(state.fullness, 0, 100);
  });
}
export function isSpeech(value: unknown): value is SpeechEvent {
  return record(value) && value.type === "speech" && integer(value.turn, 1, MAX_TURNS)
    && characterId(value.characterId) && value.characterId === CHARACTERS[(value.turn - 1) % CHARACTERS.length].id
    && typeof value.text === "string" && value.text.trim().length > 0 && value.text.length <= MAX_SPEECH_LENGTH
    && (value.source === "ai" || value.source === "fallback");
}
export function isTurnRequest(value: unknown): value is TurnRequest {
  if (!record(value) || !isSimulationState(value.state) || !Array.isArray(value.recentSpeeches)
    || value.recentSpeeches.length > MAX_RECENT_SPEECHES) return false;
  const turn = value.state.turn;
  let previousTurn = 0;
  // 過去の発言だけを受け付け、未来の発言や無制限の文脈をAIへ渡さない。
  return value.recentSpeeches.every((speech: unknown) => {
    if (!isSpeech(speech) || speech.turn <= previousTurn || speech.turn > turn) return false;
    previousTurn = speech.turn;
    return true;
  });
}
export function isTurnResponse(value: unknown, previous: SimulationState): value is TurnResponse {
  if (!record(value) || !isSimulationState(value.state) || value.state.turn !== previous.turn + 1
    || !Array.isArray(value.events)) return false;
  const actor = CHARACTERS[previous.turn % CHARACTERS.length].id;
  const [action, speech] = value.events;
  if (!record(action) || action.type !== "action" || action.characterId !== actor
    || action.turn !== value.state.turn || !["drink", "eat", "talk", "rest"].includes(String(action.action))
    || typeof action.reason !== "string" || !record(action.delta)) return false;
  const next = value.state;
  const delta = action.delta;
  // 状態とイベントをまとめて確認し、不正な応答で画面だけ先に進むことを防ぐ。
  if (!CHARACTERS.every(({ id }) => {
    const before = previous.participants[id];
    const after = next.participants[id];
    return id === actor
      ? delta.drunkenness === after.drunkenness - before.drunkenness && delta.fullness === after.fullness - before.fullness
      : before.drunkenness === after.drunkenness && before.fullness === after.fullness;
  })) return false;
  return action.action === "talk"
    ? value.events.length === 2 && isSpeech(speech) && speech.turn === next.turn && speech.characterId === actor
    : value.events.length === 1;
}
