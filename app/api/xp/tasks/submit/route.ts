import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const userIdRaw = body?.userId;
    const taskCodeRaw = body?.taskCode;

    const userId = Number(userIdRaw);
    const taskCode =
      typeof taskCodeRaw === "string" ? taskCodeRaw.trim().toUpperCase() : "";

    if (!userId || !Number.isFinite(userId)) {
      return NextResponse.json(
        { error: "INVALID_BODY", message: "userId is required" },
        { status: 400 }
      );
    }

    if (!taskCode) {
      return NextResponse.json(
        { error: "INVALID_BODY", message: "taskCode is required" },
        { status: 400 }
      );
    }

    // 1) Находим активную задачу по коду
    const { data: task, error: taskError } = await supabase
      .from("xp_tasks")
      .select(
        `
        id,
        code,
        title,
        reward_xp,
        is_active,
        task_type,
        max_user_completions
      `
      )
      .eq("code", taskCode)
      .eq("is_active", true)
      .maybeSingle();

    if (taskError) {
      console.error("[XP] submit: xp_tasks select error:", taskError);
      return NextResponse.json(
        { error: "DB_ERROR", message: taskError.message },
        { status: 500 }
      );
    }

    if (!task) {
      return NextResponse.json(
        { error: "TASK_NOT_FOUND", message: "Task not found or inactive" },
        { status: 404 }
      );
    }

    const taskId: number = task.id;
    const taskType: string = task.task_type ?? "single";
    const rawMaxUserCompletions = task.max_user_completions as
      | number
      | null
      | undefined;

    // 2) Считаем, сколько раз юзер уже выполнял эту задачу
    //    approved + pending (чтоб не спамили)
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    );

    let query = supabase
      .from("xp_task_completions")
      .select("id, created_at, status", { count: "exact", head: false })
      .eq("task_id", taskId)
      .eq("telegram_user_id", userId)
      .in("status", ["pending", "approved"]);

    // Для daily считаем только сегодняшние выполнения
    if (taskType === "daily") {
      query = query.gte("created_at", startOfToday.toISOString());
    }

    const { data: completions, error: compError, count } = await query;

    if (compError) {
      console.error("[XP] submit: completions select error:", compError);
      return NextResponse.json(
        { error: "DB_ERROR", message: compError.message },
        { status: 500 }
      );
    }

    const usedCount = typeof count === "number" ? count : (completions?.length ?? 0);

    // 3) Определяем лимит для юзера
    // single: минимум 1
    // daily: минимум 1 в день
    // multi: берём max_user_completions (0 или null => без лимита)
    let maxForUser: number | null = null;

    if (taskType === "single") {
      maxForUser =
        typeof rawMaxUserCompletions === "number" && rawMaxUserCompletions > 0
          ? rawMaxUserCompletions
          : 1;
    } else if (taskType === "daily") {
      maxForUser =
        typeof rawMaxUserCompletions === "number" && rawMaxUserCompletions > 0
          ? rawMaxUserCompletions
          : 1;
    } else if (taskType === "multi") {
      if (
        typeof rawMaxUserCompletions === "number" &&
        rawMaxUserCompletions > 0
      ) {
        maxForUser = rawMaxUserCompletions;
      } else {
        maxForUser = null; // без лимита
      }
    }

    // 4) Если лимит достигнут — возвращаем статус limit_reached (БЕЗ error)
    if (maxForUser !== null && usedCount >= maxForUser) {
      return NextResponse.json({
        ok: true,
        status: "limit_reached",
        reason: "MAX_COMPLETIONS_REACHED",
        taskCode: task.code,
        taskType,
        usedCount,
        maxForUser,
      });
    }

    // 5) Создаём новую "заявку" в xp_task_completions со статусом pending
    const { data: insertData, error: insertError } = await supabase
      .from("xp_task_completions")
      .insert([
        {
          task_id: taskId,
          telegram_user_id: userId,
          status: "pending",
        },
      ])
      .select("id, status, created_at")
      .single();

    if (insertError) {
      console.error("[XP] submit: completions insert error:", insertError);
      return NextResponse.json(
        { error: "DB_ERROR", message: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: "pending",
      completionId: insertData.id,
      taskCode: task.code,
      taskType,
      rewardXp: task.reward_xp,
      usedCount: usedCount + 1,
      maxForUser,
    });
  } catch (e: any) {
    console.error("[XP] /api/xp/tasks/submit error:", e);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
