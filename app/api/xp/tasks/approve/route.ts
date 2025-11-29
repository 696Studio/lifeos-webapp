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

/**
 * 🔮 Проверяем и открываем трофеи для пользователя.
 * Этот хелпер НЕ ломает основной поток: любые ошибки просто логируются.
 *
 * Основано на:
 * - prevTotalXp / newTotalXp
 * - prevLevel / newLevel
 * - количестве подтверждённых задач
 */
async function checkAndUnlockTrophiesForUser(params: {
  telegramUserId: number;
  prevTotalXp: number;
  newTotalXp: number;
  prevLevel: number;
  newLevel: number;
}) {
  const { telegramUserId, prevTotalXp, newTotalXp, prevLevel, newLevel } =
    params;

  try {
    // 1) сколько всего approved задач у пользователя
    const { count: approvedTasksCount, error: tasksCountError } = await supabase
      .from("xp_task_completions")
      .select("*", { count: "exact", head: true })
      .eq("telegram_user_id", telegramUserId)
      .eq("status", "approved");

    if (tasksCountError) {
      console.error(
        "[XP][TROPHIES] xp_task_completions count error:",
        tasksCountError
      );
      // не рвём процесс
    }

    const totalApprovedTasks = approvedTasksCount ?? 0;

    // 2) какие трофеи уже открыты
    const { data: existingUnlocks, error: unlocksError } = await supabase
      .from("xp_trophy_unlocks")
      .select("trophy_code")
      .eq("user_id", telegramUserId);

    if (unlocksError) {
      console.error(
        "[XP][TROPHIES] xp_trophy_unlocks select error:",
        unlocksError
      );
      // всё равно продолжаем, просто считаем что трофеев нет
    }

    const unlockedSet = new Set<string>(
      (existingUnlocks ?? []).map((u: any) => u.trophy_code)
    );

    const toInsert: { user_id: number; trophy_code: string }[] = [];

    const maybeAdd = (code: string, condition: boolean) => {
      if (!condition) return;
      if (unlockedSet.has(code)) return;
      unlockedSet.add(code);
      toInsert.push({ user_id: telegramUserId, trophy_code: code });
    };

    // 🎖 Условия (можешь потом подкрутить пороги/коды)
    // 1) awakening — как только пользователь получил первые XP
    maybeAdd("awakening", prevTotalXp <= 0 && newTotalXp > 0);

    // 2) blade_accept — достиг 10 XP
    maybeAdd(
      "blade_accept",
      prevTotalXp < 10 && newTotalXp >= 10
    );

    // 3) inner_pulse — есть хотя бы 1 подтверждённая задача
    maybeAdd("inner_pulse", totalApprovedTasks >= 1);

    // 4) contours_open — переход на уровень 2+
    maybeAdd(
      "contours_open",
      prevLevel < 2 && newLevel >= 2
    );

    // 5) mind_ignition — набрал 300 XP суммарно
    maybeAdd(
      "mind_ignition",
      prevTotalXp < 300 && newTotalXp >= 300
    );

    // 6) step_renounce — 3+ подтверждённых задачи
    maybeAdd("step_renounce", totalApprovedTasks >= 3);

    // 7) initiated — уровень 3+
    maybeAdd(
      "initiated",
      prevLevel < 3 && newLevel >= 3
    );

    // 8) shadow_cross — уровень 4+
    maybeAdd(
      "shadow_cross",
      prevLevel < 4 && newLevel >= 4
    );

    // 9) flame_bearer — 1000+ XP
    maybeAdd(
      "flame_bearer",
      prevTotalXp < 1000 && newTotalXp >= 1000
    );

    // 10) chosen_node — 10+ подтверждённых задач
    maybeAdd("chosen_node", totalApprovedTasks >= 10);

    if (toInsert.length === 0) {
      return;
    }

    const { error: insertError } = await supabase
      .from("xp_trophy_unlocks")
      .insert(toInsert);

    if (insertError) {
      console.error(
        "[XP][TROPHIES] xp_trophy_unlocks insert error:",
        insertError
      );
    } else {
      console.log(
        "[XP][TROPHIES] unlocked trophies for user",
        telegramUserId,
        toInsert.map((t) => t.trophy_code)
      );
    }
  } catch (e: any) {
    console.error("[XP][TROPHIES] checkAndUnlockTrophiesForUser error:", e);
  }
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

    // 6) 🔮 Проверяем / открываем трофеи (не ломает основной поток)
    await checkAndUnlockTrophiesForUser({
      telegramUserId,
      prevTotalXp,
      newTotalXp,
      prevLevel,
      newLevel: newStats.level,
    });

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
