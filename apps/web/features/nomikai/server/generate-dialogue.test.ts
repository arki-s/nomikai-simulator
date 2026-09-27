import assert from "node:assert/strict";
import { test } from "node:test";
import { CHARACTERS } from "../characters";
import { generateDialogue, parseDialogue } from "./generate-dialogue";

// セリフ以外の出力を拒否し、AIを状態更新の入口にしない。
test("セリフのみを採用し、余分なフィールド・空文・長文を拒否する", () => {
  assert.deepEqual(parseDialogue({ text: " 乾杯！ " }), { text: "乾杯！" });
  for (const value of [null, {}, { text: "" }, { text: "あ".repeat(201) }, { text: "乾杯", action: "drink" }]) {
    assert.throws(() => parseDialogue(value));
  }
});
test("キーなしでは外部通信せず、進行側に失敗を返す", async () => {
  const original = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    await assert.rejects(generateDialogue({ character: CHARACTERS[0], state: { drunkenness: 0, fullness: 0 }, recentSpeeches: [] }), /未設定/);
  } finally {
    if (original === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = original;
  }
});

test("SDKでセリフだけを解析し、拒否・未完了・HTTP障害は失敗として返す", async (t) => {
  // 実SDKの通信先だけを差し替え、秘密情報や料金を使わずAPI形式も検証する。
  const original = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key-not-a-real-secret";
  t.after(() => {
    if (original === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = original;
  });
  const input = { character: CHARACTERS[0], state: { drunkenness: 10, fullness: 15 }, recentSpeeches: [] };
  let body: Record<string, unknown> = {};
  let status = 200;
  let payload: unknown = {
    status: "completed", output: [{ type: "message", role: "assistant", content: [
      { type: "output_text", text: JSON.stringify({ text: "今日は楽しもう！" }), annotations: [] },
    ] }],
  };
  const fetchMock = t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
    body = JSON.parse(String(options.body));
    return Response.json(payload, { status });
  });
  assert.deepEqual(await generateDialogue(input), { text: "今日は楽しもう！" });
  assert.equal(body.model, "gpt-4.1-mini");
  assert.equal(body.store, false);
  assert.deepEqual(JSON.parse(String(body.input)).state, input.state);
  assert.equal(JSON.parse(String(body.input)).speaker, "陽キャ");
  const format = (body.text as { format: { schema: { properties: unknown } } }).format;
  assert.deepEqual(format.schema.properties, { text: { type: "string" } });

  payload = { status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "refusal", refusal: "応答不可" }] }] };
  await assert.rejects(generateDialogue(input));
  payload = { status: "incomplete", output: [] };
  await assert.rejects(generateDialogue(input), /完了/);
  payload = { error: { message: "一時的な障害" } };
  status = 500;
  await assert.rejects(generateDialogue(input));
  assert.equal(fetchMock.mock.callCount(), 4, "失敗してもSDKが自動再試行しない");
});
