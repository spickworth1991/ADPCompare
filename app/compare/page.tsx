'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getADPMap, compareADPs, PlayerResult } from '@/lib/adpUtils';

type SortKey = 'name' | 'position' | 'adpA' | 'adpB' | 'delta';

export default function ComparePage() {
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('adpA');
  const [sortAsc, setSortAsc] = useState(true);
  const [positionFilter, setPositionFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [showBoard, setShowBoard] = useState(false);
  const pageSize = 50;

  const searchParams = useSearchParams();
  const a = searchParams.get('a')?.split(',').filter(Boolean) || [];
  const b = searchParams.get('b')?.split(',').filter(Boolean) || [];
  const leagueSize = parseInt(searchParams.get('size') || '12', 10);

  const mode =
    a.length > 0 && b.length > 0
      ? 'compare'
      : a.length > 0
      ? 'full-a'
      : b.length > 0
      ? 'full-b'
      : 'none';

  const positionColor: Record<string, string> = {
    QB: 'bg-red-200',
    RB: 'bg-green-200',
    WR: 'bg-blue-200',
    TE: 'bg-yellow-200',
    K: 'bg-purple-200',
    DEF: 'bg-gray-300',
  };

  useEffect(() => {
    const run = async () => {
      if (mode === 'none') {
        setResults([]);
        setLoading(false);
        return;
      }

      if (mode === 'full-a') {
        const adp = await getADPMap(a, leagueSize);
        const data = Object.values(adp).map((d) => ({
          name: d.name,
          position: d.position,
          adpA: d.avg,
          adpB: null,
          delta: null,
        }));
        setResults(data);
        setLoading(false);
        return;
      }

      if (mode === 'full-b') {
        const adp = await getADPMap(b, leagueSize);
        const data = Object.values(adp).map((d) => ({
          name: d.name,
          position: d.position,
          adpA: d.avg,
          adpB: null,
          delta: null,
        }));
        setResults(data);
        setLoading(false);
        return;
      }

      const adpA = await getADPMap(a, leagueSize);
      const adpB = await getADPMap(b, leagueSize);
      const result = compareADPs(adpA, adpB);
      setResults(result);
      setLoading(false);
    };

    run();
  }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const formatRoundPick = (pick: number | null) => {
    if (pick === null) return '-';
    const overall = Math.round(pick);
    const round = Math.floor((overall - 1) / leagueSize) + 1;
    const pickInRound = ((overall - 1) % leagueSize) + 1;
    return `${round}.${pickInRound < 10 ? '0' : ''}${pickInRound}`;
  };

  const filtered = results.filter(
    (r) =>
      (positionFilter === 'All' || r.position === positionFilter) &&
      r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    const valA = a[sortKey] ?? 9999;
    const valB = b[sortKey] ?? 9999;
    return sortAsc ? (valA > valB ? 1 : -1) : valA < valB ? 1 : -1;
  });

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginated = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const renderDraftBoard = () => {
  const sortedByPick = [...results]
    .filter((r) => r.adpA !== null)
    .sort((a, b) => (a.adpA! - b.adpA!) || a.name.localeCompare(b.name));

  const rows: PlayerResult[][] = [];
  for (let i = 0; i < sortedByPick.length; i += leagueSize) {
    const row = sortedByPick.slice(i, i + leagueSize);
    rows.push(row);
  }

  return (
    <div className="mt-8 px-4 w-full mx-auto relative overflow-visible">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-center">🧾 Draft Board View</h2>
        <button
          onClick={() => setShowBoard(false)}
          className="bg-gray-500 text-white px-4 py-1 rounded text-sm"
        >
          Back to List
        </button>
      </div>

      <div className="space-y-16 relative">
        {rows.map((row, rowIndex) => {
          const isEvenRow = rowIndex % 2 === 0;
          const displayRow = isEvenRow ? row : [...row].reverse();

          return (
            <div key={rowIndex} className="relative">
              {/* U-turn arrow between rows */}
              {rowIndex < rows.length - 1 && (
                <div
                  className={`absolute ${
                    isEvenRow ? 'right-[-100px]' : 'left-[-100px]'
                  } top-[60%] translate-y-[-20%]`}
                >
                  <svg
                    width="120"
                    height="120"
                    viewBox="0 0 120 120"
                    className="text-gray-400"
                  >
                    <path
                      d={
                        isEvenRow
                          ? 'M20,0 C80,20 60,60 -50,220'   // rightward U-turn from left to right
                          : 'M120,150 C60,40 20,-20 250,-20'   // leftward U-turn from right to left
                      }
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <circle
                      cx={isEvenRow ? 120 : 0}
                      cy="120"
                      r="4"
                      fill="currentColor"
                    />
                  </svg>

                </div>
              )}

              {/* Grid row */}
              <div
                className="grid gap-1 mx-auto"
                style={{
                  maxWidth: '1400px', // adjust to taste
                  gridTemplateColumns: `repeat(${leagueSize}, minmax(120px, 1fr))`,
                  display: 'grid',
                }}
              >

                {displayRow.map((r, iInRow) => {
                  const truePick =
                    rowIndex * leagueSize + (isEvenRow ? iInRow : leagueSize - iInRow - 1) + 1;
                  const round = Math.floor((truePick - 1) / leagueSize) + 1;
                  const pickInRound = ((truePick - 1) % leagueSize) + 1;
                  const roundPick = `${round}.${pickInRound < 10 ? '0' : ''}${pickInRound}`;

                  return (
                    <div
                      key={`${rowIndex}-${iInRow}-${r.name}`}
                      className={`p-3 text-sm border rounded shadow text-center font-medium ${
                        positionColor[r.position] || 'bg-white'
                      }`}
                      style={{ minHeight: '64px' }}
                    >
                      <div className="truncate">{r.name}</div>
                      <div className="text-[11px]">
                        {r.position} • {roundPick}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};




  const renderTable = (items: PlayerResult[], title: string, localMode: string) => (
    <div className="mt-8">
      <h2 className="text-xl font-bold mb-2 text-center">{title}</h2>

      {(localMode === 'full-a' || localMode === 'full-b') && !showBoard && (
        <div className="flex justify-between items-center mb-4 gap-4 flex-wrap">
          <input
            type="text"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(0);
            }}
            className="border px-3 py-1 rounded w-full max-w-xs"
          />
          <select
            value={positionFilter}
            onChange={(e) => {
              setPositionFilter(e.target.value);
              setPage(0);
            }}
            className="border px-2 py-1 text-sm rounded"
          >
            <option value="All">All Positions</option>
            <option value="QB">QB</option>
            <option value="RB">RB</option>
            <option value="WR">WR</option>
            <option value="TE">TE</option>
            <option value="K">K</option>
            <option value="DEF">DEF</option>
          </select>
          <button
            onClick={() => setShowBoard(true)}
            className="bg-blue-500 text-white px-4 py-1 rounded text-sm"
          >
            Draft Board View
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full bg-white shadow rounded text-sm text-left">
          <thead className="bg-blue-100">
            <tr>
              <th className="p-2 cursor-pointer" onClick={() => toggleSort('name')}>
                Player {sortKey === 'name' && (sortAsc ? '↑' : '↓')}
              </th>
              <th className="p-2 cursor-pointer" onClick={() => toggleSort('position')}>
                Pos {sortKey === 'position' && (sortAsc ? '↑' : '↓')}
              </th>
              <th className="p-2 cursor-pointer text-center" onClick={() => toggleSort('adpA')}>
                ADP {sortKey === 'adpA' && (sortAsc ? '↑' : '↓')}
              </th>
              <th className="p-2 text-center">Round.Pick</th>
              {mode === 'compare' && (
                <>
                  <th className="p-2 cursor-pointer text-center" onClick={() => toggleSort('adpB')}>
                    Side B {sortKey === 'adpB' && (sortAsc ? '↑' : '↓')}
                  </th>
                  <th className="p-2 text-center">B Rnd.Pick</th>
                  <th className="p-2 cursor-pointer text-center" onClick={() => toggleSort('delta')}>
                    Change {sortKey === 'delta' && (sortAsc ? '↑' : '↓')}
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.name} className="border-b last:border-none">
                <td className="p-2">{r.name}</td>
                <td className="p-2">{r.position ?? '-'}</td>
                <td className="text-center">{r.adpA ?? '-'}</td>
                <td className="text-center">{formatRoundPick(r.adpA)}</td>
                {mode === 'compare' && (
                  <>
                    <td className="text-center">{r.adpB ?? '-'}</td>
                    <td className="text-center">{formatRoundPick(r.adpB)}</td>
                    <td
                      className={`text-center font-bold ${
                        r.delta && r.delta < 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {r.delta !== null
                        ? r.delta > 0
                          ? `⬇️ ${r.delta}`
                          : `⬆️ ${Math.abs(r.delta)}`
                        : '-'}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="p-4 min-h-screen bg-gray-50">
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => window.location.href = '/'}
          className="bg-gray-600 text-white px-4 py-1 rounded text-sm"
        >
          ⬅ Home
        </button>
        <button
          onClick={() => {
            const username = searchParams.get('username') || '';
            window.location.href = `/select-leagues?username=${username}`;
          }}
          className="bg-gray-600 text-white px-4 py-1 rounded text-sm"
        >
          🗂 League Selection
        </button>
      </div>


      <h1 className="text-2xl font-bold mb-4 text-center">
        {mode === 'compare'
          ? 'ADP Comparison'
          : mode === 'full-a'
          ? 'ADP List (Side A)'
          : mode === 'full-b'
          ? 'ADP List (Side B)'
          : 'No Leagues Selected'}
      </h1>
      

      {loading ? (
        <p className="text-center">Loading...</p>
      ) : showBoard ? (
        renderDraftBoard()
      ) : (
        <>
          {mode === 'compare' && (
            <>
              {renderTable(
                [...results]
                  .filter((r) => r.delta !== null && r.delta < 0)
                  .sort((a, b) => a.delta! - b.delta!)
                  .slice(0, 10),
                '📈 Top 10 Risers',
                mode
              )}
              {renderTable(
                [...results]
                  .filter((r) => r.delta !== null && r.delta > 0)
                  .sort((a, b) => b.delta! - a.delta!)
                  .slice(0, 10),
                '📉 Top 10 Fallers',
                mode
              )}
            </>
          )}
          {renderTable(
            paginated,
            mode === 'compare'
              ? 'Full Comparison'
              : mode === 'full-a'
              ? 'Full ADP Results (Side A)'
              : 'Full ADP Results (Side B)',
            mode
          )}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6 space-x-2">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`px-3 py-1 rounded ${
                    i === page ? 'bg-blue-600 text-white' : 'bg-gray-200'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
