import { eventKey } from "./simulation";
import type { SimulationEvent } from "./types";

// 実ファイルの分解済み日本語名を保ち、OSによる正規化差で404になるのを防ぐ。
export const SOUND_EFFECTS = {
  drink: "/nomikai/audio/se/gulp_down_water1.mp3",
  eat: "/nomikai/audio/se/食べ物をパクッ.mp3",
  toast: "/nomikai/audio/se/グラス乾杯1.mp3",
};
export type AudioPort = { src: string; currentTime: number; volume: number; loop: boolean; play(): Promise<void>; pause(): void };
export type AudioFrame = { active: boolean; runId: number; bgmSrc: string; event?: SimulationEvent };
export function soundFor(event?: SimulationEvent): string | undefined {
  if (event?.type === "opening" && event.stage === "toast") return SOUND_EFFECTS.toast;
  if (event?.type === "action" && (event.action === "drink" || event.action === "eat")) return SOUND_EFFECTS[event.action];
}

// 再生は表示の副作用として隔離し、失敗しても状態遷移やAPIを止めない。
export class AudioController {
  private frame: AudioFrame = { active: false, runId: 0, bgmSrc: "" };
  private bgmOn = false;
  private seOn = false;
  private hidden = false;
  private lastEvent = "";
  private bgmPlaying = false;
  private bgmBlocked = false;
  private generation = { bgm: 0, se: 0 };
  constructor(private bgm: AudioPort, private se: AudioPort, private report: (message: string) => void) {
    bgm.loop = true; bgm.volume = 0.25;
    se.loop = false; se.volume = 0.6;
  }
  update(frame: AudioFrame) {
    const restarted = frame.runId !== this.frame.runId || frame.bgmSrc !== this.frame.bgmSrc;
    if (restarted) { this.stop("bgm"); this.stop("se"); this.bgmBlocked = false; }
    this.frame = frame;
    this.reconcileBgm();
    const key = `${frame.runId}:${frame.event ? eventKey(frame.event) : "none"}`;
    const changed = key !== this.lastEvent;
    // OFF中も確認済みにすることで、ON操作や履歴再描画による音の巻き戻しを防ぐ。
    this.lastEvent = key;
    if (!frame.active || this.hidden) { this.stop("se"); return; }
    const src = soundFor(frame.event);
    if (changed && this.seOn && src) {
      this.stop("se"); this.se.src = src; this.play("se");
    }
  }
  enableBgm(on: boolean) { this.bgmOn = on; this.bgmBlocked = false; this.reconcileBgm(); }
  enableSe(on: boolean) { this.seOn = on; if (!on) this.stop("se"); }
  visibility(hidden: boolean) {
    this.hidden = hidden;
    if (hidden) this.stop("se");
    this.reconcileBgm();
  }
  failed(kind: "bgm" | "se") {
    this.stop(kind);
    if (kind === "bgm") this.bgmBlocked = true;
    this.report(`${kind === "bgm" ? "BGM" : "SE"}を再生できません。OFF→ONで再試行できます。飲み会はそのまま続けられます。`);
  }
  dispose() { this.stop("bgm"); this.stop("se"); }
  private reconcileBgm() {
    if (!this.frame.active || !this.bgmOn || this.hidden) { this.stop("bgm"); return; }
    if (this.bgmPlaying || this.bgmBlocked) return;
    this.bgm.src = this.frame.bgmSrc;
    this.bgmPlaying = true;
    this.play("bgm");
  }
  private stop(kind: "bgm" | "se") {
    this.generation[kind]++;
    const audio = kind === "bgm" ? this.bgm : this.se;
    audio.pause();
    audio.currentTime = 0;
    if (kind === "bgm") this.bgmPlaying = false;
  }
  private play(kind: "bgm" | "se") {
    const generation = ++this.generation[kind];
    // 再開催やOFF後に古いplayの拒否が届いても、現在の再生状態を壊さない。
    try {
      const pending = (kind === "bgm" ? this.bgm : this.se).play();
      void pending.catch(() => { if (generation === this.generation[kind]) this.failed(kind); });
    } catch { if (generation === this.generation[kind]) this.failed(kind); }
  }
}
