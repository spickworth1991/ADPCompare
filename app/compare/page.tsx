'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  compareADPs,
  getADPGroupData,
  type PlayerResult,
  type ADPGroupData,
  type DraftboardCellEntry,
} from '@/lib/adpUtils';

type View = 'all' | 'risers' | 'fallers' | 'unchanged';
type SortKey = 'name' | 'position' | 'adpA' | 'adpB' | 'delta' | 'roundPickA' | 'roundPickB';

function slugifyFilename(s: string) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
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

function fmtNum(n: number | null) {
  return n == null || !Number.isFinite(n) ? '—' : n.toFixed(1);
}

// Parse "R.PP" or "R.PP.FF" into a numeric value so sorting works for rounds 10+.
// Examples:
// - "1.01" => 1001
// - "10.01" => 10001
// - "2.11.50" => 2011.5
// We treat "—" / invalid as Infinity.
function roundPickToSortValue(v: unknown): number {
  const s = String(v ?? '').trim();
  if (!s || s === '—') return Number.POSITIVE_INFINITY;

  // Expected: round.pick or round.pick.frac
  const parts = s.split('.').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return Number.POSITIVE_INFINITY;

  const round = Number(parts[0]);
  const pick = Number(parts[1]);
  if (!Number.isFinite(round) || !Number.isFinite(pick)) return Number.POSITIVE_INFINITY;

  let frac = 0;
  if (parts.length >= 3) {
    const ff = Number(parts[2]);
    if (Number.isFinite(ff) && ff > 0) frac = ff / 100;
  }

  // round gets heavy weight; pick gets lighter weight, plus optional fractional hundredths.
  return round * 1000 + pick + frac;
}

