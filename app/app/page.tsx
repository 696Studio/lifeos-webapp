"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    Telegram?: any;
  }
}

export default function AppPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;

    if (!tg) return;

    tg.ready();

    // Получаем данные пользователя из initData
    const initDataUnsafe = tg.initDataUnsafe;

    setUser(initDataUnsafe?.user || null);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-6">
      <h1 className="text-3xl font-bold mb-4">LifeOS WebApp</h1>

      {!user && <p>Открыть можно только через Telegram WebApp</p>}

      {user && (
        <div className="text-center">
          <p className="text-xl">Привет, {user.first_name}!</p>

          <div className="mt-4 p-4 border border-gray-700 rounded-xl">
            <p>User ID: {user.id}</p>
            <p>Username: @{user.username}</p>
          </div>
        </div>
      )}
    </div>
  );
}
