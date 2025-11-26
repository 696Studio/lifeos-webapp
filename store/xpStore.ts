// store/xpStore.ts
import { create } from "zustand";
import { xpMockProfile } from "../lib/xpMockData";
import type { XpProfile } from "../types/xp";

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
  // timestamp последнего LEVEL UP — пока можем не использовать,
  // но он уже готов для эффектов на Home/Stats
  lastLevelUpAt: number | null;

  addXp: (amount: number, meta?: { source?: string; taskId?: string }) => void;
  completeTask: (taskId: string) => void;
  getLevel: () => number;
  getProgressPercent: () => number;
}

export const useXpStore = create<XpState>((set, get) => ({
  profile: initialProfile,
  lastLevelUpAt: null,

  // Начисление XP
  addXp: (amount, _meta) => {
    const prevLevel = get().profile.stats.level;

    // 1) обновляем профиль и пересчитываем статы
    set((state) => {
      const totalXp = state.profile.stats.totalXp + amount;
      const calc = calculateLevelStats(totalXp);

      return {
        profile: {
          ...state.profile,
          stats: {
            ...state.profile.stats,
            totalXp,
            level: calc.level,
            currentXp: calc.currentXp,
            nextLevelXp: calc.nextLevelXp,
          },
        },
      };
    });

    // 2) после обновления смотрим, вырос ли уровень
    const newLevel = get().profile.stats.level;
    if (newLevel > prevLevel) {
      set({ lastLevelUpAt: Date.now() });
    }
  },

  // Обновление задачи (статус + счётчик выполнений)
  completeTask: (taskId) =>
    set((state) => ({
      profile: {
        ...state.profile,
        tasks: state.profile.tasks.map((task) => {
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
        }),
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