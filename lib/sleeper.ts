//sleeper.ts
import axios from 'axios';

function getCurrentSeason(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = dt.getMonth() + 1; // 1-12

  // Jan + Feb are still considered the previous season year.
  // March and later count as the new season year.
  return m <= 2 ? y - 1 : y;
}

export async function getUserLeagues(username: string): Promise<any[]> {
  const userRes = await axios.get(`https://api.sleeper.app/v1/user/${username}`);
  const userId = userRes.data.user_id;
  const currentYear = getCurrentSeason();
  const leaguesRes = await axios.get(
    `https://api.sleeper.app/v1/user/${userId}/leagues/nfl/${currentYear}`
  );

  return leaguesRes.data;
}

export async function getDraftPicks(leagueId: string) {
  const draftRes = await axios.get(`https://api.sleeper.app/v1/league/${leagueId}/drafts`);
  if (!Array.isArray(draftRes.data) || draftRes.data.length === 0) return [];
  const draftId = draftRes.data[0].draft_id;

  if (!draftId) return [];
  const picksRes = await axios.get(`https://api.sleeper.app/v1/draft/${draftId}/picks`);
  return picksRes.data;
}
