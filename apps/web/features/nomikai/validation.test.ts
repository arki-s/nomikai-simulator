import assert from "node:assert/strict";
import { test } from "node:test";
import { createInitialState } from "./characters";
import { isTurnRequest, isTurnResponse } from "./validation";
import { advanceTurn } from "./server/advance-turn";

// HTTPからの値は型保証がないため、実行時検証の境界をテストする。
test("初期状態と上限ターンの入力形式を受け付ける", () => {
  assert.ok(isTurnRequest({ state: createInitialState(), recentSpeeches: [] }));
  assert.ok(isTurnRequest({ state: { ...createInitialState(), turn: 20 }, recentSpeeches: [] }));
});
test("範囲外・非整数・不明な人物・欠けた人物を拒否する", () => {
  for (const value of [-1, 101, 0.5, "10", null, NaN, Infinity]) {
    const state = createInitialState();
    Object.assign(state.participants.youkya, { drunkenness: value });
    assert.equal(isTurnRequest({ state, recentSpeeches: [] }), false);
  }
  for (const turn of [-1, 21, 0.5, "1"]) assert.equal(isTurnRequest({ state: { ...createInitialState(), turn }, recentSpeeches: [] }), false);
  const state = createInitialState();
  assert.equal(isTurnRequest({ state: { ...state, participants: { ...state.participants, unknown: {} } }, recentSpeeches: [] }), false);
  assert.equal(isTurnRequest({ state: { ...state, participants: { youkya: state.participants.youkya } }, recentSpeeches: [] }), false);
  for (const input of [null, [], {}, { state }]) assert.equal(isTurnRequest(input), false);
});
test("文脈の長さ、話者、順序、未来の発言を検証する", () => {
  const state = { ...createInitialState(), turn: 3 };
  const speech = { type: "speech", turn: 1, characterId: "youkya", text: "乾杯", source: "ai" };
  assert.ok(isTurnRequest({ state, recentSpeeches: [speech] }));
  for (const change of [{ text: " " }, { text: "あ".repeat(201) }, { turn: 4 }, { characterId: "preacher" }, { source: "unknown" }]) {
    assert.equal(isTurnRequest({ state, recentSpeeches: [{ ...speech, ...change }] }), false);
  }
  assert.equal(isTurnRequest({ state, recentSpeeches: [speech, speech] }), false);
  assert.equal(isTurnRequest({ state, recentSpeeches: Array(7).fill(speech) }), false);
});
test("応答のターン・話者・実際の増減・非行動者の変化を検査する", async () => {
  const state = createInitialState();
  const response = await advanceTurn({ state, recentSpeeches: [] }, { random: () => 0, generateDialogue: async () => ({ text: "不要" }) });
  assert.ok(isTurnResponse(response, state));
  const badTurn = structuredClone(response); badTurn.state.turn = 2;
  const badState = structuredClone(response); badState.state.participants.inkya.fullness = 1;
  const badEvent = structuredClone(response); badEvent.events[0].characterId = "inkya";
  const badDelta = structuredClone(response); if (badDelta.events[0].type === "action") badDelta.events[0].delta.drunkenness = 99;
  for (const value of [null, {}, badTurn, badState, badEvent, badDelta]) assert.equal(isTurnResponse(value, state), false);
});
