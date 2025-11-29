// app/api/xp/profile/save/route.ts
import { NextResponse } from "next/server";
import { supabase } from "../../../../../../lib/supabaseClient";

type SaveProfileBody = {
  userId: string;
  stats: {
    totalXp: number;
    level: number;
    currentXp: number;
    nextLevelXp: number;
  };
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SaveProfileBody;

    // Простая валидация входных данных
    if (!body.userId || !body.stats) {
      return NextResponse.json(
        {
          error: "BAD_REQUEST",
          message: "userId и stats обязательны",
        },
        { status: 400 }
      );
    }

    const { userId, stats } = body;

    // upsert по user_id: если профиль есть — обновим, если нет — создадим
    const { error } = await supabase
      .from("xp_profiles")
      .upsert(
        {
          user_id: userId,
          total_xp: stats.totalXp,
          level: stats.level,
          current_xp: stats.currentXp,
          next_level_xp: stats.nextLevelXp,
        },
        { onConflict: "user_id" }
      );

    if (error) {
      console.error("[Supabase] xp_profiles upsert error", error);
      return NextResponse.json(
        {
          error: "DB_ERROR",
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[API] /api/xp/profile/save error", e);
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: String(e?.message ?? e),
      },
      { status: 500 }
    );
  }
}
