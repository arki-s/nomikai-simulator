// APIと画面で同じ制約を使い、ターン数や会話長の食い違いを防ぐ。
export const MAX_TURNS = 20;
export const MAX_RECENT_SPEECHES = 6;
export const MAX_SPEECH_LENGTH = 200;
export type CharacterId = "youkya" | "inkya" | "preacher";
export type Character = {
  id: CharacterId;
  name: string;
  speakingStyle: string;
  fallbackText: string;
};
export type ParticipantState = { drunkenness: number; fullness: number };
export type SimulationState = {
  turn: number;
  participants: Record<CharacterId, ParticipantState>;
};
export type ActionType = "drink" | "eat" | "talk" | "rest";
export type ActionEvent = {
  type: "action";
  turn: number;
  characterId: CharacterId;
  action: ActionType;
  delta: ParticipantState;
  reason: string;
};
export type SpeechEvent = {
  type: "speech";
  turn: number;
  characterId: CharacterId;
  text: string;
  source: "ai" | "fallback";
};
export type SimulationEvent = ActionEvent | SpeechEvent;
export type TurnRequest = { state: SimulationState; recentSpeeches: SpeechEvent[] };
export type TurnResponse = { state: SimulationState; events: SimulationEvent[] };
export type DialogueInput = {
  character: Character;
  state: ParticipantState;
  recentSpeeches: SpeechEvent[];
};
// AIにはセリフだけを返させ、行動・話者・数値の決定権を与えない。
export type DialogueResult = { text: string };
export type DialogueGenerator = (input: DialogueInput) => Promise<DialogueResult>;
