import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type NomikaiMessage = {
  name: string;
  text: string;
};

type NomikaiResponse = {
  messages: NomikaiMessage[];
};

const nomikaiResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    messages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          text: { type: "string" },
        },
        required: ["name", "text"],
      },
    },
  },
  required: ["messages"],
} as const;

function isNomikaiResponse(value: unknown): value is NomikaiResponse {
  if (
    typeof value !== "object" ||
    value === null ||
    !("messages" in value) ||
    !Array.isArray(value.messages)
  ) {
    return false;
  }

  return value.messages.every(
    (message) =>
      typeof message === "object" &&
      message !== null &&
      "name" in message &&
      "text" in message &&
      typeof message.name === "string" &&
      typeof message.text === "string"
  );
}

export async function GET() {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "OPENAI_API_KEY が設定されていません" },
      { status: 500 }
    );
  }

  const prompt = `
説明文や前置きは不要です。JSONのみ返してください。

3人の飲み会をシミュレーションしてください。

登場人物:
- 陽キャ
- 陰キャ
- 説教おじさん

条件:
- 5ターンの会話にする
- 少しカオスで笑える感じ
- 必ずJSONだけを返す
- 形式は {"messages":[{"name":"名前","text":"セリフ"}]} にする
`;

  try {
    const response = await client.responses.parse({
      model: "gpt-4.1-mini",
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "nomikai_messages",
          strict: true,
          schema: nomikaiResponseSchema,
        },
      },
    });

    const parsed = response.output_parsed;

    if (!isNomikaiResponse(parsed)) {
      return Response.json(
        {
          error: "JSONの形式が不正でした",
          raw: response.output_text,
        },
        { status: 500 }
      );
    }

    return Response.json(parsed);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "OpenAI API の呼び出しに失敗しました" },
      { status: 500 }
    );
  }
}
