import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, stats, telegramUsername } = body;

    if (!userId || !stats) {
      return NextResponse.json(
        { error: "INVALID_BODY", message: "userId, stats required" },
        { status: 400 }
      );
    }

    const numericUserId = Number(userId);
    if (!Number.isFinite(numericUserId)) {
      return NextResponse.json(
        { error: "INVALID_USER_ID", message: "userId must be a number" },
        { status: 400 }
      );
    }

    // upsert профиля по telegram_user_id
    const { data, error } = await supabase
      .from("xp_profiles")
      .upsert(
        {
          telegram_user_id: numericUserId,
          telegram_username: telegramUsername ?? null,
          total_xp: stats.totalXp,
          level: stats.level,
          current_xp: stats.currentXp,
          next_level_xp: stats.nextLevelXp,
        },
        { onConflict: "telegram_user_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("[Supabase] xp_profiles upsert error:", error);
      return NextResponse.json(
        { error: "DB_ERROR", message: error.message },
        { status: 500 }
      );
    }

    // safety: если по какой-то причине data нет
    if (!data) {
      return NextResponse.json(
        { error: "NO_PROFILE", message: "Profile not found after upsert" },
        { status: 500 }
      );
    }

    // Нормализуем ответ под фронт (hydrateFromServer)
    const profile = {
      telegramUserId: data.telegram_user_id,
      stats: {
        totalXp: data.total_xp ?? 0,
        level: data.level ?? 1,
        currentXp: data.current_xp ?? 0,
        nextLevelXp: data.next_level_xp ?? 500,
      },
      // сюда позже можно будет прилепить задачи из другой таблицы
      tasks: [] as any[],
    };

    return NextResponse.json({
      ok: true,
      profile,
    });
  } catch (e: any) {
    console.error("[XP] profile/sync server error:", e);
    return NextResponse.json(
      { error: "SERVER_ERROR", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
