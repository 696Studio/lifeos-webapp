import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    // можешь позже передавать фильтры из бота
    const body = await req.json().catch(() => ({} as any));
    const includeInactive = body?.includeInactive ?? false;
    const category = body?.category ?? null;

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
        category
      `
      )
      .order("created_at", { ascending: false });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }
    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[Supabase] xp_tasks list error:", error);
      return NextResponse.json(
        { error: "DB_ERROR", message: error.message },
        { status: 500 }
      );
    }

    const tasks =
      data?.map((row) => ({
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
      })) ?? [];

    return NextResponse.json({
      ok: true,
      tasks,
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
