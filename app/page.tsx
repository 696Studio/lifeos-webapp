"use client";

import { useEffect, useState } from "react";
import Card from "./Card";
import { useXpStore } from "../store/xpStore";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  // данные из стора
  const level = useXpStore((s) => s.getLevel());
  const progressPercent = useXpStore((s) => s.getProgressPercent());
  const stats = useXpStore((s) => s.profile.stats);

  const currentXP = stats.currentXp;
  const nextLevelXP = stats.nextLevelXp;
  const totalXP = stats.totalXp;

  // ❗ триггер Level Up
  const lastLevelUpAt = useXpStore((s) => s.lastLevelUpAt);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!lastLevelUpAt) return;

    setFlash(true);
    const t = setTimeout(() => setFlash(false), 800);

    return () => clearTimeout(t);
  }, [lastLevelUpAt]);

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
          LifeOS XP System
        </h2>
        <p
          style={{
            color: "rgba(148, 163, 184, 0.9)",
            fontSize: "14px",
            marginBottom: "24px",
          }}
        >
          Ваш уровень в экосистеме LifeOS.
        </p>

        {/* Уровень + прогресс */}
        <div
          style={{
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "6px",
              fontSize: "13px",
            }}
          >
            <span>Уровень {level}</span>
            <span>
              {currentXP} / {nextLevelXP} XP
            </span>
          </div>

          {/* ⚡ Прогрессбар со вспышкой при Level Up */}
          <div
            style={{
              width: "100%",
              height: "10px",
              borderRadius: "999px",
              background: "#11181c",
              overflow: "hidden",
              boxShadow: flash
                ? "0 0 20px rgba(0, 229, 255, 0.7), 0 0 40px rgba(0, 179, 255, 0.6)"
                : "none",
              transition: "box-shadow 0.25s ease-out",
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: "100%",
                background: "linear-gradient(90deg, #00ffff, #00c6ff)",
                transition: "width 0.2s ease-out",
              }}
            />
          </div>

          <div
            style={{
              marginTop: "6px",
              fontSize: "12px",
              color: "#7b8a90",
            }}
          >
            Всего: {totalXP.toLocaleString("ru-RU")} XP
          </div>
        </div>

        {/* Кнопки действий */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            marginTop: "16px",
          }}
        >
          <button
            onClick={() => router.push("/earn")}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: "999px",
              border: "none",
              cursor: "pointer",
              background: "linear-gradient(90deg, #00e5ff, #00b3ff)",
              color: "#020b10",
              fontWeight: 600,
              fontSize: "14px",
              boxShadow: "0 0 20px rgba(0, 229, 255, 0.45)",
            }}
          >
            Заработать XP
          </button>

          <button
            onClick={() => router.push("/claim")}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: "999px",
              border: "1px solid rgba(148, 163, 184, 0.4)",
              background: "rgba(9, 12, 20, 0.95)",
              cursor: "pointer",
              color: "#e5edf5",
              fontWeight: 500,
              fontSize: "14px",
            }}
          >
            Получить XP (через бота)
          </button>
        </div>
      </Card>
    </main>
  );
}
