// store/xpStore.ts
import { create } from "zustand";
import { xpMockProfile } from "../lib/xpMockData";
import type { XpProfile } from "../types/xp";

// ------------------------------------------------------------------
// Вспомогательные типы и функции
// ------------------------------------------------------------------

export type XpEventType = "xp_gain" | "task_completed" | "level_up";

export interface XpEvent {
  id: string;
  type: XpEventType;
  createdAt: number; // timestamp
  amount?: number; // сколько XP
  source?: string; // категория (invite / stream / learn / ...)
  taskId?: string; // если событие связано с задачей
  levelFrom?: number;
  levelTo?: number;
}

type AddXpMeta = {
  source?: string;
  taskId?: string;
};

// ⚠️ Пока жёстко мок: позже сюда подставим реальный Telegram userId
const DEFAULT_USER_ID = "testuser123";

function makeId() {
  return (
    Math.random().toString(36).substring(2) + Date.now().toString(36)
  );
}

// отправка события в наш API, который пишет в Supabase
async function postXpEventToServer(event: {
  userId: string;
  type: XpEventType | string;
  amount?: number;
  source?: string;
  taskId?: string;
  levelFrom?: number;
  levelTo?: number;
}) {
  try {
    if (typeof window === "undefined") return; // только на клиенте
    await fetch("/api/xp/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
    });
  } catch (e) {
    console.error("[XP] failed to send event to server", e);
  }
}

// Функция, которая по totalXp считает:
// - текущий уровень
// - сколько XP внутри этого уровня
// - сколько нужно до следующего уровня
// - прогресс в процентах
function calculateLevelStats(totalXp: number) {
  let level = 1;
  let xpForNextLevel = 500; // XP для перехода с 1 -> 2 уровня
  let xpPool = totalXp;

  // Пока хватает XP на следующий уровень — повышаем
  while (xpPool >= xpForNextLevel) {
    xpPool -= xpForNextLevel;
    level++;
    xpForNextLevel = 500 * level; // можно менять формулу роста
  }

  const currentXp = xpPool;
  const nextLevelXp = xpForNextLevel;
  const progressPercent =
    nextLevelXp === 0 ? 100 : Math.min(100, (currentXp / nextLevelXp) * 100);

  return {
    level,
    currentXp,
    nextLevelXp,
    progressPercent,
  };
}

// Формируем стартовый профиль с пересчитанными полями
const initialProfile: XpProfile = (() => {
  const base: XpProfile = {
    ...xpMockProfile,
    stats: { ...xpMockProfile.stats },
    tasks: [...xpMockProfile.tasks],
  };

  const calc = calculateLevelStats(base.stats.totalXp);
  base.stats.level = calc.level;
  base.stats.currentXp = calc.currentXp;
  base.stats.nextLevelXp = calc.nextLevelXp;

  return base;
})();

interface XpState {
  profile: XpProfile;
  // timestamp последнего LEVEL UP
  lastLevelUpAt: number | null;

  // Лента XP-событий (для /feed и аналитики — локальная)
  events: XpEvent[];

  addXp: (amount: number, meta?: AddXpMeta) => void;
  completeTask: (taskId: string) => void;

  // подменить список задач данными с бэка
  setTasksFromDb: (tasks: XpProfile["tasks"]) => void;

  getLevel: () => number;
  getProgressPercent: () => number;
}

export const useXpStore = create<XpState>((set, get) => ({
  profile: initialProfile,
  lastLevelUpAt: null,
  events: [],

  // Начисление XP + генерация событий
  addXp: (amount, meta) => {
    const prev = get();
    const prevStats = prev.profile.stats;
    const prevLevel = prevStats.level;

    const totalXp = prevStats.totalXp + amount;
    const calc = calculateLevelStats(totalXp);

    const now = Date.now();

    const nextEvents: XpEvent[] = [
      ...prev.events,
      {
        id: makeId(),
        type: "xp_gain",
        createdAt: now,
        amount,
        source: meta?.source,
        taskId: meta?.taskId,
      },
    ];

    let lastLevelUpAt = prev.lastLevelUpAt;

    // если уровень вырос — фиксируем LEVEL UP событие
    if (calc.level > prevLevel) {
      lastLevelUpAt = now;
      nextEvents.push({
        id: makeId(),
        type: "level_up",
        createdAt: now,
        amount,
        source: meta?.source,
        taskId: meta?.taskId,
        levelFrom: prevLevel,
        levelTo: calc.level,
      });
    }

    // обновляем стейт
    set({
      profile: {
        ...prev.profile,
        stats: {
          ...prev.profile.stats,
          totalXp,
          level: calc.level,
          currentXp: calc.currentXp,
          nextLevelXp: calc.nextLevelXp,
        },
      },
      lastLevelUpAt,
      events: nextEvents,
    });

    // 🔥 отправляем события в Supabase через наш API
    postXpEventToServer({
      userId: DEFAULT_USER_ID,
      type: "xp_gain",
      amount,
      source: meta?.source,
      taskId: meta?.taskId,
    });

    if (calc.level > prevLevel) {
      postXpEventToServer({
        userId: DEFAULT_USER_ID,
        type: "level_up",
        amount,
        source: meta?.source,
        taskId: meta?.taskId,
        levelFrom: prevLevel,
        levelTo: calc.level,
      });
    }
  },

  // Обновление задачи (статус + счётчик выполнений) + событие
  completeTask: (taskId) => {
    const prev = get();
    const targetTask = prev.profile.tasks.find((t) => t.id === taskId) as
      | (typeof prev.profile.tasks)[number]
      | undefined;
    const now = Date.now();

    set((state) => {
      const updatedTasks = state.profile.tasks.map((task) => {
        if (task.id !== taskId) return task;

        const timesCompleted = (task.timesCompleted ?? 0) + 1;

        let status = task.status;
        if (
          task.maxRepeats !== undefined &&
          timesCompleted >= task.maxRepeats
        ) {
          status = "completed";
        }

        return {
          ...task,
          timesCompleted,
          status,
        };
      });

      const events = [...state.events];

      if (targetTask) {
        events.push({
          id: makeId(),
          type: "task_completed",
          createdAt: now,
          amount: targetTask.xp,
          source: targetTask.category,
          taskId: targetTask.id,
        });
      }

      return {
        profile: {
          ...state.profile,
          tasks: updatedTasks,
        },
        events,
      };
    });

    // 🔥 отправляем task_completed в Supabase
    if (targetTask) {
      postXpEventToServer({
        userId: DEFAULT_USER_ID,
        type: "task_completed",
        amount: targetTask.xp,
        source: targetTask.category,
        taskId: targetTask.id,
      });
    }
  },

  // Подменяем список задач данными с Supabase/бэка
  setTasksFromDb: (tasks) =>
    set((state) => ({
      profile: {
        ...state.profile,
        tasks,
      },
    })),

  // Уровень для UI
  getLevel: () => {
    return get().profile.stats.level;
  },

  // Процент прогресса для прогрессбаров
  getProgressPercent: () => {
    const { currentXp, nextLevelXp } = get().profile.stats;
    if (!nextLevelXp) return 0;
    return Math.min(100, (currentXp / nextLevelXp) * 100);
  },
}));
