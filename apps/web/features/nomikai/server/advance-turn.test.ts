import assert from "node:assert/strict";
import { test } from "node:test";
import { CHARACTERS, createInitialState } from "../characters";
import { MAX_TURNS } from "../types";
import type { DialogueGenerator, TurnRequest } from "../types";
import { isTurnResponse } from "../validation";
import { advanceTurn } from "./advance-turn";

// 外部生成器を差し替え、費用を発生させずに責務の境界を確かめる。
const unavailable: DialogueGenerator = async () => { throw new Error("AI unavailable"); };
test("1ターンに1人だけ行動し、非発言ではAIを呼ばない", async () => {
  for (const random of [0, 0.4, 0.99]) {
    const request: TurnRequest = { state: createInitialState(), recentSpeeches: [] };
    const original = structuredClone(request);
    let calls = 0;
    const result = await advanceTurn(request, { random: () => random, generateDialogue: async () => { calls++; return { text: "不可" }; } });
    assert.equal(calls, 0);
    assert.equal(result.state.turn, 1);
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].characterId, "youkya");
    assert.deepEqual(result.state.participants.inkya, original.state.participants.inkya);
    assert.deepEqual(result.state.participants.preacher, original.state.participants.preacher);
    assert.deepEqual(request, original);
    assert.ok(isTurnResponse(result, request.state));
  }
});
test("発言時だけ生成し、生成器が入力を変更しても状態・話者に影響しない", async () => {
  const request: TurnRequest = { state: createInitialState(), recentSpeeches: [] };
  const original = structuredClone(request);
  let calls = 0;
  const result = await advanceTurn(request, {
    random: () => 0.8,
    generateDialogue: async (input) => {
      calls++;
      assert.equal(input.character.id, "youkya");
      input.state.drunkenness = 100;
      input.character.id = "preacher";
      return { text: "こんにちは！" };
    },
  });
  assert.equal(calls, 1);
  assert.deepEqual(request, original);
  assert.deepEqual(result.state.participants, original.state.participants);
  assert.deepEqual(result.events[1], { type: "speech", turn: 1, characterId: "youkya", text: "こんにちは！", source: "ai" });
});
test("AI失敗・空文・長すぎる発言でも定型文で進む", async () => {
  for (const generateDialogue of [unavailable, async () => ({ text: " " }), async () => ({ text: "あ".repeat(201) })]) {
    const result = await advanceTurn({ state: createInitialState(), recentSpeeches: [] }, { random: () => 0.8, generateDialogue });
    assert.equal(result.state.turn, 1);
    assert.equal(result.events[1].type, "speech");
    assert.deepEqual(result.events[1], { type: "speech", turn: 1, characterId: "youkya", text: CHARACTERS[0].fallbackText, source: "fallback" });
  }
});
test("AIなしで20ターン完走し、人物の順番と終了条件を守る", async () => {
  let state = createInitialState();
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const result = await advanceTurn({ state, recentSpeeches: [] }, { random: () => 0.8, generateDialogue: unavailable });
    assert.equal(result.events[0].characterId, CHARACTERS[turn % 3].id);
    assert.ok(isTurnResponse(result, state));
    state = result.state;
  }
  await assert.rejects(advanceTurn({ state, recentSpeeches: [] }, { random: () => 0, generateDialogue: unavailable }));
});
