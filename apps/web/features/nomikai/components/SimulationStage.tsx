import Image from "next/image";
import { getCharacter } from "../characters";
import { getVenue } from "../venues";
import type { SimulationEvent, SimulationState } from "../types";

export function SimulationStage({ state, events }: { state: SimulationState; events: SimulationEvent[] }) {
  const venue = getVenue(state.config.venueId);
  const action = events.find((event) => event.type === "action");
  const speech = events.find((event) => event.type === "speech");
  // 最新ターンだけで舞台を作り、前ターンの発言者を現在の話者として残さない。
  return (
    <section aria-label="飲み会の舞台" className="space-y-5">
      {/* 背景の基準領域から発言枠を分離し、発言の有無や長さで画像が拡大・縮小するのを防ぐ。 */}
      <div className="relative overflow-hidden rounded-2xl bg-stone-800 p-4 sm:p-8">
        <Image src={venue.backgroundSrc} alt="" fill className="object-cover" sizes="(max-width: 1024px) 100vw, 960px" />
        <div className="relative mb-5 inline-block rounded-lg bg-stone-950/85 px-3 py-2 text-sm text-white">{venue.atmosphere}</div>
        <div className={`relative grid items-end gap-3 ${state.config.participantIds.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {state.config.participantIds.map((id) => {
            const character = getCharacter(id);
            const speaking = speech?.characterId === id;
            return (
              <div key={id} className={`flex min-w-0 flex-col items-center rounded-xl border-2 p-2 text-center sm:p-4 ${action?.characterId === id ? "border-amber-300 bg-stone-950/85" : "border-transparent bg-stone-950/70"}`}>
                <Image src={character.avatarSrc} alt="" width={110} height={110} className="h-auto w-full max-w-28" />
                <p className="mt-2 text-xs font-bold text-white sm:text-base">{character.name}</p>
                <p className="mt-1 min-h-8 text-xs text-amber-200">{speaking ? "このターンの話者" : action?.characterId === id ? "このターンの行動者" : "待機中"}</p>
              </div>
            );
          })}
        </div>
      </div>
      {speech && <div className="rounded-2xl border border-stone-200 border-l-4 border-l-amber-500 bg-white p-5 text-stone-900"><p className="mb-2 text-sm font-bold">{getCharacter(speech.characterId).name}の発言</p><p className="whitespace-pre-wrap break-words leading-7">「{speech.text}」</p></div>}
    </section>
  );
}
