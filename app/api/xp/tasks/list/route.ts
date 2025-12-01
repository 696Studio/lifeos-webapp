// app/api/xp/tasks/list/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    // можно передавать: userId, includeInactive, category
    const body = await req.json().catch(() => ({} as any));

    const userIdRaw = body?.userId;
    const includeInactive = body?.includeInactive ?? false;
    const category = body?.category ?? null;

    const userId =
      userIdRaw !== undefined && userIdRaw !== null
        ? Number(userIdRaw)
        : null;

    // 1) Базовый запрос задач
    let query = supabase
      .from("xp_tasks")
      .select(
        `
        id,
        code,
        title,
        description,
        reward_xp,
        deadline_at,
        created_at,
        created_by,
        is_active,
        category,
        task_type,
        max_user_completions
      `
      )
      .order("created_at", { ascending: true });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    if (category) {
      query = query.eq("category", category);
    }

    const { data: tasks, error: tasksError } = await query;

    if (tasksError) {
      console.error("[XP] tasks/list: xp_tasks select error:", tasksError);
      return NextResponse.json(
        { error: "DB_ERROR", message: tasksError.message },
        { status: 500 }
      );
    }

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({
        ok: true,
        tasks: [],
      });
    }

    // 2) Если userId НЕ передан — ведём себя как раньше: просто список задач
    if (!userId || !Number.isFinite(userId)) {
      const mapped = tasks.map((row: any) => ({
        id: row.id,
        code: row.code,
        title: row.title,
        description: row.description,
        rewardXp: row.reward_xp,
        deadlineAt: row.deadline_at,
        createdAt: row.created_at,
        createdBy: row.created_by,
        isActive: row.is_active,
        category: row.category,
        taskType: row.task_type ?? "single",
        maxUserCompletions: row.max_user_completions,
      }));

      return NextResponse.json({
        ok: true,
        tasks: mapped,
      });
    }

    // ---------- SMART EARN ДЛЯ КОНКРЕТНОГО ЮЗЕРА ----------

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

    const taskIds = tasks.map((t: any) => t.id);

    // 3) Смотрим все pending+approved выполнения этого юзера по этим задачам
    const { data: completions, error: compError } = await supabase
      .from("xp_task_completions")
      .select("task_id, created_at, status")
      .eq("telegram_user_id", userId)
      .in("task_id", taskIds)
      .in("status", ["pending", "approved"]);

    if (compError) {
      console.error(
        "[XP] tasks/list: xp_task_completions select error:",
        compError
      );
      return NextResponse.json(
        { error: "DB_ERROR", message: compError.message },
        { status: 500 }
      );
    }

    type CompletionRow = {
      task_id: number;
      created_at: string;
      status: string;
    };

    const completionsByTask = new Map<number, CompletionRow[]>();

    (completions || []).forEach((c: CompletionRow) => {
      const arr = completionsByTask.get(c.task_id) || [];
      arr.push(c);
      completionsByTask.set(c.task_id, arr);
    });

    const filteredTasks: any[] = [];

    for (const t of tasks as any[]) {
      const taskId: number = t.id;
      const taskType: string = t.task_type ?? "single";
      const rawMaxUserCompletions =
        (t.max_user_completions as number | null | undefined) ?? null;

      const rows = completionsByTask.get(taskId) || [];

      // 4) Считаем, сколько раз юзер уже делал эту задачу
      let usedCount = 0;

      if (taskType === "daily") {
        // для daily — только сегодняшние выполнения
        usedCount = rows.filter((r) => {
          const created = new Date(r.created_at);
          return created >= startOfToday;
        }).length;
      } else {
        // single + multi — все выполнения
        usedCount = rows.length;
      }

      // 5) Определяем maxForUser (та же логика, что в /tasks/submit)
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
          maxForUser = null; // без лимита
        }
      }

      // 6) Если лимит достигнут — НЕ показываем эту задачу этому юзеру
      if (maxForUser !== null && usedCount >= maxForUser) {
        continue;
      }

      filteredTasks.push({
        id: t.id,
        code: t.code,
        title: t.title,
        description: t.description,
        rewardXp: t.reward_xp,
        deadlineAt: t.deadline_at,
        createdAt: t.created_at,
        createdBy: t.created_by,
        isActive: t.is_active,
        category: t.category,
        taskType,
        maxUserCompletions: rawMaxUserCompletions,
        usedCount,
        maxForUser,
      });
    }

    return NextResponse.json({
      ok: true,
      tasks: filteredTasks,
    });
  } catch (e: any) {
    console.error("[XP] /api/xp/tasks/list error:", e);
    return NextResponse.json(
      {
        error: "SERVER_ERROR",
        message: String(e?.message ?? e),
      },
      { status: 500 }
    );
  }
}
