import { CHARACTERS } from "../characters";
import type { CharacterId, SimulationState } from "../types";

export function ParticipantStatus({ state, activeId }: { state: SimulationState; activeId?: CharacterId }) {
  // 数値と名前も併記し、色だけに頼らず状態と行動した人物を伝える。
  return (
    <section aria-label="参加者の状態" className="grid gap-4 sm:grid-cols-3">
      {CHARACTERS.map((character) => {
        const participant = state.participants[character.id];
        return (
          <article key={character.id} className={`rounded-2xl border p-5 ${activeId === character.id ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30" : "border-stone-300 dark:border-stone-700"}`}>
            <h2 className="text-lg font-bold">{character.name}</h2>
            <p className="mb-4 mt-1 min-h-5 text-xs text-stone-600 dark:text-stone-300">{activeId === character.id ? "このターンの行動者" : "待機中"}</p>
            <label className="block text-sm">
              酔い <span className="float-right tabular-nums">{participant.drunkenness} / 100</span>
              <meter aria-label={`${character.name}の酔い`} min={0} max={100} value={participant.drunkenness} className="mt-1 h-4 w-full" />
            </label>
            <label className="mt-3 block text-sm">
              満腹 <span className="float-right tabular-nums">{participant.fullness} / 100</span>
              <meter aria-label={`${character.name}の満腹`} min={0} max={100} value={participant.fullness} className="mt-1 h-4 w-full" />
            </label>
          </article>
        );
      })}
    </section>
  );
}
