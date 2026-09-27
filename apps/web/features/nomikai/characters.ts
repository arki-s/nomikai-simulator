import type { Character, SimulationState } from "./types";

// 固定人物を共有し、リクエストによる名前・口調の差し替えを防ぐ。
export const CHARACTERS: readonly Character[] = [
  { id: "youkya", name: "明るい人", speakingStyle: "明るく気さく。場を盛り上げる短い口調。", fallbackText: "このメンバー、なんだかんだ楽しいじゃん！" },
  { id: "inkya", name: "物静かな人", speakingStyle: "控えめで少し自虐的。小声のような短い口調。", fallbackText: "……こういう席、聞いているだけでも結構面白いですね。" },
  { id: "preacher", name: "語りたがりな人", speakingStyle: "昔の経験を語りたがる、少し説教くさい口調。", fallbackText: "まあ聞きなさい。昔の飲み会というのはだな……。" },
];

export function createInitialState(): SimulationState {
  // 再開催で前回の状態を引き継がないよう、毎回独立したオブジェクトを作る。
  return {
    turn: 0,
    participants: {
      youkya: { drunkenness: 0, fullness: 0 },
      inkya: { drunkenness: 0, fullness: 0 },
      preacher: { drunkenness: 0, fullness: 0 },
    },
  };
}
