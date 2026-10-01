import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { AudioController, CLOSING_BGM, SOUND_EFFECTS, soundFor, type AudioPort } from "./audio-controller";
import { VENUES } from "./venues";
import type { SimulationEvent } from "./types";

function media() {
  return { src: "", currentTime: 0, volume: 1, loop: false, plays: 0, pauses: 0,
    play() { this.plays++; return Promise.resolve(); }, pause() { this.pauses++; } };
}
const drink: SimulationEvent = { type: "action", turn: 1, characterId: "youkya", action: "drink", menuItemId: "beer", delta: { drunkenness: 10, fullness: 0 }, reason: "テスト" };
const frame = { phase: "running" as const, runId: 1, bgmSrc: VENUES[0].bgmSrc, event: drink };

const finished = { ...frame, phase: "finished" as const, event: { ...drink, turn: 20 } };
// 終了演出の一回性と停止条件を、実時間やブラウザの自動再生許可に依存せず検証する。
test("BGM ONで終了曲を一度だけ流し、最後のSEは停止、再開催で店舗曲へ戻る", () => {
  const bgm = media(), se = media(); const audio = new AudioController(bgm, se, assert.fail);
  audio.enableBgm(true); audio.enableSe(true); audio.update(frame);
  audio.update(finished); audio.update({ ...finished });
  assert.equal(bgm.src, CLOSING_BGM); assert.equal(bgm.loop, false);
  assert.equal(bgm.plays, 2); assert.equal(se.plays, 1);
  audio.ended(); audio.update(finished); audio.enableBgm(false); audio.enableBgm(true);
  assert.equal(bgm.plays, 2);
  audio.update({ ...frame, runId: 2 });
  assert.equal(bgm.src, frame.bgmSrc); assert.equal(bgm.loop, true); assert.equal(bgm.plays, 3);
});
test("終了曲の非表示中は一時停止し続きから再開、OFFにした曲は再演しない", () => {
  const bgm = media(); const audio = new AudioController(bgm, media(), assert.fail);
  audio.update(frame); audio.enableBgm(true); audio.update(finished);
  bgm.currentTime = 12;
  audio.visibility(true); audio.update(finished);
  assert.equal(bgm.currentTime, 12); assert.equal(bgm.plays, 2);
  audio.visibility(false); assert.equal(bgm.currentTime, 12); assert.equal(bgm.plays, 3);
  audio.enableBgm(false); audio.enableBgm(true); audio.update(finished);
  assert.equal(bgm.plays, 3); assert.equal(bgm.currentTime, 0);
});
test("OFFでの終了・終了済み画面の表示は無音、非表示中の終了曲は復帰時に開始", () => {
  const bgm = media(); const audio = new AudioController(bgm, media(), assert.fail);
  audio.update(frame); audio.update(finished); audio.enableBgm(true);
  assert.equal(bgm.plays, 0);
  const another = new AudioController(media(), media(), assert.fail);
  another.enableBgm(true); another.update(finished);
  audio.update({ ...frame, runId: 2 }); audio.visibility(true);
  audio.update({ ...finished, runId: 2 }); assert.equal(bgm.plays, 1);
  audio.visibility(false); assert.equal(bgm.src, CLOSING_BGM); assert.equal(bgm.plays, 2);
  audio.update({ ...finished, phase: "idle", runId: 2 }); assert.equal(bgm.currentTime, 0);
});
test("終了曲の読込・再生失敗は結果表示を妨げず再試行ループにもならない", async () => {
  const bgm = media(), errors: string[] = [];
  const audio = new AudioController(bgm, media(), (message) => errors.push(message));
  audio.update(frame); audio.enableBgm(true);
  bgm.play = () => { bgm.plays++; return Promise.reject(new Error("拒否")); };
  audio.update(finished); await Promise.resolve();
  assert.match(errors[0], /終了曲/);
  audio.update(finished); audio.enableBgm(false); audio.enableBgm(true);
  assert.equal(bgm.plays, 2);
});

