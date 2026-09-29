import assert from "node:assert/strict";
import { test } from "node:test";
import { CHARACTERS } from "./characters";
import { VENUES } from "./venues";

// 固定データの入力ミスで、抽選候補や状態計算が壊れないことを確認する。
test("3店舗のID・メニュー・効果と4人の特性が有効", () => {
  assert.equal(VENUES.length, 3);
  assert.equal(new Set(VENUES.map((venue) => venue.id)).size, 3);
  for (const venue of VENUES) {
    assert.equal(new Set(venue.menu.map((item) => item.id)).size, venue.menu.length);
    for (const kind of ["drink", "eat"]) assert.ok(venue.menu.filter((item) => item.kind === kind).length >= 2);
    for (const item of venue.menu) {
      const effect = item.kind === "drink" ? item.drunkenness : item.fullness;
      if (item.kind === "drink" && !item.alcoholic) assert.equal(effect, 0);
      assert.ok(Number.isInteger(effect) && effect >= 0 && effect <= 100);
    }
    assert.ok(venue.menu.some((item) => item.id === "beer" && item.kind === "drink" && item.alcoholic));
    assert.ok(venue.menu.some((item) => item.kind === "drink" && !item.alcoholic));
    assert.ok(venue.menu.some((item) => item.kind === "eat" && item.category === "dessert"));
    assert.ok(Object.values(venue.actionBias).every(Number.isFinite));
  }
  assert.equal(CHARACTERS.length, 4);
  for (const character of CHARACTERS) {
    assert.ok(character.alcoholMultiplier > 0 && Number.isFinite(character.alcoholMultiplier));
    assert.ok(Object.values(character.actionBias).every(Number.isFinite));
  }
});

test("同梱アバターと店舗背景が参照先に存在する", async () => {
  const { readFile } = await import("node:fs/promises");
  for (const src of [...CHARACTERS.map((item) => item.avatarSrc), ...VENUES.map((item) => item.backgroundSrc), ...["mug", "glass", "plate"].map((kind) => `/nomikai/vessels/${kind}.svg`)]) {
    const svg = await readFile(new URL(`../../public${src}`, import.meta.url), "utf8");
    assert.match(svg, /<svg/);
  }
});
