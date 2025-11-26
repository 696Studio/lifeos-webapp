import { NextRequest, NextResponse } from "next/server";

// URL твоего Python-бота / backend-а, который реально решает,
// сколько XP выдать. Потом просто вынесем это в .env
const BACKEND_XP_URL = process.env.BACKEND_XP_URL || "";

// Ожидаемый формат ответа от бекэнда
type BackendXpResponse = {
  ok: boolean;
  awardedXp?: number;
  totalXp?: number;
  error?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const userId = body.userId as string | undefined;
    const initData = body.initData as string | undefined;
    const taskId = body.taskId as string | undefined;
    const amount = body.amount as number | undefined;

    if (!userId || !initData) {
      return NextResponse.json(
        { ok: false, error: "MISSING_AUTH_DATA" },
        { status: 400 }
      );
    }

    // Если настроен реальный backend — пробрасываем туда запрос
    if (BACKEND_XP_URL) {
      const backendRes = await fetch(BACKEND_XP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          initData,
          taskId,
          amount,
        }),
      });

      if (!backendRes.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: `BACKEND_HTTP_${backendRes.status}`,
          },
          { status: 502 }
        );
      }

      const data = (await backendRes.json()) as BackendXpResponse;

      if (!data.ok || typeof data.awardedXp !== "number") {
        return NextResponse.json(
          {
            ok: false,
            error: data.error || "BACKEND_NO_XP",
          },
          { status: 200 }
        );
      }

      // Пробрасываем ответ MiniApp-у
      return NextResponse.json(
        {
          ok: true,
          awardedXp: data.awardedXp,
          totalXp: data.totalXp,
        },
        { status: 200 }
      );
    }

    // 🔧 MOCK-режим, если ещё нет Python backend-а
    return NextResponse.json(
      {
        ok: true,
        awardedXp: 100,
        totalXp: undefined,
        mode: "mock",
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("XP API error:", e);
    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
