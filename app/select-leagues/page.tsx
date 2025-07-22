'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import axios from 'axios';

type League = { league_id: string; name: string };

export default function SelectLeagues() {
  const [leagueSize, setLeagueSize] = useState(12);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [sideA, setSideA] = useState<string[]>([]);
  const [sideB, setSideB] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();
  const username = searchParams.get('username');

  useEffect(() => {
    const fetchLeagues = async () => {
      try {
        const res = await axios.get(`/api/leagues?username=${username}`);
        setLeagues(res.data);
        setLoading(false);
      } catch (err) {
        console.error(err);
      }
    };
    fetchLeagues();
  }, [username]);

  const handleToggle = (leagueId: string, side: 'A' | 'B') => {
    if (side === 'A') {
      setSideA((prev) =>
        prev.includes(leagueId) ? prev.filter((id) => id !== leagueId) : [...prev, leagueId]
      );
      setSideB((prev) => prev.filter((id) => id !== leagueId));
    } else {
      setSideB((prev) =>
        prev.includes(leagueId) ? prev.filter((id) => id !== leagueId) : [...prev, leagueId]
      );
      setSideA((prev) => prev.filter((id) => id !== leagueId));
    }
  };

  const handleClear = () => {
    setSideA([]);
    setSideB([]);
  };

  const handleCompare = () => {
    const query = new URLSearchParams({
      a: sideA.join(','),
      b: sideB.join(','),
      username: username || '',
      size: leagueSize.toString(),
    }).toString();
    router.push(`/compare?${query}`);
  };

  const getLeagueName = (id: string) => leagues.find((l) => l.league_id === id)?.name || 'Unknown';

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <h1 className="text-3xl font-bold mb-6 text-center">Select Leagues</h1>

      <div className="text-center mb-6">
        <label className="mr-2 font-semibold">League Size:</label>
        <select
          className="border rounded px-2 py-1"
          value={leagueSize}
          onChange={(e) => setLeagueSize(Number(e.target.value))}
        >
          {[8, 10, 12, 14, 16].map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
        <button
          onClick={handleClear}
          className="ml-6 px-4 py-1 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Clear Selections
        </button>
      </div>

      {loading ? (
        <p className="text-center">Loading leagues for {username}...</p>
      ) : (
        <div className="flex flex-col md:flex-row gap-4 max-w-7xl mx-auto">
          {/* Side A */}
          <div className="w-full md:w-1/3 bg-green-100 p-4 rounded shadow">
            <h2 className="text-xl font-bold mb-3 text-center">Side A (earlier seasons)</h2>
            {sideA.map((id) => (
              <div
                key={id}
                className="bg-white p-2 rounded shadow mb-2 transition-all duration-200"
              >
                {getLeagueName(id)}
              </div>
            ))}
          </div>

          {/* All leagues */}
          <div className="w-full md:w-1/3 bg-white p-4 rounded shadow border max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-3 text-center">All Leagues</h2>
            {leagues.map((league) => {
              const isA = sideA.includes(league.league_id);
              const isB = sideB.includes(league.league_id);
              const dim = isA || isB;

              return (
                <div
                  key={league.league_id}
                  className={`flex justify-between items-center p-2 border-b transition-all duration-150 ${
                    dim ? 'opacity-60' : ''
                  }`}
                >
                  <span className="text-sm font-medium">{league.name}</span>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-1 text-green-700 text-sm">
                      <input
                        type="checkbox"
                        checked={isA}
                        onChange={() => handleToggle(league.league_id, 'A')}
                      />
                      A
                    </label>
                    <label className="flex items-center gap-1 text-blue-700 text-sm">
                      <input
                        type="checkbox"
                        checked={isB}
                        onChange={() => handleToggle(league.league_id, 'B')}
                      />
                      B
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Side B */}
          <div className="w-full md:w-1/3 bg-blue-100 p-4 rounded shadow">
            <h2 className="text-xl font-bold mb-3 text-center">Side B</h2>
            {sideB.map((id) => (
              <div
                key={id}
                className="bg-white p-2 rounded shadow mb-2 transition-all duration-200"
              >
                {getLeagueName(id)}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-center mt-8">
        <button
          onClick={handleCompare}
          disabled={sideA.length === 0 || sideB.length === 0}
          className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
        >
          Compare ADPs
        </button>
      </div>
    </div>
  );
}
