// APIと画面で制約を共有し、表示だけ上限を超える食い違いを防ぐ。
export const MAX_TURNS = 20;
export const MAX_AI_ATTEMPTS = 8;
export const MAX_RECENT_SPEECHES = 6;
export const MAX_SPEECH_LENGTH = 200;
export type CharacterId = "youkya" | "inkya" | "preacher";
export type VenueId = "izakaya" | "washoku" | "bar";
export type ActionType = "drink" | "eat" | "talk" | "rest";
export type ActionBias = Partial<Record<ActionType, number>>;
export type Character = {
  id: CharacterId;
  name: string;
  speakingStyle: string;
  fallbackText: string;
  avatarSrc: string;
  alcoholMultiplier: number;
  actionBias: ActionBias;
  traitLabel: string;
};
// 飲み物と料理で効果の項目を分け、種類の取り違えを型でも防ぐ。
export type MenuItem = { id: string; name: string } & (
  | { kind: "drink"; drunkenness: number }
  | { kind: "eat"; fullness: number }
);
export type Venue = {
  id: VenueId;
  name: string;
  atmosphere: string;
  ruleLabel: string;
  backgroundSrc: string;
  actionBias: ActionBias;
  menu: readonly MenuItem[];
};
export type SimulationConfig = { participantIds: CharacterId[]; venueId: VenueId };
export type ParticipantState = { drunkenness: number; fullness: number };
export type SimulationState = {
  config: SimulationConfig;
  turn: number;
  aiAttempts: number;
  participants: Partial<Record<CharacterId, ParticipantState>>;
};
export type ActionEvent = {
  type: "action";
  turn: number;
  characterId: CharacterId;
  delta: ParticipantState;
  reason: string;
} & (
  | { action: "drink" | "eat"; menuItemId: string }
  | { action: "talk" | "rest"; menuItemId?: never }
);
export type SpeechEvent = {
  type: "speech";
  turn: number;
  characterId: CharacterId;
  text: string;
} & (
  | { source: "ai"; fallbackReason?: never }
  | { source: "fallback"; fallbackReason: "unavailable" | "budget_exhausted" }
);
export type SimulationEvent = ActionEvent | SpeechEvent;
export type TurnRequest = { state: SimulationState; recentSpeeches: SpeechEvent[] };
export type TurnResponse = { state: SimulationState; events: SimulationEvent[] };
export type DialogueInput = {
  character: Character;
  participants: Pick<Character, "id" | "name">[];
  venue: Pick<Venue, "name" | "atmosphere">;
  state: ParticipantState;
  recentSpeeches: SpeechEvent[];
};
// AIにはセリフだけを返させ、行動・話者・数値の決定権を与えない。
export type DialogueResult = { text: string };
export type DialogueGenerator = (input: DialogueInput) => Promise<DialogueResult>;
