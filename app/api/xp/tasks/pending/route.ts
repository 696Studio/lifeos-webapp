import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const limitRaw = body?.limit;

    let limit = 50;
    const n = Number(limitRaw);
    if (Number.isFinite(n) && n > 0 && n <= 200) {
      limit = n;
    }

    // 1) Берём pending-заявки из xp_task_completions
    // и сразу подтягиваем связанную задачу
    const { data, error } = await supabase
      .from("xp_task_completions")
      .select(
        `
        id,
        task_id,
        telegram_user_id,
        status,
        created_at,
        approved_at,
        approved_by,
        task:xp_tasks (
          id,
          code,
          title,
          reward_xp
        )
      `
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      console.error("[Supabase] xp_task_completions pending error:", error);
      return NextResponse.json(
        { error: "DB_ERROR", message: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        ok: true,
        items: [],
      });
    }

    // 2) Собираем ответ для бота
    const items = data.map((c: any) => {
      const t = c.task || null;

      return {
        id: String(c.id),
        taskId: c.task_id,
        taskCode: t?.code ?? null,
        taskTitle: t?.title ?? null,
        telegramUserId: c.telegram_user_id as number,
        status: c.status as string,
        rewardXp: (t?.reward_xp as number | null) ?? 0,
        createdAt: c.created_at as string,
        approvedAt: (c.approved_at as string | null) ?? null,
        approvedBy: (c.approved_by as number | null) ?? null,
      };
    });

    return NextResponse.json({
      ok: true,
      items,
    });
  } catch (e: any) {
    console.error("[XP] /api/xp/tasks/pending error:", e);
    return NextResponse.json(
      {
        error: "SERVER_ERROR",
        message: String(e?.message ?? e),
      },
      { status: 500 }
    );
  }
}
