// app/api/xp/tasks/route.ts
import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("xp_tasks")
      .select("*")
      .in("status", ["active", "locked"])
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[Supabase] xp_tasks fetch error", error);
      return NextResponse.json(
        { error: "DB_ERROR", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ tasks: data ?? [] });
  } catch (e: any) {
    console.error("[API] /api/xp/tasks error", e);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}