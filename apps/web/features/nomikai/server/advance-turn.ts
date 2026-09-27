import { CHARACTERS } from "../characters";
import { actionReason, applyAction, selectAction } from "../rules";
import { MAX_SPEECH_LENGTH, MAX_TURNS } from "../types";
import type { DialogueGenerator, SimulationEvent, TurnRequest, TurnResponse } from "../types";

export async function advanceTurn(request: TurnRequest, dependencies: {
  random: () => number; generateDialogue: DialogueGenerator;
}): Promise<TurnResponse> {
  if (request.state.turn >= MAX_TURNS) throw new Error("飲み会は終了しています");
  const character = CHARACTERS[request.state.turn % CHARACTERS.length];
  const before = request.state.participants[character.id];
  const action = selectAction(before, dependencies.random);
  const { nextState, delta } = applyAction(before, action);
  const turn = request.state.turn + 1;
  const events: SimulationEvent[] = [{
    type: "action", turn, characterId: character.id, action, delta, reason: actionReason(before),
  }];
  if (action === "talk") {
    let text = character.fallbackText;
    let source: "ai" | "fallback" = "fallback";
    try {
      // コピーを渡し、生成処理がルールの確定状態を書き換えないようにする。
      const result = await dependencies.generateDialogue({
        character: { ...character }, state: { ...nextState },
        recentSpeeches: request.recentSpeeches.map((speech) => ({ ...speech })),
      });
      if (typeof result?.text !== "string" || !result.text.trim() || result.text.length > MAX_SPEECH_LENGTH) {
        throw new Error("セリフの形式が不正です");
      }
      text = result.text.trim();
      source = "ai";
    } catch {
      // AI障害・キー未設定でも停止せず、定型文であることを明示して続行する。
    }
    events.push({ type: "speech", turn, characterId: character.id, text, source });
  }
  return {
    state: {
      turn,
      participants: Object.fromEntries(CHARACTERS.map(({ id }) => [
        id, id === character.id ? nextState : { ...request.state.participants[id] },
      ])) as TurnResponse["state"]["participants"],
    },
    events,
  };
}
