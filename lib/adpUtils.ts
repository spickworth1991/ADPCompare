// lib/adpUtils.ts
import { getLeaguePrimaryDraft, getDraftPicks, type DraftPick } from "@/lib/sleeper";

export type PlayerADP = {
  name: string;
  position: string;
  count: number; // total occurrences across all drafts
  avgOverallPick: number; // float
  avgRoundPick: string; // from avgOverallPick (still useful)
  modeOverallPick: number; // integer pick_no that occurred most often
  modeRoundPick: string; // from modeOverallPick (THIS is your "actual RP" column)
};

export type DraftboardCellEntry = {
  name: string;
  position: string;
  count: number;      // how many times this player hit this exact cell
  pct: number;        // count / total picks in that cell
  avgOverallPick: number; // average overall pick number for THIS player in THIS cell
  roundPick: string;      // formatted round.pick derived from avgOverallPick + teams
};


export type ADPGroupMeta = {
  teams: number;
  rounds: number;
};

export type ADPLeagueData = {
  leagueId: string;
  draftId: string;
  name: string; // draft metadata name (usually matches league name)
  meta: ADPGroupMeta;
  players: Record<string, PlayerADP>; // key is playerKey()
  draftboard: {
    // key `${round}-${slot}` where slot is 1..teams (draft slot)
    cells: Record<string, DraftboardCellEntry[]>;
  };
};

export type ADPGroupData = {
  meta: ADPGroupMeta;
  leagues: ADPLeagueData[];
  players: Record<string, PlayerADP>; // key is playerKey()
  draftboard: {
    // key `${round}-${slot}` where slot is 1..teams (draft slot)
    cells: Record<string, DraftboardCellEntry[]>;
  };
};

export type PlayerResult = {
  name: string;
  position: string;

  adpA: number | null;
  adpB: number | null;
  delta: number | null;

  roundPickA: string; // modeRoundPick
  roundPickB: string; // modeRoundPick
};

function safeStr(v: unknown) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function safeNum(v: unknown) {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : null;
}

function playerNameFromPick(p: DraftPick): string {
  const m = p?.metadata || {};
  const pn = safeStr((m as any).player_name).trim();
  if (pn) return pn;

  const first = safeStr((m as any).first_name).trim();
  const last = safeStr((m as any).last_name).trim();
  const full = `${first} ${last}`.trim();
  return full || safeStr(p?.player_id || "Unknown").trim();
}

function playerPosFromPick(p: DraftPick): string {
  const pos = safeStr((p?.metadata as any)?.position).trim();
  return pos || "UNK";
}

function playerKey(name: string, pos: string) {
  return `${name}|||${pos}`;
}

export function formatRoundPickFromOverall(overallPick: number, teams: number): string {
  const t = Number.isFinite(teams) && teams > 0 ? teams : 12;
  const x = Number.isFinite(overallPick) ? overallPick : 0;
  if (x <= 0) return "—";

  const round = Math.floor((x - 1) / t) + 1;
  const pickInRound = x - (round - 1) * t; // can be float

  // If integer, render 1.01 format
  const isInt = Math.abs(pickInRound - Math.round(pickInRound)) < 1e-9;
  if (isInt) {
    return `${round}.${String(Math.round(pickInRound)).padStart(2, "0")}`;
  }

  // If fractional, keep 2 decimals on the fractional part (rarely used in UI)
  const intPart = Math.floor(pickInRound);
  const frac = pickInRound - intPart;
  const frac2 = Math.round(frac * 100);
  return `${round}.${String(intPart).padStart(2, "0")}.${String(frac2).padStart(2, "0")}`;
}

/**
 * UI-friendly Round.Pick derived from an average overall pick.
 * We round to the nearest overall pick number before converting to Round.Pick,
 * so the list's Avg Pick and Round.Pick stay aligned.
 */
export function formatRoundPickFromAvgOverall(avgOverallPick: number, teams: number): string {
  const x = Number.isFinite(avgOverallPick) ? avgOverallPick : 0;
  if (x <= 0) return "—";
  return formatRoundPickFromOverall(Math.max(1, Math.round(x)), teams);
}

type PlayerAcc = {
  name: string;
  pos: string;
  sumPick: number;
  count: number;
  pickCounts: Map<number, number>; // for mode pick_no
};

type CellAcc = {
  name: string;
  pos: string;
  sumPick: number;
  count: number;
};

