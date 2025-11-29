"use client";

import { useEffect, useState } from "react";
import Card from "../Card";
import { useTelegram } from "../../hooks/useTelegram";
import { useXpStore } from "../../store/xpStore";

type ApiEvent = {
  id: string;
  user_id: string;
  type: string;
  amount: number | null;
  source: string | null;
  task_id: string | null;
  level_from: number | null;
  level_to: number | null;
  created_at: string;
};

const TYPE_LABEL: Record<string, string> = {
  xp_gain: "+XP",
  task_completed: "Задача",
  level_up: "LEVEL UP",
};

export default function FeedPage() {
  const { userId, isTelegram } = useTelegram();
  const localEvents = useXpStore((s) => s.events);

  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // если нет Telegram или userId — просто остаёмся на локальных событиях
    if (!isTelegram || !userId) return;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/xp/feed?userId=${encodeURIComponent(userId)}`);
        const data = await res.json();
        setEvents(data.events ?? []);
      } catch (e) {
        console.error("XP FEED LOAD ERROR", e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isTelegram, userId]);

  // если есть данные из Supabase — показываем их; если нет — local fallback
  const listToRender = events.length > 0 ? events : [];

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
          XP История
        </h2>
        <p
          style={{
            fontSize: "14px",
            color: "#a0afb5",
            marginBottom: "20px",
          }}
        >
          Здесь появятся все ключевые события: получение XP, выполнение задач и
          переходы на новые уровни.
        </p>

        {!isTelegram && (
          <div
            style={{
              marginBottom: "16px",
              fontSize: "12px",
              color: "#f97373",
            }}
          >
            Открой Mini App внутри Telegram, чтобы видеть историю, привязанную к
            твоему аккаунту.
          </div>
        )}

        {loading && (
          <div
            style={{
              fontSize: "13px",
              color: "#9ca3af",
              marginBottom: "12px",
            }}
          >
            Загружаем события...
          </div>
        )}

        {listToRender.length === 0 && !loading && (
          <div
            style={{
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            Пока здесь пусто. Выполни пару задач или запроси XP, и история
            начнёт заполняться.
          </div>
        )}

        <div
          style={{
            marginTop: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {listToRender.map((ev) => {
            const label = TYPE_LABEL[ev.type] ?? ev.type;
            const date = new Date(ev.created_at);

            return (
              <div
                key={ev.id}
                style={{
                  padding: "10px 12px",
                  borderRadius: "12px",
                  background: "rgba(15, 23, 42, 0.9)",
                  border: "1px solid rgba(31, 41, 55, 0.9)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "13px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      marginBottom: "2px",
                    }}
                  >
                    {label}
                    {ev.amount != null && ev.amount > 0 && (
                      <span style={{ marginLeft: 6, color: "#22c55e" }}>
                        +{ev.amount} XP
                      </span>
                    )}
                  </div>
                  {ev.source && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#9ca3af",
                      }}
                    >
                      {ev.source}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#6b7280",
                  }}
                >
                  {date.toLocaleString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </main>
  );
}
