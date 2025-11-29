import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

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

    // 1) Находим заявку
    const { data: completion, error: completionError } = await supabase
      .from("xp_task_completions")
      .select(
        `
        id,
        status
      `
      )
      .eq("id", completionId)
      .single();

    if (completionError || !completion) {
      console.error(
        "[Supabase] xp_task_completions find error (reject):",
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

    // 2) Обновляем статус на rejected
    const { error: updateError } = await supabase
      .from("xp_task_completions")
      .update({
        status: "rejected",
        approved_at: new Date().toISOString(), // как "обработано"
        approved_by: adminId,
      })
      .eq("id", completionId);

    if (updateError) {
      console.error(
        "[Supabase] xp_task_completions reject update error:",
        updateError
      );
      return NextResponse.json(
        { error: "DB_ERROR", message: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      completionId,
      status: "rejected",
    });
  } catch (e: any) {
    console.error("[XP] /api/xp/tasks/reject error:", e);
    return NextResponse.json(
      {
        error: "SERVER_ERROR",
        message: String(e?.message ?? e),
      },
      { status: 500 }
    );
  }
}
