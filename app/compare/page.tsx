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
  const pageSize = 50;

  const searchParams = useSearchParams();
  const a = searchParams.get('a')?.split(',') || [];
  const b = searchParams.get('b')?.split(',') || [];
  const leagueSize = parseInt(searchParams.get('size') || '12', 10);

  useEffect(() => {
    const runCompare = async () => {
      const adpA = await getADPMap(a);
      const adpB = await getADPMap(b);
      const result = compareADPs(adpA, adpB);
      setResults(result);
      setLoading(false);
    };
    runCompare();
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
    return `${round}.${pickInRound.toString().padStart(2, '0')}`;
  };

  const topRisers = [...results]
    .filter((r) => r.delta !== null && r.delta < 0)
    .sort((a, b) => a.delta! - b.delta!)
    .slice(0, 10);

  const topFallers = [...results]
    .filter((r) => r.delta !== null && r.delta > 0)
    .sort((a, b) => b.delta! - a.delta!)
    .slice(0, 10);

  const filtered = results.filter(
    (r) =>
      (positionFilter === 'All' || r.position === positionFilter) &&
      r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    const valA = a[sortKey] ?? 9999;
    const valB = b[sortKey] ?? 9999;
    return sortAsc
      ? valA > valB
        ? 1
        : -1
      : valA < valB
      ? 1
      : -1;
  });

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginated = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const renderTable = (items: PlayerResult[], title: string, isFull: boolean = false) => (
    <div className="mt-8">
      <h2 className="text-xl font-bold mb-2 text-center">{title}</h2>
      {isFull && (
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
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full bg-white shadow rounded text-sm text-left">
          <thead className="bg-blue-100">
            <tr>
              <th className="p-2 cursor-pointer" onClick={() => isFull && toggleSort('name')}>
                Player {isFull && sortKey === 'name' && (sortAsc ? '↑' : '↓')}
              </th>
              <th
                className="p-2 cursor-pointer"
                onClick={() => isFull && toggleSort('position')}
              >
                Pos {isFull && sortKey === 'position' && (sortAsc ? '↑' : '↓')}
              </th>
              <th className="p-2 cursor-pointer text-center" onClick={() => isFull && toggleSort('adpA')}>
                Side A {isFull && sortKey === 'adpA' && (sortAsc ? '↑' : '↓')}
              </th>
              <th className="p-2 cursor-pointer text-center" onClick={() => isFull && toggleSort('adpB')}>
                Side B {isFull && sortKey === 'adpB' && (sortAsc ? '↑' : '↓')}
              </th>
              <th
                className="p-2 cursor-pointer text-center"
                onClick={() => isFull && toggleSort('adpA')}
              >
                A Rnd.Pick {isFull && sortKey === 'adpA' && (sortAsc ? '↑' : '↓')}
              </th>
              <th
                className="p-2 cursor-pointer text-center"
                onClick={() => isFull && toggleSort('adpB')}
              >
                B Rnd.Pick {isFull && sortKey === 'adpB' && (sortAsc ? '↑' : '↓')}
              </th>

              <th className="p-2 cursor-pointer text-center" onClick={() => isFull && toggleSort('delta')}>
                Change {isFull && sortKey === 'delta' && (sortAsc ? '↑' : '↓')}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.name} className="border-b last:border-none">
                <td className="p-2">{r.name}</td>
                <td className="p-2">{r.position ?? '-'}</td>
                <td className="text-center">{r.adpA ?? '-'}</td>
                <td className="text-center">{r.adpB ?? '-'}</td>
                <td className="text-center">{formatRoundPick(r.adpA)}</td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="p-4 min-h-screen bg-gray-50">
      <h1 className="text-2xl font-bold mb-4 text-center">ADP Comparison</h1>
      {loading ? (
        <p className="text-center">Calculating...</p>
      ) : (
        <>
          {renderTable(topRisers, '📈 Top 10 Risers')}
          {renderTable(topFallers, '📉 Top 10 Fallers')}
          {renderTable(paginated, 'Full Results', true)}

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
