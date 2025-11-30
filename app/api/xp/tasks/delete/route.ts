// app/api/xp/tasks/delete/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

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
      .select("id, code, status")
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

    const currentStatus = (task.status as string | null) ?? null;

    // 2) Если уже в архиве — просто говорим об этом
    if (currentStatus === "archived") {
      return NextResponse.json({
        ok: true,
        taskCode,
        status: "archived",
        alreadyDeleted: true,
      });
    }

    // 3) Обновляем статус на archived
    const { error: updateError } = await supabase
      .from("xp_tasks")
      .update({
        status: "archived",
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
      status: "archived",
      alreadyDeleted: false,
    });
  } catch (e: any) {
    console.error("[XP] tasks/delete: server error:", e);
    return NextResponse.json(
      {
        error: "SERVER_ERROR",
        message: String(e?.message ?? e),
      },
      { status: 500 }
    );
  }
}
