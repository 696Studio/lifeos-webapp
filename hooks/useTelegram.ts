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

    const tg = window.Telegram?.WebApp;
    if (!tg) return;

    // говорим Telegram, что WebApp готов
    tg.ready();
    setWebApp(tg);

    // initData — сырая строка, которую потом можно валидировать на бэке
    if (tg.initData) {
      setInitDataRaw(tg.initData as string);
    }

    // initDataUnsafe.user — объект с данными пользователя
    if (tg.initDataUnsafe?.user) {
      const u = tg.initDataUnsafe.user as TelegramUser;
      setUser(u);
      setUserId(String(u.id));
      setUsername(u.username ?? null);
    }
  }, []);

  const isTelegram = Boolean(webApp);

  // оставляем initData для обратной совместимости (это то же самое, что initDataRaw)
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
