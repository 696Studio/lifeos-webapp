"use client";

import { useEffect, useState } from "react";
import { telegram } from "../lib/telegram";

export function useTelegram() {
  const [user, setUser] = useState<any>(null);
  const [initDataRaw, setInitDataRaw] = useState<string | null>(null);

  useEffect(() => {
    if (!telegram) return;

    // initData — строка, которую потом нужно проверять на бэкенде
    // initDataUnsafe — уже распарсенный объект
    const unsafe = (telegram as any).initDataUnsafe;
    const raw = (telegram as any).initData as string | undefined;

    if (unsafe?.user) {
      setUser(unsafe.user);
    }
    if (raw) {
      setInitDataRaw(raw);
    }
  }, []);

  return {
    user,
    userId: user?.id,
    username: user?.username,
    firstName: user?.first_name,
    lastName: user?.last_name,
    avatar: user?.photo_url,
    initDataRaw, // <- важное поле для сервера
  };
}
