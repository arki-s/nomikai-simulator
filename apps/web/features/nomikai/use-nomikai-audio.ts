import { useEffect, useRef, useState } from "react";
import { AudioController } from "./audio-controller";
import { getVenue } from "./venues";
import { MAX_TURNS } from "./types";
import type { TurnResponse } from "./types";

export function useNomikaiAudio(result: TurnResponse | null, runId: number) {
  const bgmRef = useRef<HTMLAudioElement>(null);
  const seRef = useRef<HTMLAudioElement>(null);
  const controller = useRef<AudioController | null>(null);
  const [bgmOn, setBgmOn] = useState(false);
  const [seOn, setSeOn] = useState(false);
  const [audioError, setAudioError] = useState("");
  useEffect(() => {
    const audio = new AudioController(bgmRef.current!, seRef.current!, setAudioError);
    controller.current = audio;
    const visibility = () => audio.visibility(document.hidden);
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => { document.removeEventListener("visibilitychange", visibility); audio.dispose(); controller.current = null; };
  }, []);
  useEffect(() => {
    // 最新の確定行動だけを渡す。会話イベントや過去ログを再生の起点にしない。
    const event = result?.events.findLast((item) => item.type !== "speech");
    controller.current?.update({ active: result !== null && result.state.turn < MAX_TURNS, runId,
      bgmSrc: result ? getVenue(result.state.config.venueId).bgmSrc : "", event });
  }, [result, runId]);
  function toggleBgm() { const on = !bgmOn; setBgmOn(on); setAudioError(""); controller.current?.enableBgm(on); }
  function toggleSe() { const on = !seOn; setSeOn(on); setAudioError(""); controller.current?.enableSe(on); }
  return { bgmRef, seRef, bgmOn, seOn, audioError, toggleBgm, toggleSe,
    mediaFailed: (kind: "bgm" | "se") => controller.current?.failed(kind) };
}
