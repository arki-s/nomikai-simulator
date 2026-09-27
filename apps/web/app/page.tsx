"use client";

import { CHARACTERS } from "@/features/nomikai/characters";
import { ParticipantStatus } from "@/features/nomikai/components/ParticipantStatus";
import { TurnEvents } from "@/features/nomikai/components/TurnEvents";
import { MAX_TURNS } from "@/features/nomikai/types";
import { useNomikai } from "@/features/nomikai/use-nomikai";

export default function Home() {
  // ページは表示の組み立てに専念し、通信と状態管理は専用フックに任せる。
  const { result, loading, error, start, nextTurn, finished } = useNomikai();
  const buttonClass = "rounded-xl bg-amber-700 px-5 py-3 font-bold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-600";
  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-5 py-10 sm:py-16">
      <header>
        <p className="mb-3 text-xs font-bold tracking-widest text-amber-700 dark:text-amber-400">NOMIKAI SIMULATOR</p>
        <h1 className="text-3xl font-bold sm:text-4xl">🍻 飲み会シミュレーター</h1>
        <p className="mt-3 text-stone-600 dark:text-stone-300">AIが勝手に飲み会を開催する地獄装置。今度は、ひとりずつ。</p>
      </header>
      {!result ? (
        <section className="rounded-2xl border border-stone-300 p-6 dark:border-stone-700">
          <h2 className="text-lg font-bold">今日のメンバー</h2>
          <p className="mt-3">{CHARACTERS.map(({ name }) => name).join(" ／ ")}</p>
          <p className="my-5 leading-7">1クリックで1人が行動します。飲む・食べる・話す・休むを見守りながら、{MAX_TURNS}ターンの飲み会を進めましょう。</p>
          <button onClick={start} className={buttonClass}>飲み会開始</button>
        </section>
      ) : (
        <>
          <section aria-label="進行操作" className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-lg font-bold tabular-nums">ターン {result.state.turn} / {MAX_TURNS}</p>
              <p role="status" className="mt-1 text-sm text-stone-600 dark:text-stone-300">{finished ? "飲み会は終了しました。お疲れさまでした。" : loading ? "ターンを進めています…" : `次は${CHARACTERS[result.state.turn % CHARACTERS.length].name}の番です`}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {!finished && <button onClick={nextTurn} disabled={loading} className={buttonClass}>{loading ? "進行中…" : "次のターン"}</button>}
              <button onClick={start} disabled={loading} className="rounded-xl border border-stone-400 px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4">{finished ? "もう一度開催" : "最初からやり直す"}</button>
            </div>
          </section>
          <ParticipantStatus state={result.state} activeId={result.events[0]?.characterId} />
          {error && <p role="alert" className="rounded-xl border border-red-400 bg-red-50 p-4 text-red-800 dark:bg-red-950 dark:text-red-200">{error} 「次のターン」で再試行できます。</p>}
          <TurnEvents events={result.events} />
        </>
      )}
      <footer className="space-y-2 border-t border-stone-300 pt-5 text-xs leading-6 text-stone-600 dark:border-stone-700 dark:text-stone-300">
        <p>酔い・満腹はゲーム内の数値です。AIが使えないときは、定型セリフで続行します。</p>
        <p>状態はこの画面内だけで保持します。再読み込み・再開催すると初期化されます。</p>
      </footer>
    </main>
  );
}
