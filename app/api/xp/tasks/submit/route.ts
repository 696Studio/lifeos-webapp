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

    // 1) Находим задачу по коду (НЕ фильтруем по is_active тут)
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
      .maybeSingle();

    if (taskError) {
      console.error("[XP] submit: xp_tasks select error:", taskError);
      return NextResponse.json(
        { error: "DB_ERROR", message: taskError.message },
        { status: 500 }
      );
    }

    if (!task) {
      // задача реально не найдена
      return NextResponse.json({
        ok: false,
        status: "task_not_found",
        message: "Task not found",
      });
    }

    const taskId = task.id;
    const taskType: string = task.task_type ?? "single";
    const rawMaxUserCompletions = task.max_user_completions as
      | number
      | null
      | undefined;

    // если задача выключена — сразу шлём статус
    if (task.is_active === false) {
      return NextResponse.json({
        ok: true,
        status: "task_inactive",
        taskCode: task.code,
      });
    }

    // 2) Считаем, сколько раз юзер уже выполнял эту задачу
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

    // для daily считаем только сегодняшние
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

    const usedCount =
      typeof count === "number" ? count : (completions?.length ?? 0);

    // 3) Определяем лимит
    let maxForUser: number | null = null;

    if (taskType === "single") {
      maxForUser =
        typeof rawMaxUserCompletions === "number" &&
        rawMaxUserCompletions > 0
          ? rawMaxUserCompletions
          : 1;
    } else if (taskType === "daily") {
      maxForUser =
        typeof rawMaxUserCompletions === "number" &&
        rawMaxUserCompletions > 0
          ? rawMaxUserCompletions
          : 1;
    } else if (taskType === "multi") {
      if (
        typeof rawMaxUserCompletions === "number" &&
        rawMaxUserCompletions > 0
      ) {
        maxForUser = rawMaxUserCompletions;
      } else {
        maxForUser = null; // без ограничения
      }
    }

    // 4) Лимит достигнут — просто говорим об этом, без ошибки
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

    // 5) Создаём новую заявку
    const { data: insertData, error: insertError } = await supabase
      .from("xp_task_completions")
      .insert([
        {
          task_id: taskId,
          telegram_user_id: userId,
          status: "pending",
          // если в таблице есть колонка reward_xp — можно закидывать:
          reward_xp: task.reward_xp ?? null,
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
