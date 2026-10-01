import Image from "next/image";
import { EmptyVessels } from "./EmptyVessels";
import { ParticipantStatus } from "./ParticipantStatus";
import { participantState } from "../simulation";
import { openingLength } from "../opening";
import { getCharacter } from "../characters";
import { getVenue } from "../venues";
import { ACTION_LABELS } from "../rules";
import type { SimulationEvent, SimulationState } from "../types";

export function SimulationStage({ state, events, history }: { state: SimulationState; events: SimulationEvent[]; history: SimulationEvent[] }) {
  const venue = getVenue(state.config.venueId);
  const action = events.find((event) => event.type === "action");
  const speech = events.find((event) => event.type === "speech");
  const opening = events.find((event) => event.type === "opening");
  const speakers = opening?.speakerIds ?? (speech ? [speech.characterId] : []);
  return <section aria-label="飲み会の舞台" className="relative overflow-hidden rounded-2xl bg-stone-800 p-3 sm:p-4">
    {/* 発言は背景の外の固定枠へ移し、舞台には全員の行動・状態をまとめる。 */}
    <Image loading="eager" src={venue.backgroundSrc} alt="" fill className="object-cover" sizes="(max-width: 1280px) 100vw, 1200px" />
    <p className="relative mb-3 inline-block rounded-lg bg-stone-950/85 px-3 py-1 text-xs text-white">{venue.atmosphere}</p>
    <div className={`relative grid items-stretch gap-2 ${state.config.participantIds.length === 4 ? "grid-cols-2 lg:grid-cols-4" : state.config.participantIds.length === 3 ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-2"}`}>
      {state.config.participantIds.map((id) => {
        const character = getCharacter(id);
        const person = participantState(state, id);
        const speaking = speakers.includes(id);
        // 直近行動は累積ログから導出し、今回の行動者と混同させない。
        const previous = history.findLast((event) => event.type === "action" && event.characterId === id);
        const last = previous?.type === "action" ? previous : undefined;
        const item = last && venue.menu.find((item) => item.id === last.menuItemId);
        const first = venue.menu.find((item) => item.id === person.firstDrinkId);
        const active = action?.characterId === id || speaking;
        return <article key={id} aria-label={character.name} className={`min-w-0 space-y-2 rounded-xl border-2 bg-stone-950/85 p-3 text-white ${active ? "border-amber-300" : "border-transparent"}`}>
          <div className="flex h-20 lg:h-16 items-center gap-2">
            <Image src={character.avatarSrc} alt="" width={64} height={64} className="h-auto w-12 shrink-0 sm:w-16" />
            <div className="min-w-0"><h2 className="text-sm font-bold">{character.name}</h2><p className="mt-1 text-xs text-amber-200">{speaking ? opening?.stage === "toast" ? "全員で乾杯！" : "今回の話者" : action?.characterId === id ? "今回の行動者" : "待機中"}</p></div>
          </div>
          <p className="h-10 lg:h-8 text-xs leading-5">{last ? <><span className="text-stone-300">直近 T{last.turn}：</span>{ACTION_LABELS[last.action]}{item ? `（${item.name}）` : ""}</> : "通常の行動はまだありません"}</p>
          <p className="h-10 lg:h-8 text-xs leading-5 text-amber-100">{first ? `${state.openingStep >= openingLength(state) - 1 ? "届いた一杯" : "注文済み"}：${first.name}` : person.nonAlcoholOnly ? "ノンアルのみ" : ""}</p>
          <ParticipantStatus name={character.name} state={person} />
          <EmptyVessels events={history} venueId={venue.id} characterId={id} />
        </article>;
      })}
    </div>
  </section>;
}
