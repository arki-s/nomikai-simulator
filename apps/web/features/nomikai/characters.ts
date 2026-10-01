import type { Character, CharacterId } from "./types";

// 人物差は固定データで管理し、AIやリクエストに行動特性を決めさせない。
// 語りたがりは通常5回程度の出番でも特徴が出るよう、話す補正を6にする。
export const CHARACTERS: readonly Character[] = [
  { id: "youkya", name: "明るい人", speakingStyle: "明るく気さく。場を盛り上げる短い口調。", fallbackText: "このメンバー、なんだかんだ楽しいじゃん！", avatarSrc: "/nomikai/avatars/youkya.svg", alcoholPolicy: "allowed", likesDessert: false, alcoholMultiplier: 1, actionBias: { talk: 2 }, traitLabel: "酔いやすさ ×1.0・話す重み +2" },
  { id: "inkya", name: "物静かな人", speakingStyle: "控えめで少し自虐的。小声のような短い口調。", fallbackText: "……こういう席、聞いているだけでも結構面白いですね。", avatarSrc: "/nomikai/avatars/inkya.svg", alcoholPolicy: "allowed", likesDessert: false, alcoholMultiplier: 1.2, actionBias: { talk: -1, rest: 1 }, traitLabel: "酔いやすさ ×1.2・話す重み −1・飲食不可時の休む重み +1" },
  { id: "preacher", name: "語りたがりな人", speakingStyle: "昔の経験を語りたがる、少し説教くさい口調。", fallbackText: "まあ聞きなさい。昔の飲み会というのはだな……。", avatarSrc: "/nomikai/avatars/preacher.svg", alcoholPolicy: "allowed", likesDessert: false, alcoholMultiplier: 0.8, actionBias: { talk: 6 }, traitLabel: "酔いやすさ ×0.8・話す重み +6" },
  { id: "sweet_tooth", name: "甘党な人", speakingStyle: "成人女性。穏やかな口調で、甘いものの話になると嬉しそう。お酒は飲まない。", fallbackText: "デザート、みんなで少しずつ分けませんか？", avatarSrc: "/nomikai/avatars/sweet_tooth.svg", alcoholPolicy: "non_alcohol_only", likesDessert: true, alcoholMultiplier: 1, actionBias: { eat: 1 }, traitLabel: "ノンアル限定・甘党・食べる重み +1" },
];

export function getCharacter(id: CharacterId): Character {
  const character = CHARACTERS.find((item) => item.id === id);
  if (!character) throw new Error("不明な人物です");
  return character;
}
