
import { getDraftPicks } from './sleeper';

export type PlayerADP = {
  name: string;
  totalPick: number;
  count: number;
};

export type PlayerResult = {
  name: string;
  adpA: number | null;
  adpB: number | null;
  delta: number | null;
};

function calcAverageADP(picks: any[], numTeams: number): Record<string, PlayerADP> {
  const data: Record<string, PlayerADP> = {};
  for (const pick of picks) {
    const meta = pick.metadata || {};
    const fullName = `${meta.first_name || ''} ${meta.last_name || ''}`.trim();
    const pickNo = pick.pick_no;
    if (!fullName || !pickNo) continue;
    const round = Math.floor((pickNo - 1) / numTeams) + 1;
    const pickInRound = (pickNo - 1) % numTeams + 1;
    const decimalPick = parseFloat(`${round}.${pickInRound.toString().padStart(2, '0')}`);
    if (!data[fullName]) {
      data[fullName] = { name: fullName, totalPick: 0, count: 0 };
    }
    data[fullName].totalPick += decimalPick;
    data[fullName].count += 1;
  }
  return data;
}

export async function getADPMap(leagueIds: string[]): Promise<Record<string, number>> {
  const adpMap: Record<string, PlayerADP> = {};
  for (const id of leagueIds) {
    const picks = await getDraftPicks(id);
    const numTeams = picks.length > 0 ? picks[0]?.draft_slot || 12 : 12;
    const leagueADP = calcAverageADP(picks, numTeams);
    for (const name in leagueADP) {
      if (!adpMap[name]) adpMap[name] = { name, totalPick: 0, count: 0 };
      adpMap[name].totalPick += leagueADP[name].totalPick;
      adpMap[name].count += leagueADP[name].count;
    }
  }
  const finalMap: Record<string, number> = {};
  for (const name in adpMap) {
    finalMap[name] = parseFloat((adpMap[name].totalPick / adpMap[name].count).toFixed(2));
  }
  return finalMap;
}

export function compareADPs(adpA: Record<string, number>, adpB: Record<string, number>): PlayerResult[] {
  const allNames = new Set([...Object.keys(adpA), ...Object.keys(adpB)]);
  const result: PlayerResult[] = [];
  for (const name of allNames) {
    const a = adpA[name] ?? null;
    const b = adpB[name] ?? null;
    const delta = a !== null && b !== null ? parseFloat((b - a).toFixed(2)) : null;
    result.push({ name, adpA: a, adpB: b, delta });
  }
  return result.sort((a, b) => {
    if (a.delta === null || b.delta === null) return 0;
    return Math.abs(b.delta) - Math.abs(a.delta);
  });
}
