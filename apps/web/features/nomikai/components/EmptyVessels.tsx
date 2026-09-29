import Image from "next/image";
import { getCharacter } from "../characters";
import { emptyVessels, vesselLayout, VESSEL_LABELS, type Vessel } from "../vessels";
import type { CharacterId, SimulationEvent, VenueId } from "../types";

export function EmptyVessels({ events, venueId, characterId }: { events: SimulationEvent[]; venueId: VenueId; characterId: CharacterId }) {
  const counts = emptyVessels(events, venueId, characterId);
  // 3種類分の高さを先に確保し、消費数による舞台背景の伸縮を防ぐ。
  return <div aria-label={`${getCharacter(characterId).name}の空の器`} className="h-20 w-full space-y-1 text-xs text-white">
    {(Object.keys(counts) as Vessel[]).map((kind) => {
      const { icons, surplus } = vesselLayout(counts[kind]);
      return <div key={kind} className="h-5 whitespace-nowrap" aria-label={`空の${VESSEL_LABELS[kind]} ${counts[kind]}個`}>
        <span aria-hidden="true" className="inline-flex items-center gap-0.5">
          {Array.from({ length: icons }, (_, index) => <Image key={index} src={`/nomikai/vessels/${kind}.svg`} alt="" width={18} height={18} />)}
          {surplus > 0 && <span>+{surplus}</span>}
        </span>
      </div>;
    })}
  </div>;
}
