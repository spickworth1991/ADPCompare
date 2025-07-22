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
  totalPick: number; // for internal use
  count: number;
  avg: number;
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
    const overallPick = pickNo; 

    if (!data[fullName]) {
      data[fullName] = {
        name: fullName,
        position,
        totalPick: 0,
        count: 0,
        avg: 0,
      };
    }

    data[fullName].totalPick += overallPick;
    data[fullName].count += 1;
  }

  for (const name in data) {
    const entry = data[name];
    entry.avg = parseFloat((entry.totalPick / entry.count).toFixed(2));
  }

  return data;
}

export async function getADPMap(leagueIds: string[], leagueSize: number): Promise<Record<string, PlayerADP>> {
  const adpMap: Record<string, PlayerADP> = {};

  for (const id of leagueIds) {
    const picks = await getDraftPicks(id);
    const leagueADP = calcAverageADP(picks, leagueSize);

    for (const name in leagueADP) {
      if (!adpMap[name]) {
        adpMap[name] = {
          name,
          position: leagueADP[name].position,
          totalPick: 0,
          count: 0,
          avg: 0,
        };
      }

      adpMap[name].totalPick += leagueADP[name].totalPick;
      adpMap[name].count += leagueADP[name].count;
    }
  }

  for (const name in adpMap) {
    const entry = adpMap[name];
    entry.avg = parseFloat((entry.totalPick / entry.count).toFixed(2));
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
      adpA: a?.avg ?? null,
      adpB: b?.avg ?? null,
      delta: null,
    };

    if (result.adpA !== null && result.adpB !== null) {
      result.delta = parseFloat((result.adpB - result.adpA).toFixed(2));
    }

    results.push(result);
  }

  return results;
}
