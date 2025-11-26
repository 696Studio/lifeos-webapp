"use client";

import { useEffect, useState } from "react";
import Card from "../Card";
import { useXpStore } from "../../store/xpStore";

export default function StatsPage() {
  const level = useXpStore((s) => s.getLevel());
  const progressPercent = useXpStore((s) => s.getProgressPercent());
  const stats = useXpStore((s) => s.profile.stats);
  const tasks = useXpStore((s) => s.profile.tasks);
  const trophies = useXpStore((s) => s.profile.trophies);

  const totalXP = stats.totalXp;
  const tasksCompleted = tasks.filter((t) => t.status === "completed").length;
  const trophiesUnlocked = trophies.filter((t) => t.unlockedAt).length;

  // ⚡ триггер LEVEL UP из стора
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
        {/* Заголовок */}
        <h2
          style={{
            fontSize: "24px",
            marginBottom: "8px",
          }}
        >
          Статистика
        </h2>
        <p
          style={{
            fontSize: "14px",
            color: "#a0afb5",
            marginBottom: "24px",
          }}
        >
          Ваш прогресс в экосистеме LifeOS.
        </p>

        {/* Блок профиля */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "24px",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 30% 30%, #00ffff, #001518 70%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "20px",
              color: "white",
            }}
          >
            B
          </div>
          <div>
            <div
              style={{
                fontSize: "16px",
                fontWeight: 600,
              }}
            >
              Blessed696
            </div>
            <div
              style={{
                fontSize: "13px",
                color: "#7b8a90",
              }}
            >
              @blessedboy_696
            </div>
          </div>
        </div>

        {/* Цифры */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "28px",
                fontWeight: 600,
              }}
            >
              {tasksCompleted}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "#7b8a90",
              }}
            >
              задач выполнено
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: "28px",
                fontWeight: 600,
              }}
            >
              {trophiesUnlocked}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "#7b8a90",
              }}
            >
              трофеев
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: "28px",
                fontWeight: 600,
              }}
            >
              {totalXP.toLocaleString("ru-RU")}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "#7b8a90",
              }}
            >
              XP всего
            </div>
          </div>
        </div>

        {/* Прогрессбар уровня */}
        <div style={{ marginBottom: "8px" }}>
          <div
            style={{
              fontSize: "13px",
              color: "#a0afb5",
              marginBottom: "4px",
            }}
          >
            Уровень
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span
              style={{
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              Lvl {level}
            </span>
            <div
              style={{
                flex: 1,
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
            <span
              style={{
                fontSize: "12px",
                color: "#7b8a90",
              }}
            >
              {totalXP.toLocaleString("ru-RU")} XP
            </span>
          </div>
        </div>
      </Card>
    </main>
  );
}
