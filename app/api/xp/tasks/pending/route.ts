import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    // можно будет передавать limit/filters, но пока просто читаем тело
    const body = await req.json().catch(() => ({} as any));
    const limitRaw = body?.limit;

    let limit = 50;
    const n = Number(limitRaw);
    if (Number.isFinite(n) && n > 0 && n <= 200) {
      limit = n;
    }

    // 1) Берём pending-заявки из xp_task_completions
    const { data: completions, error: completionsError } = await supabase
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
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (completionsError) {
      console.error(
        "[Supabase] xp_task_completions pending error:",
        completionsError
      );
      return NextResponse.json(
        { error: "DB_ERROR", message: completionsError.message },
        { status: 500 }
      );
    }

    if (!completions || completions.length === 0) {
      return NextResponse.json({
        ok: true,
        items: [],
      });
    }

    // 2) Подтягиваем данные по задачам (код, название, XP)
    const taskIds = Array.from(
      new Set(
        completions
          .map((c: any) => c.task_id)
          .filter((id: any) => typeof id === "string" && id.length > 0)
      )
    );

    let taskMap = new Map<string, any>();

    if (taskIds.length > 0) {
      const { data: tasks, error: tasksError } = await supabase
        .from("xp_tasks")
        .select(`id, code, title, reward_xp`)
        .in("id", taskIds);

      if (tasksError) {
        console.error("[Supabase] xp_tasks for pending error:", tasksError);
        // не падаем, просто вернём заявки без данных задач
      } else if (tasks) {
        taskMap = new Map<string, any>(
          tasks.map((t: any) => [t.id as string, t])
        );
      }
    }

    // 3) Сшиваем
    const items = completions.map((c: any) => {
      const t = taskMap.get(c.task_id as string) || null;

      return {
        id: c.id as string,
        taskId: c.task_id as string,
        taskCode: t?.code ?? null,
        taskTitle: t?.title ?? null,
        telegramUserId: c.telegram_user_id as number,
        status: c.status as string,
        rewardXp:
          (c.reward_xp as number | null) ??
          (t?.reward_xp as number | null) ??
          0,
        createdAt: c.created_at as string,
        approvedAt: c.approved_at as string | null,
        approvedBy: c.approved_by as number | null,
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
