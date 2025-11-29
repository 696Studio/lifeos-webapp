"use client";

import Card from "../Card";
import { useXpStore } from "../../store/xpStore";

export default function ClaimPage() {
  const stats = useXpStore((s) => s.profile.stats);

  const level = stats.level;
  const totalXp = stats.totalXp;
  const currentXp = stats.currentXp;
  const nextLevelXp = stats.nextLevelXp;

  const handleOpenBot = () => {
    // Открываем бота в новом окне/табе
    if (typeof window !== "undefined") {
      window.open("https://t.me/Lifeos_webapp_bot", "_blank");
    }
  };

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
          Получить награды
        </h2>

        <p
          style={{
            fontSize: "14px",
            color: "#a0afb5",
            marginBottom: "20px",
          }}
        >
          Здесь ты подтверждаешь действия и получаешь реальные XP через бота
          LifeOS. Всё просто: сделал — отправил — получил.
        </p>

        {/* Блок текущего статуса аккаунта */}
        <section
          style={{
            marginBottom: "20px",
            padding: "14px 16px",
            borderRadius: "18px",
            background: "rgba(15, 23, 42, 0.95)",
            border: "1px solid rgba(148, 163, 184, 0.35)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "6px",
              fontSize: "13px",
              color: "#7b8a90",
            }}
          >
            <span>Текущий уровень</span>
            <span>Прогресс уровня</span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <span
              style={{
                fontSize: "18px",
                fontWeight: 600,
                color: "#e5f2ff",
              }}
            >
              Level {level}
            </span>
            <span
              style={{
                fontSize: "14px",
                color: "#e5f2ff",
              }}
            >
              {currentXp} / {nextLevelXp} XP
            </span>
          </div>

          <div
            style={{
              width: "100%",
              height: "8px",
              borderRadius: "999px",
              background: "#11181c",
              overflow: "hidden",
              marginBottom: "6px",
            }}
          >
            <div
              style={{
                width:
                  nextLevelXp > 0
                    ? `${Math.min(100, (currentXp / nextLevelXp) * 100)}%`
                    : "100%",
                height: "100%",
                background: "linear-gradient(90deg, #22c55e, #4ade80)",
                transition: "width 0.2s ease-out",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "12px",
              color: "#7b8a90",
            }}
          >
            <span>Всего опыта</span>
            <span>{totalXp.toLocaleString("ru-RU")} XP</span>
          </div>
        </section>

        {/* Как работает Claim */}
        <section
          style={{
            marginBottom: "20px",
            fontSize: "13px",
            color: "#cbd5f5",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#6b7b84",
              marginBottom: "8px",
            }}
          >
            Как получить XP
          </div>

          <ol
            style={{
              listStyle: "decimal",
              paddingLeft: "18px",
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <li>
              Выполни задания во вкладке{" "}
              <span style={{ fontWeight: 500 }}>Earn</span> —
              приглашения, стримы, идеи, помощь.
            </li>
            <li>
              Собери доказательства: скрины, ссылки, чекбэки, любые подтверждения
              того, что ты реально сделал.
            </li>
            <li>
              Напиши боту{" "}
              <span style={{ fontWeight: 500 }}>@Lifeos_webapp_bot</span> и
              отправь свои доказательства.
            </li>
            <li>
              После проверки админом XP будут зачислены на твой аккаунт и
              моментально отобразятся в Home / Earn / Stats.
            </li>
          </ol>
        </section>

        {/* Кнопка перехода к боту */}
        <button
          onClick={handleOpenBot}
          style={{
            width: "100%",
            padding: "14px 16px",
            borderRadius: "999px",
            border: "none",
            cursor: "pointer",
            background: "linear-gradient(90deg, #22c55e, #16a34a)",
            color: "#020b10",
            fontWeight: 600,
            fontSize: "14px",
            boxShadow: "0 0 18px rgba(34, 197, 94, 0.55)",
            transition:
              "background 0.15s ease-out, box-shadow 0.15s ease-out, transform 0.08s ease-out",
          }}
        >
          Открыть бота и запросить XP
        </button>

        <p
          style={{
            marginTop: "10px",
            fontSize: "12px",
            color: "#7b8a90",
            textAlign: "center",
          }}
        >
          После подтверждения XP автоматически попадут в твою систему и
          поднимут уровень.
        </p>
      </Card>
    </main>
  );
}