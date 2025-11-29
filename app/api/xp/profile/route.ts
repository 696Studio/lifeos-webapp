import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "INVALID_QUERY", message: "userId is required" },
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

    // тянем профиль по telegram_user_id
    const { data, error } = await supabase
      .from("xp_profiles")
      .select("*")
      .eq("telegram_user_id", numericUserId)
      .single();

    // если профиль не найден — вернуть пустой базовый профиль
    if (error || !data) {
      const emptyProfile = {
        telegramUserId: numericUserId,
        stats: {
          totalXp: 0,
          level: 1,
          currentXp: 0,
          nextLevelXp: 500,
        },
        tasks: [] as any[],
      };

      return NextResponse.json({
        ok: true,
        isNew: true,
        profile: emptyProfile,
      });
    }

    // нормализуем профиль под фронт
    const profile = {
      telegramUserId: data.telegram_user_id,
      stats: {
        totalXp: data.total_xp ?? 0,
        level: data.level ?? 1,
        currentXp: data.current_xp ?? 0,
        nextLevelXp: data.next_level_xp ?? 500,
      },
      tasks: [] as any[],
    };

    return NextResponse.json({
      ok: true,
      isNew: false,
      profile,
    });
  } catch (e: any) {
    console.error("[XP] /api/xp/profile GET error:", e);
    return NextResponse.json(
      { error: "SERVER_ERROR", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}