import { person } from "./test-fixtures";
import assert from "node:assert/strict";
import { test } from "node:test";
import { CHARACTERS } from "./characters";
import { VENUES } from "./venues";
import { actionReason, actionWeights, applyAction, selectAction, selectMenuItem } from "./rules";

const character = CHARACTERS[0];
const venue = VENUES[0];
const context = { character, venue, state: person(0, 30) };

// 境界条件を固定し、補正値を強くしても休憩が通常の候補へ戻らないことを守る。
test("休むは飲食できない時だけ選べ、回復後は再び飲食できる", () => {
  for (const character of CHARACTERS) for (const drunkenness of [0, 60, 100]) {
    const hungry = { character: { ...character, actionBias: { rest: 100 } }, venue, state: person(drunkenness, 99) };
    assert.equal(actionWeights(hungry).rest, 0);
    const full = { ...hungry, state: person(drunkenness, 100) };
    assert.deepEqual([actionWeights(full).drink, actionWeights(full).eat], [0, 0]);
    assert.equal(selectAction(full, () => 0.999), "rest");
    assert.equal(selectAction(full, () => 0), "talk");
    const rested = applyAction(full.state, "rest", character).nextState;
    assert.equal(rested.fullness, 95);
    assert.equal(actionWeights({ ...full, state: rested }).rest, 0);
  }
});

test("語りたがりの話す重みは明るい人物より高く、初期居酒屋で45%になる", () => {
  const preacher = actionWeights({ ...context, character: CHARACTERS[2], state: person() });
  assert.equal(preacher.talk / Object.values(preacher).reduce((a, b) => a + b), 0.45);
  assert.ok(preacher.talk > actionWeights({ ...context, state: person() }).talk);
});

test("4行動の効果と丸めた差を返し、入力を変更しない", () => {
  const state = Object.freeze(person(57, 98));
  assert.deepEqual(applyAction(state, "drink", { ...character, alcoholMultiplier: 5 }, venue.menu[0]), { nextState: person(100, 100), delta: { drunkenness: 43, fullness: 2 } });
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
  // 補正なしの条件を用い、飲食できるときは3・3・3・0で抽選することを確認する。
  const neutral = { ...context, character: { ...character, actionBias: {} }, venue: { ...venue, actionBias: {} } };
  for (const [value, action] of [[0, "drink"], [0.333, "drink"], [1 / 3, "eat"], [2 / 3, "talk"], [0.9999, "talk"]] as const) assert.equal(selectAction(neutral, () => value), action);
  assert.equal(actionWeights({ ...neutral, state: person(79, 29) }).eat, 6);
  for (const value of [-1, 1, NaN, Infinity]) {
    assert.throws(() => selectAction(context, () => value));
    assert.throws(() => selectMenuItem(context, "drink", () => value));
  }
});
test("強い補正でも禁止行動は復活せず、休む候補が残る", () => {
  const restricted = { ...context, state: person(80, 100), character: { ...character, actionBias: { drink: 100, eat: 100, rest: -100 } } };
  assert.equal(actionWeights(restricted).drink, 0, "満腹では飲料も選べない");
  assert.equal(actionWeights(restricted).eat, 0);
  assert.ok(actionWeights(restricted).rest >= 1);
  for (let i = 0; i < 100; i++) assert.ok(["talk", "rest"].includes(selectAction(restricted, () => i / 100)));
  assert.equal(actionWeights({ ...context, venue: { ...venue, menu: [] } }).drink, 0);
  assert.throws(() => selectMenuItem({ ...context, venue: { ...venue, menu: [] } }, "drink", () => 0));
});
