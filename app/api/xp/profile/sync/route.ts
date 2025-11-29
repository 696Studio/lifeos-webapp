import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { verifyTelegramInitData } from "@/lib/verifyTelegram";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, initData, stats } = body;

    if (!userId || !initData || !stats) {
      return NextResponse.json(
        { error: "INVALID_BODY", message: "userId, initData, stats required" },
        { status: 400 }
      );
    }

    // 🔐 Верификация подписи Telegram WebApp
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
    const isValid = verifyTelegramInitData(initData, BOT_TOKEN);

    if (!isValid) {
      console.error("❌ Telegram signature check failed");
      return NextResponse.json(
        { error: "INVALID_SIGNATURE" },
        { status: 403 }
      );
    }

    // 🟩 Если всё ок — обновляем профиль
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