test("初期OFF、ONで過去SEを再生せず、確定ステップごとに1回だけ再生する", () => {
  const bgm = media(), se = media();
  const audio = new AudioController(bgm, se, assert.fail);
  audio.update(frame);
  assert.equal(bgm.plays + se.plays, 0);
  audio.enableBgm(true); audio.enableSe(true);
  assert.equal(bgm.plays, 1); assert.equal(se.plays, 0);
  audio.update(frame); audio.update({ ...frame });
  assert.equal(se.plays, 0); assert.equal(bgm.plays, 1);
  const next = { ...frame, event: { ...drink, turn: 2 } };
  audio.update(next); audio.update(next);
  assert.equal(se.plays, 1); assert.equal(se.src, SOUND_EFFECTS.drink);
  audio.enableSe(false); audio.update({ ...frame, event: { ...drink, turn: 3 } }); audio.enableSe(true);
  assert.equal(se.plays, 1);
});
test("全員乾杯は1回、食べるも対応し、会話・休む・注文・到着はSEなし", () => {
  const toast: SimulationEvent = { type: "opening", step: 8, turn: 0, stage: "toast", speakerIds: ["youkya", "inkya", "preacher", "sweet_tooth"], text: "乾杯！" };
  const bgm = media(), se = media();
  const audio = new AudioController(bgm, se, assert.fail);
  audio.enableSe(true); audio.update({ ...frame, event: toast }); audio.update({ ...frame, event: toast });
  assert.equal(se.plays, 1); assert.equal(se.src, SOUND_EFFECTS.toast);
  assert.equal(soundFor({ ...drink, action: "eat" }), SOUND_EFFECTS.eat);
  assert.equal(soundFor({ type: "action", action: "rest", turn: 1, characterId: "youkya", delta: { drunkenness: 0, fullness: 0 }, reason: "休憩" }), undefined);
  assert.equal(soundFor({ type: "speech", turn: 1, characterId: "youkya", text: "こんにちは", source: "ai" }), undefined);
  assert.equal(soundFor({ ...toast, stage: "order" }), undefined);
  assert.equal(soundFor({ ...toast, stage: "serve" }), undefined);
});
test("設定・離脱で両方停止、再開催は先頭へ、別店舗はBGM切替", () => {
  const bgm = media(), se = media(); const audio = new AudioController(bgm, se, assert.fail);
  audio.enableBgm(true); audio.enableSe(true); audio.update(frame);
  bgm.currentTime = 12; se.currentTime = 1;
  audio.update({ ...frame, phase: "idle", event: { ...drink, turn: 20 } });
  assert.equal(bgm.currentTime + se.currentTime, 0); assert.equal(se.plays, 1, "設定中はSEを流さない");
  audio.update({ ...frame, runId: 2 });
  assert.equal(bgm.plays, 2); assert.equal(se.plays, 2);
  audio.update({ ...frame, runId: 3, bgmSrc: VENUES[2].bgmSrc });
  assert.equal(bgm.src, VENUES[2].bgmSrc); assert.equal(bgm.plays, 3);
  const pauses = bgm.pauses + se.pauses; audio.dispose();
  assert.ok(bgm.pauses + se.pauses > pauses);
});
test("非表示で停止し、復帰はBGMのみ、OFFは復帰しても維持する", () => {
  const bgm = media(), se = media(); const audio = new AudioController(bgm, se, assert.fail);
  audio.enableBgm(true); audio.enableSe(true); audio.update(frame);
  audio.visibility(true); audio.update({ ...frame, event: { ...drink, turn: 2 } });
  assert.equal(bgm.plays, 1); assert.equal(se.plays, 1);
  audio.visibility(false);
  assert.equal(bgm.plays, 2); assert.equal(se.plays, 1);
  audio.enableBgm(false); audio.visibility(true); audio.visibility(false);
  assert.equal(bgm.plays, 2);
});
test("再生拒否・読込失敗は通知し、古い再生失敗で再開催を壊さない", async () => {
  const bgm = media(), se = media(); const errors: string[] = [];
  let reject: (error: Error) => void = () => {};
  const port: AudioPort = { ...bgm, play: () => new Promise<void>((_, no) => { reject = no; }) };
  const audio = new AudioController(port, se, (message) => errors.push(message));
  audio.update(frame); audio.enableBgm(true); audio.enableBgm(false);
  reject(new Error("古い拒否")); await Promise.resolve(); assert.equal(errors.length, 0);
  audio.enableBgm(true); reject(new Error("自動再生拒否")); await Promise.resolve();
  assert.equal(errors.length, 1); assert.match(errors[0], /BGM/);
  audio.failed("se"); assert.match(errors[1], /SE/);
  audio.update({ ...frame, event: { ...drink, turn: 2 } });
  assert.equal(errors.length, 2);
});
test("指定BGMと日本語名SEの実ファイルが存在する", async () => {
  assert.deepEqual(VENUES.map((venue) => venue.bgmSrc.split("/").at(-1)), ["344_BPM120.mp3", "220_BPM86.mp3", "032_BPM160.mp3"]);
  for (const src of [...VENUES.map((venue) => venue.bgmSrc), ...Object.values(SOUND_EFFECTS), CLOSING_BGM]) {
    const data = await readFile(new URL(`../../public${src}`, import.meta.url));
    assert.ok(data.length > 1000);
  }
});
