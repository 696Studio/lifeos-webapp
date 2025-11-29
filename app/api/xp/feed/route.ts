// app/api/xp/feed/route.ts
import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    // 🟦 ЛОГ 1 — покажет userId
    console.log("[XP FEED] userId =", userId);

    if (!userId) {
      return NextResponse.json(
        { error: "NO_USER_ID", message: "userId required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("xp_events")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    // 🟦 ЛОГ 2 — покажет сколько событий найдено
    console.log("[XP FEED] rows =", data?.length);

    if (error) {
      console.error("[Supabase] xp_events fetch error:", error);
      return NextResponse.json(
        { error: "DB_ERROR", message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ events: data ?? [] });
  } catch (e: any) {
    console.error("[API /xp/feed] error:", e);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: String(e.message ?? e) },
      { status: 500 }
    );
  }
}
