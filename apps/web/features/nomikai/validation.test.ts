import assert from "node:assert/strict";
import { test } from "node:test";
import { runningState as createInitialState } from "./test-fixtures";
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
    Object.assign(state.participants.youkya!, { drunkenness: value });
    assert.equal(isTurnRequest({ state, recentSpeeches: [] }), false);
  }
  for (const turn of [-1, 21, 0.5, "1"]) assert.equal(isTurnRequest({ state: { ...createInitialState(), turn }, recentSpeeches: [] }), false);
  const state = createInitialState();
  assert.equal(isTurnRequest({ state: { ...state, participants: { ...state.participants, unknown: {} } }, recentSpeeches: [] }), false);
  assert.equal(isTurnRequest({ state: { ...state, participants: { youkya: state.participants.youkya } }, recentSpeeches: [] }), false);
  for (const input of [null, [], {}, { state }]) assert.equal(isTurnRequest(input), false);
});
test("文脈の長さ、話者、順序、未来の発言を検証する", () => {
  const state = { ...createInitialState(), turn: 3, aiAttempts: 1 };
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
  const badState = structuredClone(response); badState.state.participants.inkya!.fullness = 1;
  const badEvent = structuredClone(response); if (badEvent.events[0].type === "action") badEvent.events[0].characterId = "inkya";
  const badDelta = structuredClone(response); if (badDelta.events[0].type === "action") badDelta.events[0].delta.drunkenness = 99;
  for (const value of [null, {}, badTurn, badState, badEvent, badDelta]) assert.equal(isTurnResponse(value, state), false);
});

test("開催設定・AI試行回数・選択参加者の発言順を検証する", () => {
  const state = createInitialState({ participantIds: ["inkya", "preacher"], venueId: "bar" });
  state.turn = 3; state.aiAttempts = 2;
  const recentSpeeches = [{ type: "speech", turn: 3, characterId: "inkya", text: "こんにちは", source: "ai" }];
  assert.ok(isTurnRequest({ state, recentSpeeches }));
  for (const aiAttempts of [-1, 1.5, 9, 4, "2"]) assert.equal(isTurnRequest({ state: { ...state, aiAttempts }, recentSpeeches: [] }), false);
  for (const config of [{ ...state.config, venueId: "unknown" }, { ...state.config, participantIds: ["inkya", "inkya"] }, { ...state.config, participantIds: ["youkya", "inkya"] }]) {
    assert.equal(isTurnRequest({ state: { ...state, config }, recentSpeeches: [] }), false);
  }
  assert.equal(isTurnRequest({ state, recentSpeeches: [{ ...recentSpeeches[0], characterId: "youkya" }] }), false);
  assert.equal(isTurnRequest({ state: { ...state, aiAttempts: 0 }, recentSpeeches }), false);
  assert.equal(isTurnRequest({ state, recentSpeeches: [{ ...recentSpeeches[0], source: "fallback", fallbackReason: "budget_exhausted" }] }), false);
});
test("店舗の差し替え・メニュー偽装・AI回数の飛び越しを拒否する", async () => {
  const state = createInitialState();
  const response = await advanceTurn({ state, recentSpeeches: [] }, { random: () => 0, generateDialogue: async () => ({ text: "不要" }) });
  const changedVenue = structuredClone(response); changedVenue.state.config.venueId = "bar";
  const wrongItem = structuredClone(response); if (wrongItem.events[0].type === "action" && wrongItem.events[0].action === "drink") wrongItem.events[0].menuItemId = "pizza";
  const wrongEffect = structuredClone(response); wrongEffect.state.participants.youkya!.drunkenness = 90; if (wrongEffect.events[0].type === "action") wrongEffect.events[0].delta.drunkenness = 90;
  const wrongBudget = structuredClone(response); wrongBudget.state.aiAttempts = 1;
  for (const value of [changedVenue, wrongItem, wrongEffect, wrongBudget]) assert.equal(isTurnResponse(value, state), false);
});
