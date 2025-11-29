import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const userIdRaw = body?.userId;
    const taskCodeRaw = body?.taskCode;

    if (!userIdRaw || !taskCodeRaw) {
      return NextResponse.json(
        {
          error: "INVALID_BODY",
          message: "userId and taskCode are required",
        },
        { status: 400 }
      );
    }

    const userId = Number(userIdRaw);
    if (!Number.isFinite(userId)) {
      return NextResponse.json(
        {
          error: "INVALID_USER_ID",
          message: "userId must be a number (Telegram user id)",
        },
        { status: 400 }
      );
    }

    const taskCode = String(taskCodeRaw).trim().toUpperCase();
    if (!taskCode) {
      return NextResponse.json(
        {
          error: "INVALID_TASK_CODE",
          message: "taskCode must be a non-empty string",
        },
        { status: 400 }
      );
    }

    // 1) Находим задачу по коду
    const { data: task, error: taskError } = await supabase
      .from("xp_tasks")
      .select(
        `
        id,
        code,
        title,
        reward_xp,
        is_active
      `
      )
      .eq("code", taskCode)
      .single();

    if (taskError || !task) {
      console.error("[Supabase] xp_tasks find by code error:", taskError);
      return NextResponse.json(
        {
          error: "TASK_NOT_FOUND",
          message: "Task with this code not found",
        },
        { status: 404 }
      );
    }

    if (task.is_active === false) {
      return NextResponse.json(
        {
          error: "TASK_INACTIVE",
          message: "Task is not active",
        },
        { status: 400 }
      );
    }

    const taskId = task.id as string;
    const rewardXp = task.reward_xp ?? 0;

    // 2) Проверяем, нет ли уже pending/approved выполнения
    const { data: existing, error: existingError } = await supabase
      .from("xp_task_completions")
      .select("id, status")
      .eq("task_id", taskId)
      .eq("telegram_user_id", userId)
      .in("status", ["pending", "approved"]);

    if (existingError) {
      console.error("[Supabase] xp_task_completions check error:", existingError);
      // не блокируем, но логируем
    }

    if (existing && existing.length > 0) {
      return NextResponse.json({
        ok: true,
        status: "already_submitted",
      });
    }

    // 3) Создаём новую заявку
    const { data: completion, error: insertError } = await supabase
      .from("xp_task_completions")
      .insert([
        {
          task_id: taskId,
          telegram_user_id: userId,
          status: "pending",
          reward_xp: rewardXp,
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error(
        "[Supabase] xp_task_completions insert error:",
        insertError
      );
      return NextResponse.json(
        {
          error: "DB_ERROR",
          message: insertError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: "pending",
      completion: {
        id: completion.id,
        taskId: completion.task_id,
        telegramUserId: completion.telegram_user_id,
        status: completion.status,
        rewardXp: completion.reward_xp,
        createdAt: completion.created_at,
      },
    });
  } catch (e: any) {
    console.error("[XP] /api/xp/tasks/submit error:", e);
    return NextResponse.json(
      {
        error: "SERVER_ERROR",
        message: String(e?.message ?? e),
      },
      { status: 500 }
    );
  }
}
