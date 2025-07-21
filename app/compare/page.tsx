
'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getADPMap, compareADPs, PlayerResult } from '@/lib/adpUtils';

export default function ComparePage() {
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const a = searchParams.get('a')?.split(',') || [];
  const b = searchParams.get('b')?.split(',') || [];

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

  return (
    <div className="p-4 min-h-screen bg-gray-50">
      <h1 className="text-2xl font-bold mb-6 text-center">ADP Comparison</h1>
      {loading ? (
        <p className="text-center">Calculating...</p>
      ) : (
        <table className="w-full bg-white shadow rounded overflow-x-auto text-sm">
          <thead className="bg-blue-200">
            <tr>
              <th className="text-left p-2">Player</th>
              <th className="text-center p-2">Side A ADP</th>
              <th className="text-center p-2">Side B ADP</th>
              <th className="text-center p-2">Change</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.name} className="border-b last:border-none">
                <td className="p-2">{r.name}</td>
                <td className="text-center">{r.adpA ?? '-'}</td>
                <td className="text-center">{r.adpB ?? '-'}</td>
                <td className={`text-center ${r.delta && r.delta < 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {r.delta !== null ? (r.delta > 0 ? `⬆️ ${r.delta}` : `⬇️ ${Math.abs(r.delta)}`) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
