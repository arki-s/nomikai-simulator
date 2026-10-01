import Image from "next/image";
import { getCharacter } from "../characters";
import { emptyVessels, vesselLayout, VESSEL_LABELS, type Vessel } from "../vessels";
import type { CharacterId, SimulationEvent, VenueId } from "../types";

export function EmptyVessels({ events, venueId, characterId }: { events: SimulationEvent[]; venueId: VenueId; characterId: CharacterId }) {
  const counts = emptyVessels(events, venueId, characterId);
  // 種類ごとの枠を常に確保する。PCでは横並びにして、一画面内の状態確認を優先する。
  return <div aria-label={`${getCharacter(characterId).name}の空の器`} className="grid h-16 w-full grid-cols-1 gap-1 text-xs text-white lg:h-6 lg:grid-cols-3">
    {(Object.keys(counts) as Vessel[]).map((kind) => {
      const { icons, surplus } = vesselLayout(counts[kind]);
      return <div key={kind} className="h-5 whitespace-nowrap" aria-label={`空の${VESSEL_LABELS[kind]} ${counts[kind]}個`}>
        <span aria-hidden="true" className="inline-flex items-center gap-0.5">
          {Array.from({ length: icons }, (_, index) => <Image key={index} src={`/nomikai/vessels/${kind}.svg`} alt="" width={14} height={14} />)}
          {surplus > 0 && <span>+{surplus}</span>}
        </span>
      </div>;
    })}
  </div>;
}
