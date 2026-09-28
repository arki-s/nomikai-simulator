import { getCharacter } from "../characters";
import { getVenue } from "../venues";
import { actorAt, participantState } from "../simulation";
import { actionReason, applyAction, selectAction, selectMenuItem } from "../rules";
import { MAX_AI_ATTEMPTS, MAX_SPEECH_LENGTH, MAX_TURNS } from "../types";
import type { ActionEvent, DialogueGenerator, SimulationEvent, SpeechEvent, TurnRequest, TurnResponse } from "../types";

export async function advanceTurn(request: TurnRequest, dependencies: {
  random: () => number; generateDialogue: DialogueGenerator;
}): Promise<TurnResponse> {
  const { state } = request;
  if (state.turn >= MAX_TURNS) throw new Error("飲み会は終了しています");
  const character = getCharacter(actorAt(state.config, state.turn));
  const venue = getVenue(state.config.venueId);
  const before = participantState(state, character.id);
  const context = { state: before, character, venue };
  const action = selectAction(context, dependencies.random);
  const item = action === "drink" || action === "eat" ? selectMenuItem(venue, action, dependencies.random) : undefined;
  const { nextState, delta } = applyAction(before, action, character, item);
  const turn = state.turn + 1;
  const eventBase = { type: "action" as const, turn, characterId: character.id, delta, reason: actionReason(context, action, item) };
  const actionEvent: ActionEvent = action === "drink" || action === "eat"
    ? { ...eventBase, action, menuItemId: item!.id } : { ...eventBase, action };
  const events: SimulationEvent[] = [actionEvent];
  let aiAttempts = state.aiAttempts;
  if (action === "talk") {
    const speechBase = { type: "speech" as const, turn, characterId: character.id };
    let speech: SpeechEvent = { ...speechBase, text: character.fallbackText, source: "fallback", fallbackReason: "budget_exhausted" };
    if (aiAttempts < MAX_AI_ATTEMPTS) {
      // 失敗・キー未設定でも試行を消費し、障害時に生成を際限なく試さない。
      aiAttempts++;
      speech = { ...speechBase, text: character.fallbackText, source: "fallback", fallbackReason: "unavailable" };
      try {
        // 深いコピーを渡し、人物の補正や配列まで生成器に書き換えさせない。
        const result = await dependencies.generateDialogue(structuredClone({
          character, state: nextState,
          participants: state.config.participantIds.map((id) => ({ id, name: getCharacter(id).name })),
          venue: { name: venue.name, atmosphere: venue.atmosphere },
          recentSpeeches: request.recentSpeeches,
        }));
        if (typeof result?.text !== "string" || !result.text.trim() || result.text.length > MAX_SPEECH_LENGTH) throw new Error("セリフの形式が不正です");
        speech = { ...speechBase, text: result.text.trim(), source: "ai" };
      } catch {
        // セリフ生成の障害だけを吸収し、確定済みの行動・状態で続行する。
      }
    }
    events.push(speech);
  }
  return {
    state: { ...structuredClone(state), turn, aiAttempts, participants: { ...structuredClone(state.participants), [character.id]: nextState } },
    events,
  };
}
