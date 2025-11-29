// app/api/xp/events/route.ts
import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const event = body.event;

    console.log("📩 EVENT RECEIVED:", event);

    if (!event || !event.userId || !event.type) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "event.userId and event.type required" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("xp_events").insert([
      {
        user_id: event.userId,
        type: event.type,
        amount: event.amount ?? null,
        source: event.source ?? null,
        task_id: event.taskId ?? null,
        level_from: event.levelFrom ?? null,
        level_to: event.levelTo ?? null,
      },
    ]);

    if (error) {
      console.error("❌ Supabase insert error:", error);
      return NextResponse.json({ error: "DB_ERROR", message: error.message }, { status: 500 });
    }

    console.log("✅ EVENT SAVED");

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("❌ API ERROR", e);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: e.message },
      { status: 500 }
    );
  }
}