export default function ComparePage() {
  const searchParams = useSearchParams();

  function readIds(key: string) {
    const raw = searchParams.getAll(key);
    return raw
      .flatMap((v) => String(v).split(','))
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const a = readIds('a');
  const b = readIds('b');

  const mode =
    a.length > 0 && b.length > 0 ? 'compare' : a.length > 0 ? 'full-a' : b.length > 0 ? 'full-b' : 'none';

  const [exportTitle, setExportTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const [groupA, setGroupA] = useState<ADPGroupData | null>(null);
  const [groupB, setGroupB] = useState<ADPGroupData | null>(null);
  const [results, setResults] = useState<PlayerResult[]>([]);

  const [view, setView] = useState<View>('all');
  const [sortKey, setSortKey] = useState<SortKey>(mode === 'compare' ? 'delta' : 'adpA');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(mode === 'compare' ? 'desc' : 'asc');

  const [posFilter, setPosFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [showBoard, setShowBoard] = useState(false);

  const [openCell, setOpenCell] = useState<{
    cellKey: string;
    round: number;
    slot: number;
    entries: DraftboardCellEntry[];
  } | null>(null);

  // Seed title
  useEffect(() => {
    const fromQuery = (searchParams.get('title') || '').trim();
    if (fromQuery) {
      setExportTitle(fromQuery);
      return;
    }
    setExportTitle((prev) => {
      if (prev && prev.trim()) return prev;
      return mode === 'compare'
        ? 'ADP Compare'
        : mode === 'full-a'
        ? 'ADP List (Side A)'
        : mode === 'full-b'
        ? 'ADP List (Side B)'
        : 'ADP Export';
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Reset defaults when mode changes
  useEffect(() => {
    setView('all');
    if (mode === 'compare') {
      setSortKey('delta');
      setSortDir('desc');
    } else {
      setSortKey('adpA');
      setSortDir('asc');
    }
  }, [mode]);

  // Load group data + compare results
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      setGroupA(null);
      setGroupB(null);
      setResults([]);

      try {
        if (mode === 'none') return;

        if (mode === 'compare') {
          const [ga, gb] = await Promise.all([getADPGroupData(a), getADPGroupData(b)]);

          // Enforce meta compatibility
          if (ga.meta.teams !== gb.meta.teams || ga.meta.rounds !== gb.meta.rounds) {
            throw new Error(
              `League settings mismatch between sides. Side A is ${ga.meta.teams} teams / ${ga.meta.rounds} rounds, Side B is ${gb.meta.teams} teams / ${gb.meta.rounds} rounds.`
            );
          }

          setGroupA(ga);
          setGroupB(gb);
          setResults(compareADPs(ga.players, gb.players));
        } else if (mode === 'full-a') {
          const ga = await getADPGroupData(a);
          setGroupA(ga);
          setResults(compareADPs(ga.players, {}));
        } else if (mode === 'full-b') {
          const gb = await getADPGroupData(b);
          setGroupB(gb);
          // treat as A for display simplicity (ADP A column)
          setGroupA(gb);
          setResults(compareADPs(gb.players, {}));
        }
      } catch (e: any) {
        setError(String(e?.message || e || 'Failed to load ADP.'));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [a.join(','), b.join(','), mode]);

  const meta = groupA?.meta || groupB?.meta || null;

  const filtered = useMemo(() => {
    const base = results.filter((r) => {
      if (posFilter !== 'ALL' && r.position !== posFilter) return false;

      if (search.trim()) {
        const s = search.trim().toLowerCase();
        if (!r.name.toLowerCase().includes(s)) return false;
      }

      // Single-side always full list
      if (mode !== 'compare') return true;

      // Compare-mode view filters
      if (view === 'all') return true;
      if (view === 'risers') return (r.delta ?? 0) < 0; // A - B < 0 => picked earlier in B
      if (view === 'fallers') return (r.delta ?? 0) > 0;
      return (r.delta ?? 0) === 0;
    });

    const dir = sortDir === 'asc' ? 1 : -1;

    return base.slice().sort((x, y) => {
      const vx: any = (x as any)[sortKey];
      const vy: any = (y as any)[sortKey];

      // Round.Pick sorting must be numeric (so 10.xx sorts after 9.xx)
      if (sortKey === 'roundPickA' || sortKey === 'roundPickB') {
        const ax = roundPickToSortValue(vx);
        const ay = roundPickToSortValue(vy);
        return (ax - ay) * dir;
      }

      if (typeof vx === 'string' || typeof vy === 'string') {
        return String(vx ?? '').localeCompare(String(vy ?? '')) * dir;
      }

      const nx = Number.isFinite(vx) ? vx : Infinity;
      const ny = Number.isFinite(vy) ? vy : Infinity;
      return (nx - ny) * dir;
    });
  }, [results, posFilter, search, mode, view, sortKey, sortDir]);

  const handleDownloadJson = () => {
    const title = exportTitle.trim() || 'ADP Export';
    const date = new Date().toISOString().slice(0, 10);
    const slug = slugifyFilename(title) || 'adp';

    const payload = {
      schemaVersion: 2,
      createdAt: new Date().toISOString(),
      title,
      mode,
      meta,
      leagues: { sideA: a, sideB: b },

      // Aggregated (current-page) computed output
      aggregated: {
        sideA: groupA ? { meta: groupA.meta, players: groupA.players, draftboard: groupA.draftboard } : null,
        sideB: groupB ? { meta: groupB.meta, players: groupB.players, draftboard: groupB.draftboard } : null,
      },

      // Per-league data (this is what makes the JSON reusable offline)
      perLeague: {
        sideA: groupA?.leagues || [],
        sideB: groupB?.leagues || [],
      },

      // Full comparison/list results (not UI-filtered)
      results,
    };

    downloadJson(payload, `adp_${slug}_${date}.json`);
  };

  const renderDraftBoard = () => {
    const g = groupA;
    const m = g?.meta;
    if (!g || !m) return null;

    const { teams, rounds } = m;

    return (
      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Draft Board</h2>
          <button className="text-sm px-3 py-1 rounded bg-gray-200 hover:bg-gray-300" onClick={() => setShowBoard(false)}>
            Back to list
          </button>
        </div>

        <div className="overflow-x-auto border rounded">
          <div className="min-w-[900px]">
            {Array.from({ length: rounds }).map((_, roundIdx) => {
              const roundNum = roundIdx + 1;
              const direction: 'L2R' | 'R2L' = roundNum % 2 === 1 ? 'L2R' : 'R2L';

              return (
                <div
                  key={roundIdx}
                  className="grid"
                  style={{ gridTemplateColumns: `80px repeat(${teams}, minmax(0, 1fr))` }}
                >
                  <div className="p-2 border-b border-r font-semibold bg-gray-50">
                    R{roundNum}
                  </div>

                  {Array.from({ length: teams }).map((_, colIdx) => {
                    const displaySlot = colIdx + 1;
                    const actualSlot = direction === 'L2R' ? displaySlot : teams - displaySlot + 1;

                    const cellKey = `${roundNum}-${actualSlot}`;
                    const entries = g.draftboard.cells[cellKey] || [];
                    const primary = entries[0];

                    const handleOpen = () => {
                      if (!entries.length) return;
                      setOpenCell({ cellKey, round: roundNum, slot: actualSlot, entries });
                    };

                    return (
                      <div
                        key={colIdx}
                        role={entries.length ? 'button' : undefined}
                        tabIndex={entries.length ? 0 : -1}
                        onClick={handleOpen}
                        onKeyDown={(e) => {
                          if (!entries.length) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleOpen();
                          }
                        }}
                        className={`p-2 border-b border-r text-xs ${entries.length ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                      >
                        {primary ? (
                          <>
                            <div className="font-semibold truncate">{primary.name}</div>
                            <div className="text-gray-600">{primary.position}</div>
                            <div className="text-gray-500">
                              {primary.count}x ({Math.round(primary.pct * 100)}%)
                            </div>
                            {entries.length > 1 ? (
                              <div className="mt-1 text-[11px] text-gray-500">+{entries.length - 1} more</div>
                            ) : null}
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

        <div className="text-xs text-gray-500">
          Each square = that draft slot for that round. Because multiple leagues are aggregated, a square can contain multiple different players.
        </div>

        {openCell ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setOpenCell(null)}
          >
            <div
              className="w-full max-w-2xl rounded bg-white shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                  <div className="text-sm font-semibold">Round {openCell.round} · Slot {openCell.slot}</div>
                  <div className="text-xs text-gray-500">Cell key: {openCell.cellKey}</div>
                </div>
                <button
                  className="text-sm px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
                  onClick={() => setOpenCell(null)}
                >
                  Close
                </button>
              </div>

              <div className="max-h-[70vh] overflow-auto p-4">
                <div className="text-xs text-gray-500 mb-2">
                  Sorted by most common in this slot.
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full border text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-2 border text-left">Player</th>
                        <th className="p-2 border">Pos</th>
                        <th className="p-2 border">Times</th>
                        <th className="p-2 border">Share</th>
                        <th className="p-2 border">Avg Pick #</th>
                        <th className="p-2 border">Avg RP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openCell.entries.map((e, i) => (
                        <tr key={`${e.name}-${e.position}-${i}`} className="odd:bg-white even:bg-gray-50">
                          <td className="p-2 border font-semibold">{e.name}</td>
                          <td className="p-2 border">{e.position}</td>
                          <td className="p-2 border text-center">{e.count}</td>
                          <td className="p-2 border text-center">{Math.round(e.pct * 100)}%</td>
                          <td className="p-2 border text-center">{fmtNum(e.avgOverallPick)}</td>
                          <td className="p-2 border text-center">{e.roundPick}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (mode === 'none') return <div className="p-6">Missing league IDs.</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  const titleText =
    mode === 'compare' ? 'ADP Compare' : mode === 'full-a' ? 'Side A ADP List' : 'Side B ADP List';

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">{titleText}</h1>

      {meta ? (
        <div className="text-xs text-gray-500 mb-4">
          Detected: {meta.teams} teams • {meta.rounds} rounds
        </div>
      ) : null}

      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-4">
        <div className="flex gap-2">
          {mode === 'compare' ? (
            <>
              <button className={`px-3 py-1 rounded ${view === 'all' ? 'bg-blue-700 text-white' : 'bg-gray-200'}`} onClick={() => setView('all')}>
                All
              </button>
              <button className={`px-3 py-1 rounded ${view === 'risers' ? 'bg-green-600 text-white' : 'bg-gray-200'}`} onClick={() => setView('risers')}>
                Risers
              </button>
              <button className={`px-3 py-1 rounded ${view === 'fallers' ? 'bg-red-600 text-white' : 'bg-gray-200'}`} onClick={() => setView('fallers')}>
                Fallers
              </button>
              <button className={`px-3 py-1 rounded ${view === 'unchanged' ? 'bg-gray-800 text-white' : 'bg-gray-200'}`} onClick={() => setView('unchanged')}>
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
          <select value={posFilter} onChange={(e) => setPosFilter(e.target.value)} className="border px-2 py-1 rounded text-sm">
            <option value="ALL">All Positions</option>
            <option value="QB">QB</option>
            <option value="RB">RB</option>
            <option value="WR">WR</option>
            <option value="TE">TE</option>
            <option value="K">K</option>
            <option value="DEF">DEF</option>
          </select>

          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name..." className="border px-2 py-1 rounded text-sm" />

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

      {showBoard ? (
        renderDraftBoard()
      ) : (
        <div className="overflow-x-auto mt-4">
          <table className="min-w-full border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 border cursor-pointer" onClick={() => { setSortKey('name'); setSortDir(sortKey === 'name' && sortDir === 'asc' ? 'desc' : 'asc'); }}>
                  Name
                </th>
                <th className="p-2 border cursor-pointer" onClick={() => { setSortKey('position'); setSortDir(sortKey === 'position' && sortDir === 'asc' ? 'desc' : 'asc'); }}>
                  Pos
                </th>

                <th className="p-2 border cursor-pointer" onClick={() => { setSortKey('adpA'); setSortDir(sortKey === 'adpA' && sortDir === 'asc' ? 'desc' : 'asc'); }}>
                  Avg Pick A
                </th>
                <th className="p-2 border cursor-pointer" onClick={() => { setSortKey('roundPickA'); setSortDir(sortKey === 'roundPickA' && sortDir === 'asc' ? 'desc' : 'asc'); }}>
                  RP A (Most Common)
                </th>

                <th className="p-2 border cursor-pointer" onClick={() => { setSortKey('adpB'); setSortDir(sortKey === 'adpB' && sortDir === 'asc' ? 'desc' : 'asc'); }}>
                  Avg Pick B
                </th>
                <th className="p-2 border cursor-pointer" onClick={() => { setSortKey('roundPickB'); setSortDir(sortKey === 'roundPickB' && sortDir === 'asc' ? 'desc' : 'asc'); }}>
                  RP B (Most Common)
                </th>

                <th className="p-2 border cursor-pointer" onClick={() => { setSortKey('delta'); setSortDir(sortKey === 'delta' && sortDir === 'asc' ? 'desc' : 'asc'); }}>
                  Δ (A-B)
                </th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((r, idx) => (
                <tr key={`${r.name}-${r.position}-${idx}`} className="odd:bg-white even:bg-gray-50">
                  <td className="p-2 border">{r.name}</td>
                  <td className="p-2 border">{r.position}</td>

                  <td className="p-2 border">{fmtNum(r.adpA)}</td>
                  <td className="p-2 border">{r.roundPickA || '—'}</td>

                  <td className="p-2 border">{fmtNum(r.adpB)}</td>
                  <td className="p-2 border">{r.roundPickB || '—'}</td>

                  <td className={`p-2 border ${(r.delta ?? 0) < 0 ? 'text-green-700' : (r.delta ?? 0) > 0 ? 'text-red-700' : ''}`}>
                    {r.delta == null ? '—' : r.delta.toFixed(1)}
                  </td>
                </tr>
              ))}

              {!filtered.length && (
                <tr>
                  <td className="p-3 border text-gray-500" colSpan={7}>
                    No results for current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="text-xs text-gray-500 mt-2">
            “RP” is the <b>most common actual slot</b> the player was drafted at across the selected leagues (mode of pick_no), not the average.
          </div>
        </div>
      )}
    </div>
  );
}
