// lib/sleeper.ts
// Sleeper API helpers (fetch-only, works in Node/Edge)

export type SleeperLeague = {
  league_id: string;
  name: string;
  season: string;
  total_rosters?: number;
  settings?: Record<string, unknown>;
};

export type SleeperUser = {
  user_id: string;
  username: string;
  display_name?: string;
};

export type LeagueDraft = {
  draft_id: string;
  league_id: string;
  status?: string;
  type?: string;
  settings?: {
    teams?: number;
    rounds?: number;
    [k: string]: any;
  };
  metadata?: Record<string, unknown>;
};

export type DraftPick = {
  pick_no: number; // overall pick number (1-based)
  round: number;
  roster_id: number;
  draft_slot: number; // 1..teams (draft position / column)
  player_id: string;
  metadata?: {
    player_name?: string;
    first_name?: string;
    last_name?: string;
    position?: string;
    [k: string]: any;
  };
};

const BASE = "https://api.sleeper.app/v1";

type FetchJsonOpts = { timeoutMs?: number };

// Simple in-memory cache for the current browser/server instance.
// This significantly reduces repeated Sleeper calls when users navigate between pages.
// NOTE: In serverless environments, this cache is best-effort.
const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry<T> = { ts: number; data: T };
function isFresh(ts: number) {
  return Date.now() - ts < CACHE_TTL_MS;
}

const leagueDraftsCache = new Map<string, CacheEntry<LeagueDraft[]>>();
const leagueDraftsInflight = new Map<string, Promise<LeagueDraft[]>>();

const draftPicksCache = new Map<string, CacheEntry<DraftPick[]>>();
const draftPicksInflight = new Map<string, Promise<DraftPick[]>>();
class SleeperHttpError extends Error {
  status: number;
  url: string;
  bodyText: string;
  constructor(message: string, status: number, url: string, bodyText: string) {
    super(message);
    this.name = "SleeperHttpError";
    this.status = status;
    this.url = url;
    this.bodyText = bodyText;
  }
}

async function fetchJson<T>(url: string, opts: FetchJsonOpts = {}): Promise<T> {
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? (opts.timeoutMs as number) : 15000;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      throw new SleeperHttpError(`Sleeper HTTP ${res.status}`, res.status, url, bodyText);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

export async function getUserId(username: string) {
  const u = String(username || "").trim();
  if (!u) throw new Error("Missing username");
  const url = `${BASE}/user/${encodeURIComponent(u)}`;
  const user = await fetchJson<SleeperUser>(url);
  return user.user_id;
}

export async function getUserLeagues(username: string, season: string) {
  const userId = await getUserId(username);
  const s = String(season || "").trim();
  if (!s) throw new Error("Missing season");
  const url = `${BASE}/user/${encodeURIComponent(userId)}/leagues/nfl/${encodeURIComponent(s)}`;
  return await fetchJson<SleeperLeague[]>(url);
}

export async function getLeagueDrafts(leagueId: string) {
  const id = String(leagueId || "").trim();
  if (!id) return [];

  const cached = leagueDraftsCache.get(id);
  if (cached && isFresh(cached.ts)) return cached.data;

  const inflight = leagueDraftsInflight.get(id);
  if (inflight) return inflight;

  const url = `${BASE}/league/${encodeURIComponent(id)}/drafts`;

  const p = (async () => {
    // Some leagues have no draft yet (404) — treat as no drafts.
    try {
      const data = await fetchJson<LeagueDraft[]>(url);
      leagueDraftsCache.set(id, { ts: Date.now(), data });
      return data;
    } catch (e: any) {
      if (e?.name === "SleeperHttpError" && e?.status === 404) {
        leagueDraftsCache.set(id, { ts: Date.now(), data: [] });
        return [];
      }
      throw e;
    } finally {
      leagueDraftsInflight.delete(id);
    }
  })();

  leagueDraftsInflight.set(id, p);
  return p;
}


// Prefer completed drafts, otherwise newest/first
export async function getLeaguePrimaryDraft(leagueId: string): Promise<LeagueDraft | null> {
  const drafts = await getLeagueDrafts(leagueId);
  if (!drafts.length) return null;

  const chosen =
    drafts.find((d) => String(d?.status || "").toLowerCase() === "complete") || drafts[0];

  return chosen || null;
}

export async function getDraftPicks(draftId: string) {
  const id = String(draftId || "").trim();
  if (!id) return [];

  const cached = draftPicksCache.get(id);
  if (cached && isFresh(cached.ts)) return cached.data;

  const inflight = draftPicksInflight.get(id);
  if (inflight) return inflight;

  const url = `${BASE}/draft/${encodeURIComponent(id)}/picks`;

  const p = (async () => {
    try {
      const data = await fetchJson<DraftPick[]>(url);
      draftPicksCache.set(id, { ts: Date.now(), data });
      return data;
    } catch (e: any) {
      if (e?.name === "SleeperHttpError" && (e?.status === 404 || e?.status === 400)) {
        draftPicksCache.set(id, { ts: Date.now(), data: [] });
        return [];
      }
      throw e;
    } finally {
      draftPicksInflight.delete(id);
    }
  })();

  draftPicksInflight.set(id, p);
  return p;
}

