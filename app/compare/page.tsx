'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { getADPMap, compareADPs, PlayerResult } from '@/lib/adpUtils';

type View = 'all' | 'risers' | 'fallers' | 'unchanged';
type SortKey = 'name' | 'position' | 'adpA' | 'adpB' | 'delta';

type ADPExportV1 = {
  schemaVersion: 1;
  createdAt: string;
  title: string;
  mode: 'compare' | 'full-a' | 'full-b';
  leagueSize: number;
  leagues: {
    sideA: string[];
    sideB: string[];
  };
  players: Array<{
    name: string;
    position: string;
    adpA: number | null;
    adpB: number | null;
    delta: number | null;
    roundPickA: string | null;
    roundPickB: string | null;
  }>;
  draftboard: {
    totalRounds: number;
    rows: Array<{
      round: number;
      direction: 'L2R' | 'R2L';
      picks: Array<{
        slot: number;
        overallPick: number;
        name: string;
        position: string;
        adp: number;
        roundPick: string;
      } | null>;
    }>;
  };
};

function slugifyFilename(s: string) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function toNumOrNull(n: unknown): number | null {
  const x = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(x) ? x : null;
}

function downloadJson(obj: unknown, filename: string) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toRoundPick(overallPick: number, leagueSize: number): string | null {
  if (!Number.isFinite(overallPick) || overallPick <= 0) return null;
  const size = Number.isFinite(leagueSize) && leagueSize > 0 ? leagueSize : 12;
  const round = Math.floor((overallPick - 1) / size) + 1;
  const slot = ((overallPick - 1) % size) + 1;
  return `${round}.${String(slot).padStart(2, '0')}`;
}

function buildAdpExportV1(opts: {
  title: string;
  mode: 'compare' | 'full-a' | 'full-b';
  leagueSize: number;
  a: string[];
  b: string[];
  results: PlayerResult[];
}): ADPExportV1 {
  const { title, mode, leagueSize, a, b, results } = opts;
  const createdAt = new Date().toISOString();

  // List payload (full results, not filtered by UI)
  const players = results
    .slice()
    .sort((x, y) => {
      const ax = Number.isFinite(x.adpA as any) ? (x.adpA as number) : Infinity;
      const ay = Number.isFinite(y.adpA as any) ? (y.adpA as number) : Infinity;
      return ax - ay;
    })
    .map((r) => {
      const adpA = toNumOrNull(r.adpA);
      const adpB = toNumOrNull(r.adpB);
      const delta = toNumOrNull(r.delta);
      const pickA = adpA == null ? null : Math.round(adpA);
      const pickB = adpB == null ? null : Math.round(adpB);
      return {
        name: r.name,
        position: r.position,
        adpA,
        adpB,
        delta,
        roundPickA: pickA == null ? null : toRoundPick(pickA, leagueSize),
        roundPickB: pickB == null ? null : toRoundPick(pickB, leagueSize),
      };
    });

  // Draftboard payload (uses ADP A as the board-order)
  const totalRounds = 18;
  const totalPicks = totalRounds * leagueSize;

    // Canonical board order: rank by ADP A (straight average) and assign sequential picks.
  const boardOrdered = results
    .filter((r) => Number.isFinite(r.adpA as any))
    .slice()
    .sort((x, y) => (x.adpA as number) - (y.adpA as number))
    .slice(0, totalPicks)
    .map((r, idx) => {
      const overallPick = idx + 1; // <- sequential, no rounding collisions
      const rp = toRoundPick(overallPick, leagueSize) || '';
      return {
        overallPick,
        name: r.name,
        position: r.position,
        adp: r.adpA as number, // still store the true average for reference
        roundPick: rp,
      };
    });


  const rows: ADPExportV1['draftboard']['rows'] = [];
  for (let round = 1; round <= totalRounds; round++) {
    const direction: 'L2R' | 'R2L' = round % 2 === 1 ? 'L2R' : 'R2L';
    const picks: Array<ADPExportV1['draftboard']['rows'][number]['picks'][number]> = [];

    for (let slot = 1; slot <= leagueSize; slot++) {
      const overallPick = (round - 1) * leagueSize + slot;
      const found = boardOrdered[overallPick - 1];
      if (!found) {
        picks.push(null);
        continue;
      }
      picks.push({
        slot,
        overallPick,
        name: found.name,
        position: found.position,
        adp: found.adp,
        roundPick: found.roundPick,
      });
    }

    rows.push({ round, direction, picks });
  }

  return {
    schemaVersion: 1,
    createdAt,
    title,
    mode,
    leagueSize,
    leagues: { sideA: a, sideB: b },
    players,
    draftboard: { totalRounds, rows },
  };
}

