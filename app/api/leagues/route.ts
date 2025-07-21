
import { NextResponse } from 'next/server';
import { getUserLeagues } from '@/lib/sleeper';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get('username');
  if (!username) return NextResponse.json({ error: 'Missing username' }, { status: 400 });

  try {
    const leagues = await getUserLeagues(username);
    const result = leagues.map((l: any) => ({
      league_id: l.league_id,
      name: l.name || l.metadata?.name || 'Unnamed League',
    }));
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch leagues' }, { status: 500 });
  }
}
