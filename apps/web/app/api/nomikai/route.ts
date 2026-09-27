import { advanceTurn } from "@/features/nomikai/server/advance-turn";
import { generateDialogue } from "@/features/nomikai/server/generate-dialogue";
import { MAX_TURNS } from "@/features/nomikai/types";
import { isTurnRequest } from "@/features/nomikai/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let input: unknown;
  try {
    // 小さな状態と直近の会話だけを扱い、無制限の本文を生成処理へ渡さない。
    const body = await request.text();
    if (body.length > 16_000) return Response.json({ error: "入力が大きすぎます" }, { status: 413 });
    input = JSON.parse(body);
  } catch {
    return Response.json({ error: "JSONの形式が不正です" }, { status: 400 });
  }
  if (!isTurnRequest(input)) {
    return Response.json({ error: "参加者の状態または会話の形式が不正です" }, { status: 400 });
  }
  if (input.state.turn >= MAX_TURNS) {
    return Response.json({ error: "飲み会は終了しています。再開催してください" }, { status: 409 });
  }
  try {
    // APIは入出力を担当し、状態計算とセリフ生成をそれぞれの責務へ委ねる。
    const result = await advanceTurn(input, { random: Math.random, generateDialogue });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "ターンを進められませんでした。もう一度お試しください" }, { status: 500 });
  }
}