export default function ComparePage() {
  const searchParams = useSearchParams();

  function readIds(key: string) {
    // supports: ?a=1&a=2  AND  ?a=1,2
    const raw = searchParams.getAll(key);
    return raw
      .flatMap((v) => String(v).split(','))
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const a = readIds('a');
  const b = readIds('b');

  const leagueSize = parseInt(searchParams.get('size') || '12', 10);

  const mode =
    a.length > 0 && b.length > 0
      ? 'compare'
      : a.length > 0
      ? 'full-a'
      : b.length > 0
      ? 'full-b'
      : 'none';

  const [exportTitle, setExportTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<PlayerResult[]>([]);

  const [view, setView] = useState<View>('all');
  const [sortKey, setSortKey] = useState<SortKey>(mode === 'compare' ? 'delta' : 'adpA');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(mode === 'compare' ? 'desc' : 'asc');

  const [posFilter, setPosFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [showBoard, setShowBoard] = useState(false);

  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  // If user doesn't set a title, seed one from URL + mode.
  useEffect(() => {
    const fromQuery = (searchParams.get('title') || '').trim();
    if (fromQuery) {
      setExportTitle(fromQuery);
      return;
    }
    setExportTitle((prev) => {
      if (prev && prev.trim()) return prev;
      const base =
        mode === 'compare'
          ? 'ADP Compare'
          : mode === 'full-a'
          ? 'ADP List (Side A)'
          : mode === 'full-b'
          ? 'ADP List (Side B)'
          : 'ADP Export';
      return base;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // When mode changes, reset view + default sorting appropriately
  useEffect(() => {
    setView('all');
    if (mode === 'compare') {
      setSortKey('delta');
      setSortDir('desc');
    } else if (mode === 'full-a' || mode === 'full-b') {
      setSortKey('adpA');
      setSortDir('asc');
    }
  }, [mode]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const size = Number.isFinite(leagueSize) && leagueSize > 0 ? leagueSize : 12;

        if (mode === 'compare') {
          const [mapA, mapB] = await Promise.all([getADPMap(a, size), getADPMap(b, size)]);
          setResults(compareADPs(mapA, mapB));
        } else if (mode === 'full-a') {
          const mapA = await getADPMap(a, size);
          setResults(compareADPs(mapA, {}));
        } else if (mode === 'full-b') {
          const mapB = await getADPMap(b, size);
          setResults(compareADPs(mapB, {}));
        } else {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [a.join(','), b.join(','), mode, leagueSize]);

  const handleDownloadJson = () => {
    const title = exportTitle.trim() || 'ADP Compare';
    const payload = buildAdpExportV1({
      title,
      mode: mode === 'compare' || mode === 'full-a' || mode === 'full-b' ? mode : 'compare',
      leagueSize: Number.isFinite(leagueSize) && leagueSize > 0 ? leagueSize : 12,
      a,
      b,
      results,
    });

    const date = new Date().toISOString().slice(0, 10);
    const slug = slugifyFilename(title) || 'adp';
    const filename = `adp_${slug}_${date}.json`;
    downloadJson(payload, filename);
  };

  const filtered = results
    .filter((r) => {
      if (posFilter !== 'ALL' && r.position !== posFilter) return false;

      if (search.trim()) {
        const s = search.trim().toLowerCase();
        if (!r.name.toLowerCase().includes(s)) return false;
      }

      // Single-side = ALWAYS full list
      if (mode !== 'compare') return true;

      // Compare-mode view filters
      if (view === 'all') return true;
      if (view === 'risers') return r.delta > 0;
      if (view === 'fallers') return r.delta < 0;
      return r.delta === 0;
    })
    .sort((x, y) => {
      const vX = (x as any)[sortKey];
      const vY = (y as any)[sortKey];

      if (typeof vX === 'string') {
        const cmp = String(vX).localeCompare(String(vY));
        return sortDir === 'asc' ? cmp : -cmp;
      }

      const nx = Number.isFinite(vX) ? vX : Infinity;
      const ny = Number.isFinite(vY) ? vY : Infinity;

      const cmp = nx - ny;
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const renderDraftBoard = () => {
    const totalRounds = 18;
    const totalPicks = totalRounds * leagueSize;

    const sortedByPick = results
      .filter((r) => Number.isFinite(r.adpA))
      .slice()
      .sort((x, y) => x.adpA - y.adpA)
      .slice(0, totalPicks);

    const rounds: PlayerResult[][] = [];
    for (let i = 0; i < totalRounds; i++) {
      const slice = sortedByPick.slice(i * leagueSize, (i + 1) * leagueSize);
      rounds.push(slice);
    }

    return (
      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Draft Board</h2>
          <button
            className="text-sm px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
            onClick={() => setShowBoard(false)}
          >
            Back to list
          </button>
        </div>

        <div className="overflow-x-auto border rounded">
          <div className="min-w-[900px]">
            {rounds.map((roundPlayers, roundIdx) => {
              const roundNum = roundIdx + 1;
              const snakeRight = roundNum % 2 === 0;

              const ordered = snakeRight ? [...roundPlayers].reverse() : roundPlayers;

              return (
                <div
                  key={roundIdx}
                  className="grid"
                  style={{ gridTemplateColumns: `80px repeat(${leagueSize}, minmax(0, 1fr))` }}
                >
                  <div className="p-2 border-b border-r font-semibold bg-gray-50">R{roundNum}</div>
                  {Array.from({ length: leagueSize }).map((_, i) => {
                    const p = ordered[i];
                    return (
                      <div key={i} className="p-2 border-b border-r text-xs">
                        {p ? (
                          <>
                            <div className="font-semibold truncate">{p.name}</div>
                            <div className="text-gray-600">{p.position}</div>
                            <div className="text-gray-500">
                              {toRoundPick(roundIdx * leagueSize + (snakeRight ? (leagueSize - i) : (i + 1)), leagueSize)}
                            </div>
                          </>
                        ) : (
                          <div className="text-gray-300">—</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (mode === 'none') return <div className="p-6">Missing league IDs.</div>;

  const titleText =
    mode === 'compare' ? 'ADP Compare' : mode === 'full-a' ? 'Side A ADP List' : 'Side B ADP List';

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">{titleText}</h1>

      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-4">
        <div className="flex gap-2">
          {mode === 'compare' ? (
            <>
              <button
                className={`px-3 py-1 rounded ${view === 'all' ? 'bg-blue-700 text-white' : 'bg-gray-200'}`}
                onClick={() => setView('all')}
              >
                All
              </button>
              <button
                className={`px-3 py-1 rounded ${view === 'risers' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
                onClick={() => setView('risers')}
              >
                Risers
              </button>
              <button
                className={`px-3 py-1 rounded ${view === 'fallers' ? 'bg-red-600 text-white' : 'bg-gray-200'}`}
                onClick={() => setView('fallers')}
              >
                Fallers
              </button>
              <button
                className={`px-3 py-1 rounded ${view === 'unchanged' ? 'bg-gray-800 text-white' : 'bg-gray-200'}`}
                onClick={() => setView('unchanged')}
              >
                Unchanged
              </button>
            </>
          ) : (
            <button className="px-3 py-1 rounded bg-blue-700 text-white" disabled>
              All
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <select
            value={posFilter}
            onChange={(e) => setPosFilter(e.target.value)}
            className="border px-2 py-1 rounded text-sm"
          >
            <option value="ALL">All Positions</option>
            <option value="QB">QB</option>
            <option value="RB">RB</option>
            <option value="WR">WR</option>
            <option value="TE">TE</option>
            <option value="K">K</option>
            <option value="DEF">DEF</option>
          </select>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name..."
            className="border px-2 py-1 rounded text-sm"
          />

          {mode !== 'compare' && (
            <button
              className={`px-3 py-1 rounded text-sm ${showBoard ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              onClick={() => setShowBoard((v) => !v)}
            >
              {showBoard ? 'Hide Draft Board' : 'Show Draft Board'}
            </button>
          )}
        </div>
      </div>

      {/* Export */}
      <div className="mt-4 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <input
          value={exportTitle}
          onChange={(e) => setExportTitle(e.target.value)}
          placeholder="Export title (e.g., Gauntlet 2026 ADP)"
          className="border px-3 py-2 rounded text-sm flex-1"
        />
        <button
          type="button"
          onClick={handleDownloadJson}
          disabled={!results.length}
          className={`px-4 py-2 rounded text-sm font-semibold ${
            results.length ? 'bg-black text-white hover:bg-gray-800' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          Download JSON
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Exports one JSON that includes both the list-view results and the draftboard grid. File is named using your title + today’s date.
      </p>

      {showBoard ? (
        renderDraftBoard()
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th
                  className="p-2 border cursor-pointer"
                  onClick={() => {
                    setSortKey('name');
                    setSortDir(sortKey === 'name' && sortDir === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  Name
                </th>
                <th
                  className="p-2 border cursor-pointer"
                  onClick={() => {
                    setSortKey('position');
                    setSortDir(sortKey === 'position' && sortDir === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  Pos
                </th>
                <th
                  className="p-2 border cursor-pointer"
                  onClick={() => {
                    setSortKey('adpA');
                    setSortDir(sortKey === 'adpA' && sortDir === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  ADP A
                </th>
                <th
                  className="p-2 border cursor-pointer"
                  onClick={() => {
                    setSortKey('adpB');
                    setSortDir(sortKey === 'adpB' && sortDir === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  ADP B
                </th>
                <th
                  className="p-2 border cursor-pointer"
                  onClick={() => {
                    setSortKey('delta');
                    setSortDir(sortKey === 'delta' && sortDir === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  Δ
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => (
                <tr key={`${r.name}-${r.position}-${idx}`} className="odd:bg-white even:bg-gray-50">
                  <td className="p-2 border">{r.name}</td>
                  <td className="p-2 border">{r.position}</td>
                  <td className="p-2 border">{Number.isFinite(r.adpA) ? r.adpA.toFixed(1) : '—'}</td>
                  <td className="p-2 border">{Number.isFinite(r.adpB) ? r.adpB.toFixed(1) : '—'}</td>
                  <td className={`p-2 border ${r.delta > 0 ? 'text-green-700' : r.delta < 0 ? 'text-red-700' : ''}`}>
                    {Number.isFinite(r.delta) ? r.delta.toFixed(1) : '—'}
                  </td>
                </tr>
              ))}

              {!filtered.length && (
                <tr>
                  <td className="p-3 border text-gray-500" colSpan={5}>
                    No results for current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
