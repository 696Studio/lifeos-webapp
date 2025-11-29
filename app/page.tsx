"use client";

import { useEffect, useState } from "react";
import Card from "./Card";
import { useXpStore } from "../store/xpStore";
import { useRouter } from "next/navigation";
import { useTelegram } from "../hooks/useTelegram";

type TgUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

export default function HomePage() {
  const router = useRouter();
  const { userId, initDataRaw, isTelegram } = useTelegram();

  // данные из стора
  const level = useXpStore((s) => s.getLevel());
  const progressPercent = useXpStore((s) => s.getProgressPercent());
  const stats = useXpStore((s) => s.profile.stats);

  const currentXP = stats.currentXp;
  const nextLevelXP = stats.nextLevelXp;
  const totalXP = stats.totalXp;

  // триггер Level Up
  const lastLevelUpAt = useXpStore((s) => s.lastLevelUpAt);
  const [flash, setFlash] = useState(false);

  // статус синхронизации профиля (для отладки)
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "pending" | "ok" | "error"
  >("idle");

  // из стора: userId + гидрация профиля
  const setStoreUserId = useXpStore((s) => s.setUserId);
  const hydrateFromServer = useXpStore((s) => s.hydrateFromServer);

  // 🔹 Данные пользователя Telegram (аватар + ник)
  const [tgUser, setTgUser] = useState<TgUser | null>(null);

  useEffect(() => {
    if (!lastLevelUpAt) return;

    setFlash(true);
    const t = setTimeout(() => setFlash(false), 800);

    return () => clearTimeout(t);
  }, [lastLevelUpAt]);

  // 🔗 Кладём Telegram userId в xpStore, чтобы события шли с реальным ID
  useEffect(() => {
    if (!isTelegram) return;
    if (!userId) return;
    setStoreUserId(String(userId));
  }, [isTelegram, userId, setStoreUserId]);

  // 🔹 Читаем данные юзера из Telegram WebApp (для аватарки и ника)
  useEffect(() => {
    if (!isTelegram) return;
    if (typeof window === "undefined") return;

    try {
      const anyWindow = window as any;
      const tg = anyWindow.Telegram?.WebApp;
      const user: TgUser | undefined = tg?.initDataUnsafe?.user;
      if (user) {
        setTgUser(user);
      }
    } catch (e) {
      console.error("Failed to read Telegram user", e);
    }
  }, [isTelegram]);

  const displayName =
    tgUser?.username ||
    [tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(" ") ||
    "Telegram user";

  // 🔐 Синхронизация профиля в Supabase по Telegram userId + гидрация стора
  // + отправляем telegramUsername в бэкенд
  useEffect(() => {
    // если не в Telegram — не дёргаем API
    if (!isTelegram) return;
    // ждём пока приедет userId и initDataRaw
    if (!userId || !initDataRaw) return;
    // базовая защита от пустых статов
    if (totalXP == null || level == null) return;

    const telegramUsername = tgUser?.username ?? null;

    const syncProfile = async () => {
      try {
        setSyncStatus("pending");

        const res = await fetch("/api/xp/profile/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            initData: initDataRaw,
            telegramUsername,
            stats: {
              totalXp: totalXP,
              level,
              currentXp: currentXP,
              nextLevelXp: nextLevelXP,
            },
          }),
        });

        const data: any = await res.json().catch(() => null);

        if (!res.ok) {
          console.error(
            "XP profile sync failed:",
            res.status,
            res.statusText,
            data
          );
          setSyncStatus("error");
          return;
        }

        setSyncStatus("ok");

        // 🧠 Если бэк вернул stats/профиль — гидрируем стор, чтобы XP не сбрасывался
        if (data) {
          const statsFromServer =
            data.stats ??
            data.profile?.stats ??
            data.profileStats ??
            null;

          const tasksFromServer =
            data.tasks ??
            data.profile?.tasks ??
            null;

          if (statsFromServer && typeof statsFromServer.totalXp === "number") {
            hydrateFromServer({
              totalXp: statsFromServer.totalXp,
              level: statsFromServer.level,
              currentXp: statsFromServer.currentXp,
              nextLevelXp: statsFromServer.nextLevelXp,
              tasks: tasksFromServer ?? undefined,
            });
          }
        }
      } catch (err) {
        console.error("Failed to sync XP profile", err);
        setSyncStatus("error");
      }
    };

    syncProfile();
  }, [
    isTelegram,
    userId,
    initDataRaw,
    totalXP,
    level,
    currentXP,
    nextLevelXP,
    hydrateFromServer,
    tgUser,
  ]);

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
        {/* 🔹 Блок профиля пользователя Telegram */}
        {isTelegram && tgUser && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "999px",
                overflow: "hidden",
                background:
                  "linear-gradient(135deg, rgba(0,229,255,0.15), rgba(0,179,255,0.05))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid rgba(148, 163, 184, 0.4)",
              }}
            >
              {tgUser.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tgUser.photo_url}
                  alt={displayName}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <span
                  style={{
                    fontSize: "18px",
                    fontWeight: 600,
                    color: "#e5edf5",
                  }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#e5edf5",
                }}
              >
                {displayName}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  color: "rgba(148, 163, 184, 0.9)",
                }}
              >
                Ваш профиль в Telegram
              </span>
            </div>
          </div>
        )}

        <h2 style={{ fontSize: "24px", marginBottom: "8px" }}>
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
        <div style={{ marginBottom: "16px" }}>
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

        {/* Кнопки */}
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

        {/* 🔍 DEBUG-блок — временно, чтобы понять, что происходит в Telegram */}
        <div
          style={{
            marginTop: "20px",
            paddingTop: "10px",
            borderTop: "1px solid rgba(148, 163, 184, 0.2)",
            fontSize: "11px",
            color: "#64748b",
          }}
        >
          <div>DEBUG:</div>
          <div>isTelegram: {String(isTelegram)}</div>
          <div>userId: {userId ?? "null"}</div>
          <div>syncStatus: {syncStatus}</div>
        </div>
      </Card>
    </main>
  );
}
