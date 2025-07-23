'use client';
import React, { useEffect, useState, useRef } from 'react';
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
  const cardRefs = useRef<React.RefObject<HTMLDivElement>[][]>([]);
  const searchParams = useSearchParams();
  const a = searchParams.get('a')?.split(',').filter(Boolean) || [];
  const b = searchParams.get('b')?.split(',').filter(Boolean) || [];
  const leagueSize = parseInt(searchParams.get('size') || '12', 10);
  const [refsReady, setRefsReady] = useState(false);


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
    const timeout = setTimeout(() => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerOffsetX(rect.x);
        setContainerOffsetY(rect.y);
        setRefsReady(true); // ✅ trigger re-render after refs are valid
      }
    }, 100); // let the DOM layout settle

    return () => clearTimeout(timeout);
  }, [results, showBoard]);



  useEffect(() => {
    const run = async () => {
      if (mode === 'none') {
        setResults([]);
        setLoading(false);
        return;
      }

      if (mode === 'full-a') {
        const adp = await getADPMap(a, leagueSize);
        const sorted = Object.values(adp).sort((a, b) => (a.avg ?? 9999) - (b.avg ?? 9999));
        const data = sorted.map((d) => ({
          name: d.name,
          position: d.position,
          adpA: d.avg,
          adpB: null,
          delta: null,
        }));
        const numRows = Math.ceil(data.filter(r => r.adpA !== null).length / leagueSize);
        cardRefs.current = Array.from({ length: numRows }, () =>
          Array.from({ length: leagueSize }, () => React.createRef<HTMLDivElement>())
        );

        setResults(data);
        setLoading(false);
        return;
      }


      if (mode === 'full-b') {
        const adp = await getADPMap(b, leagueSize);
        const sorted = Object.values(adp).sort((a, b) => (a.avg ?? 9999) - (b.avg ?? 9999));
        const data = sorted.map((d) => ({
          name: d.name,
          position: d.position,
          adpA: d.avg,
          adpB: null,
          delta: null,
        }));
        const numRows = Math.ceil(data.length / leagueSize);
        cardRefs.current = Array.from({ length: numRows }, () =>
          Array.from({ length: leagueSize }, () => React.createRef<HTMLDivElement>())
        );
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerOffsetX, setContainerOffsetX] = useState(0);
  const [containerOffsetY, setContainerOffsetY] = useState(0);

  const renderDraftBoard = () => {
    const sortedByPick = [...results]
      .filter((r) => r.adpA !== null)
      .sort((a, b) => (a.adpA! - b.adpA!) || a.name.localeCompare(b.name));

    const rows: PlayerResult[][] = [];
    for (let i = 0; i < sortedByPick.length; i += leagueSize) {
      rows.push(sortedByPick.slice(i, i + leagueSize));
    }

    const refs = cardRefs.current;
    
    return (
      <div className="mt-8 w-full relative overflow-visible">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-center">🧾 Draft Board View</h2>
          <button
            onClick={() => setShowBoard(false)}
            className="bg-gray-500 text-white px-4 py-1 rounded text-sm"
          >
            Back to List
          </button>
        </div>

        <div ref={containerRef} className="space-y-16 relative">
          {rows.map((row, rowIndex) => {
            const isEvenRow = rowIndex % 2 === 0;
            const displayRow = isEvenRow ? row : [...row].reverse();

            const nextRow = rows[rowIndex + 1] || [];
            const toIndex = (rowIndex + 1) % 2 === 0 ? nextRow.length - 1 : 0;
            const fromIndex = isEvenRow ? row.length - 1 : 0;



            return (
              <div key={rowIndex} className="relative" style={{ minHeight: '100px' }}>
                {/* ⬅️ Arrow to next round */}
                {rowIndex < rows.length - 1 && refsReady && (
                  <svg
                    className="absolute pointer-events-none z-50"
                    style={{ top: 0, left: 0, width: '100%', height: '100%' }}
                  >
                    {(() => {
                      const from = refs[rowIndex]?.[fromIndex]?.current?.getBoundingClientRect?.();
                      const to = refs[rowIndex + 1]?.[toIndex]?.current?.getBoundingClientRect?.();
                      if (!from || !to) return null;
                      const container = containerRef.current?.getBoundingClientRect();
                      const containerOffsetX = container?.left ?? 0;
                      const containerOffsetY = container?.top ?? 0;

                      const x1 = from.left + from.width / 2 - containerOffsetX;
                      const y1 = from.top + from.height - containerOffsetY;
                      const x2 = to.left + to.width / 2 - containerOffsetX;
                      const y2 = to.top - containerOffsetY;
                      // console.log(`Drawing arrow for round ${rowIndex + 1}`);
                      // console.log('fromIndex:', fromIndex, 'toIndex:', toIndex);
                      // console.log('refs[rowIndex]:', refs[rowIndex]);
                      // console.log('refs[rowIndex + 1]:', refs[rowIndex + 1]);
                      // console.log('from:', from);
                      // console.log('to:', to);
                      console.log(
                      `Arrow line: (${x1}, ${y1}) → (${x2}, ${y2})`,
                      'Δx:', x2 - x1,
                      'Δy:', y2 - y1
);

                      return (
                        <>
                          <defs>
                            <marker
                              id="arrowhead"
                              markerWidth="10"
                              markerHeight="7"
                              refX="0"
                              refY="3.5"
                              orient="auto"
                            >
                              <polygon points="0 0, 10 3.5, 0 7" fill="black" />
                            </marker>
                          </defs>
                          <line
                             key={`arrow-${rowIndex}`}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke="black"
                            strokeWidth="2"
                            markerEnd="url(#arrowhead)"
                          />
                          
                        </>
                        
                      );
                    })()}
                  </svg>
                )}

                {/* ⬇️ Grid Row */}
                <div
                  className="grid gap-1 mx-auto"
                  style={{
                    gridTemplateColumns: `repeat(${leagueSize}, minmax(120px, 1fr))`,
                    maxWidth: `${leagueSize * 130}px`,
                    display: 'grid',
                  }}
                >
                  {displayRow.map((r, iInRow) => {
                    const truePick =
                      rowIndex * leagueSize +
                      (isEvenRow ? iInRow : leagueSize - iInRow - 1) +
                      1;
                    const round = Math.floor((truePick - 1) / leagueSize) + 1;
                    const pickInRound = ((truePick - 1) % leagueSize) + 1;
                    const roundPick = `${round}.${pickInRound < 10 ? '0' : ''}${pickInRound}`;
                    const refIndex = isEvenRow ? iInRow : leagueSize - iInRow - 1;

                    return (
                      <div
                        key={`${rowIndex}-${iInRow}-${r.name}`}
                        ref={refs[rowIndex]?.[refIndex]}
                        className={`relative p-3 text-sm border rounded shadow text-center font-medium ${
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

      {!showBoard && title.toLowerCase().includes('full') && (
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
          </select>
          {(localMode === 'full-a' || localMode === 'full-b') && (
            <button
              onClick={() => setShowBoard(true)}
              className="bg-blue-500 text-white px-4 py-1 rounded text-sm"
            >
              Draft Board View
            </button>
          )}
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
          onClick={() => (window.location.href = '/')}
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
      ) : showBoard && (mode === 'full-a' || mode === 'full-b') ? (
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
