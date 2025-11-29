"use client";

import { useEffect, useState } from "react";
import type { TelegramUser } from "../lib/telegram";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: any;
    };
  }
}

export function useTelegram() {
  const [webApp, setWebApp] = useState<any | null>(null);
  const [user, setUser] = useState<TelegramUser | null>(null);

  // сырые данные от Telegram WebApp
  const [initDataRaw, setInitDataRaw] = useState<string>("");
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let attempts = 0;
    const maxAttempts = 50; // до ~5 секунд (50 * 100ms)

    const interval = setInterval(() => {
      const tg = window.Telegram?.WebApp;

      // Telegram WebApp ещё не проинициализировался — ждём
      if (!tg) {
        attempts += 1;
        if (attempts >= maxAttempts) {
          clearInterval(interval);
        }
        return;
      }

      // нашли WebApp — инициализируем и останавливаем таймер
      try {
        tg.ready();
      } catch (e) {
        // на всякий случай, чтобы ошибка не роняла эффект
        console.error("tg.ready() error:", e);
      }

      setWebApp(tg);

      if (tg.initData) {
        setInitDataRaw(tg.initData as string);
      }

      if (tg.initDataUnsafe?.user) {
        const u = tg.initDataUnsafe.user as TelegramUser;
        setUser(u);
        setUserId(String(u.id));
        setUsername(u.username ?? null);
      }

      clearInterval(interval);
    }, 100);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const isTelegram = Boolean(webApp);

  return {
    webApp,
    user,
    userId,
    username,
    initData: initDataRaw,
    initDataRaw,
    isTelegram,
  };
}
