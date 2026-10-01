import assert from "node:assert/strict";
import { test } from "node:test";
import { runningState as createInitialState } from "../../../features/nomikai/test-fixtures";
import { POST } from "./route";

// 実APIの入口で入力不備と終了を確認し、AIへ到達する前に拒否できることを守る。
function request(body: string) {
  return new Request("http://localhost/api/nomikai", { method: "POST", body, headers: { "Content-Type": "application/json" } });
}
test("壊れたJSON、不正な状態、大きすぎる本文を拒否する", async () => {
  assert.equal((await POST(request("{"))).status, 400);
  assert.equal((await POST(request("{}"))).status, 400);
  assert.equal((await POST(request(" ".repeat(16_001)))).status, 413);
});
test("終了後のターン要求を409で拒否する", async () => {
  assert.equal((await POST(request(JSON.stringify({ state: { ...createInitialState(), turn: 20 }, recentSpeeches: [] })))).status, 409);
});

test("POSTから状態更新とAI未設定時の定型文を取得できる", async (t) => {
  // 実際のHTTP処理と進行処理をつなぎ、異常系だけでなく正常系の契約も守る。
  const original = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  t.after(() => {
    if (original === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = original;
  });
  const random = t.mock.method(Math, "random", () => 0);
  const first = await POST(request(JSON.stringify({ state: createInitialState(), recentSpeeches: [] })));
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("Cache-Control"), "no-store");
  const result = await first.json();
  assert.equal(result.state.turn, 1);
  assert.equal(result.state.participants.youkya.drunkenness, 10);
  assert.equal(result.state.participants.youkya.fullness, 10);
  random.mock.mockImplementation(() => 0.999);
  const second = await POST(request(JSON.stringify({ state: result.state, recentSpeeches: [] })));
  assert.equal(second.status, 200);
  const next = await second.json();
  assert.equal(next.state.turn, 2);
  assert.equal(next.events[1].characterId, "inkya");
  assert.equal(next.events[1].source, "fallback");
});

test("2人開催と店舗メニューを受け付け、不正設定は400、AI上限後も200で継続する", async (t) => {
  const random = t.mock.method(Math, "random", () => 0);
  const state = createInitialState({ participantIds: ["inkya", "preacher"], venueId: "washoku" });
  const first = await POST(request(JSON.stringify({ state, recentSpeeches: [] })));
  assert.equal(first.status, 200);
  const result = await first.json();
  assert.deepEqual(Object.keys(result.state.participants), ["inkya", "preacher"]);
  assert.equal(result.events[0].menuItemId, "beer");
  assert.equal(result.state.participants.inkya.drunkenness, 12);
  for (const config of [{ ...state.config, venueId: "unknown" }, { ...state.config, participantIds: ["inkya", "inkya"] }]) {
    assert.equal((await POST(request(JSON.stringify({ state: { ...state, config }, recentSpeeches: [] })))).status, 400);
  }
  // 上限時はキーの有無によらず外部通信してはならない。
  const fetchMock = t.mock.method(globalThis, "fetch", async () => { throw new Error("外部通信禁止"); });
  random.mock.mockImplementation(() => 0.999);
  state.turn = 8; state.aiAttempts = 8;
  const capped = await POST(request(JSON.stringify({ state, recentSpeeches: [] })));
  assert.equal(capped.status, 200);
  const data = await capped.json();
  assert.equal(data.state.aiAttempts, 8);
  assert.equal(data.events[1].fallbackReason, "budget_exhausted");
  assert.equal(fetchMock.mock.callCount(), 0);
});

// 開始演出も既存POSTの契約で進み、通常ターンやAIの上限を消費しない。
test("POSTで質問から全員乾杯まで進め、通常ターン0とAI試行0を維持する", async () => {
  const { createInitialState: initialState } = await import("../../../features/nomikai/simulation");
  let state = initialState({ participantIds: ["youkya", "sweet_tooth"], venueId: "bar" });
  const stages: string[] = [];
  for (let step = 1; step <= 6; step++) {
    const response = await POST(request(JSON.stringify({ state, recentSpeeches: [] })));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.state.openingStep, step);
    assert.equal(result.state.turn, 0);
    assert.equal(result.state.aiAttempts, 0);
    stages.push(result.events[0].stage);
    state = result.state;
  }
  assert.deepEqual(stages, ["ask", "order", "order", "wait", "serve", "toast"]);
});
