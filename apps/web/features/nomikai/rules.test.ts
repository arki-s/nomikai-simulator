import { person } from "./test-fixtures";
import assert from "node:assert/strict";
import { test } from "node:test";
import { CHARACTERS } from "./characters";
import { VENUES } from "./venues";
import { actionReason, actionWeights, applyAction, selectAction, selectMenuItem } from "./rules";

const character = CHARACTERS[0];
const venue = VENUES[0];
const context = { character, venue, state: person(0, 30) };

test("4行動の効果と丸めた差を返し、入力を変更しない", () => {
  const state = Object.freeze(person(57, 98));
  assert.deepEqual(applyAction(state, "drink", { ...character, alcoholMultiplier: 5 }, venue.menu[0]), { nextState: person(100, 98), delta: { drunkenness: 43, fullness: 0 } });
  assert.equal(applyAction(state, "eat", character, venue.menu[2]).delta.fullness, 2);
  assert.deepEqual(applyAction(state, "talk", character).nextState, state);
  assert.deepEqual(applyAction(person(2, 0), "rest", character), { nextState: person(0, 0), delta: { drunkenness: -2, fullness: 0 } });
  assert.throws(() => applyAction(state, "drink", character, venue.menu[2]));
  assert.throws(() => applyAction(state, "eat", character));
});
test("人物・店舗・メニューの違いを固定乱数で再現できる", () => {
  assert.equal(selectAction(context, () => 0.3), "drink");
  assert.equal(selectAction({ ...context, venue: VENUES[2] }, () => 0.3), "eat");
  assert.equal(actionWeights(context).talk, 5);
  assert.equal(actionWeights({ ...context, character: CHARACTERS[1] }).talk, 2);
  assert.equal(applyAction(context.state, "drink", CHARACTERS[1], venue.menu[0]).delta.drunkenness, 12);
  assert.equal(applyAction(context.state, "drink", CHARACTERS[2], venue.menu[1]).delta.drunkenness, 12);
  assert.equal(applyAction(context.state, "drink", { ...character, alcoholMultiplier: 1.25 }, venue.menu[1]).delta.drunkenness, 19);
  assert.equal(selectMenuItem(context, "eat", () => 0).id, "edamame");
  assert.equal(selectMenuItem(context, "eat", () => 0.999).id, "dessert");
  assert.match(actionReason(context, "drink", venue.menu[0]), /ビールの酔い効果10/);
});
test("抽選境界・空腹・不正乱数を検証する", () => {
  // 補正なしの条件を用い、従来の3・3・3・1の境界も維持していることを確認する。
  const neutral = { ...context, character: { ...character, actionBias: {} }, venue: { ...venue, actionBias: {} } };
  for (const [value, action] of [[0, "drink"], [0.299, "drink"], [0.3, "eat"], [0.6, "talk"], [0.9, "rest"], [0.9999, "rest"]] as const) assert.equal(selectAction(neutral, () => value), action);
  assert.equal(actionWeights({ ...neutral, state: person(79, 29) }).eat, 6);
  for (const value of [-1, 1, NaN, Infinity]) {
    assert.throws(() => selectAction(context, () => value));
    assert.throws(() => selectMenuItem(context, "drink", () => value));
  }
});
test("強い補正でも禁止行動は復活せず、休む候補が残る", () => {
  const restricted = { ...context, state: person(80, 100), character: { ...character, actionBias: { drink: 100, eat: 100, rest: -100 } } };
  assert.ok(actionWeights(restricted).drink > 0, "強い酔いでもノンアルは選択可能");
  assert.equal(actionWeights(restricted).eat, 0);
  assert.ok(actionWeights(restricted).rest >= 1);
  for (let i = 0; i < 100; i++) assert.ok(["drink", "talk", "rest"].includes(selectAction(restricted, () => i / 100)));
  assert.equal(actionWeights({ ...context, venue: { ...venue, menu: [] } }).drink, 0);
  assert.throws(() => selectMenuItem({ ...context, venue: { ...venue, menu: [] } }, "drink", () => 0));
});
