import Image from "next/image";
import { useState } from "react";
import { CHARACTERS } from "../characters";
import { VENUES } from "../venues";
import { MAX_AI_ATTEMPTS, MAX_TURNS } from "../types";
import type { CharacterId, SimulationConfig } from "../types";

export function NomikaiSetup({ initialConfig, onStart }: { initialConfig: SimulationConfig; onStart: (config: SimulationConfig) => void }) {
  const [config, setConfig] = useState<SimulationConfig>(() => structuredClone(initialConfig));
  function toggle(id: CharacterId) {
    setConfig((previous) => {
      const selected = new Set(previous.participantIds);
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      // 選択した順ではなく掲載順に揃え、開始前に行動順を予測できるようにする。
      return { ...previous, participantIds: CHARACTERS.filter(({ id }) => selected.has(id)).map(({ id }) => id) };
    });
  }
  return (
    <form className="space-y-8" onSubmit={(event) => { event.preventDefault(); if (config.participantIds.length >= 2) onStart(config); }}>
      <fieldset>
        <legend className="mb-4 text-xl font-bold">01 メンバーを選ぶ</legend>
        <p className="mb-4 text-sm text-stone-600 dark:text-stone-300">2〜4人を選択。行動順は左から順番です。重みが大きい行動ほど選ばれやすくなります。</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CHARACTERS.map((character) => (
            <label key={character.id} className={`cursor-pointer rounded-2xl border-2 p-4 transition-colors ${config.participantIds.includes(character.id) ? "border-amber-600 bg-amber-50 dark:bg-amber-950/30" : "border-stone-300 dark:border-stone-700"}`}>
              <div className="flex items-center justify-between"><Image src={character.avatarSrc} alt="" width={72} height={72} /><input type="checkbox" checked={config.participantIds.includes(character.id)} onChange={() => toggle(character.id)} aria-label={character.name} className="size-5 accent-amber-700" /></div>
              <p className="mt-3 font-bold">{character.name}</p>
              <p className="mt-2 text-xs leading-6 text-stone-600 dark:text-stone-300">{character.traitLabel}</p>
            </label>
          ))}
        </div>
        {config.participantIds.length < 2 && <p role="status" className="mt-3 text-sm text-red-700 dark:text-red-300">参加者を2人以上選んでください。</p>}
      </fieldset>
      <fieldset>
        <legend className="mb-4 text-xl font-bold">02 お店を選ぶ</legend>
        <div className="grid gap-4 md:grid-cols-3">
          {VENUES.map((venue) => (
            <label key={venue.id} className={`overflow-hidden rounded-2xl border-2 cursor-pointer ${config.venueId === venue.id ? "border-amber-600 bg-amber-50 dark:bg-amber-950/30" : "border-stone-300 dark:border-stone-700"}`}>
              {/* 店舗の主画像は表示時にすぐ読み込み、背景の表示待ちを避ける。 */}
              <Image loading="eager" src={venue.backgroundSrc} alt="" width={800} height={320} className="h-28 w-full object-cover" />
              <div className="p-4">
                <div className="flex items-center gap-2"><input type="radio" name="venue" value={venue.id} checked={config.venueId === venue.id} onChange={() => setConfig((previous) => ({ ...previous, venueId: venue.id }))} aria-label={venue.name} className="size-4 accent-amber-700" /><span className="font-bold">{venue.name}</span></div>
                <p className="my-2 text-sm leading-6">{venue.atmosphere}</p>
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">{venue.ruleLabel}</p>
                <ul className="mt-3 space-y-1 text-xs leading-5 text-stone-600 dark:text-stone-300">
                  {venue.menu.map((item) => <li key={item.id}>{item.name} · {item.kind === "drink" ? item.alcoholic ? `酔い +${item.drunkenness} × 人物倍率・満腹 +${item.fullness}` : `ノンアル・満腹 +${item.fullness}` : `満腹 +${item.fullness}`}</li>)}
                </ul>
              </div>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="rounded-2xl bg-stone-100 p-5 dark:bg-stone-900">
        <p className="text-sm leading-7">注文・到着・全員の乾杯を経て、1クリックで1人が1回行動。全{MAX_TURNS}ターン、AI生成試行は最大{MAX_AI_ATTEMPTS}回です。AIが使えない場合も定型セリフで続行します。</p>
        <button disabled={config.participantIds.length < 2} className="mt-4 rounded-xl bg-amber-700 px-8 py-3 font-bold text-white hover:bg-amber-800 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-4">飲み会開始</button>
      </div>
    </form>
  );
}
