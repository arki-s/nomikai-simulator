import assert from "node:assert/strict";
import { test } from "node:test";
import { CHARACTERS } from "../characters";
import { runningState as createInitialState } from "../test-fixtures";
import { MAX_TURNS } from "../types";
import type { DialogueGenerator, TurnRequest } from "../types";
import { isTurnResponse } from "../validation";
import { advanceTurn } from "./advance-turn";

// 外部生成器を差し替え、費用を発生させずに責務の境界を確かめる。
const unavailable: DialogueGenerator = async () => { throw new Error("AI unavailable"); };
// 満腹時の休憩を進行・応答検証まで通し、通常時の偽装応答も拒否する。
test("飲食できない時だけAIなしで休み、回復した数値を応答検証できる", async () => {
  for (const id of ["youkya", "sweet_tooth"] as const) {
    const state = createInitialState({ participantIds: ["youkya", "sweet_tooth"], venueId: "izakaya" });
    state.turn = id === "sweet_tooth" ? 1 : 0;
    state.participants[id] = { ...state.participants[id]!, fullness: 100, drunkenness: id === "sweet_tooth" ? 0 : 100, nonAlcoholOnly: true, firstDrinkId: null };
    let calls = 0;
    const result = await advanceTurn({ state, recentSpeeches: [] }, { random: () => 0.999, generateDialogue: async () => { calls++; return { text: "不要" }; } });
    assert.equal(calls, 0);
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].type === "action" && result.events[0].action, "rest");
    assert.equal(result.state.participants[id]!.fullness, 95);
    assert.ok(isTurnResponse(result, state));
    const drinkable = structuredClone(state); drinkable.participants[id]!.fullness = 99;
    const forged = structuredClone(result); forged.state.participants[id]!.fullness = 94;
    assert.equal(isTurnResponse(forged, drinkable), false);
  }
});
test("1ターンに1人だけ行動し、非発言ではAIを呼ばない", async () => {
  for (const random of [0, 0.4]) {
    const request: TurnRequest = { state: createInitialState(), recentSpeeches: [] };
    const original = structuredClone(request);
    let calls = 0;
    const result = await advanceTurn(request, { random: () => random, generateDialogue: async () => { calls++; return { text: "不可" }; } });
    assert.equal(calls, 0);
    assert.equal(result.state.turn, 1);
    assert.equal(result.events.length, 1);
    assert.equal((result.events[0].type !== "opening" && result.events[0].characterId), "youkya");
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
      input.character.actionBias.talk = 999;
      input.participants.length = 0;
      input.venue.name = "書き換え";
      return { text: "こんにちは！" };
    },
  });
  assert.equal(calls, 1);
  assert.equal(CHARACTERS[0].actionBias.talk, 2);
  assert.equal(result.state.aiAttempts, 1);
  assert.deepEqual(request, original);
  assert.deepEqual(result.state.participants, original.state.participants);
  assert.deepEqual(result.events[1], { type: "speech", turn: 1, characterId: "youkya", text: "こんにちは！", source: "ai" });
});
test("AI失敗・空文・長すぎる発言でも定型文で進む", async () => {
  for (const generateDialogue of [unavailable, async () => ({ text: " " }), async () => ({ text: "あ".repeat(201) })]) {
    const result = await advanceTurn({ state: createInitialState(), recentSpeeches: [] }, { random: () => 0.8, generateDialogue });
    assert.equal(result.state.turn, 1);
    assert.equal(result.events[1].type, "speech");
    assert.deepEqual(result.events[1], { type: "speech", turn: 1, characterId: "youkya", text: CHARACTERS[0].fallbackText, source: "fallback", fallbackReason: "unavailable" });
  }
});
test("AIなしで20ターン完走し、人物の順番と終了条件を守る", async () => {
  let state = createInitialState();
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const result = await advanceTurn({ state, recentSpeeches: [] }, { random: () => 0.8, generateDialogue: unavailable });
    assert.equal((result.events[0].type !== "opening" && result.events[0].characterId), CHARACTERS[turn % CHARACTERS.length].id);
    assert.ok(isTurnResponse(result, state));
    state = result.state;
  }
  await assert.rejects(advanceTurn({ state, recentSpeeches: [] }, { random: () => 0, generateDialogue: unavailable }));
});

test("成功・失敗とも8回まで試行し、上限後は生成器を呼ばない", async () => {
  for (const fail of [false, true]) {
    let calls = 0;
    let state = createInitialState();
    state.turn = 7; state.aiAttempts = 7;
    const generateDialogue: DialogueGenerator = async () => { calls++; if (fail) throw new Error("失敗"); return { text: "最後の生成" }; };
    const eighth = await advanceTurn({ state, recentSpeeches: [] }, { random: () => 0.8, generateDialogue });
    assert.equal(eighth.state.aiAttempts, 8);
    assert.ok(isTurnResponse(eighth, state));
    state = eighth.state;
    const ninth = await advanceTurn({ state, recentSpeeches: [] }, { random: () => 0.8, generateDialogue });
    assert.equal(calls, 1);
    assert.equal(ninth.state.aiAttempts, 8);
    assert.ok(isTurnResponse(ninth, state));
    assert.equal(ninth.events[1].type === "speech" && ninth.events[1].fallbackReason, "budget_exhausted");
  }
});

// 全組合せを固定乱数列で進め、AIを使わず履歴込みのAPI契約を確認する。
test("参加者4組合せ×3店舗で20ターン完走し、毎回1人だけが行動する", async () => {
  const { VENUES } = await import("../venues");
  const { isTurnRequest } = await import("../validation");
  const groups = [["youkya", "inkya"], ["youkya", "preacher"], ["inkya", "preacher"], ["youkya", "inkya", "preacher"]] as const;
  for (const participantIds of groups) for (const venue of VENUES) {
    let state = createInitialState({ participantIds: [...participantIds], venueId: venue.id });
    let recentSpeeches: TurnRequest["recentSpeeches"] = [];
    let calls = 0;
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const request = { state, recentSpeeches };
      assert.ok(isTurnRequest(request));
      const original = structuredClone(request);
      const result = await advanceTurn(request, { random: () => [0, 0.4, 0.8, 0.99][turn % 4], generateDialogue: async () => { calls++; throw new Error("offline"); } });
      assert.equal((result.events[0].type !== "opening" && result.events[0].characterId), participantIds[turn % participantIds.length]);
      assert.ok(isTurnResponse(result, state));
      assert.deepEqual(request, original);
      for (const event of result.events) if (event.type === "speech") recentSpeeches = [...recentSpeeches, event].slice(-6);
      state = result.state;
    }
    assert.equal(state.turn, 20);
    assert.equal(state.aiAttempts, calls);
    assert.ok(calls <= 8);
    assert.deepEqual(Object.keys(state.participants), [...participantIds]);
  }
});
