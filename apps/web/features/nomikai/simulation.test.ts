import assert from "node:assert/strict";
import { test } from "node:test";
import { actorAt, createInitialState, defaultConfig, isSimulationConfig } from "./simulation";

test("選択人物だけを初期化し、開催間・設定間で状態を共有しない", () => {
  const config = defaultConfig();
  config.participantIds = ["inkya", "preacher"];
  const first = createInitialState(config);
  assert.deepEqual(Object.keys(first.participants), ["inkya", "preacher"]);
  first.participants.inkya!.drunkenness = 90;
  config.participantIds.pop();
  const second = createInitialState(first.config);
  assert.equal(second.participants.inkya!.drunkenness, 0);
  assert.equal(second.aiAttempts, 0);
  assert.equal(second.turn, 0);
  assert.deepEqual([0, 1, 2, 3].map((turn) => actorAt(second.config, turn)), ["inkya", "preacher", "inkya", "preacher"]);
});
test("未知・重複・人数不足・順番違い・未知店舗を拒否する", () => {
  for (const participantIds of [[], ["youkya"], ["youkya", "youkya"], ["unknown", "inkya"], ["inkya", "youkya"]]) {
    assert.equal(isSimulationConfig({ participantIds, venueId: "izakaya" }), false);
  }
  assert.equal(isSimulationConfig({ ...defaultConfig(), venueId: "unknown" }), false);
  assert.throws(() => createInitialState({ ...defaultConfig(), participantIds: [] }));
});

test("累積ログは発言以外も残し、最新表示と直近6発言を導出できる", async () => {
  const { appendTurnResult, latestEvents, recentSpeeches } = await import("./simulation");
  const { advanceTurn } = await import("./server/advance-turn");
  let session = { state: createInitialState(), events: [] } as import("./types").TurnResponse;
  for (let turn = 0; turn < 10; turn++) {
    const next = await advanceTurn({ state: session.state, recentSpeeches: recentSpeeches(session.events) }, { random: () => turn === 9 ? 0 : 0.8, generateDialogue: async () => ({ text: "話しました" }) });
    const count = session.events.length;
    const previous = session;
    session = appendTurnResult(session, next);
    assert.equal(previous.events.length, count);
    assert.equal(session.events.length, count + next.events.length);
  }
  assert.equal(session.events.length, 19);
  assert.equal(latestEvents(session).length, 1, "飲むターンで前の発言を残さない");
  assert.deepEqual(recentSpeeches(session.events).map((event) => event.turn), [4, 5, 6, 7, 8, 9]);
  assert.throws(() => appendTurnResult(session, session), /連続/);
});
