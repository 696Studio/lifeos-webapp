import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, stats } = body;

    if (!userId || !stats) {
      return NextResponse.json(
        { error: "INVALID_BODY", message: "userId, stats required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("xp_profiles")
      .upsert(
        {
          telegram_user_id: Number(userId),
          total_xp: stats.totalXp,
          level: stats.level,
          current_xp: stats.currentXp,
          next_level_xp: stats.nextLevelXp,
        },
        { onConflict: "telegram_user_id" }
      );

    if (error) {
      console.error("[Supabase] xp_profiles upsert error:", error);
      return NextResponse.json(
        { error: "DB_ERROR", message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: "SERVER_ERROR", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
