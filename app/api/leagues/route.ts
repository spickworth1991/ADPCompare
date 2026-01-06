// app/api/leagues/route.ts
import { NextResponse } from "next/server";
import { getUserLeagues } from "@/lib/sleeper";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = (searchParams.get("username") || "").trim();
  const seasonParam = (searchParams.get("season") || "").trim();

  if (!username) {
    return NextResponse.json({ error: "Missing username" }, { status: 400 });
  }

  // Default season = current year if not provided
  const season = seasonParam || String(new Date().getFullYear());

  try {
    const leagues = await getUserLeagues(username, season);
    return NextResponse.json({ leagues });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to load leagues", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
