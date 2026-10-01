import type { ParticipantState } from "../types";

export function ParticipantStatus({ name, state }: { name: string; state: ParticipantState }) {
  // キャラの直下へメーターを統合し、人物と数値をスクロールで見比べる手間をなくす。
  return <div aria-label={`${name}の状態`} className="w-full space-y-1 text-left text-xs text-white">
    {([['drunkenness', '酔い'], ['fullness', '満腹']] as const).map(([key, label]) => <label key={key} className="block">
      {label}<span className="float-right tabular-nums">{state[key]} / 100</span>
      <meter aria-label={`${name}の${label}`} min={0} max={100} value={state[key]} className="block h-3 w-full" />
    </label>)}
  </div>;
}
