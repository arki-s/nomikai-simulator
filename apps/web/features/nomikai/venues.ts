import type { Venue, VenueId } from "./types";

// 店舗・飲食効果は同梱プリセットで解決し、クライアントの任意の数値を採用しない。
export const VENUES: readonly Venue[] = [
  {
    id: "izakaya", name: "路地裏の居酒屋", atmosphere: "提灯の灯る、気取らないにぎやかな店。", ruleLabel: "飲む重み +2", backgroundSrc: "/nomikai/venues/izakaya.svg", actionBias: { drink: 2 },
    menu: [
      { id: "beer", name: "ビール", kind: "drink", drunkenness: 10 },
      { id: "sour", name: "レモンサワー", kind: "drink", drunkenness: 15 },
      { id: "edamame", name: "枝豆", kind: "eat", fullness: 10 },
      { id: "karaage", name: "唐揚げ", kind: "eat", fullness: 25 },
    ],
  },
  {
    id: "washoku", name: "静かな和食店", atmosphere: "庭を眺めながら、落ち着いて料理を楽しめる店。", ruleLabel: "食べる重み +2・休む重み +1", backgroundSrc: "/nomikai/venues/washoku.svg", actionBias: { eat: 2, rest: 1 },
    menu: [
      { id: "sake", name: "日本酒", kind: "drink", drunkenness: 20 },
      { id: "umeshu", name: "梅酒", kind: "drink", drunkenness: 12 },
      { id: "sashimi", name: "刺身", kind: "eat", fullness: 12 },
      { id: "rice", name: "炊き込みご飯", kind: "eat", fullness: 30 },
    ],
  },
  {
    id: "bar", name: "にぎやかなバル", atmosphere: "音楽と笑い声が弾む、カラフルなバル。", ruleLabel: "話す重み +3", backgroundSrc: "/nomikai/venues/bar.svg", actionBias: { talk: 3 },
    menu: [
      { id: "wine", name: "ワイン", kind: "drink", drunkenness: 16 },
      { id: "cocktail", name: "カクテル", kind: "drink", drunkenness: 22 },
      { id: "cheese", name: "チーズ", kind: "eat", fullness: 10 },
      { id: "pizza", name: "ピザ", kind: "eat", fullness: 28 },
    ],
  },
];

export function getVenue(id: VenueId): Venue {
  const venue = VENUES.find((item) => item.id === id);
  if (!venue) throw new Error("不明な店舗です");
  return venue;
}
