import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userIdRaw = searchParams.get("userId");

    if (!userIdRaw) {
      return NextResponse.json(
        { error: "INVALID_QUERY", message: "userId is required" },
        { status: 400 }
      );
    }

    const userId = Number(userIdRaw);

    if (!Number.isFinite(userId)) {
      return NextResponse.json(
        { error: "INVALID_QUERY", message: "userId must be a number" },
        { status: 400 }
      );
    }

    // 1) Забираем события XP
    const { data: events, error } = await supabase
      .from("xp_events")
      .select(
        `
        id,
        created_at,
        type,
        amount,
        source,
        task_id,
        level_from,
        level_to
      `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Supabase] xp_events fetch error:", error);
      return NextResponse.json(
        { error: "DB_ERROR", message: error.message },
        { status: 500 }
      );
    }

    const normalized = (events ?? []).map((ev) => ({
      id: ev.id,
      createdAt: ev.created_at,
      type: ev.type,
      amount: ev.amount,
      source: ev.source,
      taskId: ev.task_id,
      levelFrom: ev.level_from,
      levelTo: ev.level_to,
    }));

    return NextResponse.json({ events: normalized });
  } catch (e: any) {
    console.error("[XP] /api/xp/events error:", e);
    return NextResponse.json(
      {
        error: "SERVER_ERROR",
        message: String(e?.message ?? e),
      },
      { status: 500 }
    );
  }
}
