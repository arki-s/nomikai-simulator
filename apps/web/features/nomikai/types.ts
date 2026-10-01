// APIと画面で制約を共有し、表示だけ上限を超える食い違いを防ぐ。
export const MAX_TURNS = 20;
export const MAX_AI_ATTEMPTS = 8;
export const MAX_RECENT_SPEECHES = 6;
export const MAX_SPEECH_LENGTH = 200;
// 調整値を一か所に置き、抽選・表示・検証で基準を共有する。
export const NON_ALCOHOL_THRESHOLD = 60;
export const DESSERT_WEIGHT = 3;
export type CharacterId = "youkya" | "inkya" | "preacher" | "sweet_tooth";
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
  alcoholPolicy: "allowed" | "non_alcohol_only";
  likesDessert: boolean;
  actionBias: ActionBias;
  traitLabel: string;
};
// 飲料にも満腹効果を持たせつつ、酔いは飲料だけに限定して種類の取り違えを防ぐ。
export type MenuItem = { id: string; name: string } & (
  | { kind: "drink"; fullness: number; drunkenness: number; alcoholic: boolean; vessel: "mug" | "glass" }
  | { kind: "eat"; fullness: number; category: "food" | "dessert"; vessel: "plate" }
);
export type Venue = {
  id: VenueId;
  name: string;
  atmosphere: string;
  ruleLabel: string;
  backgroundSrc: string;
  bgmSrc: string;
  actionBias: ActionBias;
  menu: readonly MenuItem[];
};
export type SimulationConfig = { participantIds: CharacterId[]; venueId: VenueId };
export type Meters = { drunkenness: number; fullness: number };
export type ParticipantState = Meters & { nonAlcoholOnly: boolean; firstDrinkId: string | null };
export type SimulationState = {
  config: SimulationConfig;
  turn: number;
  // 通常ターンを消費せず、開始演出の確定済みステップ数だけを保持する。
  openingStep: number;
  aiAttempts: number;
  participants: Partial<Record<CharacterId, ParticipantState>>;
};
export type ActionEvent = {
  type: "action";
  turn: number;
  characterId: CharacterId;
  delta: Meters;
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
export type OpeningEvent = {
  type: "opening"; turn: 0; step: number;
  stage: "ask" | "order" | "wait" | "serve" | "toast";
  speakerIds: CharacterId[]; text: string; menuItemId?: string;
};
export type SimulationEvent = ActionEvent | SpeechEvent | OpeningEvent;
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
