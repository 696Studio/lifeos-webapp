import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

function generateTaskCode(title: string) {
  // простая генерация кода: PREFIX + random
  const base = title
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 12);

  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();

  const prefix = base || "TASK";
  return `${prefix}_${suffix}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const title = (body?.title ?? "").toString().trim();
    const description =
      body?.description != null ? String(body.description).trim() : null;
    const rewardXpRaw = body?.rewardXp;
    const deadlineAtRaw = body?.deadlineAt ?? null;
    const createdByRaw = body?.createdBy ?? null;

    if (!title) {
      return NextResponse.json(
        { error: "INVALID_BODY", message: "title is required" },
        { status: 400 }
      );
    }

    const rewardXp = Number(rewardXpRaw);
    if (!Number.isFinite(rewardXp) || rewardXp <= 0) {
      return NextResponse.json(
        {
          error: "INVALID_BODY",
          message: "rewardXp must be a positive number",
        },
        { status: 400 }
      );
    }

    let deadlineAt: string | null = null;
    if (deadlineAtRaw) {
      const d = new Date(deadlineAtRaw);
      if (isNaN(d.getTime())) {
        return NextResponse.json(
          {
            error: "INVALID_BODY",
            message: "deadlineAt must be a valid ISO date string",
          },
          { status: 400 }
        );
      }
      deadlineAt = d.toISOString();
    }

    const createdBy =
      createdByRaw != null && Number.isFinite(Number(createdByRaw))
        ? Number(createdByRaw)
        : null;

    const code = generateTaskCode(title);

    const { data, error } = await supabase
      .from("xp_tasks")
      .insert([
        {
          code,
          title,
          description,
          reward_xp: rewardXp,
          deadline_at: deadlineAt,
          created_by: createdBy,
          is_active: true,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("[Supabase] xp_tasks insert error:", error);
      return NextResponse.json(
        {
          error: "DB_ERROR",
          message: error.message,
        },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          error: "NO_DATA",
          message: "Task not returned after insert",
        },
        { status: 500 }
      );
    }

    const task = {
      id: data.id,
      code: data.code,
      title: data.title,
      description: data.description,
      rewardXp: data.reward_xp,
      deadlineAt: data.deadline_at,
      createdAt: data.created_at,
      createdBy: data.created_by,
      isActive: data.is_active,
    };

    return NextResponse.json({
      ok: true,
      task,
    });
  } catch (e: any) {
    console.error("[XP] /api/xp/tasks/create error:", e);
    return NextResponse.json(
      {
        error: "SERVER_ERROR",
        message: String(e?.message ?? e),
      },
      { status: 500 }
    );
  }
}
