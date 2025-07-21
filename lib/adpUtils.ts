// adpUtils.ts
import { getDraftPicks } from './sleeper';

export type PlayerResult = {
  name: string;
  position: string;
  adpA: number | null;
  adpB: number | null;
  delta: number | null;
};

type PlayerADP = {
  name: string;
  position: string;
  totalPick: number;
  count: number;
};

function calcAverageADP(picks: any[], numTeams: number): Record<string, PlayerADP> {
  const data: Record<string, PlayerADP> = {};
  for (const pick of picks) {
    const meta = pick.metadata || {};
    const fullName = `${meta.first_name || ''} ${meta.last_name || ''}`.trim();
    const position = meta.position || '-';
    const pickNo = pick.pick_no;

    if (!fullName || !pickNo) continue;

    const round = Math.floor((pickNo - 1) / numTeams) + 1;
    const pickInRound = (pickNo - 1) % numTeams + 1;
    const decimalPick = parseFloat(`${round}.${pickInRound.toString().padStart(2, '0')}`);

    if (!data[fullName]) {
      data[fullName] = {
        name: fullName,
        position,
        totalPick: 0,
        count: 0,
      };
    }

    data[fullName].totalPick += decimalPick;
    data[fullName].count += 1;
  }

  return data;
}

export async function getADPMap(leagueIds: string[]): Promise<Record<string, PlayerADP>> {
  const adpMap: Record<string, PlayerADP> = {};

  for (const id of leagueIds) {
    const picks = await getDraftPicks(id);
    const numTeams = picks.length > 0 ? picks[0]?.draft_slot || 12 : 12;
    const leagueADP = calcAverageADP(picks, numTeams);

    for (const name in leagueADP) {
      if (!adpMap[name]) {
        adpMap[name] = {
          name,
          position: leagueADP[name].position,
          totalPick: 0,
          count: 0,
        };
      }

      adpMap[name].totalPick += leagueADP[name].totalPick;
      adpMap[name].count += leagueADP[name].count;
    }
  }

  // convert to average
  for (const name in adpMap) {
    adpMap[name].totalPick = parseFloat((adpMap[name].totalPick / adpMap[name].count).toFixed(2));
  }

  return adpMap;
}

export function compareADPs(
  adpA: Record<string, PlayerADP>,
  adpB: Record<string, PlayerADP>
): PlayerResult[] {
  const allNames = new Set([...Object.keys(adpA), ...Object.keys(adpB)]);
  const results: PlayerResult[] = [];

  for (const name of allNames) {
    const a = adpA[name];
    const b = adpB[name];

    const result: PlayerResult = {
      name: name,
      position: a?.position || b?.position || '-',
      adpA: a?.totalPick ?? null,
      adpB: b?.totalPick ?? null,
      delta: null,
    };

    if (result.adpA !== null && result.adpB !== null) {
      result.delta = parseFloat((result.adpB - result.adpA).toFixed(2));
    }

    results.push(result);
  }

  return results;
}
