import { getCharacter } from "../characters";
import { participantState } from "../simulation";
import { NON_ALCOHOL_THRESHOLD } from "../types";
import type { CharacterId, SimulationState } from "../types";

export function ParticipantStatus({ state, activeId }: { state: SimulationState; activeId?: CharacterId }) {
  // 数値と名前も併記し、色だけに頼らず状態と行動した人物を伝える。
  return (
    <section aria-label="参加者の状態" className={`grid gap-4 ${state.config.participantIds.length === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : state.config.participantIds.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
      {// 選択した人物だけを描画し、未参加者の状態参照を避ける。
      state.config.participantIds.map((id) => {
        const character = getCharacter(id);
        const participant = participantState(state, id);
        return (
          <article key={character.id} className={`rounded-2xl border p-5 ${activeId === character.id ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30" : "border-stone-300 dark:border-stone-700"}`}>
            <h2 className="text-lg font-bold">{character.name}</h2>
            <p className="mb-4 mt-1 min-h-5 text-xs text-stone-600 dark:text-stone-300">{activeId === character.id ? state.turn === 0 ? "開始会話の話者" : "このターンの行動者" : "待機中"}</p>
            <p className="mb-3 text-xs text-amber-800 dark:text-amber-300">{character.alcoholPolicy === "non_alcohol_only" ? "ノンアル限定" : participant.nonAlcoholOnly ? "この開催はノンアルへ切替済み" : `酔い${NON_ALCOHOL_THRESHOLD}以上でノンアルへ切替`}</p>
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
