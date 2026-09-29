"use client";

import { getCharacter } from "@/features/nomikai/characters";
import { getVenue } from "@/features/nomikai/venues";
import { isOpening, openingLength } from "@/features/nomikai/opening";
import { useNomikaiAudio } from "@/features/nomikai/use-nomikai-audio";
import { actorAt } from "@/features/nomikai/simulation";
import { NomikaiSetup } from "@/features/nomikai/components/NomikaiSetup";
import { SimulationStage } from "@/features/nomikai/components/SimulationStage";
import { ParticipantStatus } from "@/features/nomikai/components/ParticipantStatus";
import { TurnEvents } from "@/features/nomikai/components/TurnEvents";
import { EventLog } from "@/features/nomikai/components/EventLog";
import { MAX_AI_ATTEMPTS, MAX_TURNS } from "@/features/nomikai/types";
import { useNomikai } from "@/features/nomikai/use-nomikai";

export default function Home() {
  // ページは表示を組み立て、通信・状態管理と行動ルールはそれぞれの担当へ委ねる。
  const { result, runId, config, loading, error, start, configure, nextTurn, turnEvents, finished } = useNomikai();
  const { bgmRef, seRef, bgmOn, seOn, audioError, toggleBgm, toggleSe, mediaFailed } = useNomikaiAudio(result, runId);
  const opening = result !== null && isOpening(result.state);
  const firstEvent = turnEvents[0];
  const activeId = firstEvent?.type === "opening" ? firstEvent.speakerIds.length === 1 ? firstEvent.speakerIds[0] : undefined : firstEvent?.characterId;
  const buttonClass = "rounded-xl bg-amber-700 px-5 py-3 font-bold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-600";
  const secondaryClass = "rounded-xl border border-stone-400 px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4";
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      {/* 音声要素は設定画面でも保持し、設定維持と確実な停止を両立する。 */}
      <audio ref={bgmRef} aria-label="店舗BGM" preload="none" onError={() => mediaFailed("bgm")} />
      <audio ref={seRef} aria-label="行動SE" preload="none" onError={() => mediaFailed("se")} />
      <header className="mb-8">
        <p className="mb-3 text-xs font-bold tracking-widest text-amber-700 dark:text-amber-400">NOMIKAI SIMULATOR</p>
        <h1 className="text-3xl font-bold sm:text-4xl">🍻 飲み会シミュレーター</h1>
        <p className="mt-3 text-stone-600 dark:text-stone-300">誰と、どこで。ひとりずつ転がる飲み会を見守ろう。</p>
      </header>
      {!result ? <NomikaiSetup initialConfig={config} onStart={start} /> : <>
        <section aria-label="進行操作" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">{getVenue(result.state.config.venueId).name}</h2>
            <div className="flex flex-wrap gap-3 text-sm tabular-nums"><p>ターン {result.state.turn} / {MAX_TURNS}</p><p>AI生成試行 {result.state.aiAttempts} / {MAX_AI_ATTEMPTS}</p></div>
          </div>
          <p role="status" className="text-sm">{finished ? "飲み会は終了しました。最終状態と今回のログを振り返れます。" : loading ? "ターンを進めています…" : opening ? `開始会話 ${result.state.openingStep} / ${openingLength(result.state)}（通常ターンはまだ消費しません）` : `次は${getCharacter(actorAt(result.state.config, result.state.turn)).name}の番です`}</p>
          {result.state.aiAttempts === MAX_AI_ATTEMPTS && <p className="text-sm text-amber-800 dark:text-amber-300">AI生成試行の上限に達しました。以降の発言は定型セリフで続行します。</p>}
          <div aria-label="音声設定" className="flex flex-wrap items-center gap-3">
            <button type="button" aria-pressed={bgmOn} onClick={toggleBgm} className={secondaryClass}>BGM {bgmOn ? "ON" : "OFF"}</button>
            <button type="button" aria-pressed={seOn} onClick={toggleSe} className={secondaryClass}>SE {seOn ? "ON" : "OFF"}</button>
            <span className="text-xs">初期OFF・終了時は自動停止</span>
          </div>
          {audioError && <p role="status" className="text-sm text-amber-800 dark:text-amber-300">{audioError}</p>}
          <div className="flex flex-wrap gap-3">
            {!finished && <button onClick={nextTurn} disabled={loading} className={buttonClass}>{loading ? "進行中…" : opening ? "開始会話を進める" : "次のターン"}</button>}
            <button onClick={() => start()} disabled={loading} className={secondaryClass}>同じ設定で再開催</button>
            <button onClick={configure} disabled={loading} className={secondaryClass}>設定に戻る</button>
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-300">再開催・設定に戻ると今回の状態とログは消えます。AI試行には未設定・失敗も含み、課金回数とは異なります。</p>
        </section>
        <SimulationStage state={result.state} events={turnEvents} history={result.events} />
        <ParticipantStatus state={result.state} activeId={activeId} />
        {error && <p role="alert" className="rounded-xl border border-red-400 bg-red-50 p-4 text-red-800 dark:bg-red-950 dark:text-red-200">{error} 「次のターン」で再試行できます。</p>}
        <TurnEvents events={turnEvents} venueId={result.state.config.venueId} />
        <EventLog events={result.events} venueId={result.state.config.venueId} />
      </>}
      <footer className="space-y-2 border-t border-stone-300 pt-5 text-xs leading-6 text-stone-600 dark:border-stone-700">
        <p>酔い・満腹はゲーム内の数値です。AIが使えないときは、定型セリフで続行します。</p>
        <p>音源：<a href="https://bgmer.net/" className="underline">BGMer</a> ／ <a href="https://soundeffect-lab.info/" className="underline">効果音ラボ</a> ／ <a href="https://www.springin.org/sound-stock/" className="underline">Springin’ Sound Stock</a> ／ <a href="https://taira-komori.net/index.html" className="underline">小森平</a></p>
        <p>状態とログはこの画面内だけで保持します。再読み込み・再開催すると初期化されます。</p>
      </footer>
    </main>
  );
}
