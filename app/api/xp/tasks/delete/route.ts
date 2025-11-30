import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

/**
 * Мягкое отключение задачи:
 *
 * POST /api/xp/tasks/delete
 * {
 *   "taskCode": "SOME_CODE"
 * }
 *
 * Логика:
 *  - Находим задачу по code
 *  - Если уже is_active = false → говорим, что уже отключена
 *  - Если is_active = true → ставим is_active = false
 *  - Поле status НЕ трогаем (чтобы не ломать enum xp_task_status)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const rawCode = body?.taskCode ?? body?.code;
    if (!rawCode || typeof rawCode !== "string") {
      return NextResponse.json(
        {
          error: "INVALID_BODY",
          message: "taskCode is required",
        },
        { status: 400 }
      );
    }

    const taskCode = rawCode.trim().toUpperCase();

    // 1) Ищем задачу по коду
    const { data: task, error: taskError } = await supabase
      .from("xp_tasks")
      .select("id, code, status, is_active")
      .eq("code", taskCode)
      .single();

    if (taskError || !task) {
      console.error("[XP] tasks/delete: task not found:", taskError);
      return NextResponse.json(
        {
          error: "TASK_NOT_FOUND",
          message: `Task with code ${taskCode} not found`,
        },
        { status: 404 }
      );
    }

    const isActive =
      typeof task.is_active === "boolean" ? task.is_active : true;

    // 2) Если уже выключена — считаем операцию идемпотентной
    if (!isActive) {
      return NextResponse.json({
        ok: true,
        taskCode,
        isActive: false,
        alreadyDeleted: true,
      });
    }

    // 3) Отключаем задачу (is_active = false), status не трогаем
    const { error: updateError } = await supabase
      .from("xp_tasks")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", task.id);

    if (updateError) {
      console.error("[XP] tasks/delete: update error:", updateError);
      return NextResponse.json(
        {
          error: "DB_ERROR",
          message: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      taskCode,
      isActive: false,
      alreadyDeleted: false,
    });
  } catch (e: any) {
    console.error("[XP] /api/xp/tasks/delete error:", e);
    return NextResponse.json(
      {
        error: "SERVER_ERROR",
        message: String(e?.message ?? e),
      },
      { status: 500 }
    );
  }
}