export async function getADPGroupData(leagueIds: string[]): Promise<ADPGroupData> {
  const ids = (leagueIds || []).map((s) => safeStr(s).trim()).filter(Boolean);

  if (!ids.length) {
    return {
      meta: { teams: 12, rounds: 15 },
      leagues: [],
      players: {},
      draftboard: { cells: {} },
    };
  }

  // 1) Resolve each league => primary draft meta (teams/rounds + draft_id)
  const drafts = await Promise.all(ids.map((id) => getLeaguePrimaryDraft(id)));

  const valid = drafts
    .map((d, idx) => ({ d, leagueId: ids[idx] }))
    .filter((x) => !!x.d)
    .map((x) => ({ ...(x.d as any), _leagueId: x.leagueId }));

  if (!valid.length) {
    throw new Error("No drafts found for provided league IDs.");
  }

  const firstTeams = safeNum(valid[0]?.settings?.teams) ?? 12;
  const firstRounds = safeNum(valid[0]?.settings?.rounds) ?? 15;

  // 2) Protect against mismatched settings
  const mismatches = valid.filter((d) => {
    const t = safeNum(d?.settings?.teams) ?? 12;
    const r = safeNum(d?.settings?.rounds) ?? 15;
    return t !== firstTeams || r !== firstRounds;
  });

  if (mismatches.length) {
    const bad = mismatches
      .slice(0, 5)
      .map((d) => {
        const lid = safeStr((d as any)._leagueId);
        const t = safeNum(d?.settings?.teams) ?? 12;
        const r = safeNum(d?.settings?.rounds) ?? 15;
        const n = safeStr(d?.metadata?.name);
        return `${lid} (${n || "Draft"}) [teams=${t}, rounds=${r}]`;
      })
      .join(", ");

    throw new Error(
      `League draft settings mismatch. All leagues must share the same teams/rounds as the first one (teams=${firstTeams}, rounds=${firstRounds}). Mismatch: ${bad}`
    );
  }

  const meta: ADPGroupMeta = { teams: firstTeams, rounds: firstRounds };

  // 3) Pull picks for each draft_id
  const draftIds = valid.map((d) => safeStr(d.draft_id)).filter(Boolean);
  const pickLists = await Promise.all(draftIds.map((draftId) => getDraftPicks(draftId)));

  // 4) Aggregate player ADP across ALL picks (all leagues) + mode pick
  const byPlayer = new Map<string, PlayerAcc>();

  // 5) Aggregate draftboard cells across ALL leagues: (round,slot) => player counts
  const cellToPlayers = new Map<string, Map<string, CellAcc>>();

  // 6) Also build per-league outputs so an exported JSON can be re-used offline
  const leagues: ADPLeagueData[] = [];

  function finalizePlayersMap(map: Map<string, PlayerAcc>, teams: number): Record<string, PlayerADP> {
    const out: Record<string, PlayerADP> = {};
    for (const [k, acc] of map.entries()) {
      const avg = acc.sumPick / acc.count;

      // mode pick_no (most common pick number). Tie-break: earlier pick wins.
      let modePick = 0;
      let modeCount = -1;
      for (const [pickNo, c] of acc.pickCounts.entries()) {
        if (c > modeCount || (c === modeCount && pickNo < modePick)) {
          modePick = pickNo;
          modeCount = c;
        }
      }
      if (!modePick) modePick = Math.max(1, Math.round(avg));

      out[k] = {
        name: acc.name,
        position: acc.pos,
        count: acc.count,
        avgOverallPick: avg,
        avgRoundPick: formatRoundPickFromAvgOverall(avg, teams),
        modeOverallPick: modePick,
        modeRoundPick: formatRoundPickFromOverall(modePick, teams),
      };
    }
    return out;
  }

  function finalizeCellsMap(
    map: Map<string, Map<string, CellAcc>>,
    teams: number
  ): Record<string, DraftboardCellEntry[]> {
    const out: Record<string, DraftboardCellEntry[]> = {};

    for (const [cellKey, pmap] of map.entries()) {
      const total = Array.from(pmap.values()).reduce((s, v) => s + v.count, 0) || 1;
      out[cellKey] = Array.from(pmap.values())
        .map((v) => {
          const avgPick = v.sumPick / (v.count || 1);
          return {
            name: v.name,
            position: v.pos,
            count: v.count,
            pct: v.count / total,
            avgOverallPick: avgPick,
            roundPick: formatRoundPickFromAvgOverall(avgPick, teams),
          };
        })
        .sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          if (a.avgOverallPick !== b.avgOverallPick) return a.avgOverallPick - b.avgOverallPick;
          return a.name.localeCompare(b.name);
        });
    }

    return out;
  }

  for (let i = 0; i < pickLists.length; i++) {
    const picks = pickLists[i] || [];
    const draftMeta = valid[i];
    const leagueId = safeStr((draftMeta as any)?._leagueId);
    const draftId = safeStr(draftMeta?.draft_id);
    const draftName = safeStr(draftMeta?.metadata?.name).trim();

    // Per-league accs
    const byPlayerOne = new Map<string, PlayerAcc>();
    const cellToPlayersOne = new Map<string, Map<string, CellAcc>>();

    for (const p of picks) {
      const pickNo = safeNum(p.pick_no);
      const round = safeNum(p.round);
      const slot = safeNum((p as any).draft_slot);
      if (!pickNo || !round || !slot) continue;

      const name = playerNameFromPick(p);
      const pos = playerPosFromPick(p);
      const key = playerKey(name, pos);

      // player acc
      let acc = byPlayer.get(key);
      if (!acc) {
        acc = { name, pos, sumPick: 0, count: 0, pickCounts: new Map() };
        byPlayer.set(key, acc);
      }
      acc.sumPick += pickNo;
      acc.count += 1;
      acc.pickCounts.set(pickNo, (acc.pickCounts.get(pickNo) || 0) + 1);

      // per-league player acc
      let acc1 = byPlayerOne.get(key);
      if (!acc1) {
        acc1 = { name, pos, sumPick: 0, count: 0, pickCounts: new Map() };
        byPlayerOne.set(key, acc1);
      }
      acc1.sumPick += pickNo;
      acc1.count += 1;
      acc1.pickCounts.set(pickNo, (acc1.pickCounts.get(pickNo) || 0) + 1);

      // board cell acc
      const cellKey = `${round}-${slot}`;
      let cellMap = cellToPlayers.get(cellKey);
      if (!cellMap) {
        cellMap = new Map();
        cellToPlayers.set(cellKey, cellMap);
      }
      let cc = cellMap.get(key);
      if (!cc) {
        cc = { name, pos, sumPick: 0, count: 0 };
        cellMap.set(key, cc);
      }
      cc.sumPick += pickNo;
      cc.count += 1;

      // per-league board cell acc
      let cellMap1 = cellToPlayersOne.get(cellKey);
      if (!cellMap1) {
        cellMap1 = new Map();
        cellToPlayersOne.set(cellKey, cellMap1);
      }
      let cc1 = cellMap1.get(key);
      if (!cc1) {
        cc1 = { name, pos, sumPick: 0, count: 0 };
        cellMap1.set(key, cc1);
      }
      cc1.sumPick += pickNo;
      cc1.count += 1;
    }

    leagues.push({
      leagueId,
      draftId,
      name: draftName || leagueId || draftId,
      meta,
      players: finalizePlayersMap(byPlayerOne, meta.teams),
      draftboard: { cells: finalizeCellsMap(cellToPlayersOne, meta.teams) },
    });
  }

  const players: Record<string, PlayerADP> = {};
  for (const [key, acc] of byPlayer.entries()) {
    const avg = acc.sumPick / acc.count;

    // mode pick_no (most common pick number). Tie-break: earlier pick wins.
    let modePick = 0;
    let modeCount = -1;
    for (const [pickNo, c] of acc.pickCounts.entries()) {
      if (c > modeCount || (c === modeCount && pickNo < modePick)) {
        modePick = pickNo;
        modeCount = c;
      }
    }
    if (!modePick) modePick = Math.max(1, Math.round(avg));

    players[key] = {
      name: acc.name,
      position: acc.pos,
      count: acc.count,
      avgOverallPick: avg,
      // Derive Round.Pick from the rounded average overall pick so Avg Pick and RP stay aligned.
      avgRoundPick: formatRoundPickFromAvgOverall(avg, meta.teams),
      modeOverallPick: modePick,
      modeRoundPick: formatRoundPickFromOverall(modePick, meta.teams),
    };
  }

  const cells = finalizeCellsMap(cellToPlayers, meta.teams);

  return { meta, leagues, players, draftboard: { cells } };
}

export function compareADPs(
  mapA: Record<string, PlayerADP>,
  mapB: Record<string, PlayerADP>
): PlayerResult[] {
  const allKeys = new Set<string>([...Object.keys(mapA || {}), ...Object.keys(mapB || {})]);

  const out: PlayerResult[] = [];
  for (const key of allKeys) {
    const a = mapA[key];
    const b = mapB[key];
    if (!a && !b) continue;

    const name = (a?.name || b?.name || "Unknown") as string;
    const position = (a?.position || b?.position || "UNK") as string;

    const adpA = a ? a.avgOverallPick : null;
    const adpB = b ? b.avgOverallPick : null;

    const delta =
      adpA != null && adpB != null && Number.isFinite(adpA) && Number.isFinite(adpB)
        ? adpA - adpB
        : null;

    out.push({
      name,
      position,
      adpA,
      adpB,
      delta,
      // RoundPick is derived from the rounded average overall pick so the value stays aligned with avgOverallPick.
      roundPickA: a?.avgRoundPick || "—",
      roundPickB: b?.avgRoundPick || "—",
    });
  }

  return out;
}
