import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

// та же логика уровней, что и на фронте
function calculateLevelStats(totalXp: number) {
  let level = 1;
  let xpForNextLevel = 500; // XP для 1 -> 2
  let xpPool = totalXp;

  while (xpPool >= xpForNextLevel) {
    xpPool -= xpForNextLevel;
    level++;
    xpForNextLevel = 500 * level;
  }

  const currentXp = xpPool;
  const nextLevelXp = xpForNextLevel;
  const progressPercent =
    nextLevelXp === 0 ? 100 : Math.min(100, (currentXp / nextLevelXp) * 100);

  return {
    level,
    currentXp,
    nextLevelXp,
    progressPercent,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const completionIdRaw = body?.completionId;
    const adminIdRaw = body?.adminId;

    if (!completionIdRaw) {
      return NextResponse.json(
        { error: "INVALID_BODY", message: "completionId is required" },
        { status: 400 }
      );
    }

    const completionId = String(completionIdRaw);
    const adminId =
      adminIdRaw != null && Number.isFinite(Number(adminIdRaw))
        ? Number(adminIdRaw)
        : null;

    // 1) Находим заявку в pending
    const { data: completion, error: completionError } = await supabase
      .from("xp_task_completions")
      .select(
        `
        id,
        task_id,
        telegram_user_id,
        status,
        reward_xp,
        created_at,
        approved_at,
        approved_by
      `
      )
      .eq("id", completionId)
      .single();

    if (completionError || !completion) {
      console.error(
        "[Supabase] xp_task_completions find error:",
        completionError
      );
      return NextResponse.json(
        {
          error: "COMPLETION_NOT_FOUND",
          message: "Task completion not found",
        },
        { status: 404 }
      );
    }

    if (completion.status !== "pending") {
      return NextResponse.json(
        {
          error: "INVALID_STATUS",
          message: `Completion is not pending (status=${completion.status})`,
        },
        { status: 400 }
      );
    }

    const telegramUserId = completion.telegram_user_id as number;
    const rewardXp = (completion.reward_xp as number | null) ?? 0;
    const taskId = completion.task_id as string;

    // 2) Обновляем заявку: approved
    const { error: updateCompletionError } = await supabase
      .from("xp_task_completions")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: adminId,
      })
      .eq("id", completionId);

    if (updateCompletionError) {
      console.error(
        "[Supabase] xp_task_completions update error:",
        updateCompletionError
      );
      return NextResponse.json(
        { error: "DB_ERROR", message: updateCompletionError.message },
        { status: 500 }
      );
    }

    // 3) Читаем текущий профиль XP пользователя
    const { data: profileRow, error: profileError } = await supabase
      .from("xp_profiles")
      .select(
        `
        id,
        telegram_user_id,
        total_xp,
        level,
        current_xp,
        next_level_xp
      `
      )
      .eq("telegram_user_id", telegramUserId)
      .single();

    let totalXp = 0;

    if (profileError && profileError.code !== "PGRST116") {
      // PGRST116 = no rows
      console.error("[Supabase] xp_profiles select error:", profileError);
      return NextResponse.json(
        { error: "DB_ERROR", message: profileError.message },
        { status: 500 }
      );
    }

    if (profileRow) {
      totalXp = (profileRow.total_xp as number | null) ?? 0;
    }

    const prevTotalXp = totalXp;
    const prevStats = calculateLevelStats(prevTotalXp);
    const prevLevel = prevStats.level;

    const newTotalXp = prevTotalXp + rewardXp;
    const newStats = calculateLevelStats(newTotalXp);

    // 4) upsert профиля с новыми статами
    const { data: upsertedProfile, error: upsertError } = await supabase
      .from("xp_profiles")
      .upsert(
        {
          telegram_user_id: telegramUserId,
          total_xp: newTotalXp,
          level: newStats.level,
          current_xp: newStats.currentXp,
          next_level_xp: newStats.nextLevelXp,
        },
        { onConflict: "telegram_user_id" }
      )
      .select()
      .single();

    if (upsertError) {
      console.error("[Supabase] xp_profiles upsert error:", upsertError);
      return NextResponse.json(
        { error: "DB_ERROR", message: upsertError.message },
        { status: 500 }
      );
    }

    // 5) Пишем событие в xp_events (task_completed)
    const levelFrom = prevLevel;
    const levelTo = newStats.level;

    const { error: eventError } = await supabase.from("xp_events").insert([
      {
        user_id: telegramUserId,
        type: "task_completed",
        amount: rewardXp,
        source: "task",
        task_id: taskId,
        level_from: levelFrom,
        level_to: levelTo,
      },
    ]);

    if (eventError) {
      console.error("[Supabase] xp_events insert error:", eventError);
      // не рвём процесс, просто логируем
    }

    const normalizedProfile = {
      telegramUserId: upsertedProfile.telegram_user_id,
      stats: {
        totalXp: upsertedProfile.total_xp ?? newTotalXp,
        level: upsertedProfile.level ?? newStats.level,
        currentXp: upsertedProfile.current_xp ?? newStats.currentXp,
        nextLevelXp: upsertedProfile.next_level_xp ?? newStats.nextLevelXp,
      },
    };

    return NextResponse.json({
      ok: true,
      completionId,
      rewardXp,
      profile: normalizedProfile,
    });
  } catch (e: any) {
    console.error("[XP] /api/xp/tasks/approve error:", e);
    return NextResponse.json(
      {
        error: "SERVER_ERROR",
        message: String(e?.message ?? e),
      },
      { status: 500 }
    );
  }
}
