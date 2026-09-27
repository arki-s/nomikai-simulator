import assert from "node:assert/strict";
import { test } from "node:test";
import { createInitialState } from "./characters";
import { actionWeights, applyAction, selectAction } from "./rules";

// AIを介さず境界値と抽選を検証し、ルール変更による状態の破綻を防ぐ。
test("初期状態は固定3人で、再開催ごとに独立する", () => {
  const first = createInitialState();
  first.participants.youkya.drunkenness = 90;
  const second = createInitialState();
  assert.deepEqual(Object.keys(second.participants), ["youkya", "inkya", "preacher"]);
  assert.equal(second.turn, 0);
  for (const state of Object.values(second.participants)) assert.deepEqual(state, { drunkenness: 0, fullness: 0 });
});
test("4行動の効果が決まり、元の状態は変更されない", () => {
  const before = Object.freeze({ drunkenness: 30, fullness: 40 });
  assert.deepEqual(applyAction(before, "drink").nextState, { drunkenness: 40, fullness: 40 });
  assert.deepEqual(applyAction(before, "eat").nextState, { drunkenness: 30, fullness: 55 });
  assert.deepEqual(applyAction(before, "talk").nextState, before);
  assert.deepEqual(applyAction(before, "rest").nextState, { drunkenness: 25, fullness: 35 });
});
test("上下限で丸め、実際の増減を返す", () => {
  assert.deepEqual(applyAction({ drunkenness: 97, fullness: 98 }, "drink"), {
    nextState: { drunkenness: 100, fullness: 98 }, delta: { drunkenness: 3, fullness: 0 },
  });
  assert.equal(applyAction({ drunkenness: 0, fullness: 98 }, "eat").delta.fullness, 2);
  assert.deepEqual(applyAction({ drunkenness: 2, fullness: 0 }, "rest"), {
    nextState: { drunkenness: 0, fullness: 0 }, delta: { drunkenness: -2, fullness: 0 },
  });
});
test("重み付き抽選の境界を固定乱数で確認する", () => {
  const state = { drunkenness: 0, fullness: 30 };
  for (const [random, action] of [[0, "drink"], [0.299, "drink"], [0.3, "eat"], [0.6, "talk"], [0.9, "rest"], [0.9999, "rest"]] as const) {
    assert.equal(selectAction(state, () => random), action);
  }
  assert.equal(actionWeights({ drunkenness: 79, fullness: 29 }).eat, 6);
  assert.equal(actionWeights(state).eat, 3);
  for (const random of [-1, 1, NaN, Infinity]) assert.throws(() => selectAction(state, () => random));
});
test("高い酔いでは飲まず、満腹では食べず、常に候補が残る", () => {
  const state = { drunkenness: 80, fullness: 100 };
  assert.deepEqual(actionWeights(state), { drink: 0, eat: 0, talk: 3, rest: 6 });
  for (let i = 0; i < 100; i++) assert.ok(["talk", "rest"].includes(selectAction(state, () => i / 100)));
  assert.equal(actionWeights({ drunkenness: 79, fullness: 99 }).drink, 3);
  assert.equal(actionWeights({ drunkenness: 79, fullness: 99 }).eat, 3);
});
