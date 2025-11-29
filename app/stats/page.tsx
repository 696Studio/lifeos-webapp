"use client";

import { useEffect, useState } from "react";
import { useXpStore } from "../../store/xpStore";

export default function StatsPage() {
  const level = useXpStore((s) => s.getLevel());
  const progressPercent = useXpStore((s) => s.getProgressPercent());
  const stats = useXpStore((s) => s.profile.stats);
  const tasks = useXpStore((s) => s.profile.tasks) || [];
  const trophies = useXpStore((s) => s.profile.trophies) || [];
  const lastLevelUpAt = useXpStore((s) => s.lastLevelUpAt);

  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!lastLevelUpAt) return;

    setFlash(true);
    const t = setTimeout(() => setFlash(false), 800);
    return () => clearTimeout(t);
  }, [lastLevelUpAt]);

  const currentXP = stats?.currentXp ?? 0;
  const nextLevelXP = stats?.nextLevelXp ?? 0;
  const totalXP = stats?.totalXp ?? 0;

  const tasksCompleted = tasks.filter((t: any) => t.status === "completed")
    .length;
  const trophiesUnlocked = trophies.filter((t: any) => t.unlockedAt).length;

  const barGlowStyle = flash
    ? {
        boxShadow:
          "0 0 20px rgba(0, 229, 255, 0.7), 0 0 40px rgba(0, 179, 255, 0.6)",
      }
    : undefined;

  return (
    <div className="min-h-screen bg-[#050509] text-white">
      <div className="px-4 pt-6 pb-4">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Stats
          </p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight">
            Твой прогресс
            <br />
            в экосистеме LifeOS
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Следи за уровнем, XP и трофеями, которые ты уже открыл.
          </p>
        </div>

        <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-slate-900 to-slate-950 p-4 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400">Текущий уровень</p>
              <p className="text-xl font-semibold">Level {level}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-400">Прогресс уровня</p>
              <p className="text-sm font-mono text-zinc-100">
                {progressPercent.toFixed(0)}%
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-zinc-200">XP</span>
            {/* прогрессбар один в один как на Home, + подсветка */}
            <div
              style={{
                width: "100%",
                height: "10px",
                borderRadius: "999px",
                background: "#11181c",
                overflow: "hidden",
                ...barGlowStyle,
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
            <span className="text-xs text-zinc-400">
              {totalXP.toLocaleString("ru-RU")} XP
            </span>
          </div>

          <p className="mt-2 text-[11px] text-zinc-400">
            Когда шкала заполнится, ты перейдёшь на новый уровень и откроешь
            новые награды.
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Сейчас: {currentXP} / {nextLevelXP} XP до следующего уровня.
          </p>
        </div>
      </div>

      <div className="space-y-6 px-4 pb-24">
        <section>
          <h2 className="mb-2 text-sm font-medium text-zinc-100">
            Общая статистика
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/5 bg-zinc-950/70 px-3 py-3">
              <div className="text-xl font-semibold">{tasksCompleted}</div>
              <div className="mt-1 text-[11px] text-zinc-400">
                задач
                <br />
                выполнено
              </div>
            </div>
            <div className="rounded-2xl border border-amber-500/30 bg-amber-950/40 px-3 py-3">
              <div className="text-xl font-semibold">{trophiesUnlocked}</div>
              <div className="mt-1 text-[11px] text-amber-100/80">
                трофеев
                <br />
                открыто
              </div>
            </div>
            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/40 px-3 py-3">
              <div className="text-xl font-semibold">
                {totalXP.toLocaleString("ru-RU")}
              </div>
              <div className="mt-1 text-[11px] text-cyan-100/80">
                XP
                <br />
                накоплено
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-medium text-zinc-100">
            Дальше здесь появятся графики
          </h2>
          <div className="rounded-2xl border border-white/5 bg-zinc-950/60 px-4 py-4 text-xs text-zinc-400">
            Здесь позже добавим:
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>динамику XP по дням и неделям;</li>
              <li>распределение XP по типам задач (invite / learn / stream);</li>
              <li>ленту ключевых событий: LEVEL UP, трофеи, крупные награды.</li>
            </ul>
            <p className="mt-2">
              Сейчас главное — ты уже видишь свой базовый прогресс и можешь
              отслеживать рост.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
