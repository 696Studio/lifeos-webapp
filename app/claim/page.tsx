"use client";

import { useState } from "react";
import Card from "../Card";
import { useXpStore } from "../../store/xpStore";
import { useTelegram } from "../../hooks/useTelegram";

export default function ClaimPage() {
  const stats = useXpStore((s) => s.profile.stats);
  const addXp = useXpStore((s) => s.addXp);
  const { userId, initDataRaw } = useTelegram();

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [awardedXp, setAwardedXp] = useState<number | null>(null);

  const handleClaim = async () => {
    if (loading) return;

    setLoading(true);
    setStatus("idle");
    setMessage(null);
    setAwardedXp(null);

    try {
      const res = await fetch("/api/xp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId ?? "mock-user-001",
          initData: initDataRaw ?? "LOCAL_DEV", // в Telegram тут будет реальная строка
        }),
      });

      const data = await res.json();
      console.log("XP CLAIM API RESPONSE:", data);

      if (data?.ok && typeof data.awardedXp === "number") {
        addXp(data.awardedXp, {
          source: "server",
          taskId: "claim-api",
        });

        setAwardedXp(data.awardedXp);
        setStatus("success");
        setMessage(`+${data.awardedXp} XP зачислено на аккаунт`);
      } else {
        setStatus("error");
        setMessage("Сервер не выдал XP. Попробуй ещё раз позже.");
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
      setMessage("Ошибка запроса. Проверь соединение и повтори попытку.");
    } finally {
      setLoading(false);
    }
  };

  const buttonLabel =
    status === "success"
      ? "XP зачислен"
      : loading
      ? "Запрос..."
      : "Получить XP с сервера";

  return (
    <main
      style={{
        minHeight: "calc(100vh - 80px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "40px 16px",
      }}
    >
      <Card>
        <h2
          style={{
            fontSize: "24px",
            marginBottom: "8px",
          }}
        >
          Получить XP
        </h2>

        <p
          style={{
            fontSize: "14px",
            color: "#a0afb5",
            marginBottom: "20px",
          }}
        >
          В Telegram Mini App сюда придёт подтверждение от бота.
          Сейчас — тестовый запрос через API.
        </p>

        {/* Блок текущего статуса аккаунта */}
        <div
          style={{
            marginBottom: "20px",
            fontSize: "13px",
            color: "#7b8a90",
            padding: "12px 14px",
            borderRadius: "14px",
            background: "rgba(15, 23, 42, 0.9)",
            border: "1px solid rgba(148, 163, 184, 0.35)",
          }}
        >
          <div
            style={{
              marginBottom: "4px",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Уровень</span>
            <b>Lvl {stats.level}</b>
          </div>
          <div
            style={{
              marginBottom: "4px",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Всего XP</span>
            <b>{stats.totalXp.toLocaleString("ru-RU")} XP</b>
          </div>
          <div
            style={{
              marginTop: "4px",
              display: "flex",
              justifyContent: "space-between",
              fontSize: "12px",
              opacity: 0.9,
            }}
          >
            <span>userId</span>
            <span>{userId ?? "mock-user-001"}</span>
          </div>
        </div>

        {/* Сообщение о статусе Claim */}
        {status !== "idle" && message && (
          <div
            style={{
              marginBottom: "16px",
              fontSize: "13px",
              padding: "10px 12px",
              borderRadius: "12px",
              background:
                status === "success"
                  ? "rgba(22, 163, 74, 0.12)"
                  : "rgba(239, 68, 68, 0.08)",
              border:
                status === "success"
                  ? "1px solid rgba(34, 197, 94, 0.5)"
                  : "1px solid rgba(248, 113, 113, 0.5)",
              color: status === "success" ? "#bbf7d0" : "#fecaca",
              textAlign: "center",
            }}
          >
            {message}
          </div>
        )}

        {/* Кнопка Claim */}
        <button
          onClick={handleClaim}
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px 16px",
            borderRadius: "999px",
            border: "none",
            cursor: loading ? "default" : "pointer",
            background:
              status === "success"
                ? "linear-gradient(90deg, #22c55e, #16a34a)"
                : loading
                ? "linear-gradient(90deg, #6b7280, #4b5563)"
                : "linear-gradient(90deg, #22c55e, #16a34a)",
            color: "#020b10",
            fontWeight: 600,
            fontSize: "14px",
            boxShadow:
              status === "success"
                ? "0 0 18px rgba(34, 197, 94, 0.55)"
                : "0 0 18px rgba(34, 197, 94, 0.45)",
            transition:
              "background 0.15s ease-out, box-shadow 0.15s ease-out, transform 0.08s ease-out",
            transform: loading ? "scale(1)" : "scale(1.01)",
          }}
        >
          {buttonLabel}
        </button>

        {awardedXp !== null && status === "success" && (
          <p
            style={{
              marginTop: "10px",
              fontSize: "12px",
              color: "#6ee7b7",
              textAlign: "center",
            }}
          >
            Твой баланс и уровень уже обновлены на главной и в статистике.
          </p>
        )}
      </Card>
    </main>
  );
}
