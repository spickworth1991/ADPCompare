'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getADPMap, compareADPs, PlayerResult } from '@/lib/adpUtils';

type SortKey = 'name' | 'adpA' | 'adpB' | 'delta';

export default function ComparePage() {
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('delta');
  const [sortAsc, setSortAsc] = useState(false);
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

  const sorted = [...results].sort((a, b) => {
    const valA = a[sortKey] ?? 999;
    const valB = b[sortKey] ?? 999;
    return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
  });

  const formatRoundPick = (pick: number | null) => {
    if (pick === null) return '-';
    const round = Math.floor((pick - 1) / leagueSize) + 1;
    const pickInRound = ((pick - 1) % leagueSize) + 1;
    return `${round}.${pickInRound.toString().padStart(2, '0')}`;
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const renderTable = (items: PlayerResult[], title: string) => (
    <div className="mt-6">
      <h2 className="text-xl font-bold mb-2 text-center">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full bg-white shadow rounded text-sm text-left">
          <thead className="bg-blue-100">
            <tr>
              <th className="cursor-pointer p-2" onClick={() => toggleSort('name')}>Player</th>
              <th className="p-2">Pos</th>
              <th className="cursor-pointer p-2 text-center" onClick={() => toggleSort('adpA')}>Side A</th>
              <th className="cursor-pointer p-2 text-center" onClick={() => toggleSort('adpB')}>Side B</th>
              <th className="p-2 text-center">A Rnd.Pick</th>
              <th className="p-2 text-center">B Rnd.Pick</th>
              <th className="cursor-pointer p-2 text-center" onClick={() => toggleSort('delta')}>Change</th>
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
                <td className={`text-center font-bold ${r.delta && r.delta < 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {r.delta !== null ? (r.delta > 0 ? `⬆️ ${r.delta}` : `⬇️ ${Math.abs(r.delta)}`) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const risers = sorted.filter((r) => r.delta !== null && r.delta < 0);
  const fallers = sorted.filter((r) => r.delta !== null && r.delta > 0);
  const unchanged = sorted.filter((r) => r.delta === 0 || r.delta === null);

  return (
    <div className="p-4 min-h-screen bg-gray-50">
      <h1 className="text-2xl font-bold mb-6 text-center">ADP Comparison</h1>
      {loading ? (
        <p className="text-center">Calculating...</p>
      ) : (
        <>
          {renderTable(risers, '📈 Risers')}
          {renderTable(fallers, '📉 Fallers')}
          {renderTable(unchanged, 'No Change')}
        </>
      )}
    </div>
  );
}
