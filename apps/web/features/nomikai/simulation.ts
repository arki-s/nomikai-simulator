import { getCharacter, CHARACTERS } from "./characters";
import { VENUES } from "./venues";
import { MAX_RECENT_SPEECHES } from "./types";
import type { CharacterId, SimulationConfig, SimulationState, SimulationEvent, SpeechEvent, TurnResponse } from "./types";

export function isSimulationConfig(value: unknown): value is SimulationConfig {
  if (typeof value !== "object" || value === null || !("participantIds" in value) || !("venueId" in value)) return false;
  const ids = value.participantIds;
  if (!Array.isArray(ids) || ids.length < 2 || ids.length > 4 || new Set(ids).size !== ids.length) return false;
  // 掲載順を契約に含め、画面・履歴検証・サーバーで順番がずれないようにする。
  const expected = CHARACTERS.filter(({ id }) => ids.includes(id)).map(({ id }) => id);
  return expected.length === ids.length && expected.every((id, index) => id === ids[index])
    && VENUES.some(({ id }) => id === value.venueId);
}

export function defaultConfig(): SimulationConfig {
  return { participantIds: CHARACTERS.map(({ id }) => id), venueId: "izakaya" };
}

export function createInitialState(config: SimulationConfig = defaultConfig()): SimulationState {
  if (!isSimulationConfig(config)) throw new Error("参加者または店舗の設定が不正です");
  // 開催設定もコピーし、フォーム変更や再開催で進行中の状態が書き換わるのを防ぐ。
  return {
    config: { participantIds: [...config.participantIds], venueId: config.venueId },
    turn: 0, openingStep: 0, aiAttempts: 0,
    participants: Object.fromEntries(config.participantIds.map((id) => [id, { drunkenness: 0, fullness: 0, nonAlcoholOnly: getCharacter(id).alcoholPolicy === "non_alcohol_only", firstDrinkId: null }])),
  };
}

export function actorAt(config: SimulationConfig, completedTurns: number): CharacterId {
  return config.participantIds[completedTurns % config.participantIds.length];
}

export function participantState(state: SimulationState, id: CharacterId) {
  const participant = state.participants[id];
  if (!participant) throw new Error("参加者の状態がありません");
  return participant;
}

// 画面内の開催ログを保存し、APIの今回分と累積分を混同しないための小さな変換。
export function appendTurnResult(previous: TurnResponse, next: TurnResponse): TurnResponse {
  if (next.state.turn + next.state.openingStep !== previous.state.turn + previous.state.openingStep + 1) throw new Error("ターンが連続していません");
  return { state: next.state, events: [...previous.events, ...next.events] };
}
export function latestEvents(session: TurnResponse): SimulationEvent[] {
  const last = session.events.at(-1);
  return last ? session.events.filter((event) => eventKey(event) === eventKey(last)) : [];
}
export function recentSpeeches(events: SimulationEvent[]): SpeechEvent[] {
  return events.filter((event): event is SpeechEvent => event.type === "speech").slice(-MAX_RECENT_SPEECHES);
}

// 開始演出は通常ターン0にまとまるため、履歴・音声には別の識別子を使う。
export function eventKey(event: SimulationEvent): string {
  return event.type === "opening" ? `opening-${event.step}` : `turn-${event.turn}`;
}
