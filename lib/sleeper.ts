//sleeper.ts
import axios from 'axios';

export async function getUserLeagues(username: string): Promise<any[]> {
  const userRes = await axios.get(`https://api.sleeper.app/v1/user/${username}`);
  const userId = userRes.data.user_id;
  const currentYear = new Date().getFullYear();
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
