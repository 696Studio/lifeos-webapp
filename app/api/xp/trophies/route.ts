import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

// GET /api/xp/trophies?userId=123456
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userIdParam = url.searchParams.get("userId");

    const userId = userIdParam ? Number(userIdParam) : null;
    const hasUser = Number.isFinite(userId as number);

    // 1) тянем все трофеи из справочника
    const { data: trophies, error: trophiesError } = await supabase
      .from("xp_trophies")
      .select("code, title, description, icon, created_at")
      .order("created_at", { ascending: true });

    if (trophiesError) {
      console.error("[Supabase] xp_trophies select error:", trophiesError);
      return NextResponse.json(
        {
          error: "DB_ERROR",
          message: trophiesError.message,
        },
        { status: 500 }
      );
    }

    if (!trophies || trophies.length === 0) {
      return NextResponse.json({ trophies: [] });
    }

    // 2) если нет userId — просто отдаём список без статусов
    if (!hasUser) {
      const normalized = trophies.map((t) => ({
        code: t.code,
        title: t.title,
        description: t.description,
        icon: t.icon,
        unlocked: false,
        unlockedAt: null,
      }));

      return NextResponse.json({ trophies: normalized });
    }

    // 3) тянем, какие трофеи уже открыты у этого пользователя
    const { data: unlocks, error: unlocksError } = await supabase
      .from("xp_trophy_unlocks")
      .select("trophy_code, unlocked_at")
      .eq("user_id", userId);

    if (unlocksError) {
      console.error(
        "[Supabase] xp_trophy_unlocks select error:",
        unlocksError
      );
      return NextResponse.json(
        {
          error: "DB_ERROR",
          message: unlocksError.message,
        },
        { status: 500 }
      );
    }

    const unlockMap = new Map<string, string>();
    (unlocks ?? []).forEach((u) => {
      unlockMap.set(u.trophy_code, u.unlocked_at);
    });

    // 4) собираем итоговый список
    const result = trophies.map((t) => {
      const unlockedAt = unlockMap.get(t.code) ?? null;

      return {
        code: t.code,
        title: t.title,
        description: t.description,
        icon: t.icon,
        unlocked: Boolean(unlockedAt),
        unlockedAt,
      };
    });

    return NextResponse.json({ trophies: result });
  } catch (e: any) {
    console.error("[XP] /api/xp/trophies GET error:", e);
    return NextResponse.json(
      {
        error: "SERVER_ERROR",
        message: String(e?.message ?? e),
      },
      { status: 500 }
    );
  }
}
