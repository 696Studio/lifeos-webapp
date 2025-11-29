// app/api/xp/events/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const event = body?.event;

    console.log("📩 EVENT RECEIVED:", event);

    if (!event || event.userId == null || !event.type) {
      return NextResponse.json(
        {
          error: "BAD_REQUEST",
          message: "event.userId and event.type required",
        },
        { status: 400 }
      );
    }

    const numericUserId = Number(event.userId);
    if (!Number.isFinite(numericUserId)) {
      return NextResponse.json(
        {
          error: "INVALID_USER_ID",
          message: "event.userId must be a number (Telegram user id)",
        },
        { status: 400 }
      );
    }

    // Если из стора прилетает createdAt (timestamp), конвертим в ISO
    let createdAt: string | undefined = undefined;
    if (event.createdAt) {
      const d = new Date(event.createdAt);
      if (!isNaN(d.getTime())) {
        createdAt = d.toISOString();
      }
    }

    const payload: any = {
      user_id: numericUserId, // тут лежит реальный Telegram ID
      type: event.type,
      amount: event.amount ?? null,
      source: event.source ?? null,
      task_id: event.taskId ?? null,
      level_from: event.levelFrom ?? null,
      level_to: event.levelTo ?? null,
    };

    if (createdAt) {
      payload.created_at = createdAt;
    }

    const { data, error } = await supabase
      .from("xp_events")
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error("❌ Supabase insert error:", error);
      return NextResponse.json(
        { error: "DB_ERROR", message: error.message },
        { status: 500 }
      );
    }

    console.log("✅ EVENT SAVED:", data?.id ?? data);

    return NextResponse.json({ ok: true, eventId: data?.id ?? null });
  } catch (e: any) {
    console.error("❌ API ERROR", e);
    return NextResponse.json(
      {
        error: "SERVER_ERROR",
        message: String(e?.message ?? e),
      },
      { status: 500 }
    );
  }
}
