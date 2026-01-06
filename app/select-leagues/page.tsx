"use client";

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";

type League = {
  league_id: string;
  name: string;
  season: string;
};

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function getCurrentSeason(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = dt.getMonth() + 1; // 1-12

  // Jan + Feb are still considered the previous season year.
  // March and later count as the new season year.
  return m <= 2 ? y - 1 : y;
}

export default function SelectLeaguesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const username = searchParams.get("username");
  const season = (searchParams.get("season") || "").trim() || String(getCurrentSeason());

  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const [sideA, setSideA] = useState<string[]>([]);
  const [sideB, setSideB] = useState<string[]>([]);

  useEffect(() => {
    const fetchLeagues = async () => {
      if (!username) {
        setLeagues([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const res = await axios.get(`/api/leagues?username=${encodeURIComponent(username)}&season=${encodeURIComponent(season)}`);
        setLeagues(res.data?.leagues || []);
      } catch (e: any) {
        setError("Failed to load leagues. Double-check the username.");
        setLeagues([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLeagues();
  }, [username, season]);

  const selected = useMemo(() => uniq([...sideA, ...sideB]), [sideA, sideB]);

  const toggle = (leagueId: string, side: "A" | "B") => {
    setError("");
    if (side === "A") {
      setSideA((prev) => (prev.includes(leagueId) ? prev.filter((x) => x !== leagueId) : [...prev, leagueId]));
      setSideB((prev) => prev.filter((x) => x !== leagueId));
    } else {
      setSideB((prev) => (prev.includes(leagueId) ? prev.filter((x) => x !== leagueId) : [...prev, leagueId]));
      setSideA((prev) => prev.filter((x) => x !== leagueId));
    }
  };

  const goCompare = () => {
    const qs = new URLSearchParams();
    sideA.forEach((id) => qs.append("a", id));
    sideB.forEach((id) => qs.append("b", id));
    router.push(`/compare?${qs.toString()}`);
  };

  if (loading) return <div className="p-6">Loading leagues...</div>;
  if (!username) return <div className="p-6">Missing username.</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Select Leagues</h1>

      <div className="text-xs text-gray-500">
        Season: <span className="font-semibold">{season}</span>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="grid md:grid-cols-3 gap-4">
        <div className="border rounded p-3">
          <div className="font-semibold mb-2">Side A</div>
          <div className="text-xs text-gray-500 mb-2">{sideA.length} selected</div>
          <div className="space-y-1">
            {sideA.map((id) => {
              const l = leagues.find((x) => x.league_id === id);
              return (
                <button
                  key={id}
                  className="w-full text-left text-sm px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
                  onClick={() => toggle(id, "A")}
                >
                  {l?.name || id}
                </button>
              );
            })}
            {!sideA.length ? <div className="text-xs text-gray-400">None</div> : null}
          </div>
        </div>

        <div className="border rounded p-3">
          <div className="font-semibold mb-2">All Leagues</div>
          <div className="text-xs text-gray-500 mb-2">{leagues.length} found</div>

          <div className="space-y-2 max-h-[55vh] overflow-auto pr-1">
            {leagues.map((l) => {
              const isA = sideA.includes(l.league_id);
              const isB = sideB.includes(l.league_id);
              const isSelected = isA || isB;

              return (
                <div key={l.league_id} className={`border rounded p-2 ${isSelected ? "bg-gray-50" : ""}`}>
                  <div className="text-sm font-semibold">{l.name}</div>
                  <div className="text-xs text-gray-500">ID: {l.league_id}</div>

                  <div className="mt-2 flex gap-2">
                    <button
                      className={`px-2 py-1 rounded text-xs ${isA ? "bg-blue-700 text-white" : "bg-gray-200"}`}
                      onClick={() => toggle(l.league_id, "A")}
                    >
                      Side A
                    </button>
                    <button
                      className={`px-2 py-1 rounded text-xs ${isB ? "bg-blue-700 text-white" : "bg-gray-200"}`}
                      onClick={() => toggle(l.league_id, "B")}
                    >
                      Side B
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border rounded p-3">
          <div className="font-semibold mb-2">Side B</div>
          <div className="text-xs text-gray-500 mb-2">{sideB.length} selected</div>
          <div className="space-y-1">
            {sideB.map((id) => {
              const l = leagues.find((x) => x.league_id === id);
              return (
                <button
                  key={id}
                  className="w-full text-left text-sm px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
                  onClick={() => toggle(id, "B")}
                >
                  {l?.name || id}
                </button>
              );
            })}
            {!sideB.length ? <div className="text-xs text-gray-400">None</div> : null}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={goCompare}
          disabled={!sideA.length}
          className={`px-4 py-2 rounded font-semibold text-sm ${
            sideA.length ? "bg-black text-white hover:bg-gray-800" : "bg-gray-200 text-gray-500 cursor-not-allowed"
          }`}
        >
          Continue
        </button>
        <div className="text-xs text-gray-500 self-center">
          Tip: Side B optional — Side A alone generates a full ADP list + draftboard.
        </div>
      </div>
    </div>
  );
}
