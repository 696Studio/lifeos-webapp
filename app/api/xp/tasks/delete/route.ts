import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

/**
 * Мягкое удаление задачи по коду.
 *
 * POST /api/xp/tasks/delete
 * {
 *   "taskCode": "SOME_CODE"
 * }
 *
 * Логика:
 * - Находим задачу по code
 * - Ставим status = "deleted"
 * - Earn этого больше не увидит, потому что /api/xp/tasks отдаёт
 *   только status IN ("active", "locked")
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const rawCode = body?.taskCode;
    if (!rawCode || typeof rawCode !== "string") {
      return NextResponse.json(
        { error: "INVALID_BODY", message: "taskCode is required" },
        { status: 400 }
      );
    }

    const taskCode = rawCode.trim().toUpperCase();

    // 1) Находим задачу по коду
    const { data: task, error: findError } = await supabase
      .from("xp_tasks")
      .select("id, code, status")
      .eq("code", taskCode)
      .single();

    if (findError || !task) {
      console.error("[XP] tasks/delete: task not found", findError);
      return NextResponse.json(
        {
          error: "TASK_NOT_FOUND",
          message: `Task with code ${taskCode} not found`,
        },
        { status: 404 }
      );
    }

    // Если уже удалена — считаем операцию идемпотентной
    if (task.status === "deleted") {
      return NextResponse.json({
        ok: true,
        taskId: task.id,
        taskCode,
        status: "deleted",
        alreadyDeleted: true,
      });
    }

    // 2) Помечаем как deleted
    const { error: updateError } = await supabase
      .from("xp_tasks")
      .update({ status: "deleted" })
      .eq("id", task.id);

    if (updateError) {
      console.error("[XP] tasks/delete: update error", updateError);
      return NextResponse.json(
        { error: "DB_ERROR", message: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      taskId: task.id,
      taskCode,
      status: "deleted",
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
