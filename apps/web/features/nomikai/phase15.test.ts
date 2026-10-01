import assert from "node:assert/strict";
import { test } from "node:test";
import { CHARACTERS, getCharacter } from "./characters";
import { VENUES } from "./venues";
import { advanceTurn } from "./server/advance-turn";
import { advanceOpening, firstDrink, isOpening, openingLength } from "./opening";
import { createInitialState, latestEvents, appendTurnResult } from "./simulation";
import { applyAction, menuCandidates, selectMenuItem } from "./rules";
import { isTurnRequest, isTurnResponse } from "./validation";
import { person, runningState } from "./test-fixtures";
import { emptyVessels, vesselLayout } from "./vessels";
import type { ActionEvent, TurnResponse } from "./types";

// 全参加パターンを実際の遷移で進め、開始演出の追加が既存20ターンを壊さないことを守る。
test("2〜4人の全11組合せ×3店舗：注文・待機・到着・全員乾杯から20ターンまで完走", async () => {
  for (let mask = 0; mask < 16; mask++) {
    const ids = CHARACTERS.filter((_, index) => mask & (1 << index)).map(({ id }) => id);
    if (ids.length < 2) continue;
    for (const venue of VENUES) {
      let session: TurnResponse = { state: createInitialState({ participantIds: ids, venueId: venue.id }), events: [] };
      while (isOpening(session.state)) {
        const before = structuredClone(session.state);
        const response = await advanceTurn({ state: session.state, recentSpeeches: [] }, { random: () => { throw new Error("開始中に抽選しない"); }, generateDialogue: async () => { throw new Error("開始中にAIを呼ばない"); } });
        assert.ok(isTurnRequest({ state: response.state, recentSpeeches: [] }));
        assert.ok(isTurnResponse(response, session.state));
        assert.deepEqual(before, session.state);
        assert.equal(response.state.turn, 0);
        assert.equal(response.state.aiAttempts, 0);
        for (const id of ids) assert.equal(response.state.participants[id]!.drunkenness + response.state.participants[id]!.fullness, 0);
        session = appendTurnResult(session, response);
        assert.equal(latestEvents(session).length, 1);
      }
      assert.equal(session.events.length, ids.length + 4);
      assert.deepEqual(session.events.map((event) => event.type === "opening" && event.stage), ["ask", ...ids.map(() => "order"), "wait", "serve", "toast"]);
      const toast = session.events.at(-1)!;
      assert.ok(toast.type === "opening");
      assert.deepEqual(toast.speakerIds, ids);
      assert.equal(toast.text, "乾杯！");
      assert.throws(() => advanceOpening(session.state));
      for (const id of ids) assert.deepEqual(emptyVessels(session.events, venue.id, id), { mug: 0, glass: 0, plate: 0 });
      for (let turn = 0; turn < 20; turn++) {
        const response = await advanceTurn({ state: session.state, recentSpeeches: [] }, { random: () => [0, .4, .8, .99][turn % 4], generateDialogue: async () => { throw new Error("オフライン"); } });
        assert.ok(isTurnResponse(response, session.state));
        assert.ok(response.events[0].type === "action");
        assert.equal(response.events[0].characterId, ids[turn % ids.length]);
        session = appendTurnResult(session, response);
        if (ids.includes("sweet_tooth")) assert.equal(session.state.participants.sweet_tooth!.drunkenness, 0);
      }
      assert.equal(session.state.turn, 20);
      assert.equal(session.state.openingStep, openingLength(session.state));
      assert.ok(session.state.aiAttempts <= 8);
    }
  }
});
test("最初の通常飲むは配膳済みの一杯を消費し、その後に店舗の抽選へ戻る", async () => {
  for (const venue of VENUES) {
    const state = runningState({ participantIds: ["youkya", "sweet_tooth"], venueId: venue.id });
    const context = { state: state.participants.youkya!, character: getCharacter("youkya"), venue };
    assert.equal(selectMenuItem(context, "drink", () => .999).id, "beer");
    const first = await advanceTurn({ state, recentSpeeches: [] }, { random: () => 0, generateDialogue: async () => { throw new Error(); } });
    assert.equal(first.state.participants.youkya!.firstDrinkId, null);
    assert.ok(menuCandidates({ ...context, state: first.state.participants.youkya! }, "drink").length >= 2);
    const second = await advanceTurn({ state: first.state, recentSpeeches: [] }, { random: () => 0, generateDialogue: async () => { throw new Error(); } });
    assert.equal(second.state.participants.sweet_tooth!.drunkenness, 0);
    assert.deepEqual(emptyVessels([...first.events, ...second.events], venue.id, "sweet_tooth"), { mug: 0, glass: 1, plate: 0 });
    assert.equal(firstDrink(state, "sweet_tooth").id, "juice");
  }
});
test("酔い60でノンアルへ切り替え、休んでも戻らず、ノンアル自体は酔いを下げない", () => {
  const character = CHARACTERS[0];
  const venue = VENUES[0];
  const beer = venue.menu.find((item) => item.id === "beer")!;
  const before = person(50, 30);
  const after = applyAction(before, "drink", character, beer).nextState;
  assert.equal(after.drunkenness, 60);
  assert.equal(after.nonAlcoholOnly, true);
  const rested = applyAction(after, "rest", character).nextState;
  assert.equal(rested.drunkenness, 55);
  for (const state of [person(59), person(60), person(80), rested]) {
    const candidates = menuCandidates({ state, character, venue }, "drink");
    assert.ok(candidates.length);
    assert.ok(candidates.every((item) => item.kind === "drink" && item.alcoholic === !state.nonAlcoholOnly));
  }
  const juice = venue.menu.find((item) => item.id === "juice")!;
  assert.deepEqual(applyAction(rested, "drink", character, juice).delta, { drunkenness: 0, fullness: 10 });
  assert.throws(() => applyAction(rested, "drink", character, beer), /ノンアル/);
  assert.throws(() => applyAction(person(), "drink", getCharacter("sweet_tooth"), beer), /ノンアル/);
});
test("甘党はデザート重み3、他の人物は同じ重みで料理を選ぶ", () => {
  const venue = VENUES[0];
  const context = { state: person(), venue, character: getCharacter("sweet_tooth") };
  assert.equal(selectMenuItem(context, "eat", () => .399).id, "karaage");
  assert.equal(selectMenuItem(context, "eat", () => .4).id, "dessert");
  assert.equal(selectMenuItem({ ...context, character: CHARACTERS[0] }, "eat", () => .4).id, "karaage");
});
test("開始ステップ飛ばし・順番・注文・酔い・話者の偽装を拒否する", () => {
  const initial = createInitialState();
  const response = advanceOpening(initial);
  for (const field of ["stage", "speakerIds", "text", "step"] as const) {
    const bad = structuredClone(response);
    Object.assign(bad.events[0], { [field]: field === "speakerIds" ? ["sweet_tooth"] : "偽装" });
    assert.equal(isTurnResponse(bad, initial), false);
  }
  for (const patch of [{ openingStep: 99 }, { openingStep: -1 }, { openingStep: 1.2 }, { turn: 1 }, { aiAttempts: 1 }]) assert.equal(isTurnRequest({ state: { ...initial, ...patch }, recentSpeeches: [] }), false);
  const wrongOrder = structuredClone(response); wrongOrder.state.participants.youkya!.firstDrinkId = "beer";
  assert.equal(isTurnRequest({ state: wrongOrder.state, recentSpeeches: [] }), false);
  const running = runningState(); running.turn = 1; running.participants.sweet_tooth!.drunkenness = 10;
  assert.equal(isTurnRequest({ state: running, recentSpeeches: [] }), false);
});
test("禁止アルコールと最初の一杯のすり替えを応答検証でも拒否する", async () => {
  const state = runningState({ participantIds: ["youkya", "sweet_tooth"], venueId: "izakaya" });
  const result = await advanceTurn({ state, recentSpeeches: [] }, { random: () => 0, generateDialogue: async () => ({ text: "未使用" }) });
  assert.ok(result.events[0].type === "action" && result.events[0].action === "drink");
  result.events[0].menuItemId = "sour";
  assert.equal(isTurnResponse(result, state), false);
  const nonAlcohol = structuredClone(state); nonAlcohol.turn = 1;
  const second = await advanceTurn({ state: nonAlcohol, recentSpeeches: [] }, { random: () => 0, generateDialogue: async () => ({ text: "未使用" }) });
  assert.ok(second.events[0].type === "action" && second.events[0].action === "drink");
  second.events[0].menuItemId = "beer";
  assert.equal(isTurnResponse(second, nonAlcohol), false);
});
test("空の器は人物・種類別に累積し、5個から集約、再開催でゼロへ戻る", () => {
  const event: ActionEvent = { type: "action", turn: 1, characterId: "youkya", action: "drink", menuItemId: "beer", delta: { drunkenness: 10, fullness: 0 }, reason: "テスト" };
  const history = Array.from({ length: 6 }, (_, index) => ({ ...event, turn: index + 1 }));
  assert.deepEqual(emptyVessels(history, "izakaya", "youkya"), { mug: 6, glass: 0, plate: 0 });
  assert.deepEqual(emptyVessels(history, "izakaya", "sweet_tooth"), { mug: 0, glass: 0, plate: 0 });
  assert.deepEqual(emptyVessels([], "izakaya", "youkya"), { mug: 0, glass: 0, plate: 0 });
  assert.deepEqual(vesselLayout(4), { icons: 4, surplus: 0 });
  assert.deepEqual(vesselLayout(5), { icons: 1, surplus: 4 });
  assert.deepEqual(vesselLayout(6), { icons: 1, surplus: 5 });
});
