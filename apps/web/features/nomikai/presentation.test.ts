import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CurrentEvent } from "./components/CurrentEvent";
import { SimulationStage } from "./components/SimulationStage";
import { runningState } from "./test-fixtures";
import type { SimulationEvent } from "./types";

// 長文を省略してしまう退行と、今回の話者／過去の行動者を混同する退行を防ぐ。
test("最大200文字のセリフを全文残し、次の飲食では前のセリフを残さない", () => {
  const text = "長い話です。".repeat(33) + "終。";
  const speech: SimulationEvent = { type: "speech", turn: 2, characterId: "preacher", text, source: "ai" };
  const action: SimulationEvent = { type: "action", turn: 2, characterId: "preacher", action: "talk", delta: { drunkenness: 0, fullness: 0 }, reason: "テスト" };
  const html = renderToStaticMarkup(createElement(CurrentEvent, { events: [action, speech], venueId: "izakaya" }));
  assert.equal(text.length, 200);
  assert.ok(html.includes(text)); assert.match(html, /語りたがりな人：話す/);
  const next = renderToStaticMarkup(createElement(CurrentEvent, { events: [{ ...action, action: "drink", menuItemId: "beer", delta: { drunkenness: 8, fullness: 10 } }], venueId: "izakaya" }));
  assert.ok(!next.includes(text)); assert.match(next, /満腹 \+10/);
});
test("舞台には各自の直近行動と状態を残し、今回の話者だけを強調する", () => {
  const previous: SimulationEvent = { type: "action", turn: 1, characterId: "youkya", action: "drink", menuItemId: "beer", delta: { drunkenness: 10, fullness: 10 }, reason: "テスト" };
  const action: SimulationEvent = { ...previous, turn: 2, characterId: "inkya", action: "talk", menuItemId: undefined, delta: { drunkenness: 0, fullness: 0 } };
  const speech: SimulationEvent = { type: "speech", turn: 2, characterId: "inkya", text: "話します", source: "fallback", fallbackReason: "unavailable" };
  const state = runningState(); state.turn = 2;
  const html = renderToStaticMarkup(createElement(SimulationStage, { state, events: [action, speech], history: [previous, action, speech] }));
  assert.equal((html.match(/今回の話者/g) ?? []).length, 1);
  assert.equal((html.match(/<meter /g) ?? []).length, 8);
  assert.match(html, /飲む/); assert.match(html, /ビール/); assert.match(html, /話す/);
  assert.ok(!html.includes("話します"), "セリフを舞台へ二重に表示しない");
});
