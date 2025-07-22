'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getADPMap, compareADPs, PlayerResult } from '@/lib/adpUtils';
import { useRouter } from 'next/navigation';




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
  const a = searchParams.get('a')?.split(',').filter(Boolean) || [];
  const b = searchParams.get('b')?.split(',').filter(Boolean) || [];
  const router = useRouter();
  const username = searchParams.get('username') || '';
  const leagueSize = parseInt(searchParams.get('size') || '12', 10);
  const mode =
    a.length > 0 && b.length > 0
      ? 'compare'
      : a.length > 0
      ? 'full-a'
      : b.length > 0
      ? 'full-b'
      : 'none';

  useEffect(() => {
    const run = async () => {
      if (a.length === 0 && b.length === 0) {
        setResults([]);
        setLoading(false);
        return;
      }

      if (a.length > 0 && b.length === 0) {
        const adp = await getADPMap(a, leagueSize);
        const data = Object.entries(adp).map(([_, d]) => ({
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

      if (b.length > 0 && a.length === 0) {
        const adp = await getADPMap(b, leagueSize);
        const data = Object.entries(adp).map(([_, d]) => ({
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

      // compare mode
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
    const overallPick = Math.round(pick); // e.g. 28
    const round = Math.floor((overallPick - 1) / leagueSize) + 1;
    const pickInRound = ((overallPick - 1) % leagueSize) + 1;
    return `${round}.${pickInRound.toString().padStart(2, '0')}`; // e.g. 3.04
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

  const renderTable = (items: PlayerResult[], title: string, localMode: string) => (

    <div className="mt-8">
      <h2 className="text-xl font-bold mb-2 text-center">{title}</h2>

      {(localMode === 'full-a' || localMode === 'full-b' || localMode === 'compare') && (
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
          <div className="mb-2">
      <a href="/" className="text-blue-600 hover:underline text-sm">
        ← Home
      </a>
    </div>
    <div className="mb-2">
  <button
      onClick={() => router.push(`/select-leagues?username=${username}`)}
      className="text-blue-600 hover:underline text-sm"
    >
      ← Return to League Selection
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
                'mini'
              )}
              {renderTable(
                [...results]
                  .filter((r) => r.delta !== null && r.delta > 0)
                  .sort((a, b) => b.delta! - a.delta!)
                  .slice(0, 10),
                '📉 Top 10 Fallers',
                'mini'
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
