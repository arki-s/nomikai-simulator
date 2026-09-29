import { getVenue } from "./venues";
import type { CharacterId, SimulationEvent, VenueId } from "./types";
export const VESSEL_LABELS = { mug: "ジョッキ", glass: "グラス", plate: "皿" } as const;
export type Vessel = keyof typeof VESSEL_LABELS;
// 消費済みのログを唯一の根拠にする。注文・到着・乾杯では空の器を増やさない。
export function emptyVessels(events: SimulationEvent[], venueId: VenueId, id: CharacterId): Record<Vessel, number> {
  const counts = { mug: 0, glass: 0, plate: 0 };
  const venue = getVenue(venueId);
  for (const event of events) if (event.type === "action" && event.characterId === id && (event.action === "drink" || event.action === "eat")) {
    const item = venue.menu.find((item) => item.id === event.menuItemId);
    if (item) counts[item.vessel]++;
  }
  return counts;
}
// 描画とテストで集約境界を共有し、表示個数と実際の消費数を取り違えない。
export function vesselLayout(count: number) {
  return { icons: count >= 5 ? 1 : count, surplus: count >= 5 ? count - 1 : 0 };
}
